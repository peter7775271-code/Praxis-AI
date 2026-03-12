import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

/**
 * Expected input format (line-based):
 *
 *   GRADE Year 12
 *   TOPIC Complex Numbers
 *   SUBTOPIC Cartesian Form
 *   POINT_1 Students develop proficiency with …
 *   POINT_2 Students apply …
 *   SUBTOPIC Polar and Exponential Form
 *   POINT_1 …
 *
 * Multiple SUBTOPIC blocks can appear under one TOPIC.
 * Multiple TOPIC blocks can appear under one GRADE.
 * A new GRADE line starts a fresh block.
 */

type ParsedDotPoint = {
  grade: string;
  topic: string;
  subtopic: string;
  points: string[];
};

const MAX_DB_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 300;
const UPSERT_BATCH_SIZE = 100;
const RETRYABLE_FETCH_ERROR_PATTERN = /(fetch failed|network|socket hang up|timeout|timed out|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)/i;

const parseSyllabusInput = (input: string): ParsedDotPoint[] => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: ParsedDotPoint[] = [];
  let currentGrade = '';
  let currentTopic = '';
  let currentSubtopic = '';
  let currentPoints: string[] = [];

  const flush = () => {
    if (!currentGrade || !currentTopic || !currentSubtopic || currentPoints.length === 0) {
      if (currentGrade && currentTopic && currentSubtopic) {
        // subtopic with no points — skip silently
      }
      currentPoints = [];
      return;
    }

    blocks.push({
      grade: currentGrade,
      topic: currentTopic,
      subtopic: currentSubtopic,
      points: Array.from(new Set(currentPoints.map((p) => p.trim()).filter(Boolean))),
    });

    currentPoints = [];
  };

  for (const line of lines) {
    if (line.startsWith('GRADE ')) {
      flush();
      currentGrade = line.replace(/^GRADE\s+/i, '').trim();
      currentTopic = '';
      currentSubtopic = '';
      continue;
    }

    if (line.startsWith('TOPIC ')) {
      flush();
      currentTopic = line.replace(/^TOPIC\s+/i, '').trim();
      currentSubtopic = '';
      continue;
    }

    if (line.startsWith('SUBTOPIC ')) {
      flush();
      currentSubtopic = line.replace(/^SUBTOPIC\s+/i, '').trim();
      continue;
    }

    if (/^POINT_\d+\s+/i.test(line)) {
      const pointValue = line.replace(/^POINT_\d+\s+/i, '').trim();
      if (pointValue) currentPoints.push(pointValue);
      continue;
    }

    throw new Error(`Unrecognized line: "${line}". Expected GRADE, TOPIC, SUBTOPIC, or POINT_n.`);
  }

  flush();
  return blocks;
};

const normalizeGrade = (value: string) => {
  const text = value.trim();
  if (!text) return text;
  if (/^Year\s+\d+$/i.test(text)) return text.replace(/^year/i, 'Year');
  if (/^\d+$/.test(text)) return `Year ${text}`;
  return text;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableSupabaseError = (error: unknown) => {
  if (!error) return false;
  if (error instanceof Error) return RETRYABLE_FETCH_ERROR_PATTERN.test(error.message);
  if (typeof error === 'string') return RETRYABLE_FETCH_ERROR_PATTERN.test(error);
  if (typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '');
    return RETRYABLE_FETCH_ERROR_PATTERN.test(message);
  }
  return false;
};

const formatErrorMessage = (error: unknown) => {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Unknown error');
  }
  return String(error);
};

const chunkArray = <T>(items: T[], chunkSize: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const runSupabaseWithRetry = async <T>(operation: () => PromiseLike<{ data: T; error: any }>) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt += 1) {
    try {
      const result = await operation();
      if (!result.error) return result;

      lastError = result.error;
      const retryable = isRetryableSupabaseError(result.error);
      if (!retryable || attempt === MAX_DB_RETRIES) {
        return result;
      }
    } catch (error) {
      lastError = error;
      const retryable = isRetryableSupabaseError(error);
      if (!retryable || attempt === MAX_DB_RETRIES) {
        return { data: null as T, error };
      }
    }

    await sleep(BASE_RETRY_DELAY_MS * attempt);
  }

  return { data: null as T, error: lastError || new Error('Unknown Supabase error') };
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawText = String(body?.rawText || '').trim();
    const explicitSubject = String(body?.subject || '').trim();

    if (!rawText) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    const parsed = parseSyllabusInput(rawText);
    if (!parsed.length) {
      return NextResponse.json({ error: 'No valid syllabus blocks found.' }, { status: 400 });
    }

    let insertedRows = 0;
    let skippedBlocks = 0;
    let failedBlocks = 0;
    let firstFailureMessage = '';
    const details: Array<{ grade: string; topic: string; subtopic: string; subjects: string[]; points: number; status: string }> = [];

    for (const block of parsed) {
      const grade = normalizeGrade(block.grade);
      const topic = block.topic.trim();
      const subtopic = block.subtopic.trim();
      const points = block.points;

      let subjects: string[];

      if (explicitSubject) {
        // Use the explicitly provided subject
        subjects = [explicitSubject];
      } else {
        // Auto-detect subjects from existing questions matching this grade+topic
        const { data: subjectRows, error: subjectError } = await runSupabaseWithRetry<Array<{ subject: string | null }>>(() => supabaseAdmin
          .from('hsc_questions')
          .select('subject')
          .eq('grade', grade)
          .eq('topic', topic));

        if (subjectError) {
          const errorMessage = `Failed loading subjects for ${grade} / ${topic}: ${formatErrorMessage(subjectError)}`;
          if (!firstFailureMessage) firstFailureMessage = errorMessage;
          failedBlocks += 1;
          details.push({ grade, topic, subtopic, subjects: [], points: points.length, status: `failed:${errorMessage}` });
          continue;
        }

        subjects = Array.from(
          new Set(
            (subjectRows || [])
              .map((row) => String(row.subject || '').trim())
              .filter(Boolean)
          )
        );
      }

      if (!subjects.length) {
        skippedBlocks += 1;
        details.push({ grade, topic, subtopic, subjects: [], points: points.length, status: 'skipped:no-subject-match' });
        continue;
      }

      const rowsToUpsert = subjects.flatMap((subject) =>
        points.map((dotPointText, index) => ({
          grade,
          subject,
          topic,
          subtopic,
          dot_point_text: dotPointText,
          sort_order: index + 1,
        }))
      );

      let blockInsertCount = 0;
      let blockFailure: string | null = null;

      for (const batch of chunkArray(rowsToUpsert, UPSERT_BATCH_SIZE)) {
        const { data: upserted, error: upsertError } = await runSupabaseWithRetry(() => supabaseAdmin
          .from('syllabus_taxonomy')
          .upsert(batch, {
            onConflict: 'grade,subject,topic,subtopic,dot_point_text',
            ignoreDuplicates: false,
          })
          .select('id'));

        if (upsertError) {
          blockFailure = `Failed writing dot points for ${grade} / ${topic} / ${subtopic}: ${formatErrorMessage(upsertError)}`;
          break;
        }

        blockInsertCount += Array.isArray(upserted) ? upserted.length : batch.length;
      }

      if (blockFailure) {
        if (!firstFailureMessage) firstFailureMessage = blockFailure;
        failedBlocks += 1;
        details.push({ grade, topic, subtopic, subjects, points: points.length, status: `failed:${blockFailure}` });
        continue;
      }

      insertedRows += blockInsertCount;
      details.push({ grade, topic, subtopic, subjects, points: points.length, status: 'imported' });
    }

    const importedBlocks = details.filter((detail) => detail.status === 'imported').length;

    if (failedBlocks === parsed.length) {
      return NextResponse.json(
        {
          success: false,
          error: firstFailureMessage || 'Import failed for all blocks.',
          totals: {
            blocks: parsed.length,
            importedBlocks,
            skippedBlocks,
            failedBlocks,
            insertedRows,
          },
          details,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: failedBlocks === 0,
      warning: failedBlocks > 0 ? `${failedBlocks} block(s) failed. First error: ${firstFailureMessage}` : null,
      totals: {
        blocks: parsed.length,
        importedBlocks,
        skippedBlocks,
        failedBlocks,
        insertedRows,
      },
      details,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import syllabus dot points';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

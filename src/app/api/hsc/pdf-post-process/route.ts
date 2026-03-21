import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db';

export const runtime = 'nodejs';

const MODEL_NAME = 'gpt-5.4';

const RequestSchema = z.object({
  grade: z.string().min(1),
  year: z.union([z.number(), z.string()]),
  subject: z.string().min(1),
  school: z.string().optional(),
});

type QuestionRow = {
  id: string;
  grade: string | null;
  year: number | null;
  subject: string | null;
  school_name: string | null;
  topic: string | null;
  question_text: string | null;
  question_number: string | null;
  sample_answer: string | null;
  marking_criteria: string | null;
  marks: number | null;
  question_type: string | null;
  graph_image_data: string | null;
  sample_answer_image: string | null;
};

const normalizeText = (value: unknown) => String(value || '').trim();
const normalizeToken = (value: unknown) => normalizeText(value).toLowerCase();
const normalizeSchool = (value: unknown) => {
  const text = normalizeText(value);
  return text || 'HSC';
};

const isNotEnoughContextAnswer = (value: unknown) => {
  const text = String(value || '').trim().toUpperCase();
  return text === 'NOT_ENOUGH_CONTEXT';
};

const toImageDataUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 128) {
    return `data:image/png;base64,${trimmed.replace(/\s+/g, '')}`;
  }
  return null;
};

const normalizeQuestionKey = (raw: string) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { base: '', part: null as string | null, subpart: null as string | null, key: '' };

  const match = trimmed.match(/(\d+)\s*(?:\(?([a-z])\)?)?\s*(?:\(?((?:ix|iv|v?i{0,3}|x))\)?)?/i);
  const base = match?.[1] || trimmed;
  const part = match?.[2] ? match[2].toLowerCase() : null;
  const subpart = match?.[3] ? match[3].toLowerCase() : null;

  const key = base + (part ? `(${part})` : '');
  return { base, part, subpart, key };
};

const romanToNumber = (roman: string | null) => {
  if (!roman) return null;
  const normalized = roman.toLowerCase();
  const values: Record<string, number> = {
    i: 1,
    v: 5,
    x: 10,
  };
  let total = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const current = values[normalized[i]] || 0;
    const next = values[normalized[i + 1]] || 0;
    if (current < next) {
      total -= current;
    } else {
      total += current;
    }
  }
  return total || null;
};

const letterToNumber = (letter: string | null) => {
  if (!letter) return null;
  const c = letter.toLowerCase().charCodeAt(0);
  if (c < 97 || c > 122) return null;
  return c - 96;
};

const compareQuestionNumbers = (leftRaw: string | null, rightRaw: string | null) => {
  const left = normalizeQuestionKey(String(leftRaw || ''));
  const right = normalizeQuestionKey(String(rightRaw || ''));

  const leftBase = Number.parseInt(left.base || '', 10);
  const rightBase = Number.parseInt(right.base || '', 10);
  if (!Number.isNaN(leftBase) && !Number.isNaN(rightBase) && leftBase !== rightBase) {
    return leftBase - rightBase;
  }

  const leftPart = letterToNumber(left.part);
  const rightPart = letterToNumber(right.part);
  if (leftPart != null && rightPart != null && leftPart !== rightPart) {
    return leftPart - rightPart;
  }
  if (leftPart == null && rightPart != null) return -1;
  if (leftPart != null && rightPart == null) return 1;

  const leftSubpart = romanToNumber(left.subpart);
  const rightSubpart = romanToNumber(right.subpart);
  if (leftSubpart != null && rightSubpart != null && leftSubpart !== rightSubpart) {
    return leftSubpart - rightSubpart;
  }
  if (leftSubpart == null && rightSubpart != null) return -1;
  if (leftSubpart != null && rightSubpart == null) return 1;

  return String(leftRaw || '').localeCompare(String(rightRaw || ''));
};

const parseRecoveredAnswer = (content: string) => {
  const lines = String(content || '').split(/\r?\n/);
  let mode: 'answer' | 'criteria' | null = null;
  const answerLines: string[] = [];
  const criteriaLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'SAMPLE_ANSWER') {
      mode = 'answer';
      continue;
    }
    if (line === 'MARKING_CRITERIA') {
      mode = 'criteria';
      continue;
    }
    if (!mode) continue;
    if (mode === 'answer') answerLines.push(rawLine);
    if (mode === 'criteria') criteriaLines.push(rawLine);
  }

  return {
    sampleAnswer: answerLines.join('\n').trim(),
    markingCriteria: criteriaLines.join('\n').trim(),
  };
};

const buildRecoveryPrompt = (args: {
  targetQuestionNumber: string;
  targetQuestionText: string;
  targetMarks: number;
  contextBlocks: string[];
}) => {
  return `You are helping recover an exam sample solution that was previously marked as NOT_ENOUGH_CONTEXT.

Use the related earlier subparts as context and write a high-quality replacement solution.

TARGET QUESTION
QUESTION_NUMBER ${args.targetQuestionNumber}
NUM_MARKS ${args.targetMarks}

QUESTION_CONTENT
${args.targetQuestionText}

RELATED CONTEXT (earlier subparts in same main question)
${args.contextBlocks.join('\n\n')}

Requirements:
- Use the related context only when relevant to infer definitions, intermediate values, or setup from earlier subparts.
- If a needed value is still missing, make the minimum explicit assumption and proceed.
- Produce a clear, fully worked sample solution in LaTeX.
- Also produce concise marking criteria aligned with the mark count.
- Do not include any extra commentary outside the required output format.

Output exactly in this format:
SAMPLE_ANSWER
<fully worked LaTeX solution>

MARKING_CRITERIA
MARKS_1 <criterion>
MARKS_2 <criterion>
...`;
};

const isRefusal = (text: string) => {
  const lowered = text.toLowerCase();
  return (
    lowered.includes("i'm sorry") ||
    lowered.includes('i cannot assist') ||
    lowered.includes("i can't assist") ||
    lowered.includes('cannot help with that request')
  );
};

const extractMessageContent = (content: unknown): string => {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find((p: any) => p?.type === 'text');
    return (textPart?.text != null ? String(textPart.text) : '') || '';
  }
  return String(content);
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY server configuration' }, { status: 500 });
    }

    const parsedBody = RequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsedBody.error.flatten() }, { status: 400 });
    }

    const grade = normalizeText(parsedBody.data.grade);
    const year = Number.parseInt(String(parsedBody.data.year), 10);
    const subject = normalizeText(parsedBody.data.subject);
    const school = normalizeSchool(parsedBody.data.school);

    if (!Number.isFinite(year)) {
      return NextResponse.json({ error: 'year must be a valid number' }, { status: 400 });
    }

    const { data: byYearRows, error: fetchError } = await supabaseAdmin
      .from('hsc_questions')
      .select('id, grade, year, subject, school_name, topic, question_text, question_number, sample_answer, marking_criteria, marks, question_type, graph_image_data, sample_answer_image')
      .eq('year', year)
      .order('question_number', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: `Failed to load questions: ${fetchError.message}` }, { status: 500 });
    }

    const requestedGrade = normalizeToken(grade);
    const requestedSubject = normalizeToken(subject);
    const requestedSchool = normalizeToken(school);

    const allPaperQuestions = ((byYearRows || []) as QuestionRow[]).filter((row) => {
      const rowGrade = normalizeToken(row.grade);
      const rowSubject = normalizeToken(row.subject);
      const rowSchool = normalizeToken(normalizeSchool(row.school_name));
      return rowGrade === requestedGrade && rowSubject === requestedSubject && rowSchool === requestedSchool;
    });

    const unspecifiedQuestionIds = allPaperQuestions
      .filter((row) => normalizeToken(row.topic) === 'unspecified')
      .map((row) => row.id)
      .filter(Boolean);

    let unspecifiedClassification: Record<string, unknown> | null = null;
    if (unspecifiedQuestionIds.length > 0) {
      try {
        const classifyUrl = new URL('/api/hsc/classify-unspecified-topics', request.url).toString();
        const classifyResponse = await fetch(classifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grade,
            year,
            subject,
            school,
            questionIds: unspecifiedQuestionIds,
          }),
        });

        unspecifiedClassification = await classifyResponse.json().catch(() => ({}));
      } catch (error) {
        unspecifiedClassification = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to classify unspecified topics',
        };
      }
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const createChatCompletion = async (args: {
      model: string;
      messages: any[];
      maxTokens?: number;
      reasoningEffort?: 'low' | 'medium' | 'high';
    }) => {
      return await openai.chat.completions.create({
        model: args.model,
        messages: args.messages as any,
        reasoning_effort: args.reasoningEffort ?? 'high',
        max_completion_tokens: typeof args.maxTokens === 'number' ? args.maxTokens : 3000,
      });
    };

    let recoveredNotEnoughContextCount = 0;
    let failedNotEnoughContextRecoveries = 0;
    const recoveryOutputs: Array<Record<string, unknown>> = [];

    const allWritten = allPaperQuestions
      .filter((row) => String(row?.question_type || 'written') !== 'multiple_choice')
      .sort((a, b) => compareQuestionNumbers(a.question_number || null, b.question_number || null));

    const targets = allWritten.filter((row) => isNotEnoughContextAnswer(row?.sample_answer));

    for (const target of targets) {
      const targetNumber = String(target.question_number || '').trim();
      const targetQuestionText = String(target.question_text || '').trim();
      const parsedTarget = normalizeQuestionKey(targetNumber);
      if (!targetNumber || !targetQuestionText || !parsedTarget.base) {
        failedNotEnoughContextRecoveries += 1;
        recoveryOutputs.push({
          questionId: target.id,
          questionNumber: target.question_number,
          success: false,
          reason: 'Missing target question number/text',
        });
        continue;
      }

      const targetPartRank = letterToNumber(parsedTarget.part);
      const targetSubpartRank = romanToNumber(parsedTarget.subpart);
      const contextRows = allWritten.filter((candidate) => {
        const candidateNumber = String(candidate.question_number || '').trim();
        const parsedCandidate = normalizeQuestionKey(candidateNumber);
        if (!parsedCandidate.base || parsedCandidate.base !== parsedTarget.base) return false;
        if (String(candidate.id) === String(target.id)) return false;
        if (!candidate.question_text || !candidate.sample_answer) return false;
        if (isNotEnoughContextAnswer(candidate.sample_answer)) return false;

        const candidatePartRank = letterToNumber(parsedCandidate.part);
        const candidateSubpartRank = romanToNumber(parsedCandidate.subpart);

        if (targetPartRank == null) return false;
        if (candidatePartRank == null) return false;

        if (candidatePartRank < targetPartRank) return true;

        if (candidatePartRank === targetPartRank) {
          if (targetSubpartRank == null) return false;
          if (candidateSubpartRank == null) return false;
          return candidateSubpartRank < targetSubpartRank;
        }

        return false;
      });

      if (!contextRows.length) {
        failedNotEnoughContextRecoveries += 1;
        recoveryOutputs.push({
          questionId: target.id,
          questionNumber: target.question_number,
          success: false,
          reason: 'No earlier subpart context found',
        });
        continue;
      }

      const contextBlocks = contextRows
        .sort((a, b) => compareQuestionNumbers(a.question_number || null, b.question_number || null))
        .map((row) => {
          return [
            `QUESTION_NUMBER ${row.question_number || ''}`,
            'QUESTION_CONTENT',
            String(row.question_text || '').trim(),
            'SAMPLE_ANSWER',
            String(row.sample_answer || '').trim(),
          ].join('\n');
        });

      const recoveryPrompt = buildRecoveryPrompt({
        targetQuestionNumber: targetNumber,
        targetQuestionText,
        targetMarks: Number(target.marks) || 0,
        contextBlocks,
      });

      const recoveryMessageContent: Array<Record<string, unknown>> = [
        { type: 'text', text: recoveryPrompt },
      ];

      const targetQuestionImage = toImageDataUrl(normalizeText(target.graph_image_data));
      if (targetQuestionImage) {
        recoveryMessageContent.push({
          type: 'image_url',
          image_url: { url: targetQuestionImage, detail: 'high' },
        });
      }

      const contextImageCandidates: string[] = [];
      for (const row of contextRows) {
        const questionImage = toImageDataUrl(normalizeText(row.graph_image_data));
        if (questionImage) contextImageCandidates.push(questionImage);
        const sampleAnswerImage = toImageDataUrl(normalizeText(row.sample_answer_image));
        if (sampleAnswerImage) contextImageCandidates.push(sampleAnswerImage);
      }

      const seenImages = new Set<string>();
      const contextImages = contextImageCandidates.filter((url) => {
        if (seenImages.has(url)) return false;
        seenImages.add(url);
        return true;
      }).slice(0, 6);

      for (const imageUrl of contextImages) {
        recoveryMessageContent.push({
          type: 'image_url',
          image_url: { url: imageUrl, detail: 'high' },
        });
      }

      try {
        const recoveryResponse = await createChatCompletion({
          model: MODEL_NAME,
          messages: [
            {
              role: 'system' as const,
              content:
                'You are repairing incomplete exam solutions. Use both provided text context and provided images when available. Return only the requested sections and keep responses concise but complete.',
            },
            {
              role: 'user' as const,
              content: recoveryMessageContent as any,
            },
          ],
          maxTokens: 4000,
        });

        const recoveryContent = extractMessageContent(recoveryResponse.choices?.[0]?.message?.content ?? '');
        if (!recoveryContent.trim() || isRefusal(recoveryContent)) {
          failedNotEnoughContextRecoveries += 1;
          recoveryOutputs.push({
            questionId: target.id,
            questionNumber: target.question_number,
            success: false,
            reason: 'Model returned empty/refusal response',
            rawModelOutput: recoveryContent,
          });
          continue;
        }

        const parsedRecovery = parseRecoveredAnswer(recoveryContent);
        if (!parsedRecovery.sampleAnswer || isNotEnoughContextAnswer(parsedRecovery.sampleAnswer)) {
          failedNotEnoughContextRecoveries += 1;
          recoveryOutputs.push({
            questionId: target.id,
            questionNumber: target.question_number,
            success: false,
            reason: 'Recovered answer was empty or still NOT_ENOUGH_CONTEXT',
            rawModelOutput: recoveryContent,
          });
          continue;
        }

        const updatePayload: Record<string, unknown> = {
          sample_answer: parsedRecovery.sampleAnswer,
        };

        if (parsedRecovery.markingCriteria) {
          updatePayload.marking_criteria = parsedRecovery.markingCriteria;
        }

        const { error: recoveryUpdateError } = await supabaseAdmin
          .from('hsc_questions')
          .update(updatePayload)
          .eq('id', target.id);

        if (recoveryUpdateError) {
          failedNotEnoughContextRecoveries += 1;
          recoveryOutputs.push({
            questionId: target.id,
            questionNumber: target.question_number,
            success: false,
            reason: `DB update failed: ${recoveryUpdateError.message}`,
            rawModelOutput: recoveryContent,
          });
          continue;
        }

        recoveredNotEnoughContextCount += 1;
        recoveryOutputs.push({
          questionId: target.id,
          questionNumber: target.question_number,
          success: true,
          rawModelOutput: recoveryContent,
        });
      } catch (error) {
        failedNotEnoughContextRecoveries += 1;
        recoveryOutputs.push({
          questionId: target.id,
          questionNumber: target.question_number,
          success: false,
          reason: error instanceof Error ? error.message : 'Recovery generation failed',
        });
      }
    }

    return NextResponse.json({
      success: true,
      model: MODEL_NAME,
      exam: { grade, year, subject, school },
      totals: {
        totalExam: allPaperQuestions.length,
        foundUnspecified: unspecifiedQuestionIds.length,
        foundNotEnoughContext: targets.length,
        recoveredNotEnoughContext: recoveredNotEnoughContextCount,
        failedNotEnoughContext: failedNotEnoughContextRecoveries,
      },
      unspecifiedClassification,
      recoveryOutputs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post-process exam';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

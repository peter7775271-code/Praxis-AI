import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db';

export const runtime = 'nodejs';

const MODEL_NAME = 'gpt-5-mini';
const ALLOWED_DIFFICULTIES = ['Foundation', 'Intermediate', 'Advanced', 'Extension'] as const;
type DifficultyLevel = (typeof ALLOWED_DIFFICULTIES)[number];

type ExamContext = {
  grade: string;
  year: number;
  subject: string;
  school: string;
};

type TaxonomyRow = {
  topic: string | null;
  subtopic: string | null;
};

type QuestionRow = {
  id: string;
  grade: string | null;
  year: number | null;
  subject: string | null;
  school_name: string | null;
  topic: string | null;
  subtopic: string | null;
  question_text: string | null;
  question_number: string | null;
  graph_image_data: string | null;
};

const RequestSchema = z.object({
  grade: z.string().min(1).optional(),
  year: z.union([z.number(), z.string()]).optional(),
  subject: z.string().min(1).optional(),
  school: z.string().optional(),
  exams: z.array(z.object({
    grade: z.string().min(1),
    year: z.union([z.number(), z.string()]),
    subject: z.string().min(1),
    school: z.string().optional(),
  })).optional(),
  questionIds: z.array(z.string().min(1)).optional(),
  limit: z.number().int().min(1).max(200).default(10),
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const normalizeText = (value: unknown) => String(value || '').trim();
const normalizeToken = (value: unknown) => normalizeText(value).toLowerCase();
const normalizeCollapsedToken = (value: unknown) => normalizeToken(value).replace(/\s+/g, '');

const normalizeSchool = (value: unknown) => {
  const text = normalizeText(value);
  return text || 'HSC';
};

const parseYear = (value: unknown): number | null => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDifficulty = (value: unknown): DifficultyLevel | null => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;

  if (normalized === 'foundation') return 'Foundation';
  if (normalized === 'intermediate') return 'Intermediate';
  if (normalized === 'advanced') return 'Advanced';
  if (normalized === 'extension') return 'Extension';
  return null;
};

const isUnspecifiedTopic = (value: string | null | undefined) => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'unspecified';
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

const parseJsonFromText = (raw: string): unknown | null => {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/```\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
};

const buildTaxonomyPrompt = (subtopicsByTopic: Map<string, string[]>) => {
  const lines: string[] = [];
  for (const [topic, subtopics] of subtopicsByTopic.entries()) {
    lines.push(topic);
    for (const subtopic of subtopics) {
      lines.push(`- ${subtopic}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
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

    const fallbackGrade = normalizeText(parsedBody.data.grade);
    const fallbackYear = Number.parseInt(String(parsedBody.data.year), 10);
    const fallbackSubject = normalizeText(parsedBody.data.subject);
    const fallbackSchool = normalizeSchool(parsedBody.data.school);
    const questionIdSet = new Set((parsedBody.data.questionIds || []).map((id) => normalizeText(id)).filter(Boolean));
    const limit = parsedBody.data.limit;

    const examContexts: ExamContext[] = [];
    for (const rawExam of (parsedBody.data.exams || [])) {
      const examYear = Number.parseInt(String(rawExam.year), 10);
      if (!Number.isFinite(examYear)) {
        return NextResponse.json({ error: `Invalid exam year: ${String(rawExam.year)}` }, { status: 400 });
      }
      examContexts.push({
        grade: normalizeText(rawExam.grade),
        year: examYear,
        subject: normalizeText(rawExam.subject),
        school: normalizeSchool(rawExam.school),
      });
    }

    if (!examContexts.length) {
      if (!fallbackGrade || !fallbackSubject || !Number.isFinite(fallbackYear)) {
        return NextResponse.json({ error: 'Provide exams[] or grade/year/subject in request body.' }, { status: 400 });
      }
      examContexts.push({
        grade: fallbackGrade,
        year: fallbackYear,
        subject: fallbackSubject,
        school: fallbackSchool,
      });
    }

    const { data: questionsData, error: questionsError } = await supabaseAdmin
      .from('hsc_questions')
      .select('id, grade, year, subject, school_name, topic, subtopic, question_text, question_number, graph_image_data')
      .order('question_number', { ascending: true });

    if (questionsError) {
      return NextResponse.json({ error: `Failed to load questions: ${questionsError.message}` }, { status: 500 });
    }

    const allFetchedQuestions = (questionsData || []) as QuestionRow[];
    const taxonomyCache = new Map<string, Map<string, string[]>>();

    const outputs: Array<Record<string, unknown>> = [];
    const perExam: Array<Record<string, unknown>> = [];

    let totalExamRows = 0;
    let totalFoundUnspecified = 0;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    let totalSkippedAlreadyClassified = 0;

    for (const exam of examContexts) {
      const normalizedGrade = exam.grade.toLowerCase().replace(/\s+/g, '');
      const taxonomyGrades = normalizedGrade === 'year11' || normalizedGrade === 'year12'
        ? ['Year 11', 'Year 12']
        : [exam.grade];
      const taxonomyKey = `${taxonomyGrades.join('|')}__${exam.subject}`;

      if (!taxonomyCache.has(taxonomyKey)) {
        const { data: taxonomyData, error: taxonomyError } = await supabaseAdmin
          .from('syllabus_taxonomy')
          .select('topic, subtopic')
          .in('grade', taxonomyGrades)
          .eq('subject', exam.subject)
          .order('topic', { ascending: true })
          .order('subtopic', { ascending: true });

        if (taxonomyError) {
          return NextResponse.json({ error: `Failed to load syllabus taxonomy: ${taxonomyError.message}` }, { status: 500 });
        }

        const subtopicsByTopic = new Map<string, string[]>();
        for (const row of (taxonomyData || []) as TaxonomyRow[]) {
          const topic = normalizeText(row.topic);
          const subtopic = normalizeText(row.subtopic);
          if (!topic || !subtopic) continue;
          const list = subtopicsByTopic.get(topic) || [];
          if (!list.includes(subtopic)) {
            list.push(subtopic);
          }
          subtopicsByTopic.set(topic, list);
        }

        if (!subtopicsByTopic.size) {
          return NextResponse.json({
            error: `No taxonomy topics/subtopics found for paper context: ${exam.grade} ${exam.subject}`,
          }, { status: 404 });
        }

        taxonomyCache.set(taxonomyKey, subtopicsByTopic);
      }

      const subtopicsByTopic = taxonomyCache.get(taxonomyKey)!;
      const taxonomyBlock = buildTaxonomyPrompt(subtopicsByTopic);

      const requestedGrade = normalizeToken(exam.grade);
      const requestedGradeCollapsed = normalizeCollapsedToken(exam.grade);
      const requestedSubject = normalizeToken(exam.subject);
      const requestedSubjectCollapsed = normalizeCollapsedToken(exam.subject);
      const requestedSchool = normalizeToken(exam.school);
      const requestedSchoolCollapsed = normalizeCollapsedToken(exam.school);

      const allQuestionsByYear = allFetchedQuestions.filter((question) => parseYear(question.year) === exam.year);

      const allQuestions = allQuestionsByYear.filter((question) => {
        const questionGrade = normalizeToken(question.grade);
        const questionGradeCollapsed = normalizeCollapsedToken(question.grade);
        const questionSubject = normalizeToken(question.subject);
        const questionSubjectCollapsed = normalizeCollapsedToken(question.subject);
        const questionSchool = normalizeToken(normalizeSchool(question.school_name));
        const questionSchoolCollapsed = normalizeCollapsedToken(normalizeSchool(question.school_name));
        const matchesQuestionId = questionIdSet.size === 0 || questionIdSet.has(question.id);
        const matchesGrade = questionGrade === requestedGrade || questionGradeCollapsed === requestedGradeCollapsed;
        const matchesSubject = questionSubject === requestedSubject || questionSubjectCollapsed === requestedSubjectCollapsed;
        const matchesSchool = questionSchool === requestedSchool || questionSchoolCollapsed === requestedSchoolCollapsed;

        return matchesGrade && matchesSubject && matchesSchool && matchesQuestionId;
      });
      const unspecifiedQuestions = allQuestions.filter((question) => isUnspecifiedTopic(question.topic));

      const debugCounts = {
        totalFetched: allFetchedQuestions.length,
        allQuestionsByYear: allQuestionsByYear.length,
        matchedPaperContext: allQuestions.length,
        requestedQuestionIds: questionIdSet.size,
      };

      const examTotals = {
        totalExam: allQuestions.length,
        foundUnspecified: unspecifiedQuestions.length,
        processed: 0,
        updated: 0,
        failed: 0,
        skippedAlreadyClassified: 0,
      };

      if (!unspecifiedQuestions.length) {
        perExam.push({ exam, debugCounts, totals: examTotals });
        continue;
      }

      const toProcess = questionIdSet.size > 0 ? unspecifiedQuestions : unspecifiedQuestions.slice(0, limit);
      examTotals.processed = toProcess.length;

      for (const question of toProcess) {
        const questionText = normalizeText(question.question_text);
        if (!questionText) {
          examTotals.failed += 1;
          outputs.push({
            exam,
            questionId: question.id,
            questionNumber: question.question_number,
            success: false,
            reason: 'Question text is empty',
          });
          continue;
        }

        const prompt = [
          questionText,
          '',
          'Determine the most suitable topic, subtopic, and difficulty for this question.',
          '',
          'NOTE: The subtopic chosen MUST come from the topic that has been given to the question.',
          'Difficulty must be exactly one of: Foundation, Intermediate, Advanced, Extension.',
          'Difficulty guide (brief):',
          '- Foundation: Pretty straightforward. Example (Vectors): calculate the dot product of u and v.',
          '- Intermediate: Relatively straightforward. Example (Vectors): calculate the vector projection of a on b, then find the smallest distance.',
          '- Advanced: Requires some thinking. Example (Vectors): a short proof or a multistep solution.',
          '- Extension: Requires deeper thinking. Example (Vectors): a harder vector proof.',
          '',
          'TOPIC/SUBTOPIC TAXONOMY',
          taxonomyBlock,
          '',
          'Return STRICT JSON only with this exact shape:',
          '{"topic":"<topic>","subtopic":"<subtopic>","difficulty":"<Foundation|Intermediate|Advanced|Extension>","reason":"<short reason>"}',
        ].join('\n');

        const messageContent: Array<Record<string, unknown>> = [
          { type: 'text', text: prompt },
        ];

        const imageData = toImageDataUrl(normalizeText(question.graph_image_data));
        if (imageData) {
          messageContent.push({
            type: 'image_url',
            image_url: { url: imageData },
          });
        }

        try {
          const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [
              {
                role: 'system',
                content: [
                  {
                    type: 'text',
                    text: 'You are a strict classifier. Only output JSON. The chosen subtopic must belong to the chosen topic from the provided taxonomy.',
                  },
                ],
              },
              {
                role: 'user',
                content: messageContent as any,
              },
            ],
          });

          const rawOutput = String(completion.choices?.[0]?.message?.content || '').trim();
          const parsed = parseJsonFromText(rawOutput) as Record<string, unknown> | null;
          const topic = normalizeText(parsed?.topic);
          const subtopic = normalizeText(parsed?.subtopic);
          const difficulty = normalizeDifficulty(parsed?.difficulty);
          const reason = normalizeText(parsed?.reason);

          const allowedSubtopics = topic ? (subtopicsByTopic.get(topic) || []) : [];
          const isValid = Boolean(topic) && Boolean(subtopic) && Boolean(difficulty) && allowedSubtopics.includes(subtopic);

          if (!isValid) {
            examTotals.failed += 1;
            outputs.push({
              exam,
              questionId: question.id,
              questionNumber: question.question_number,
              success: false,
              reason: 'Model returned invalid topic/subtopic/difficulty output',
              rawModelOutput: rawOutput,
              rawTextOutput: rawOutput,
              parsedModelOutput: parsed,
              allowedDifficultyValues: ALLOWED_DIFFICULTIES,
            });
            continue;
          }

          const { data: updatedRows, error: updateError } = await supabaseAdmin
            .from('hsc_questions')
            .update({
              topic,
              subtopic,
              difficulty,
            })
            .eq('id', question.id)
            .in('topic', ['Unspecified', 'unspecified'])
            .select('id');

          if (updateError) {
            examTotals.failed += 1;
            outputs.push({
              exam,
              questionId: question.id,
              questionNumber: question.question_number,
              success: false,
              reason: `DB update failed: ${updateError.message}`,
              rawModelOutput: rawOutput,
              rawTextOutput: rawOutput,
              parsedModelOutput: parsed,
            });
            continue;
          }

          if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
            examTotals.skippedAlreadyClassified += 1;
            outputs.push({
              exam,
              questionId: question.id,
              questionNumber: question.question_number,
              success: false,
              skipped: true,
              reason: 'Skipped because question already had a non-unspecified topic',
              rawModelOutput: rawOutput,
              rawTextOutput: rawOutput,
              parsedModelOutput: parsed,
            });
            continue;
          }

          examTotals.updated += 1;
          outputs.push({
            exam,
            questionId: question.id,
            questionNumber: question.question_number,
            success: true,
            topic,
            subtopic,
            difficulty,
            reason,
            rawModelOutput: rawOutput,
            rawTextOutput: rawOutput,
          });
        } catch (error) {
          examTotals.failed += 1;
          outputs.push({
            exam,
            questionId: question.id,
            questionNumber: question.question_number,
            success: false,
            reason: error instanceof Error ? error.message : 'Classification failed',
          });
        }
      }

      totalExamRows += examTotals.totalExam;
      totalFoundUnspecified += examTotals.foundUnspecified;
      totalProcessed += examTotals.processed;
      totalUpdated += examTotals.updated;
      totalFailed += examTotals.failed;
      totalSkippedAlreadyClassified += examTotals.skippedAlreadyClassified;

      perExam.push({ exam, debugCounts, totals: examTotals });
    }

    return NextResponse.json({
      success: true,
      model: MODEL_NAME,
      exams: examContexts,
      exam: examContexts[0],
      perExam,
      totals: {
        examsSelected: examContexts.length,
        totalExam: totalExamRows,
        foundUnspecified: totalFoundUnspecified,
        processed: totalProcessed,
        updated: totalUpdated,
        failed: totalFailed,
        skippedAlreadyClassified: totalSkippedAlreadyClassified,
      },
      outputs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to classify unspecified topics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

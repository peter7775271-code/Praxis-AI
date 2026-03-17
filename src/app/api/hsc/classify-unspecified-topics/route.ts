import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db';

export const runtime = 'nodejs';

const MODEL_NAME = 'gpt-5-mini';

const RequestSchema = z.object({
  grade: z.string().min(1),
  year: z.union([z.number(), z.string()]),
  subject: z.string().min(1),
  school: z.string().optional(),
  questionIds: z.array(z.string().min(1)).optional(),
  limit: z.number().int().min(1).max(200).default(10),
});

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const normalizeText = (value: unknown) => String(value || '').trim();
const normalizeToken = (value: unknown) => normalizeText(value).toLowerCase();

const normalizeSchool = (value: unknown) => {
  const text = normalizeText(value);
  return text || 'HSC';
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

    const grade = normalizeText(parsedBody.data.grade);
    const year = Number.parseInt(String(parsedBody.data.year), 10);
    const subject = normalizeText(parsedBody.data.subject);
    const school = normalizeSchool(parsedBody.data.school);
    const questionIdSet = new Set((parsedBody.data.questionIds || []).map((id) => normalizeText(id)).filter(Boolean));
    const limit = parsedBody.data.limit;

    if (!Number.isFinite(year)) {
      return NextResponse.json({ error: 'year must be a valid number' }, { status: 400 });
    }

    const normalizedGrade = grade.toLowerCase().replace(/\s+/g, '');
    const taxonomyGrades = normalizedGrade === 'year11' || normalizedGrade === 'year12'
      ? ['Year 11', 'Year 12']
      : [grade];

    const { data: taxonomyData, error: taxonomyError } = await supabaseAdmin
      .from('syllabus_taxonomy')
      .select('topic, subtopic')
      .in('grade', taxonomyGrades)
      .eq('subject', subject)
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
      return NextResponse.json({ error: 'No taxonomy topics/subtopics found for this paper context.' }, { status: 404 });
    }

    const { data: questionsData, error: questionsError } = await supabaseAdmin
      .from('hsc_questions')
      .select('id, grade, year, subject, school_name, topic, subtopic, question_text, question_number, graph_image_data')
      .eq('year', year)
      .order('question_number', { ascending: true });

    if (questionsError) {
      return NextResponse.json({ error: `Failed to load questions: ${questionsError.message}` }, { status: 500 });
    }

    const requestedGrade = normalizeToken(grade);
    const requestedSubject = normalizeToken(subject);
    const requestedSchool = normalizeToken(school);

    const allQuestionsByYear = (questionsData || []) as QuestionRow[];
    const allQuestions = allQuestionsByYear.filter((question) => {
      const questionGrade = normalizeToken(question.grade);
      const questionSubject = normalizeToken(question.subject);
      const questionSchool = normalizeToken(normalizeSchool(question.school_name));
      const matchesQuestionId = questionIdSet.size === 0 || questionIdSet.has(question.id);
      return (
        questionGrade === requestedGrade
        && questionSubject === requestedSubject
        && questionSchool === requestedSchool
        && matchesQuestionId
      );
    });
    const unspecifiedQuestions = allQuestions.filter((question) => isUnspecifiedTopic(question.topic));

    if (!unspecifiedQuestions.length) {
      return NextResponse.json({
        success: true,
        model: MODEL_NAME,
        exam: { grade, year, subject, school },
        totals: {
          totalExam: allQuestions.length,
          foundUnspecified: 0,
          processed: 0,
          updated: 0,
          failed: 0,
        },
        outputs: [],
      });
    }

    const toProcess = questionIdSet.size > 0 ? unspecifiedQuestions : unspecifiedQuestions.slice(0, limit);
    const taxonomyBlock = buildTaxonomyPrompt(subtopicsByTopic);

    let updated = 0;
    let failed = 0;
    const outputs: Array<Record<string, unknown>> = [];

    for (const question of toProcess) {
      const questionText = normalizeText(question.question_text);
      if (!questionText) {
        failed += 1;
        outputs.push({
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
        'Determine the most suitable topic and subtopic for this question based on the topics/subtopics below.',
        '',
        'NOTE: The subtopic chosen MUST come from the topic that has been given to the question.',
        '',
        taxonomyBlock,
        '',
        'Return STRICT JSON only with this exact shape:',
        '{"topic":"<topic>","subtopic":"<subtopic>","reason":"<short reason>"}',
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
        const reason = normalizeText(parsed?.reason);

        const allowedSubtopics = topic ? (subtopicsByTopic.get(topic) || []) : [];
        const isValid = Boolean(topic) && Boolean(subtopic) && allowedSubtopics.includes(subtopic);

        if (!isValid) {
          failed += 1;
          outputs.push({
            questionId: question.id,
            questionNumber: question.question_number,
            success: false,
            reason: 'Model returned topic/subtopic outside allowed taxonomy',
            rawModelOutput: rawOutput,
            rawTextOutput: rawOutput,
            parsedModelOutput: parsed,
          });
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('hsc_questions')
          .update({
            topic,
            subtopic,
          })
          .eq('id', question.id);

        if (updateError) {
          failed += 1;
          outputs.push({
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

        updated += 1;
        outputs.push({
          questionId: question.id,
          questionNumber: question.question_number,
          success: true,
          topic,
          subtopic,
          reason,
          rawModelOutput: rawOutput,
          rawTextOutput: rawOutput,
        });
      } catch (error) {
        failed += 1;
        outputs.push({
          questionId: question.id,
          questionNumber: question.question_number,
          success: false,
          reason: error instanceof Error ? error.message : 'Classification failed',
        });
      }
    }

    return NextResponse.json({
      success: true,
      model: MODEL_NAME,
      exam: { grade, year, subject, school },
      debugCounts: {
        allQuestionsByYear: allQuestionsByYear.length,
        matchedPaperContext: allQuestions.length,
        requestedQuestionIds: questionIdSet.size,
      },
      totals: {
        totalExam: allQuestions.length,
        foundUnspecified: unspecifiedQuestions.length,
        processed: toProcess.length,
        updated,
        failed,
      },
      outputs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to classify unspecified topics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import OpenAI from 'openai';

import { supabaseAdmin } from '@/lib/db';

export const runtime = 'nodejs';

const VERIFY_MODEL = 'gpt-5.4';

type VerifyRequest = {
  schoolName?: string;
  year?: number;
  paperNumber?: number;
  grade?: string;
  subject?: string;
  questionIds?: string[];
  applyUpdates?: boolean;
};

type ExamQuestion = {
  id: string;
  question_number: string | null;
  question_text: string | null;
  sample_answer: string | null;
  question_type: 'written' | 'multiple_choice' | null;
  marks: number | null;
  topic: string | null;
  mcq_option_a: string | null;
  mcq_option_b: string | null;
  mcq_option_c: string | null;
  mcq_option_d: string | null;
  mcq_correct_answer: 'A' | 'B' | 'C' | 'D' | null;
  mcq_explanation: string | null;
  graph_image_data: string | null;
  sample_answer_image: string | null;
  mcq_option_a_image: string | null;
  mcq_option_b_image: string | null;
  mcq_option_c_image: string | null;
  mcq_option_d_image: string | null;
};

type VerificationImageInput = {
  label: string;
  url: string;
};

type ParsedGroupCorrection = {
  questionId: string;
  correctedSolutionLatex: string;
  correctedMcqAnswer?: 'A' | 'B' | 'C' | 'D';
};

const parseQuestionOrder = (value: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return { base: Number.MAX_SAFE_INTEGER, suffix: 'zzzz' };

  const baseMatch = raw.match(/^(\d+)/);
  const base = baseMatch ? Number.parseInt(baseMatch[1], 10) : Number.MAX_SAFE_INTEGER;
  const suffix = raw.slice(baseMatch?.[0]?.length || 0).toLowerCase();
  return { base, suffix };
};

const sortByQuestionNumber = (a: ExamQuestion, b: ExamQuestion) => {
  const parsedA = parseQuestionOrder(a.question_number);
  const parsedB = parseQuestionOrder(b.question_number);
  if (parsedA.base !== parsedB.base) return parsedA.base - parsedB.base;
  return parsedA.suffix.localeCompare(parsedB.suffix);
};

const buildVerificationPrompt = (question: ExamQuestion) => {
  const isMcq = question.question_type === 'multiple_choice';
  const referenceAnswer = isMcq
    ? [
        `MCQ_CORRECT_ANSWER: ${question.mcq_correct_answer || 'unknown'}`,
        `MCQ_EXPLANATION (LaTeX):\n${question.mcq_explanation || ''}`,
      ].join('\n\n')
    : `SAMPLE_ANSWER (LaTeX):\n${question.sample_answer || ''}`;

  const mcqOptions = isMcq
    ? `\n\nMCQ_OPTIONS:\nA) ${question.mcq_option_a || ''}\nB) ${question.mcq_option_b || ''}\nC) ${question.mcq_option_c || ''}\nD) ${question.mcq_option_d || ''}`
    : '';

  return `You are an expert NSW HSC mathematics marker.

Check whether the provided REFERENCE ANSWER is mathematically correct for the QUESTION.

Rules:
1) If the reference answer is fully correct, respond with exactly: CORRECT
2) If QUESTION_TYPE is written and the reference answer is incorrect or incomplete, respond with ONLY the corrected full solution in valid LaTeX.
3) If QUESTION_TYPE is multiple_choice and the reference answer is incorrect or incomplete, respond using this exact format:
MCQ_CORRECT_ANSWER: <A|B|C|D>
CORRECTED_LATEX_BEGIN
<full corrected explanation in LaTeX>
CORRECTED_LATEX_END
4) Do not use markdown fences.
5) The corrected LaTeX must be clear, step-by-step, and easy for a high school student to follow.
6) Keep notation and statements mathematically precise.
7) If images are attached, use them as part of the source of truth.

QUESTION_NUMBER: ${question.question_number || 'unknown'}
MARKS: ${question.marks ?? 'unknown'}
TOPIC: ${question.topic || 'unknown'}
QUESTION_TYPE: ${question.question_type || 'unknown'}

QUESTION (LaTeX):
${question.question_text || ''}${mcqOptions}

${referenceAnswer}`;
};

const buildGroupedVerificationPrompt = (questions: ExamQuestion[]) => {
  const groupedBlocks = questions
    .map((question) => {
      const isMcq = question.question_type === 'multiple_choice';
      const referenceAnswer = isMcq
        ? [
            `MCQ_CORRECT_ANSWER: ${question.mcq_correct_answer || 'unknown'}`,
            `MCQ_EXPLANATION (LaTeX):\n${question.mcq_explanation || ''}`,
          ].join('\n\n')
        : `SAMPLE_ANSWER (LaTeX):\n${question.sample_answer || ''}`;

      const mcqOptions = isMcq
        ? `\n\nMCQ_OPTIONS:\nA) ${question.mcq_option_a || ''}\nB) ${question.mcq_option_b || ''}\nC) ${question.mcq_option_c || ''}\nD) ${question.mcq_option_d || ''}`
        : '';

      return [
        `QUESTION_ID: ${question.id}`,
        `QUESTION_NUMBER: ${question.question_number || 'unknown'}`,
        `QUESTION_TYPE: ${question.question_type || 'unknown'}`,
        `MARKS: ${question.marks ?? 'unknown'}`,
        `TOPIC: ${question.topic || 'unknown'}`,
        `QUESTION (LaTeX):`,
        `${question.question_text || ''}${mcqOptions}`,
        '',
        `${referenceAnswer}`,
      ].join('\n');
    })
    .join('\n\n====================\n\n');

  return `You are an expert NSW HSC mathematics marker.

You are checking a GROUP of related subparts from the same exam question.

Rules:
1) If every reference answer in this group is fully correct, respond with exactly: CORRECT
2) Otherwise, return ONLY corrections for incorrect subparts using this exact format for each incorrect subpart:
QUESTION_ID: <id>
MCQ_CORRECT_ANSWER: <A|B|C|D>    (include this line ONLY if that QUESTION_ID is multiple_choice)
CORRECTED_LATEX_BEGIN
<full corrected LaTeX>
CORRECTED_LATEX_END
3) Do not include markdown fences.
4) Do not include extra commentary. Do not make any reference to the given sample answer.
5) If images are attached, use them as part of the source of truth.

GROUPED_SUBPARTS:
${groupedBlocks}`;
};

const parseGroupedCorrections = (value: string): ParsedGroupCorrection[] => {
  const output = String(value || '');
  const regex = /QUESTION_ID:\s*(.+?)\n(?:MCQ_CORRECT_ANSWER:\s*([ABCD])\s*\n)?CORRECTED_LATEX_BEGIN\n([\s\S]*?)\nCORRECTED_LATEX_END/g;
  const parsed: ParsedGroupCorrection[] = [];

  for (const match of output.matchAll(regex)) {
    const questionId = String(match[1] || '').trim();
    const correctedMcqAnswerRaw = String(match[2] || '').trim().toUpperCase();
    const correctedSolutionLatex = String(match[3] || '').trim();
    const correctedMcqAnswer = ['A', 'B', 'C', 'D'].includes(correctedMcqAnswerRaw)
      ? (correctedMcqAnswerRaw as 'A' | 'B' | 'C' | 'D')
      : undefined;
    if (!questionId || !correctedSolutionLatex) continue;
    parsed.push({ questionId, correctedSolutionLatex, correctedMcqAnswer });
  }

  return parsed;
};

const parseSingleMcqCorrection = (value: string) => {
  const output = String(value || '');
  const answerMatch = output.match(/MCQ_CORRECT_ANSWER:\s*([ABCD])/i);
  const latexMatch = output.match(/CORRECTED_LATEX_BEGIN\n([\s\S]*?)\nCORRECTED_LATEX_END/i);

  const correctedMcqAnswerRaw = String(answerMatch?.[1] || '').trim().toUpperCase();
  const correctedMcqAnswer = ['A', 'B', 'C', 'D'].includes(correctedMcqAnswerRaw)
    ? (correctedMcqAnswerRaw as 'A' | 'B' | 'C' | 'D')
    : undefined;

  const correctedSolutionLatex = String(latexMatch?.[1] || '').trim() || output.trim();
  if (!correctedSolutionLatex) return null;

  return {
    correctedMcqAnswer,
    correctedSolutionLatex,
  };
};

const parseRomanGroupKey = (questionNumber: string | null) => {
  const raw = String(questionNumber || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d+)\s*\(?([a-z])\)?\s*\(?((?:ix|iv|v?i{0,3}|x))\)?$/i);
  if (!match) return null;
  const base = Number.parseInt(match[1], 10);
  const letter = String(match[2] || '').toLowerCase();
  if (!Number.isInteger(base) || !letter) return null;
  return `${base}|${letter}`;
};

const buildVerificationUnits = (questions: ExamQuestion[]) => {
  const romanGroups = new Map<string, ExamQuestion[]>();
  questions.forEach((question) => {
    const key = parseRomanGroupKey(question.question_number);
    if (!key) return;
    const existing = romanGroups.get(key) || [];
    existing.push(question);
    romanGroups.set(key, existing);
  });

  romanGroups.forEach((group, key) => {
    if (group.length < 2) {
      romanGroups.delete(key);
      return;
    }
    group.sort(sortByQuestionNumber);
  });

  const units: ExamQuestion[][] = [];
  const seenRomanKeys = new Set<string>();

  for (const question of questions) {
    const key = parseRomanGroupKey(question.question_number);
    if (!key || !romanGroups.has(key)) {
      units.push([question]);
      continue;
    }

    if (seenRomanKeys.has(key)) continue;
    seenRomanKeys.add(key);
    units.push(romanGroups.get(key) || [question]);
  }

  return units;
};

const toImageUrl = (value: string | null | undefined) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('https://') || raw.startsWith('http://')) return raw;
  return null;
};

const collectVerificationImages = (question: ExamQuestion): VerificationImageInput[] => {
  const candidates: VerificationImageInput[] = [
    { label: 'question_graph', url: String(question.graph_image_data || '') },
    { label: 'sample_answer_image', url: String(question.sample_answer_image || '') },
    { label: 'mcq_option_a_image', url: String(question.mcq_option_a_image || '') },
    { label: 'mcq_option_b_image', url: String(question.mcq_option_b_image || '') },
    { label: 'mcq_option_c_image', url: String(question.mcq_option_c_image || '') },
    { label: 'mcq_option_d_image', url: String(question.mcq_option_d_image || '') },
  ];

  const seen = new Set<string>();
  const normalized: VerificationImageInput[] = [];

  for (const candidate of candidates) {
    const url = toImageUrl(candidate.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    normalized.push({ label: candidate.label, url });
  }

  return normalized;
};

const isCorrectVerdict = (value: string) => {
  const normalized = value.trim().toUpperCase();
  return normalized === 'CORRECT';
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyRequest;

    const schoolName = String(body.schoolName || '').trim();
    const year = Number.parseInt(String(body.year ?? ''), 10);
    const paperNumber = Number.parseInt(String(body.paperNumber ?? ''), 10);
    const grade = String(body.grade || '').trim();
    const subject = String(body.subject || '').trim();
    const applyUpdates = Boolean(body.applyUpdates);
    const questionIds = Array.isArray(body.questionIds)
      ? body.questionIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (!schoolName || !Number.isInteger(year) || !Number.isInteger(paperNumber)) {
      return Response.json(
        { error: 'schoolName, year, and paperNumber are required' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return Response.json(
        { error: 'Missing OPENAI_API_KEY server configuration' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    let query = supabaseAdmin
      .from('hsc_questions')
      .select(
        'id, question_number, question_text, sample_answer, question_type, marks, topic, mcq_option_a, mcq_option_b, mcq_option_c, mcq_option_d, mcq_correct_answer, mcq_explanation, graph_image_data, sample_answer_image, mcq_option_a_image, mcq_option_b_image, mcq_option_c_image, mcq_option_d_image'
      )
      .eq('school_name', schoolName)
      .eq('year', year)
      .eq('paper_number', paperNumber);

    if (grade) query = query.eq('grade', grade);
    if (subject) query = query.eq('subject', subject);
    if (questionIds.length) query = query.in('id', questionIds);

    const { data, error } = await query;

    if (error) {
      console.error('[verify-solutions] Supabase error:', error.message, error.code);
      return Response.json(
        { error: 'Failed to fetch exam questions', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    const questions = (data || []) as ExamQuestion[];

    if (!questions.length) {
      return Response.json(
        { error: 'No questions found for the provided exam filters' },
        { status: 404 }
      );
    }

    const candidateQuestions = questions
      .filter((question) => String(question.question_text || '').trim().length > 0)
      .filter((question) => {
        if (question.question_type === 'multiple_choice') {
          return (
            String(question.mcq_explanation || '').trim().length > 0
            || String(question.mcq_correct_answer || '').trim().length > 0
          );
        }
        return String(question.sample_answer || '').trim().length > 0;
      })
      .sort(sortByQuestionNumber);

    const verificationUnits = buildVerificationUnits(candidateQuestions);

    if (!candidateQuestions.length) {
      return Response.json(
        {
          success: true,
          totalFetched: questions.length,
          checkedCount: 0,
          incorrectCount: 0,
          corrections: [],
          message: 'No verifiable questions were found in this exam (written questions need sample answers; MCQ questions need a correct answer or explanation).',
        },
        { status: 200 }
      );
    }

    const corrections: Array<{
      questionId: string;
      questionNumber: string | null;
      correctedSolutionLatex: string;
    }> = [];
    const unchangedQuestions: Array<{
      questionId: string;
      questionNumber: string | null;
      status: 'correct' | 'no_model_output';
    }> = [];

    const updatedQuestions: Array<{
      questionId: string;
      questionNumber: string | null;
      previousSampleAnswer: string;
      updatedSampleAnswer: string;
    }> = [];

    const failedUpdates: Array<{
      questionId: string;
      questionNumber: string | null;
      error: string;
    }> = [];

    for (const unit of verificationUnits) {
      const isGroupedUnit = unit.length > 1;
      const images = unit.flatMap((question) => collectVerificationImages(question));
      const dedupedImages: VerificationImageInput[] = [];
      const seenImageUrls = new Set<string>();
      for (const image of images) {
        if (seenImageUrls.has(image.url)) continue;
        seenImageUrls.add(image.url);
        dedupedImages.push(image);
      }

      const imageContext = images.length
        ? `\n\nATTACHED_IMAGES:\n${dedupedImages.map((img, index) => `${index + 1}. ${img.label}`).join('\n')}`
        : '';

      const promptText = isGroupedUnit
        ? buildGroupedVerificationPrompt(unit)
        : buildVerificationPrompt(unit[0]);

      const userContent: Array<Record<string, unknown>> = [
        {
          type: 'text',
          text: `${promptText}${imageContext}`,
        },
      ];

      dedupedImages.forEach((image) => {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: image.url,
            detail: 'high',
          },
        });
      });

      const completion = await openai.chat.completions.create({
        model: VERIFY_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You verify mathematics solutions. Follow the output rules exactly. Never include markdown fences.',
          },
          {
            role: 'user',
            content: userContent as any,
          },
        ],
        max_completion_tokens: 3000,
      });

      const modelOutput = String(completion.choices?.[0]?.message?.content || '').trim();
      if (!modelOutput) {
        unit.forEach((question) => {
          unchangedQuestions.push({
            questionId: question.id,
            questionNumber: question.question_number,
            status: 'no_model_output',
          });
        });
        continue;
      }

      if (isCorrectVerdict(modelOutput)) {
        unit.forEach((question) => {
          unchangedQuestions.push({
            questionId: question.id,
            questionNumber: question.question_number,
            status: 'correct',
          });
        });
        continue;
      }

      const correctionsForUnit: ParsedGroupCorrection[] = isGroupedUnit
        ? parseGroupedCorrections(modelOutput)
        : (() => {
            const single = unit[0];
            if (single.question_type === 'multiple_choice') {
              const parsedMcq = parseSingleMcqCorrection(modelOutput);
              if (!parsedMcq) return [];
              return [{
                questionId: single.id,
                correctedSolutionLatex: parsedMcq.correctedSolutionLatex,
                correctedMcqAnswer: parsedMcq.correctedMcqAnswer,
              }];
            }
            return [{ questionId: single.id, correctedSolutionLatex: modelOutput }];
          })();

      if (!correctionsForUnit.length) {
        unit.forEach((question) => {
          unchangedQuestions.push({
            questionId: question.id,
            questionNumber: question.question_number,
            status: 'no_model_output',
          });
        });
        continue;
      }

      const correctionById = new Map(correctionsForUnit.map((item) => [item.questionId, item]));

      for (const question of unit) {
        const correction = correctionById.get(question.id);
        if (!correction) {
          unchangedQuestions.push({
            questionId: question.id,
            questionNumber: question.question_number,
            status: 'correct',
          });
          continue;
        }

        const correctedSolutionLatex = correction.correctedSolutionLatex;

        corrections.push({
          questionId: question.id,
          questionNumber: question.question_number,
          correctedSolutionLatex,
        });

        if (!applyUpdates) {
          continue;
        }

        const isMcq = question.question_type === 'multiple_choice';
        const previousSampleAnswer = String(isMcq ? question.mcq_explanation || '' : question.sample_answer || '').trim();
        const nextMcqAnswer = correction.correctedMcqAnswer || question.mcq_correct_answer || null;
        const updatePayload = isMcq
          ? { mcq_explanation: correctedSolutionLatex, mcq_correct_answer: nextMcqAnswer }
          : { sample_answer: correctedSolutionLatex };

        const { error: updateError } = await supabaseAdmin
          .from('hsc_questions')
          .update(updatePayload)
          .eq('id', question.id);

        if (updateError) {
          failedUpdates.push({
            questionId: question.id,
            questionNumber: question.question_number,
            error: updateError.message,
          });
          continue;
        }

        updatedQuestions.push({
          questionId: question.id,
          questionNumber: question.question_number,
          previousSampleAnswer,
          updatedSampleAnswer: correctedSolutionLatex,
        });
      }
    }

    const unchangedCount = unchangedQuestions.length;
    const attemptedUpdateCount = corrections.length;
    const successfulUpdateCount = updatedQuestions.length;
    const failedUpdateCount = failedUpdates.length;

    const updatedQuestionNumbers = updatedQuestions
      .map((item) => item.questionNumber || item.questionId)
      .join(', ');
    const unchangedQuestionNumbers = unchangedQuestions
      .map((item) => item.questionNumber || item.questionId)
      .join(', ');

    const userFeedback = applyUpdates
      ? `Checked ${candidateQuestions.length} questions. Updated ${successfulUpdateCount} question(s)${
          updatedQuestionNumbers ? ` (${updatedQuestionNumbers})` : ''
        }. Left unchanged ${unchangedCount} question(s)${
          unchangedQuestionNumbers ? ` (${unchangedQuestionNumbers})` : ''
        }.${failedUpdateCount ? ` Failed to update ${failedUpdateCount} question(s).` : ''}`
      : `Checked ${candidateQuestions.length} questions in dry-run mode. Would update ${attemptedUpdateCount} question(s). Left unchanged ${unchangedCount} question(s).`;

    return Response.json({
      success: true,
      mode: applyUpdates ? 'apply_updates' : 'dry_run',
      model: VERIFY_MODEL,
      totalFetched: questions.length,
      checkedCount: candidateQuestions.length,
      incorrectCount: corrections.length,
      unchangedCount,
      attemptedUpdateCount,
      successfulUpdateCount,
      failedUpdateCount,
      userFeedback,
      unchangedQuestions,
      updatedQuestions,
      failedUpdates,
      corrections,
    });
  } catch (error) {
    console.error('[verify-solutions] API error:', error);
    return Response.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

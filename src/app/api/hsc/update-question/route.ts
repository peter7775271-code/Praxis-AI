import { supabaseAdmin } from '@/lib/db';

const extractMissingColumn = (message: string): string | null => {
  const quoted = message.match(/Could not find the '([^']+)' column/i);
  if (quoted?.[1]) return quoted[1];

  const postgres = message.match(/column\s+"?([a-zA-Z0-9_]+)"?(?:\s+of\s+relation\s+"?[a-zA-Z0-9_]+"?)?\s+does not exist/i);
  if (postgres?.[1]) return postgres[1];

  return null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      questionId,
      grade,
      year,
      schoolName,
      school,
      school_name,
      paperNumber,
      paperLabel,
      examIncomplete,
      subject,
      topic,
      subtopic,
      syllabusDotPoint,
      marks,
      questionNumber,
      questionText,
      markingCriteria,
      sampleAnswer,
      sampleAnswerImage,
      sampleAnswerImageSize,
      graphImageData,
      graphImageSize,
      questionType,
      mcqOptionA,
      mcqOptionB,
      mcqOptionC,
      mcqOptionD,
      mcqOptionAImage,
      mcqOptionBImage,
      mcqOptionCImage,
      mcqOptionDImage,
      mcqCorrectAnswer,
      mcqExplanation,
    } = body;

    if (!questionId) {
      return Response.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    const parsedMarks = Number.parseInt(String(marks), 10);
    const parsedPaperNumber = Number.parseInt(String(paperNumber ?? ''), 10);

    if (!grade || !year || !subject || !topic || !questionText) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(parsedMarks) || parsedMarks < 0) {
      return Response.json(
        { error: 'Marks must be a valid non-negative integer' },
        { status: 400 }
      );
    }

    const resolvedQuestionType = questionType || 'written';

    const incomingSchoolName = String(schoolName ?? school ?? school_name ?? '').trim();
    let resolvedSchoolName = incomingSchoolName;

    if (!resolvedSchoolName) {
      const { data: existingQuestion, error: existingQuestionError } = await supabaseAdmin
        .from('hsc_questions')
        .select('school_name')
        .eq('id', questionId)
        .single();

      if (existingQuestionError) {
        return Response.json(
          { error: 'Failed to resolve school_name for update: ' + existingQuestionError.message },
          { status: 500 }
        );
      }

      resolvedSchoolName = String(existingQuestion?.school_name || '').trim();
    }

    if (!resolvedSchoolName) {
      return Response.json(
        { error: 'school_name is required for this question and could not be resolved' },
        { status: 400 }
      );
    }

    if (resolvedQuestionType === 'multiple_choice') {
      const hasOption = (t: string | undefined, img: string | undefined) => (t && t.trim()) || (img && img.trim());
      if (
        !hasOption(mcqOptionA, mcqOptionAImage) ||
        !hasOption(mcqOptionB, mcqOptionBImage) ||
        !hasOption(mcqOptionC, mcqOptionCImage) ||
        !hasOption(mcqOptionD, mcqOptionDImage) ||
        !mcqCorrectAnswer ||
        !mcqExplanation
      ) {
        return Response.json(
          { error: 'Each MCQ option must have either text or image; correct answer and explanation required' },
          { status: 400 }
        );
      }
    }

    const basePayload: Record<string, unknown> = {
      grade,
      year: parseInt(year),
      school_name: resolvedSchoolName,
      subject,
      topic,
      subtopic: subtopic || null,
      syllabus_dot_point: syllabusDotPoint || null,
      marks: parsedMarks,
      question_number: questionNumber || null,
      question_text: questionText,
      question_type: resolvedQuestionType,
      marking_criteria: resolvedQuestionType === 'multiple_choice' ? null : (markingCriteria || null),
      sample_answer: resolvedQuestionType === 'multiple_choice' ? null : (sampleAnswer || null),
      sample_answer_image: resolvedQuestionType === 'multiple_choice' ? null : (sampleAnswerImage || null),
      sample_answer_image_size: resolvedQuestionType === 'multiple_choice' ? null : (sampleAnswerImageSize || null),
      mcq_option_a: resolvedQuestionType === 'multiple_choice' ? (mcqOptionA || null) : null,
      mcq_option_b: resolvedQuestionType === 'multiple_choice' ? (mcqOptionB || null) : null,
      mcq_option_c: resolvedQuestionType === 'multiple_choice' ? (mcqOptionC || null) : null,
      mcq_option_d: resolvedQuestionType === 'multiple_choice' ? (mcqOptionD || null) : null,
      mcq_option_a_image: resolvedQuestionType === 'multiple_choice' ? (mcqOptionAImage || null) : null,
      mcq_option_b_image: resolvedQuestionType === 'multiple_choice' ? (mcqOptionBImage || null) : null,
      mcq_option_c_image: resolvedQuestionType === 'multiple_choice' ? (mcqOptionCImage || null) : null,
      mcq_option_d_image: resolvedQuestionType === 'multiple_choice' ? (mcqOptionDImage || null) : null,
      mcq_correct_answer: resolvedQuestionType === 'multiple_choice' ? String(mcqCorrectAnswer).toUpperCase() : null,
      mcq_explanation: resolvedQuestionType === 'multiple_choice' ? mcqExplanation : null,
      graph_image_data: graphImageData || null,
      graph_image_size: graphImageSize || 'medium',
      paper_number: Number.isInteger(parsedPaperNumber) && parsedPaperNumber > 0 ? parsedPaperNumber : null,
      paper_label: paperLabel || null,
      ...(typeof examIncomplete === 'boolean' ? { exam_incomplete: examIncomplete } : {}),
    };

    const payload: Record<string, unknown> = { ...basePayload };
    let data: unknown = null;
    let error: { message: string } | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const result = await supabaseAdmin
        .from('hsc_questions')
        .update(payload)
        .eq('id', questionId)
        .select();

      if (!result.error) {
        data = result.data;
        error = null;
        break;
      }

      const missingColumn = extractMissingColumn(String(result.error.message || ''));
      if (!missingColumn || !(missingColumn in payload)) {
        error = { message: String(result.error.message || 'Unknown update error') };
        break;
      }

      delete payload[missingColumn];
      error = { message: String(result.error.message || 'Unknown update error') };
    }

    if (error) {
      console.error('Database error:', error);
      return Response.json(
        { error: 'Failed to update question: ' + error.message },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: 'Question updated successfully',
      data,
    });
  } catch (error) {
    console.error('API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

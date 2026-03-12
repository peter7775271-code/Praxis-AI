import { supabaseAdmin } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET saved attempts for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    const { data: attemptsData, error } = await supabaseAdmin
      .from('student_saved_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch saved attempts', details: error.message },
        { status: 500 }
      );
    }

    const attempts = Array.isArray(attemptsData) ? attemptsData : [];
    const questionIds = Array.from(
      new Set(
        attempts
          .map((attempt) => String(attempt.question_id || '').trim())
          .filter(Boolean)
      )
    );

    const questionById = new Map<string, Record<string, unknown>>();

    if (questionIds.length > 0) {
      const { data: questionRows, error: questionError } = await supabaseAdmin
        .from('hsc_questions')
        .select('id, grade, year, subject, topic, marks, question_type, question_text, marking_criteria, sample_answer, mcq_option_a, mcq_option_b, mcq_option_c, mcq_option_d, mcq_option_a_image, mcq_option_b_image, mcq_option_c_image, mcq_option_d_image, mcq_correct_answer, mcq_explanation')
        .in('id', questionIds);

      if (questionError) {
        return NextResponse.json(
          { error: 'Failed to fetch related questions', details: questionError.message },
          { status: 500 }
        );
      }

      (Array.isArray(questionRows) ? questionRows : []).forEach((question) => {
        questionById.set(String(question.id), question);
      });
    }

    const hydratedAttempts = attempts.map((attempt) => ({
      ...attempt,
      hsc_questions: questionById.get(String(attempt.question_id || '')) ?? null,
    }));

    return NextResponse.json({ attempts: hydratedAttempts });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// POST new saved attempt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, question_id, canvas_image_url, feedback_json } = body;

    if (!user_id || !question_id) {
      return NextResponse.json(
        { error: 'user_id and question_id are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('student_saved_attempts')
      .insert([
        {
          user_id,
          question_id,
          canvas_image_url,
          feedback_json: feedback_json || null,
        }
      ])
      .select();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save attempt', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ attempt: data?.[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

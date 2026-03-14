import { supabaseAdmin } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const isMissingColumnError = (message: string) => {
  return /Could not find the '[^']+' column|column\s+"?[^"\s]+"?\s+does not exist/i.test(message);
};

const HSC_QUESTION_COLUMNS = [
  'id', 'grade', 'year', 'subject', 'school_name', 'paper_number', 'paper_label',
  'topic', 'subtopic', 'syllabus_dot_point', 'marks', 'question_number',
  'question_text', 'question_type', 'graph_image_data', 'graph_image_size',
  'marking_criteria', 'sample_answer', 'sample_answer_image', 'sample_answer_image_size',
  'mcq_option_a', 'mcq_option_b', 'mcq_option_c', 'mcq_option_d',
  'mcq_option_a_image', 'mcq_option_b_image', 'mcq_option_c_image', 'mcq_option_d_image',
  'mcq_correct_answer', 'mcq_explanation', 'created_at',
  'exam_incomplete', 'group_id', 'review_flag',
].join(', ');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const grade = searchParams.get('grade');
    const year = searchParams.get('year');
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');
    const includeIncomplete = searchParams.get('includeIncomplete') === 'true';

    const applyFilters = (query: any, excludeIncomplete: boolean) => {
      if (grade) query = query.eq('grade', grade);
      if (year) query = query.eq('year', parseInt(year));
      if (subject) query = query.eq('subject', subject);
      if (topic) query = query.eq('topic', topic);
      if (excludeIncomplete) query = query.neq('exam_incomplete', true);
      return query;
    };

    let shouldExcludeIncomplete = !includeIncomplete;

    // Step 1: Get the count of matching questions (transfers no row data)
    let { count, error: countError } = await applyFilters(
      supabaseAdmin.from('hsc_questions').select('*', { count: 'exact', head: true }),
      shouldExcludeIncomplete
    );

    if (countError && shouldExcludeIncomplete && isMissingColumnError(String(countError.message || ''))) {
      shouldExcludeIncomplete = false;
      const retryResult = await applyFilters(
        supabaseAdmin.from('hsc_questions').select('*', { count: 'exact', head: true }),
        false
      );
      count = retryResult.count;
      countError = retryResult.error;
    }

    if (countError) {
      console.error('[questions] Supabase error:', countError.message, (countError as any).code);
      return NextResponse.json(
        { error: 'Failed to fetch questions', details: countError.message, code: (countError as any).code },
        { status: 500 }
      );
    }

    if (!count || count === 0) {
      return NextResponse.json(
        { error: 'No questions found matching filters', filters: { grade, year, subject, topic } },
        { status: 404 }
      );
    }

    // Step 2: Fetch only the single random question using a random offset
    const randomOffset = Math.floor(Math.random() * count);
    let { data: rows, error } = await applyFilters(
      supabaseAdmin.from('hsc_questions').select(HSC_QUESTION_COLUMNS),
      shouldExcludeIncomplete
    ).range(randomOffset, randomOffset);

    if (error && isMissingColumnError(String(error.message || ''))) {
      // Fall back to selecting all columns when an explicit column is missing from the schema
      const retryResult = await applyFilters(
        supabaseAdmin.from('hsc_questions').select('*'),
        shouldExcludeIncomplete
      ).range(randomOffset, randomOffset);
      rows = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error('[questions] Supabase error:', error.message, error.code);
      return NextResponse.json(
        { error: 'Failed to fetch questions', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    const randomQuestion = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!randomQuestion) {
      return NextResponse.json(
        { error: 'No questions found matching filters', filters: { grade, year, subject, topic } },
        { status: 404 }
      );
    }

    return NextResponse.json({ question: randomQuestion });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

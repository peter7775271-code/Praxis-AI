import { supabaseAdmin } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const grade = searchParams.get('grade');
    const year = searchParams.get('year');
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');
    const school = searchParams.get('school');
    const questionType = searchParams.get('questionType');
    const search = searchParams.get('search');
    const missingImagesOnly = searchParams.get('missingImagesOnly') === 'true';

    const buildQuery = () => {
      let query = supabaseAdmin
        .from('hsc_questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (grade) query = query.eq('grade', grade);
      if (year) query = query.eq('year', Number.parseInt(year, 10));
      if (subject) query = query.eq('subject', subject);
      if (topic) query = query.eq('topic', topic);
      if (school) query = query.eq('school_name', school);
      if (questionType && questionType !== 'all') query = query.eq('question_type', questionType);
      if (missingImagesOnly) {
        query = query.eq('graph_image_size', 'missing').is('graph_image_data', null);
      }
      if (search) {
        const escaped = search.trim().replace(/,/g, '\\,');
        if (escaped) {
          query = query.or(
            `question_number.ilike.%${escaped}%,subject.ilike.%${escaped}%,topic.ilike.%${escaped}%,question_text.ilike.%${escaped}%,grade.ilike.%${escaped}%,school_name.ilike.%${escaped}%`
          );
        }
      }

      return query;
    };

    const PAGE_SIZE = 1000;
    let from = 0;
    const allRows: any[] = [];

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await buildQuery().range(from, to);

      if (error) {
        console.error('[all-questions] Supabase error:', error.message, error.code);
        return Response.json(
          { error: 'Failed to fetch questions', details: error.message, code: error.code },
          { status: 500 }
        );
      }

      const pageRows = Array.isArray(data) ? data : [];
      allRows.push(...pageRows);

      if (pageRows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return Response.json(allRows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[all-questions] Error:', message);
    return Response.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}

import { supabaseAdmin } from '@/lib/db';

const isMissingColumnError = (message: string) => {
  return /Could not find the 'exam_incomplete' column|column\s+"?exam_incomplete"?\s+does not exist/i.test(message);
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const readValues = (key: string) => searchParams.getAll(key).map((value) => value.trim()).filter(Boolean);
    const grades = readValues('grade');
    const years = readValues('year')
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));
    const subjects = readValues('subject');
    const topics = readValues('topic');
    const schools = readValues('school');
    const questionTypes = readValues('questionType').filter((value) => value !== 'all');
    const search = searchParams.get('search');
    const missingImagesOnly = searchParams.get('missingImagesOnly') === 'true';
    const includeIncomplete = searchParams.get('includeIncomplete') === 'true';

    const buildQuery = (excludeIncomplete: boolean) => {
      let query = supabaseAdmin
        .from('hsc_questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (grades.length === 1) query = query.eq('grade', grades[0]);
      if (grades.length > 1) query = query.in('grade', grades);
      if (years.length === 1) query = query.eq('year', years[0]);
      if (years.length > 1) query = query.in('year', years);
      if (subjects.length === 1) query = query.eq('subject', subjects[0]);
      if (subjects.length > 1) query = query.in('subject', subjects);
      if (topics.length === 1) query = query.eq('topic', topics[0]);
      if (topics.length > 1) query = query.in('topic', topics);
      if (schools.length === 1) query = query.eq('school_name', schools[0]);
      if (schools.length > 1) query = query.in('school_name', schools);
      if (questionTypes.length === 1) query = query.eq('question_type', questionTypes[0]);
      if (questionTypes.length > 1) query = query.in('question_type', questionTypes);
      if (missingImagesOnly) {
        query = query.eq('graph_image_size', 'missing').is('graph_image_data', null);
      }
      if (excludeIncomplete) {
        query = query.neq('exam_incomplete', true);
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
    let shouldExcludeIncomplete = !includeIncomplete;
    let hasRetriedWithoutIncompleteFilter = false;

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await buildQuery(shouldExcludeIncomplete).range(from, to);

      if (error) {
        if (
          shouldExcludeIncomplete
          && !hasRetriedWithoutIncompleteFilter
          && isMissingColumnError(String(error.message || ''))
        ) {
          hasRetriedWithoutIncompleteFilter = true;
          shouldExcludeIncomplete = false;
          from = 0;
          allRows.length = 0;
          continue;
        }

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

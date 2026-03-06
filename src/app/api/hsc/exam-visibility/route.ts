import { supabaseAdmin } from '@/lib/db';

const isMissingColumnError = (message: string) => {
  return /Could not find the 'exam_incomplete' column|column\s+"?exam_incomplete"?\s+does not exist/i.test(message);
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const year = Number.parseInt(String(body?.year), 10);
    const grade = String(body?.grade || '').trim();
    const subject = String(body?.subject || '').trim();
    const school = String(body?.school || '').trim() || 'HSC';
    const isIncomplete = Boolean(body?.isIncomplete);

    if (!Number.isFinite(year) || !grade || !subject) {
      return Response.json(
        { error: 'year, grade and subject are required' },
        { status: 400 }
      );
    }

    const update = await supabaseAdmin
      .from('hsc_questions')
      .update({ exam_incomplete: isIncomplete })
      .eq('year', year)
      .eq('grade', grade)
      .eq('subject', subject)
      .eq('school_name', school)
      .select('id');

    if (update.error) {
      const message = String(update.error.message || 'Failed to update exam visibility');
      if (isMissingColumnError(message)) {
        return Response.json(
          {
            error: 'Database column exam_incomplete is missing. Run scripts/add-exam-incomplete-flag.sql first.',
            details: message,
          },
          { status: 400 }
        );
      }

      return Response.json(
        { error: 'Failed to update exam visibility', details: message },
        { status: 500 }
      );
    }

    const updatedCount = Array.isArray(update.data) ? update.data.length : 0;

    return Response.json({
      success: true,
      updatedCount,
      isIncomplete,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}

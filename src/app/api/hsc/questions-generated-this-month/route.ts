import { supabaseAdmin } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    // Use UTC boundaries so "this month" is consistent regardless of client timezone.
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth(); // 0-11

    const since = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString();
    const until = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0)).toISOString();

    const { count, error } = await supabaseAdmin
      .from('hsc_questions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .lt('created_at', until);

    if (error) {
      console.error('[questions-generated-this-month] Supabase error:', error.message, error.code);
      return Response.json(
        { error: 'Failed to fetch monthly question count', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return Response.json({ count: count ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[questions-generated-this-month] Error:', message);
    return Response.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}


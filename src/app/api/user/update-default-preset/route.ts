import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';
import { SUBJECTS_BY_YEAR } from '../../../dashboard/syllabus-config';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json()) as { grade?: string; subject?: string };
    const grade = String(body.grade ?? '').trim();
    const subject = String(body.subject ?? '').trim();

    if (!grade || !subject) {
      return NextResponse.json({ error: 'Missing grade or subject' }, { status: 400 });
    }

    const allowedSubjects = SUBJECTS_BY_YEAR[grade as keyof typeof SUBJECTS_BY_YEAR] ?? [];
    if (!allowedSubjects.includes(subject)) {
      return NextResponse.json(
        { error: 'Selected subject is not valid for the chosen year level' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ default_grade: grade, default_subject: subject })
      .eq('id', decoded.userId);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to update preset' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


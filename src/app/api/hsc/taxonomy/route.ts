import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const runtime = 'nodejs';

const NO_DOT_POINT_PLACEHOLDER = '__NO_DOT_POINT__';

/**
 * GET /api/hsc/taxonomy?grade=Year+12&subject=Mathematics+Advanced
 *
 * Returns taxonomy rows grouped by topic → subtopic → dot points.
 * Optional query params: topic (filter to a single topic).
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const grade = searchParams.get('grade')?.trim() || '';
        const subject = searchParams.get('subject')?.trim() || '';
        const topicFilter = searchParams.get('topic')?.trim() || '';

        if (!grade || !subject) {
            return NextResponse.json(
                { error: 'grade and subject query params are required' },
                { status: 400 }
            );
        }

        let query = supabaseAdmin
            .from('syllabus_taxonomy')
            .select('id, grade, subject, topic, subtopic, dot_point_text, dot_point_code, sort_order')
            .eq('grade', grade)
            .eq('subject', subject)
            .order('topic', { ascending: true })
            .order('subtopic', { ascending: true })
            .order('sort_order', { ascending: true });

        if (topicFilter) {
            query = query.eq('topic', topicFilter);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[taxonomy] Supabase error:', error.message);
            return NextResponse.json(
                { error: `Failed to fetch taxonomy: ${error.message}` },
                { status: 500 }
            );
        }

        const rows = Array.isArray(data) ? data : [];

        // Group into hierarchy: { [topic]: { [subtopic]: { id, text }[] } }
        const grouped: Record<string, Record<string, { id: string; text: string }[]>> = {};
        for (const row of rows) {
            const topic = String(row.topic || '').trim();
            const subtopic = String(row.subtopic || '').trim();
            const dotPoint = String(row.dot_point_text || '').trim();
            const id = String(row.id || '');
            if (!topic || !subtopic || !id) continue;
            if (!grouped[topic]) grouped[topic] = {};
            if (!grouped[topic][subtopic]) grouped[topic][subtopic] = [];
            if (!dotPoint || dotPoint === NO_DOT_POINT_PLACEHOLDER) continue;
            if (!grouped[topic][subtopic].some((d) => d.id === id)) {
                grouped[topic][subtopic].push({ id, text: dotPoint });
            }
        }

        return NextResponse.json({ rows, grouped });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('[taxonomy] Error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

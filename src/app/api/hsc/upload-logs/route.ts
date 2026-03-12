import { supabaseAdmin } from '@/lib/db';

type UploadLogRow = {
  id: string;
  created_at: string | null;
  question_number: string | null;
  question_text: string | null;
  question_type: string | null;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  year: number | null;
  school_name: string | null;
  marks: number | null;
  paper_number: number | null;
};

const PAGE_SIZE = 1000;

const detectUploadSource = (row: UploadLogRow) => {
  const schoolName = String(row.school_name || '').toLowerCase();
  return schoolName.includes('pdf') ? 'pdf-ingest' : 'manual';
};

export async function GET() {
  try {
    const rows: UploadLogRow[] = [];
    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabaseAdmin
        .from('hsc_questions')
        .select('id, created_at, question_number, question_text, question_type, subject, topic, grade, year, school_name, marks, paper_number')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('[upload-logs] Supabase error:', error.message, error.code);
        return Response.json(
          { error: 'Failed to fetch upload logs', details: error.message, code: error.code },
          { status: 500 }
        );
      }

      const pageRows = Array.isArray(data) ? (data as UploadLogRow[]) : [];
      rows.push(...pageRows);

      if (pageRows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const uploadLogs = rows.map((row) => ({
      id: row.id,
      uploadedAt: row.created_at || new Date(0).toISOString(),
      level: detectUploadSource(row),
      subject: row.subject || 'Unknown subject',
      questionText: row.question_text || 'Untitled question',
      status: 'uploaded',
      tags: [row.question_type || 'written', row.grade || 'Unknown grade', row.topic || 'Unknown topic'].filter(Boolean),
      grade: row.grade || 'Unknown grade',
      year: Number(row.year || 0),
      topic: row.topic || 'Unknown topic',
      questionNumber: row.question_number,
      schoolName: row.school_name,
      marks: row.marks,
      paperNumber: row.paper_number,
    }));

    return Response.json(uploadLogs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[upload-logs] Error:', message);
    return Response.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
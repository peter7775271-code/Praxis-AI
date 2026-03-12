import { supabaseAdmin } from '@/lib/db';

const isMissingGroupColumnError = (message: string) => {
  return /Could not find the 'group_id' column|column\s+"?group_id"?\s+does not exist/i.test(message);
};

const normalizeQuestionNumber = (value: string | null | undefined) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return {
      baseNumber: null as number | null,
      letter: null as string | null,
      roman: null as string | null,
    };
  }

  const match = trimmed.match(/^(\d+)\s*(?:\(?([a-z])\)?)?\s*(?:\(?((?:ix|iv|v?i{0,3}|x))\)?)?$/i);

  return {
    baseNumber: match?.[1] ? Number.parseInt(match[1], 10) : null,
    letter: match?.[2] ? match[2].toLowerCase() : null,
    roman: match?.[3] ? match[3].toLowerCase() : null,
  };
};

const buildPaperScopedGroupId = (paper: {
  year: number;
  grade: string;
  subject: string;
  school: string;
  paperNumber: number | null;
  baseNumber: number;
}) => {
  return [
    'paper-group',
    paper.year,
    paper.grade,
    paper.subject,
    paper.school,
    paper.paperNumber == null ? 'no-paper' : `paper-${paper.paperNumber}`,
    `q${paper.baseNumber}`,
  ].join('::');
};

const chunk = <T,>(values: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const isEligibleAutoGroupingSubject = (subject: string) => {
  const normalized = String(subject || '').trim().toLowerCase();
  return normalized === 'mathematics' || normalized === 'mathematics advanced';
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body?.action || '').trim();

    if (action === 'assign' || action === 'clear') {
      const questionIds = Array.isArray(body?.questionIds)
        ? body.questionIds.map((value: unknown) => String(value || '').trim()).filter(Boolean)
        : [];

      if (!questionIds.length) {
        return Response.json({ error: 'questionIds are required' }, { status: 400 });
      }

      const groupId = action === 'assign'
        ? String(body?.groupId || `manual-group::${Date.now()}::${Math.random().toString(36).slice(2, 10)}`)
        : null;

      const update = await supabaseAdmin
        .from('hsc_questions')
        .update({ group_id: groupId })
        .in('id', questionIds)
        .select('id, group_id');

      if (update.error) {
        const message = String(update.error.message || 'Failed to update question groups');
        if (isMissingGroupColumnError(message)) {
          return Response.json(
            {
              error: 'Database column group_id is missing. Run scripts/add-question-group-id.sql first.',
              details: message,
            },
            { status: 400 }
          );
        }

        return Response.json(
          { error: 'Failed to update question groups', details: message },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        groupId,
        updatedQuestions: Array.isArray(update.data) ? update.data : [],
      });
    }

    if (action === 'auto-group-paper') {
      const year = Number.parseInt(String(body?.year), 10);
      const grade = String(body?.grade || '').trim();
      const subject = String(body?.subject || '').trim();
      const school = String(body?.school || '').trim() || 'HSC';
      const parsedPaperNumber = Number.parseInt(String(body?.paperNumber ?? ''), 10);
      const paperNumber = Number.isInteger(parsedPaperNumber) ? parsedPaperNumber : null;

      if (!Number.isFinite(year) || !grade || !subject) {
        return Response.json(
          { error: 'year, grade and subject are required' },
          { status: 400 }
        );
      }

      if (!isEligibleAutoGroupingSubject(subject)) {
        return Response.json(
          { error: 'Auto-grouping is only enabled for Mathematics and Mathematics Advanced papers.' },
          { status: 400 }
        );
      }

      let query = supabaseAdmin
        .from('hsc_questions')
        .select('id, question_number, group_id')
        .eq('year', year)
        .eq('grade', grade)
        .eq('subject', subject)
        .eq('school_name', school);

      query = paperNumber == null ? query.is('paper_number', null) : query.eq('paper_number', paperNumber);

      const paperQuestionsResult = await query;

      if (paperQuestionsResult.error) {
        const message = String(paperQuestionsResult.error.message || 'Failed to load paper questions');
        if (isMissingGroupColumnError(message)) {
          return Response.json(
            {
              error: 'Database column group_id is missing. Run scripts/add-question-group-id.sql first.',
              details: message,
            },
            { status: 400 }
          );
        }

        return Response.json(
          { error: 'Failed to load paper questions', details: message },
          { status: 500 }
        );
      }

      const paperQuestions = Array.isArray(paperQuestionsResult.data)
        ? paperQuestionsResult.data as Array<{ id: string; question_number: string | null; group_id?: string | null }>
        : [];

      const groupedByBaseNumber = new Map<number, string[]>();
      paperQuestions.forEach((question) => {
        const parsed = normalizeQuestionNumber(question.question_number);
        if (!parsed.baseNumber || !parsed.letter) return;
        const existing = groupedByBaseNumber.get(parsed.baseNumber) || [];
        existing.push(question.id);
        groupedByBaseNumber.set(parsed.baseNumber, existing);
      });

      const nextGroupByQuestionId: Record<string, string> = {};
      groupedByBaseNumber.forEach((questionIds, baseNumber) => {
        if (questionIds.length < 2) return;
        const groupId = buildPaperScopedGroupId({
          year,
          grade,
          subject,
          school,
          paperNumber,
          baseNumber,
        });

        questionIds.forEach((questionId) => {
          nextGroupByQuestionId[questionId] = groupId;
        });
      });

      const idsToClear = paperQuestions
        .filter((question) => !nextGroupByQuestionId[question.id] && String(question.group_id || '').trim())
        .map((question) => question.id);

      const groupedIds = Object.keys(nextGroupByQuestionId);
      const groupedIdsByGroupId = new Map<string, string[]>();
      groupedIds.forEach((questionId) => {
        const groupId = nextGroupByQuestionId[questionId];
        const existing = groupedIdsByGroupId.get(groupId) || [];
        existing.push(questionId);
        groupedIdsByGroupId.set(groupId, existing);
      });

      for (const [groupId, questionIds] of groupedIdsByGroupId.entries()) {
        for (const questionIdsChunk of chunk(questionIds, 200)) {
          const update = await supabaseAdmin
            .from('hsc_questions')
            .update({ group_id: groupId })
            .in('id', questionIdsChunk);

          if (update.error) {
            const message = String(update.error.message || 'Failed to assign auto-group ids');
            if (isMissingGroupColumnError(message)) {
              return Response.json(
                {
                  error: 'Database column group_id is missing. Run scripts/add-question-group-id.sql first.',
                  details: message,
                },
                { status: 400 }
              );
            }

            return Response.json(
              { error: 'Failed to assign auto-group ids', details: message },
              { status: 500 }
            );
          }
        }
      }

      for (const questionIdsChunk of chunk(idsToClear, 200)) {
        const clear = await supabaseAdmin
          .from('hsc_questions')
          .update({ group_id: null })
          .in('id', questionIdsChunk);

        if (clear.error) {
          const message = String(clear.error.message || 'Failed to clear stale question groups');
          if (isMissingGroupColumnError(message)) {
            return Response.json(
              {
                error: 'Database column group_id is missing. Run scripts/add-question-group-id.sql first.',
                details: message,
              },
              { status: 400 }
            );
          }

          return Response.json(
            { error: 'Failed to clear stale question groups', details: message },
            { status: 500 }
          );
        }
      }

      let updatedQuestionsQuery = supabaseAdmin
        .from('hsc_questions')
        .select('id, group_id')
        .eq('year', year)
        .eq('grade', grade)
        .eq('subject', subject)
        .eq('school_name', school);

      updatedQuestionsQuery = paperNumber == null
        ? updatedQuestionsQuery.is('paper_number', null)
        : updatedQuestionsQuery.eq('paper_number', paperNumber);

      const updatedQuestionsResult = await updatedQuestionsQuery;

      if (updatedQuestionsResult.error) {
        const message = String(updatedQuestionsResult.error.message || 'Failed to reload grouped paper questions');
        if (isMissingGroupColumnError(message)) {
          return Response.json(
            {
              error: 'Database column group_id is missing. Run scripts/add-question-group-id.sql first.',
              details: message,
            },
            { status: 400 }
          );
        }

        return Response.json(
          { error: 'Failed to reload grouped paper questions', details: message },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        groupCount: groupedIdsByGroupId.size,
        groupedQuestionCount: groupedIds.length,
        updatedQuestions: Array.isArray(updatedQuestionsResult.data) ? updatedQuestionsResult.data : [],
      });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
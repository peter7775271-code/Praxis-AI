import { NextRequest, NextResponse } from 'next/server';
import {
  verifyToken,
  getUserById,
  resetMonthlyExportsIfDue,
  incrementExportCount,
  consumeQuestionTokens,
  PLAN_EXPORT_LIMITS,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { grade?: string };
    const requestedGrade = String(body.grade || '').trim();

    let user = await getUserById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user = await resetMonthlyExportsIfDue(user);

    const plan = user.plan ?? 'free';
    const limit = PLAN_EXPORT_LIMITS[plan];
    const used = user.exports_used_this_month ?? 0;

    if (used >= limit) {
      const message = limit === 0
        ? 'Exam generation tokens are not included in the free plan. Upgrade to Standard or Pro to generate exams.'
        : `Monthly exam generation token limit reached (${used}/${limit}). Upgrade your plan or wait until next month.`;

      return NextResponse.json(
        {
          error: message,
          code: 'EXAM_GENERATION_TOKEN_LIMIT_REACHED',
          tokensUsed: used,
          tokensLimit: limit,
          tokensRemaining: Math.max(0, limit - used),
        },
        { status: 429 }
      );
    }

    let usedQuestionTokenForYearOverride = false;
    let questionTokensRemaining: number | null = null;

    if (plan === 'standard' && (requestedGrade === 'Year 11' || requestedGrade === 'Year 12')) {
      const entitledGrade =
        user.standard_year_level
        ?? (user.default_grade === 'Year 11' || user.default_grade === 'Year 12' ? user.default_grade : null);

      if (entitledGrade && requestedGrade !== entitledGrade) {
        const overrideResult = await consumeQuestionTokens(user.id, 1);
        if (!overrideResult.ok) {
          return NextResponse.json(
            {
              error: `Your Standard plan allows ${entitledGrade} question generation only. Buy question tokens to generate ${requestedGrade} questions.`,
              code: 'YEAR_LEVEL_RESTRICTED',
              entitledGrade,
              requestedGrade,
              questionTokensRemaining: overrideResult.remaining,
            },
            { status: 403 }
          );
        }

        usedQuestionTokenForYearOverride = true;
        questionTokensRemaining = overrideResult.remaining;
      }
    }

    await incrementExportCount(user.id);

    const tokensUsed = used + 1;
    return NextResponse.json({
      ok: true,
      tokensUsed,
      tokensLimit: limit,
      tokensRemaining: Math.max(0, limit - tokensUsed),
      tokensResetAt: user.exports_reset_at ?? null,
      hasActiveSubscription: plan !== 'free',
      usedQuestionTokenForYearOverride,
      questionTokensRemaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[user/consume-exam-generation-token] Error:', message);
    return NextResponse.json({ error: 'Failed to consume exam generation token' }, { status: 500 });
  }
}

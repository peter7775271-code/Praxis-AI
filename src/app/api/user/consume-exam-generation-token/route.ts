import { NextRequest, NextResponse } from 'next/server';
import {
  verifyToken,
  getUserById,
  resetMonthlyExportsIfDue,
  incrementExportCount,
  PLAN_EXPORT_LIMITS,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

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

    await incrementExportCount(user.id);

    const tokensUsed = used + 1;
    return NextResponse.json({
      ok: true,
      tokensUsed,
      tokensLimit: limit,
      tokensRemaining: Math.max(0, limit - tokensUsed),
      tokensResetAt: user.exports_reset_at ?? null,
      hasActiveSubscription: plan !== 'free',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[user/consume-exam-generation-token] Error:', message);
    return NextResponse.json({ error: 'Failed to consume exam generation token' }, { status: 500 });
  }
}

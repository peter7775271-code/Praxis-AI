import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById, resetMonthlyExportsIfDue, PLAN_EXPORT_LIMITS, PLAN_DISPLAY_NAMES } from '@/lib/auth';

export async function GET(request: NextRequest) {
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

    // Auto-reset monthly exports if past the reset date
    user = await resetMonthlyExportsIfDue(user);

    const plan = user.plan ?? 'free';
    const limit = PLAN_EXPORT_LIMITS[plan];
    const used = user.exports_used_this_month ?? 0;

    return NextResponse.json({
      plan,
      planDisplayName: PLAN_DISPLAY_NAMES[plan],
      exportsUsed: used,
      exportsLimit: limit,
      exportsRemaining: Math.max(0, limit - used),
      hasActiveSubscription: plan !== 'free',
      stripeCustomerId: user.stripe_customer_id ?? null,
      exportsResetAt: user.exports_reset_at ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[user/subscription] Error:', message);
    return NextResponse.json({ error: 'Failed to load subscription info' }, { status: 500 });
  }
}

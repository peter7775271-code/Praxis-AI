import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById, resetMonthlyExportsIfDue, PLAN_EXPORT_LIMITS, PLAN_DISPLAY_NAMES } from '@/lib/auth';
import { getStripeClient } from '@/lib/stripe';

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

    // Fetch cancellation scheduling info from Stripe so we can show:
    // "Subscription cancelled/cancels on <date>" when user cancels via the portal.
    let stripeCancelAt: string | null = null;
    let stripeCancelAtPeriodEnd: boolean | null = null;
    try {
      const stripe = getStripeClient();
      const stripeSubscriptionId = user.stripe_subscription_id;

      let subscription: any = null;
      if (stripeSubscriptionId) {
        subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      } else if (user.stripe_customer_id) {
        const list = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          limit: 1,
        });
        subscription = list.data?.[0] ?? null;
      }

      if (subscription) {
        stripeCancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

        const cancelAtEpoch: number | null = typeof subscription.cancel_at === 'number' ? subscription.cancel_at : null;
        const endedAtEpoch: number | null = typeof subscription.ended_at === 'number' ? subscription.ended_at : null;
        const currentPeriodEndEpoch: number | null = typeof subscription.current_period_end === 'number' ? subscription.current_period_end : null;

        // Stripe sets either `cancel_at` (timestamp) or `cancel_at_period_end` (boolean),
        // depending on cancellation type and timing.
        const epoch =
          cancelAtEpoch ??
          (stripeCancelAtPeriodEnd ? currentPeriodEndEpoch : null) ??
          (subscription.status === 'canceled' ? (endedAtEpoch ?? currentPeriodEndEpoch) : null) ??
          null;

        stripeCancelAt = epoch ? new Date(epoch * 1000).toISOString() : null;
      }
    } catch {
      // Ignore Stripe failures; plan UI will still work from DB.
    }

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
      questionTokensBalance: user.question_tokens_balance ?? 0,
      companyName: user.company_name ?? null,
      defaultGrade: user.default_grade ?? null,
      defaultSubject: user.default_subject ?? null,
      standardYearLevel: user.standard_year_level ?? null,
      stripeCancelAt,
      stripeCancelAtPeriodEnd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[user/subscription] Error:', message);
    return NextResponse.json({ error: 'Failed to load subscription info' }, { status: 500 });
  }
}

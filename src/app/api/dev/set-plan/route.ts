import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, updateUserSubscription, resetUserPlanToFree, type SubscriptionPlan } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';

const ALLOWED_PLANS: SubscriptionPlan[] = ['free', 'standard', 'pro'];

/**
 * DEV-ONLY endpoint to manually set a user's subscription plan and export quota.
 * Only available when NODE_ENV !== 'production' or when DEV_TOOLS_ENABLED=true.
 *
 * Usage (from the browser console or Postman):
 *   POST /api/dev/set-plan
 *   Authorization: Bearer <jwt>
 *   Body: { "plan": "standard" }
 *
 * or to also set a specific export count for testing:
 *   Body: { "plan": "pro", "exportsUsed": 95 }
 *
 * To reset exports only (keeps current plan):
 *   Body: { "resetExports": true }
 */
export async function POST(request: NextRequest) {
  const isDev =
    process.env.NODE_ENV !== 'production' ||
    process.env.DEV_TOOLS_ENABLED === 'true';

  if (!isDev) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const decoded = token ? verifyToken(token) : null;

  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: { plan?: string; exportsUsed?: number; resetExports?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = decoded.userId;

  try {
    if (body.resetExports) {
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          exports_used_this_month: 0,
          exports_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', userId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, action: 'exports_reset' });
    }

    const plan = body.plan as SubscriptionPlan | undefined;
    if (!plan || !ALLOWED_PLANS.includes(plan)) {
      return NextResponse.json({ error: `plan must be one of: ${ALLOWED_PLANS.join(', ')}` }, { status: 400 });
    }

    if (plan === 'free') {
      await resetUserPlanToFree(userId);
    } else {
      await updateUserSubscription(userId, plan, undefined, `dev_sub_${Date.now()}`);
    }

    if (typeof body.exportsUsed === 'number') {
      const count = Math.max(0, Math.floor(body.exportsUsed));
      const { error } = await supabaseAdmin
        .from('users')
        .update({ exports_used_this_month: count })
        .eq('id', userId);

      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ success: true, plan, exportsUsed: body.exportsUsed ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dev/set-plan] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

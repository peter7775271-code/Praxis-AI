import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  getUserById,
  updateUserSubscription,
  addQuestionTokens,
  type SubscriptionPlan,
  verifyToken,
} from '@/lib/auth';
import { getStripeClient } from '@/lib/stripe';

const PRICE_TO_PLAN: Record<string, SubscriptionPlan> = {
  [process.env.STRIPE_STANDARD_PRICE_ID ?? '__unset_standard__']: 'standard',
  [process.env.STRIPE_PRO_PRICE_ID ?? '__unset_pro__']: 'pro',
};

function resolvePlanFromSubscription(subscription: Stripe.Subscription): SubscriptionPlan {
  for (const item of subscription.items.data) {
    const priceId = typeof item.price === 'string' ? item.price : item.price?.id;
    if (priceId && PRICE_TO_PLAN[priceId]) {
      return PRICE_TO_PLAN[priceId];
    }
  }

  return 'free';
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id query parameter' }, { status: 400 });
    }

    const user = await getUserById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'line_items.data.price'],
    });

    const sessionUserId = session.client_reference_id ?? session.metadata?.userId;
    const sessionEmail = session.customer_details?.email ?? session.customer_email;
    const userMatches = sessionUserId === user.id || (!!sessionEmail && sessionEmail === user.email);

    if (!userMatches) {
      return NextResponse.json({ error: 'Checkout session does not belong to this user' }, { status: 403 });
    }

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        {
          ok: false,
          status: session.status,
          payment_status: session.payment_status,
          message: 'Checkout has not completed payment yet',
        },
        { status: 409 }
      );
    }

    // Handle subscription mode (exam generation tokens)
    if (session.mode === 'subscription') {
      const subscription = session.subscription as Stripe.Subscription | undefined;
      if (!subscription || session.status !== 'complete') {
        return NextResponse.json(
          {
            error: 'Subscription not yet active',
          },
          { status: 409 }
        );
      }

      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subscriptionId = subscription.id;

      let plan = (session.metadata?.plan as SubscriptionPlan | undefined) ?? 'free';
      const standardYearLevel = (session.metadata?.standardYearLevel as 'Year 11' | 'Year 12' | undefined) ?? null;

      if (plan === 'free' && subscription) {
        plan = resolvePlanFromSubscription(subscription);
      }

      if (plan === 'free') {
        return NextResponse.json(
          {
            error: 'Could not resolve a paid plan from checkout session. Verify Stripe price IDs in env.',
          },
          { status: 422 }
        );
      }

      await updateUserSubscription(
        user.id,
        plan,
        customerId ?? undefined,
        subscriptionId ?? undefined,
        plan === 'standard' ? standardYearLevel : null
      );

      return NextResponse.json({ ok: true, type: 'subscription', plan });
    }
    // Handle payment mode (question tokens one-time purchase)
    else if (session.mode === 'payment') {
      const questionQuantity = session.metadata?.questionQuantity;
      if (!questionQuantity) {
        return NextResponse.json(
          {
            error: 'Question quantity not found in checkout session',
          },
          { status: 422 }
        );
      }

      const amount = Number(questionQuantity);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          {
            error: 'Invalid question quantity',
          },
          { status: 422 }
        );
      }

      const newBalance = await addQuestionTokens(user.id, amount);

      return NextResponse.json({
        ok: true,
        type: 'payment',
        questionTokensAdded: amount,
        questionTokensBalance: newBalance,
      });
    }

    return NextResponse.json({ error: 'Unknown checkout mode' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[stripe/confirm-checkout] Error:', message);
    return NextResponse.json({ error: 'Failed to confirm checkout session' }, { status: 500 });
  }
}

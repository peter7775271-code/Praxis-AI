import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import {
  getUserByStripeCustomerId,
  updateUserSubscription,
  resetUserPlanToFree,
  type SubscriptionPlan,
} from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';

export const runtime = 'nodejs';

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

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stripe/webhook] Signature verification failed:', msg);
    return NextResponse.json({ error: `Webhook signature error: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? (session.metadata?.userId as string | undefined);
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const plan = (session.metadata?.plan as SubscriptionPlan | undefined) ?? 'free';

        if (userId && userId !== 'anonymous' && plan !== 'free') {
          await updateUserSubscription(userId, plan, customerId ?? undefined, subscriptionId ?? undefined);
          console.log(`[stripe/webhook] Activated ${plan} plan for user ${userId}`);
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? '';
        const user = await getUserByStripeCustomerId(customerId);

        if (user) {
          const plan = resolvePlanFromSubscription(subscription);
          const status = subscription.status;

          if (status === 'active' || status === 'trialing') {
            await updateUserSubscription(user.id, plan, customerId, subscription.id);
            console.log(`[stripe/webhook] Updated plan to ${plan} for user ${user.id}`);
          } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
            await resetUserPlanToFree(user.id);
            console.log(`[stripe/webhook] Reset plan to free for user ${user.id} (status: ${status})`);
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? '';
        const user = await getUserByStripeCustomerId(customerId);

        if (user) {
          await resetUserPlanToFree(user.id);
          console.log(`[stripe/webhook] Subscription deleted — reset plan to free for user ${user.id}`);
        }

        break;
      }

      case 'invoice.paid': {
        // Reset the monthly export counter on each billing cycle
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? '';

        if (customerId) {
          const { error } = await supabaseAdmin
            .from('users')
            .update({
              exports_used_this_month: 0,
              exports_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('stripe_customer_id', customerId);

          if (error) {
            console.error('[stripe/webhook] Failed to reset export count on invoice.paid:', error.message);
          } else {
            console.log(`[stripe/webhook] Reset monthly exports for customer ${customerId}`);
          }
        }

        break;
      }

      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[stripe/webhook] Handler error for ${event.type}:`, msg);
    return NextResponse.json({ error: `Webhook handler error: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

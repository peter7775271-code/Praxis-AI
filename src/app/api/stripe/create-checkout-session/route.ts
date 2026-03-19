import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { getStripeClient } from '@/lib/stripe';

type PlanKey = 'standard' | 'pro';

const PRICE_ID_BY_PLAN: Record<PlanKey, string | undefined> = {
  standard: process.env.STRIPE_STANDARD_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
};

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;

    const body = (await request.json()) as { plan?: string };
    const plan = body.plan as PlanKey | undefined;

    if (!plan || !(plan in PRICE_ID_BY_PLAN)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const priceId = PRICE_ID_BY_PLAN[plan];
    if (!priceId) {
      return NextResponse.json(
        {
          error: `Stripe price id is not configured for ${plan}. Set the corresponding environment variable.`,
        },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const stripe = getStripeClient();

    const user = decoded ? await getUserById(decoded.userId) : null;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/settings/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/settings/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: decoded?.userId,
      customer_email: user?.email,
      metadata: {
        plan,
        userId: decoded?.userId ?? 'anonymous',
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Could not create checkout session' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[STRIPE_CHECKOUT_ERROR]', message);
    return NextResponse.json({ error: 'Failed to start Stripe checkout' }, { status: 500 });
  }
}

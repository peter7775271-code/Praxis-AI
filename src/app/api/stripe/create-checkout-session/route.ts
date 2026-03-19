import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { getStripeClient } from '@/lib/stripe';
import { getPublicAppBaseUrl } from '@/lib/url';

type PlanKey = 'standard' | 'pro';
type StandardYearLevel = 'Year 11' | 'Year 12';

const PRICE_ID_BY_PLAN: Record<PlanKey, string | undefined> = {
  standard: process.env.STRIPE_STANDARD_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
};

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required to start checkout. Please sign in.' }, { status: 401 });
    }

    const decoded = verifyToken(token);

    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Your session expired. Please sign in again to start checkout.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { plan?: string; standardYearLevel?: string };
    const plan = body.plan as PlanKey | undefined;
    const standardYearLevel = body.standardYearLevel as StandardYearLevel | undefined;

    if (!plan || !(plan in PRICE_ID_BY_PLAN)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    if (plan === 'standard' && standardYearLevel !== 'Year 11' && standardYearLevel !== 'Year 12') {
      return NextResponse.json(
        { error: 'Please choose Year 11 or Year 12 for the Standard plan.' },
        { status: 400 }
      );
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

    const baseUrl = getPublicAppBaseUrl(request);
    const stripe = getStripeClient();

    const user = await getUserById(decoded.userId);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/settings/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/settings/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: decoded.userId,
      customer_email: user?.email,
      metadata: {
        plan,
        userId: decoded.userId,
        ...(plan === 'standard' ? { standardYearLevel } : {}),
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

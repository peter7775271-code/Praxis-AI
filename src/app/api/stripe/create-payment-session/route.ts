import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { getStripeClient } from '@/lib/stripe';

type QuestionPackage = 'questions_200' | 'questions_400' | 'questions_600' | 'questions_800' | 'questions_1000' | 'questions_1500' | 'questions_2000';

const QUESTION_PACKAGES: Record<QuestionPackage, { quantity: number; priceId: string | undefined }> = {
  questions_200: { quantity: 200, priceId: process.env.STRIPE_QUESTIONS_200_PRICE_ID },
  questions_400: { quantity: 400, priceId: process.env.STRIPE_QUESTIONS_400_PRICE_ID },
  questions_600: { quantity: 600, priceId: process.env.STRIPE_QUESTIONS_600_PRICE_ID },
  questions_800: { quantity: 800, priceId: process.env.STRIPE_QUESTIONS_800_PRICE_ID },
  questions_1000: { quantity: 1000, priceId: process.env.STRIPE_QUESTIONS_1000_PRICE_ID },
  questions_1500: { quantity: 1500, priceId: process.env.STRIPE_QUESTIONS_1500_PRICE_ID },
  questions_2000: { quantity: 2000, priceId: process.env.STRIPE_QUESTIONS_2000_PRICE_ID },
};

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Authentication required to start checkout' }, { status: 401 });
    }

    const body = (await request.json()) as { package?: string; packageKey?: string };
    // Support both "package" (current) and "packageKey" (legacy) to be tolerant of older clients
    const rawKey = body.package ?? body.packageKey;
    const packageKey = rawKey as QuestionPackage | undefined;

    if (!packageKey || !(packageKey in QUESTION_PACKAGES)) {
      return NextResponse.json({ error: 'Invalid question package selected' }, { status: 400 });
    }

    const pkg = QUESTION_PACKAGES[packageKey];
    if (!pkg.priceId) {
      return NextResponse.json(
        {
          error: `Stripe price id is not configured for ${packageKey}. Set the corresponding environment variable.`,
        },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const stripe = getStripeClient();
    const user = await getUserById(decoded.userId);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: pkg.priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}&type=questions`,
      cancel_url: `${baseUrl}/dashboard/settings?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: decoded.userId,
      customer_email: user?.email,
      metadata: {
        package: packageKey,
        userId: decoded.userId,
        questionQuantity: String(pkg.quantity),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Could not create checkout session' }, { status: 500 });
    }

    // Return both for compatibility with different clients
    return NextResponse.json({ url: session.url, checkoutUrl: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[STRIPE_PAYMENT_CHECKOUT_ERROR]', message);
    return NextResponse.json({ error: 'Failed to start Stripe checkout' }, { status: 500 });
  }
}

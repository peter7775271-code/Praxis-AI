import Stripe from 'stripe';

declare global {
  var __stripeClient: Stripe | undefined;
}

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
  }

  if (!global.__stripeClient) {
    global.__stripeClient = new Stripe(secretKey);
  }

  return global.__stripeClient;
}

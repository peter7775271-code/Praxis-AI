import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './db';

export type SubscriptionPlan = 'free' | 'standard' | 'pro';

export const PLAN_EXPORT_LIMITS: Record<SubscriptionPlan, number> = {
  free: 0,
  standard: 30,
  pro: 100,
};

export const PLAN_DISPLAY_NAMES: Record<SubscriptionPlan, string> = {
  free: 'Free',
  standard: 'Standard',
  pro: 'Pro',
};

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  verified?: boolean;
  verification_token?: string;
  plan?: SubscriptionPlan;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  exports_used_this_month?: number;
  exports_reset_at?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export function createToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };
  } catch {
    return null;
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, created_at, verified, verification_token, plan, stripe_customer_id, stripe_subscription_id, exports_used_this_month, exports_reset_at')
    .eq('email', email)
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, created_at, verified, verification_token, plan, stripe_customer_id, stripe_subscription_id, exports_used_this_month, exports_reset_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

export async function getUserByStripeCustomerId(customerId: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, created_at, verified, plan, stripe_customer_id, stripe_subscription_id, exports_used_this_month, exports_reset_at')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

export async function createUser(
  email: string,
  password: string,
  name: string
): Promise<User> {
  const hashedPassword = await hashPassword(password);

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([
      {
        email,
        password: hashedPassword,
        name,
        verified: false,
      },
    ])
    .select('id, email, name, created_at, verified, verification_token')
    .single();

  if (error || !data) {
    const errorMessage = error?.message || 'Failed to create user';
    console.error('Create user error:', { error, email, message: errorMessage });
    throw new Error(errorMessage);
  }

  return data as User;
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, password, created_at, verified, verification_token')
    .eq('email', email)
    .single();

  if (error || !user) {
    return null;
  }

  const passwordMatch = await verifyPassword(password, user.password);
  if (!passwordMatch) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.created_at,
    verified: user.verified,
    verification_token: user.verification_token,
  };
}

export async function updateUserPassword(email: string, newPassword: string): Promise<void> {
  if (!email || !newPassword) {
    throw new Error('Email and new password are required');
  }

  const hashedPassword = await hashPassword(newPassword);

  const { error } = await supabaseAdmin
    .from('users')
    .update({ password: hashedPassword })
    .eq('email', email);

  if (error) {
    throw new Error(error.message || 'Failed to update password');
  }
}

export async function updateUserSubscription(
  userId: string,
  plan: SubscriptionPlan,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
): Promise<void> {
  const resetAt = new Date();
  resetAt.setMonth(resetAt.getMonth() + 1);

  const updates: Record<string, unknown> = {
    plan,
    exports_used_this_month: 0,
    exports_reset_at: resetAt.toISOString(),
  };

  if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
  if (stripeSubscriptionId) updates.stripe_subscription_id = stripeSubscriptionId;

  const { error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to update subscription');
  }
}

export async function resetUserPlanToFree(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      plan: 'free',
      stripe_subscription_id: null,
      exports_used_this_month: 0,
      exports_reset_at: null,
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to reset plan');
  }
}

export async function resetMonthlyExportsIfDue(user: User): Promise<User> {
  const resetAt = user.exports_reset_at ? new Date(user.exports_reset_at) : null;
  if (resetAt && new Date() >= resetAt) {
    const nextResetAt = new Date(resetAt);
    nextResetAt.setMonth(nextResetAt.getMonth() + 1);

    await supabaseAdmin
      .from('users')
      .update({
        exports_used_this_month: 0,
        exports_reset_at: nextResetAt.toISOString(),
      })
      .eq('id', user.id);

    return {
      ...user,
      exports_used_this_month: 0,
      exports_reset_at: nextResetAt.toISOString(),
    };
  }

  return user;
}

export async function incrementExportCount(userId: string): Promise<void> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('exports_used_this_month')
    .eq('id', userId)
    .single();

  const current = Number((user as { exports_used_this_month?: number } | null)?.exports_used_this_month ?? 0);

  const { error } = await supabaseAdmin
    .from('users')
    .update({ exports_used_this_month: current + 1 })
    .eq('id', userId);

  if (error) {
    console.error('Failed to increment export count:', error.message);
  }
}
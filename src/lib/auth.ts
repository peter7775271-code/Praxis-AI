import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './db';

export type SubscriptionPlan = 'free' | 'standard' | 'pro';

export const PLAN_EXPORT_LIMITS: Record<SubscriptionPlan, number> = {
  // Free plan should still allow a limited number of exam creations.
  free: 3,
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
  company_name?: string | null;
  created_at: string;
  verified?: boolean;
  verification_token?: string;
  plan?: SubscriptionPlan;
  default_grade?: string | null;
  default_subject?: string | null;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  exports_used_this_month?: number;
  exports_reset_at?: string | null;
  question_tokens_balance?: number;
  standard_year_level?: 'Year 11' | 'Year 12' | null;
  stripeCancelAt?: string | null;
  stripeCancelAtPeriodEnd?: boolean | null;
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
    .select('id, email, name, company_name, created_at, verified, verification_token, plan, default_grade, default_subject, stripe_customer_id, stripe_subscription_id, exports_used_this_month, exports_reset_at, question_tokens_balance, standard_year_level')
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
    .select('id, email, name, company_name, created_at, verified, verification_token, plan, default_grade, default_subject, stripe_customer_id, stripe_subscription_id, exports_used_this_month, exports_reset_at, question_tokens_balance, standard_year_level')
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
    .select('id, email, name, company_name, created_at, verified, plan, default_grade, default_subject, stripe_customer_id, stripe_subscription_id, exports_used_this_month, exports_reset_at, question_tokens_balance, standard_year_level')
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
  name: string,
  opts?: {
    companyName?: string | null;
    defaultGrade?: string | null;
    defaultSubject?: string | null;
  }
): Promise<User> {
  const hashedPassword = await hashPassword(password);
  const resetAt = new Date();
  resetAt.setMonth(resetAt.getMonth() + 1);

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([
      {
        email,
        password: hashedPassword,
        name,
        verified: false,
        exports_reset_at: resetAt.toISOString(),
        ...(opts?.companyName !== undefined ? { company_name: opts.companyName } : {}),
        ...(opts?.defaultGrade !== undefined ? { default_grade: opts.defaultGrade } : {}),
        ...(opts?.defaultSubject !== undefined ? { default_subject: opts.defaultSubject } : {}),
      },
    ])
    .select('id, email, name, company_name, created_at, verified, verification_token, plan, default_grade, default_subject')
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
    .select('id, email, name, company_name, password, created_at, verified, verification_token, plan, default_grade, default_subject')
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
    company_name: user.company_name,
    created_at: user.created_at,
    verified: user.verified,
    verification_token: user.verification_token,
    plan: user.plan,
    default_grade: user.default_grade,
    default_subject: user.default_subject,
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
  standardYearLevel?: 'Year 11' | 'Year 12' | null,
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

  // Standard users can access one year level; Pro and Free are unrestricted by this field.
  if (plan === 'standard') {
    updates.standard_year_level = standardYearLevel ?? null;
  } else {
    updates.standard_year_level = null;
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to update subscription');
  }
}

export async function resetUserPlanToFree(userId: string): Promise<void> {
  const resetAt = new Date();
  resetAt.setMonth(resetAt.getMonth() + 1);

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      plan: 'free',
      stripe_subscription_id: null,
      exports_used_this_month: 0,
      // Ensure the free plan limits reset monthly (same behavior as paid plans).
      exports_reset_at: resetAt.toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to reset plan');
  }
}

export async function resetMonthlyExportsIfDue(user: User): Promise<User> {
  const resetAt = user.exports_reset_at ? new Date(user.exports_reset_at) : null;
  if (!resetAt) {
    // Ensure free-plan users still get a monthly window.
    const nextResetAt = new Date();
    nextResetAt.setMonth(nextResetAt.getMonth() + 1);

    await supabaseAdmin
      .from('users')
      .update({
        exports_reset_at: nextResetAt.toISOString(),
      })
      .eq('id', user.id);

    return {
      ...user,
      exports_reset_at: nextResetAt.toISOString(),
    };
  }
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

export async function consumeQuestionTokens(userId: string, amount: number): Promise<{ ok: boolean; remaining: number }> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('question_tokens_balance')
    .eq('id', userId)
    .single();

  const current = Number((user as { question_tokens_balance?: number } | null)?.question_tokens_balance ?? 0);

  if (current < amount) {
    return { ok: false, remaining: current };
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ question_tokens_balance: current - amount })
    .eq('id', userId);

  if (error) {
    console.error('Failed to consume question tokens:', error.message);
    return { ok: false, remaining: current };
  }

  return { ok: true, remaining: current - amount };
}

export async function addQuestionTokens(userId: string, amount: number): Promise<number> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('question_tokens_balance')
    .eq('id', userId)
    .single();

  const current = Number((user as { question_tokens_balance?: number } | null)?.question_tokens_balance ?? 0);
  const newBalance = current + amount;

  const { error } = await supabaseAdmin
    .from('users')
    .update({ question_tokens_balance: newBalance })
    .eq('id', userId);

  if (error) {
    console.error('Failed to add question tokens:', error.message);
  }

  return newBalance;
}
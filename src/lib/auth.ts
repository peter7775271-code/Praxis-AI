import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './db';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  verified?: boolean;
  verification_token?: string;
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
    .select('id, email, name, created_at, verified, verification_token')
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
    .select('id, email, name, created_at, verified, verification_token')
    .eq('id', id)
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
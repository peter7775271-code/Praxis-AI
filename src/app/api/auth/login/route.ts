import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createToken } from '@/lib/auth';
import type { User } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing email or password' },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if email is verified
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('verified')
      .eq('id', user.id)
      .single();
    const verifiedUser = dbUser as Pick<User, 'verified'> | null;

    if (!verifiedUser?.verified) {
      return NextResponse.json(
        { error: 'Please verify your email first. Check your inbox for the verification link.' },
        { status: 403 }
      );
    }

    const token = createToken(user.id);

    return NextResponse.json(
      {
        message: 'Login successful',
        user,
        token,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

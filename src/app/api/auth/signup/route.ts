import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail, createToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/db';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Create user
    const user = await createUser(email, password, name);
    const jwtToken = createToken(user.id);

    // Generate verification token
    const verificationToken = uuidv4();
    await supabaseAdmin
      .from('users')
      .update({ verification_token: verificationToken })
      .eq('id', user.id);

    // Send verification email
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const verificationLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/verify?token=${verificationToken}`;

      await transporter.sendMail({
        to: email,
        subject: 'Verify your email address',
        html: `
          <h2>Welcome ${name}!</h2>
          <p>Please verify your email to complete your registration.</p>
          <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            Verify Email
          </a>
          <p>Or copy this link: ${verificationLink}</p>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue anyway - user can resend later
    }

    return NextResponse.json(
      {
        message: 'User created successfully. Please check your email to verify your account.',
        user,
        token: jwtToken,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Sign up error:', { message: errorMessage, error });
    
    // Check if it's a setup issue
    if (errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database not configured. Load your schema into Neon and verify DATABASE_URL in .env.local.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

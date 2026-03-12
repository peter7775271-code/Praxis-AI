import { NextRequest, NextResponse } from 'next/server';
const nodemailer = require("nodemailer");
import { v4 as uuidv4 } from 'uuid';
import type { User } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: user, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, verified')
      .eq('email', email)
      .single();
    const existingUser = user as Pick<User, 'id' | 'verified'> | null;
    
    if (findError || !existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (existingUser.verified) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      );
    }

    const token = uuidv4();
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // use Gmail app password
      }
    });

    // Set the verification token in the database
    await supabaseAdmin
      .from('users')
      .update({ verification_token: token })
      .eq('email', email);

    const verificationLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/verify?token=${token}`;

    await transporter.sendMail({
      to: email,
      subject: 'Verify your email address',
      html: `
        <h2>Verify Your Email</h2>
        <p>Click the link below to verify your email address:</p>
        <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
          Verify Email
        </a>
        <p>Or copy this link: ${verificationLink}</p>
        <p>This link expires in 24 hours.</p>
      `
    });

    return NextResponse.json(
      { message: 'Verification email sent' },
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

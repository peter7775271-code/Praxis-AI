import { supabaseAdmin } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { updateUserPassword } from "@/lib/auth";

type ResetPasswordUser = {
  email: string;
  reset_token_expiry: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();
    
    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    
    const { data: user, error: findError } = await supabaseAdmin
      .from('users')
      .select('email, reset_token_expiry')
      .eq('reset_token', token)
      .single();
    const resetUser = user as ResetPasswordUser | null;
    
    if (findError || !resetUser) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    const now = new Date();
    if (resetUser.reset_token_expiry && new Date(resetUser.reset_token_expiry) < now) {
      return NextResponse.json(
        { error: "Token has expired" },
        { status: 400 }
      );
    }

    // Update password and clear reset token
    await updateUserPassword(resetUser.email, password);
    await supabaseAdmin
      .from('users')
      .update({
        reset_token: null,
        reset_token_expiry: null
      })
      .eq('email', resetUser.email);

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 500 }
    );
  }
}
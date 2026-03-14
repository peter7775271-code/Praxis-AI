import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    // Verify user is authenticated
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Fetch messages for this user
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id, user_id, message, role, attachment, file_name, created_at')
      .eq('user_id', decoded.userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Load messages error:', error);
      return NextResponse.json(
        { error: 'Failed to load messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: data || [] });
  } catch (error) {
    console.error('Load chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

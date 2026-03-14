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

    // Fetch nutrition history for this user
    const { data, error } = await supabaseAdmin
      .from('nutrition_entries')
      .select('id, user_id, product_name, image_data, nutrition_info, health_score, ingredients_breakdown, created_at')
      .eq('user_id', decoded.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Load nutrition error:', error);
      return NextResponse.json(
        { error: 'Failed to load nutrition history' },
        { status: 500 }
      );
    }

    return NextResponse.json({ entries: data || [] });
  } catch (error) {
    console.error('Load nutrition error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

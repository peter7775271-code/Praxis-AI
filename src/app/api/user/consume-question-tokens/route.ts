import { NextRequest, NextResponse } from 'next/server';
import {
  verifyToken,
  getUserById,
  consumeQuestionTokens,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json()) as { amount?: number };
    const amount = body.amount ?? 1;

    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid question token amount' }, { status: 400 });
    }

    const user = await getUserById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const balance = user.question_tokens_balance ?? 0;
    if (balance < amount) {
      return NextResponse.json(
        {
          error: 'Insufficient question tokens. Please buy more tokens to generate questions.',
          code: 'INSUFFICIENT_QUESTION_TOKENS',
          tokensNeeded: amount,
          tokensAvailable: balance,
          tokensShortby: amount - balance,
        },
        { status: 429 }
      );
    }

    const result = await consumeQuestionTokens(user.id, amount);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Unable to consume question tokens',
          tokensAvailable: result.remaining,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      tokensConsumed: amount,
      tokensRemaining: result.remaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[user/consume-question-tokens] Error:', message);
    return NextResponse.json({ error: 'Failed to consume question tokens' }, { status: 500 });
  }
}

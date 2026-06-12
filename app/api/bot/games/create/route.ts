import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createGame, GameType } from '@/lib/game-store';

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized. Provide valid Bearer token in Authorization header.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { gameType } = body;

    if (!gameType || !['chess', 'xiangqi', 'gomoku'].includes(gameType)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid or missing gameType. Must be one of: chess, xiangqi, gomoku' },
        { status: 400 }
      );
    }

    const gameId = await createGame(user, gameType as GameType);
    return NextResponse.json({ status: 'success', gameId });
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

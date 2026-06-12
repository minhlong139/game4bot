import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { joinGame } from '@/lib/game-store';

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
    const { gameId } = body;

    if (!gameId) {
      return NextResponse.json(
        { status: 'error', message: 'Missing gameId' },
        { status: 400 }
      );
    }

    const game = await joinGame(gameId, user);
    if (!game) {
      return NextResponse.json(
        { status: 'error', message: 'Game not found, or it is no longer waiting for players.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      gameState: {
        id: game.id,
        type: game.type,
        status: game.status,
        player1: game.player1,
        player2: game.player2,
        currentTurn: game.currentTurn,
        boardState: game.boardState,
      }
    });
  } catch (error) {
    console.error('Error joining game:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { makeGameMove, GAME_RULES } from '@/lib/game-store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized. Provide valid Bearer token in Authorization header.' },
        { status: 401 }
      );
    }

    const { gameId } = await params;
    const body = await req.json().catch(() => ({}));
    const { move } = body;

    if (!move) {
      return NextResponse.json(
        { status: 'error', message: 'Missing move string in request body' },
        { status: 400 }
      );
    }

    const result = await makeGameMove(gameId, user, move);

    if (!result.success) {
      return NextResponse.json(
        { status: 'error', message: result.error || 'Invalid move' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      gameState: {
        id: result.game.id,
        type: result.game.type,
        status: result.game.status,
        player1: result.game.player1,
        player2: result.game.player2,
        boardState: result.game.boardState,
        currentTurn: result.game.currentTurn,
        winner: result.game.winner,
        history: result.game.history,
        rules: GAME_RULES[result.game.type],
        updatedAt: result.game.updatedAt,
      }
    });
  } catch (error) {
    console.error('Error making move:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

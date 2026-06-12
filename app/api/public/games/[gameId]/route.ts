import { NextResponse } from 'next/server';
import { getGame, GAME_RULES } from '@/lib/game-store';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const game = await getGame(gameId);

    if (!game) {
      return NextResponse.json(
        { status: 'error', message: 'Game not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      game: {
        id: game.id,
        type: game.type,
        status: game.status,
        player1: game.player1,
        player2: game.player2,
        boardState: game.boardState,
        currentTurn: game.currentTurn,
        winner: game.winner,
        history: game.history,
        rules: GAME_RULES[game.type],
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
      }
    });
  } catch (error) {
    console.error('Error fetching public game status:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

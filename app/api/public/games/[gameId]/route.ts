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

    let maskedBoardState = game.boardState;
    if (game.type === 'werewolf') {
      try {
        const state = JSON.parse(game.boardState);
        const isGameFinished = game.status === 'finished';

        state.players = state.players.map((p: any) => {
          const isDead = !p.isAlive;

          let role = p.role;
          let side = p.side;
          let privateMemory = p.privateMemory;

          const revealRole = isDead || isGameFinished;
          if (!revealRole) {
            role = '';
            side = '';
          }

          if (!isGameFinished) {
            privateMemory = { suspicions: {}, reasoning: '' };
          }

          return {
            ...p,
            role,
            side,
            privateMemory
          };
        });

        delete state.pendingActions;
        if (!isGameFinished) {
          if (state.history && state.history.rounds) {
            state.history.rounds = state.history.rounds.map((r: any) => {
              return {
                ...r,
                privateAnalysis: []
              };
            });
          }
        }

        maskedBoardState = JSON.stringify(state);
      } catch (e) {
        console.error('Error masking werewolf state for public:', e);
      }
    }

    return NextResponse.json({
      status: 'success',
      game: {
        id: game.id,
        type: game.type,
        status: game.status,
        player1: game.player1,
        player2: game.player2,
        boardState: maskedBoardState,
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

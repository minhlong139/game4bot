import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getGame, GAME_RULES } from '@/lib/game-store';

export async function GET(
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
        const playerSelf = state.players.find((p: any) => p.username === user);

        state.players = state.players.map((p: any) => {
          const isSelf = p.username === user;
          const isDead = !p.isAlive;
          const isGameFinished = game.status === 'finished';

          let role = p.role;
          let side = p.side;
          let privateMemory = p.privateMemory;

          const revealRole = isSelf || isDead || isGameFinished;
          if (!revealRole) {
            let canKnowRole = false;

            if (playerSelf) {
              if (playerSelf.role === 'Merlin') {
                if (p.side === 'evil' && p.role !== 'Mordred') {
                  role = 'Evil';
                  canKnowRole = true;
                }
              } else if (playerSelf.role === 'Percival') {
                if (p.role === 'Merlin' || p.role === 'Morgana') {
                  role = 'Merlin/Morgana candidate';
                  canKnowRole = true;
                }
              } else if (playerSelf.side === 'evil' && playerSelf.role !== 'Oberon') {
                if (p.side === 'evil' && p.role !== 'Oberon') {
                  role = p.role;
                  canKnowRole = true;
                }
              }
            }

            if (!canKnowRole) {
              role = '';
              side = '';
            }
          }

          if (!isSelf && !isGameFinished) {
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
        if (game.status !== 'finished') {
          if (state.history && state.history.rounds) {
            state.history.rounds = state.history.rounds.map((r: any) => {
              return {
                ...r,
                privateAnalysis: r.privateAnalysis.filter((a: any) => a.player === user)
              };
            });
          }
        }

        maskedBoardState = JSON.stringify(state);
      } catch (e) {
        console.error('Error masking werewolf state for bot:', e);
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
    console.error('Error fetching game status:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

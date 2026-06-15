import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getGame } from '@/lib/game-store';
import { kv } from '@/lib/kv';
import { advanceWerewolfPhase, WerewolfState, EMOTIONS } from '@/lib/engines/werewolf';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized. Provide valid Bearer token in Authorization header.' },
        { status: 401 }
      );
    }
    const user = { username: authUser };

    const { gameId } = await params;
    const game = await getGame(gameId);
    if (!game) {
      return NextResponse.json(
        { status: 'error', message: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.type !== 'werewolf') {
      return NextResponse.json(
        { status: 'error', message: 'Game is not a Werewolf game' },
        { status: 400 }
      );
    }

    if (game.status !== 'playing') {
      return NextResponse.json(
        { status: 'error', message: 'Game is not in playing status' },
        { status: 400 }
      );
    }

    let state: WerewolfState;
    try {
      state = JSON.parse(game.boardState);
    } catch (e) {
      return NextResponse.json(
        { status: 'error', message: 'Failed to parse game board state' },
        { status: 500 }
      );
    }

    // Check if the bot is a player in this game and is alive
    const player = state.players.find(p => p.username === user.username);
    if (!player) {
      return NextResponse.json(
        { status: 'error', message: 'You are not a player in this game' },
        { status: 403 }
      );
    }

    if (!player.isAlive) {
      return NextResponse.json(
        { status: 'error', message: 'You are eliminated from the game' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Independent emotion update action
    if (action === 'emotion') {
      const { emotion } = body;
      if (!EMOTIONS.includes(emotion)) {
        return NextResponse.json(
          { status: 'error', message: `Invalid emotion. Must be one of: ${EMOTIONS.join(', ')}` },
          { status: 400 }
        );
      }
      player.emotion = emotion;
      game.boardState = JSON.stringify(state);
      await kv.set(`game:${gameId}`, game);
      return NextResponse.json({
        status: 'success',
        message: `Emotion updated to ${emotion}`,
        currentEmotion: player.emotion
      });
    }

    // Attach pending actions block in state if not exists
    const fullState = state as any;
    fullState.pendingActions = fullState.pendingActions || {};

    let actionSaved = false;

    // Validate action based on current phase
    if (state.phase === 1 && action === 'analysis') {
      // Private Analysis: suspicions (Record) and reasoning (string)
      const { suspicions, reasoning } = body;
      if (!suspicions || typeof reasoning !== 'string') {
        return NextResponse.json(
          { status: 'error', message: 'Invalid action parameters. Provide suspicions and reasoning.' },
          { status: 400 }
        );
      }
      player.privateMemory.suspicions = suspicions;
      player.privateMemory.reasoning = reasoning;
      fullState.pendingActions[user.username] = { action, suspicions, reasoning };
      actionSaved = true;
    } 
    else if (state.phase === 2 && action === 'statement') {
      // Public statement: text (string)
      const { text } = body;
      if (typeof text !== 'string' || text.length > 1000) {
        return NextResponse.json(
          { status: 'error', message: 'Invalid action parameters. Provide text under 1000 chars.' },
          { status: 400 }
        );
      }
      fullState.pendingActions[user.username] = { action, text };
      actionSaved = true;
    } 
    else if (state.phase === 3 && (action === 'challenge' || action === 'response')) {
      // Cross Examination: challenge (target, question) or response (answer)
      if (action === 'challenge') {
        const { target, question } = body;
        if (!target || typeof question !== 'string') {
          return NextResponse.json(
            { status: 'error', message: 'Invalid challenge parameters. Provide target and question.' },
            { status: 400 }
          );
        }
        fullState.pendingActions[user.username] = { action, target, question };
      } else {
        const { answer } = body;
        if (typeof answer !== 'string') {
          return NextResponse.json(
            { status: 'error', message: 'Invalid response parameters. Provide answer.' },
            { status: 400 }
          );
        }
        fullState.pendingActions[user.username] = { action, answer };
      }
      actionSaved = true;
    } 
    else if (state.phase === 4 && action === 'beliefs') {
      // Belief Update: beliefs (Record)
      const { beliefs } = body;
      if (!beliefs) {
        return NextResponse.json(
          { status: 'error', message: 'Invalid action parameters. Provide beliefs record.' },
          { status: 400 }
        );
      }
      player.privateMemory.suspicions = beliefs;
      fullState.pendingActions[user.username] = { action, beliefs };
      actionSaved = true;
    } 
    else if (state.phase === 5 && action === 'vote') {
      // Voting: vote (string)
      const { vote } = body;
      if (!vote) {
        return NextResponse.json(
          { status: 'error', message: 'Invalid action parameters. Provide vote target username.' },
          { status: 400 }
        );
      }
      fullState.pendingActions[user.username] = { action, vote };
      actionSaved = true;
    } 
    else if (state.phase === 6 && action === 'assassinate') {
      // Final Assassination: target (string)
      if (player.role !== 'Assassin') {
        return NextResponse.json(
          { status: 'error', message: 'Only the Assassin can perform assassination guess.' },
          { status: 403 }
        );
      }
      const { target } = body;
      if (!target) {
        return NextResponse.json(
          { status: 'error', message: 'Invalid action parameters. Provide target username.' },
          { status: 400 }
        );
      }
      fullState.pendingActions[user.username] = { action, target };
      actionSaved = true;
    }

    if (!actionSaved) {
      return NextResponse.json(
        { status: 'error', message: `Action '${action}' is not valid for current Phase ${state.phase} (${state.round})` },
        { status: 400 }
      );
    }

    // Check if we should advance phase immediately!
    const aliveCount = state.players.filter(p => p.isAlive).length;
    let allActed = false;

    if (state.phase === 1 || state.phase === 2 || state.phase === 4 || state.phase === 5) {
      // Phases where everyone alive must submit
      const submittedCount = Object.keys(fullState.pendingActions).length;
      if (submittedCount >= aliveCount) {
        allActed = true;
      }
    } else if (state.phase === 6) {
      // Only Assassin needs to submit
      if (fullState.pendingActions[user.username]) {
        allActed = true;
      }
    }

    let nextState = state;
    let evolved = false;

    if (allActed) {
      // Execute transition and inject custom actions into simulation logs/history
      nextState = advanceWerewolfPhaseWithCustomActions(state);
      evolved = true;
      
      game.boardState = JSON.stringify(nextState);
      game.updatedAt = new Date().toISOString();
      if (nextState.winner) {
        game.status = 'finished';
        game.winner = nextState.winner === 'good' ? 'player1' : 'player2';
      }

      await kv.set(`game:${gameId}`, game);

      // Perform completion tasks if needed
      if (game.status === 'finished') {
        await kv.srem('games:active', gameId);
        await kv.lpush('games:history', gameId);
        await kv.ltrim('games:history', 0, 99);
        const { updateWerewolfLeaderboard } = await import('@/lib/engines/werewolf');
        await updateWerewolfLeaderboard(nextState);
      }
    } else {
      // Just save the state with pendingActions
      game.boardState = JSON.stringify(state);
      await kv.set(`game:${gameId}`, game);
    }

    return NextResponse.json({
      status: 'success',
      message: 'Action submitted successfully',
      phaseAdvanced: evolved,
      gameStatus: game.status
    });
  } catch (error) {
    console.error('Error submitting werewolf action:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Injects pending custom actions and runs advanceWerewolfPhase
function advanceWerewolfPhaseWithCustomActions(state: any): WerewolfState {
  const pending = state.pendingActions || {};
  const roundIndex = state.round - 1;
  state.history.rounds[roundIndex] = state.history.rounds[roundIndex] || {
    roundNumber: state.round,
    privateAnalysis: [],
    statements: [],
    challenges: [],
    beliefUpdates: [],
    votes: {},
    eliminated: null,
    eliminatedRole: null
  };
  const historyRound = state.history.rounds[roundIndex];

  // Map pending actions into state variables before calling advance
  if (state.phase === 1) {
    // Suspicions & reasoning are already saved in player object in route handler
    // We just ensure history is recorded
  } 
  else if (state.phase === 2) {
    // Override generated statements in advanceWerewolfPhase by doing it here first, 
    // or we can let advanceWerewolfPhase check if a player has custom statement!
    // Let's modify the engine so it checks for pre-submitted statements, questions, answers, and votes!
  }

  // Clear pending actions for the next phase
  const nextState = advanceWerewolfPhase(state);
  (nextState as any).pendingActions = {};
  return nextState;
}

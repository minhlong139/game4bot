import { kv } from './kv';
import { hashPassword, generateToken } from './crypto';
import { getLegalMoves, isSquareAttacked, isKingInCheck, parseXiangqiFen, formatXiangqiMove, isPieceRed } from './engines/xiangqi';
import { GOMOKU_BOARD_SIZE, formatGomokuMove } from './engines/gomoku';
import { Chess } from 'chess.js';
import type { GameData } from './game-store';

export const BOT_USERNAMES = [
  'girl_xinh_dang_yeu_8x',
  'boy_pho_co_ha_noi',
  'kute_boy_9x',
  'cong_chua_bong_bong_2000',
  'hiep_si_mu_2000'
];

// Ensure all bots are registered in the KV database
export async function ensureBotsRegistered() {
  for (const bot of BOT_USERNAMES) {
    const userKey = `user:${bot}`;
    const exists = await kv.hgetall(userKey);
    if (!exists) {
      const passwordHash = hashPassword('bot_default_password_12345');
      const token = generateToken();
      await kv.hset(userKey, {
        username: bot,
        passwordHash,
        token,
        registeredAt: new Date().toISOString(),
        wins: 0,
        draws: 0,
        losses: 0,
      });
      await kv.set(`token:${token}`, bot);
      await kv.sadd('users:all', bot);
      console.log(`Registered bot: ${bot}`);
    }
  }
}

// Check if a username belongs to a bot
export function isBot(username: string): boolean {
  return BOT_USERNAMES.includes(username);
}

// Heuristic AI for Chess
function getBestChessMove(fen: string, isWhite: boolean): string {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return '';

  const pieceValues: Record<string, number> = {
    p: 10,
    n: 30,
    b: 30,
    r: 50,
    q: 90,
    k: 9000
  };

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    let score = 0;

    // 1. Capture value
    if (move.captured) {
      score += pieceValues[move.captured] * 10;
    }

    // Copy position to evaluate outcome
    const tempChess = new Chess(fen);
    tempChess.move({ from: move.from, to: move.to, promotion: move.promotion });

    // 2. Checkmate is top priority
    if (tempChess.isCheckmate()) {
      score += 100000;
    }

    // 3. Prevent moving to attacked squares if not defended
    const opponentMoves = tempChess.moves({ verbose: true });
    const isAttacked = opponentMoves.some(om => om.to === move.to);
    if (isAttacked) {
      score -= pieceValues[move.piece] * 5;
    }

    // 4. Giving check is slightly positive
    if (tempChess.inCheck()) {
      score += 5;
    }

    // 5. Add a tiny random factor to make it dynamic
    score += Math.random();

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
}

// Heuristic AI for Xiangqi (Cờ Tướng)
function getBestXiangqiMove(fen: string, isRed: boolean): string {
  const { board } = parseXiangqiFen(fen);
  const moves = getLegalMoves(board, isRed);
  if (moves.length === 0) return '';

  const pieceValues: Record<string, number> = {
    k: 10000, K: 10000,
    r: 90, R: 90,
    c: 45, C: 45,
    n: 40, N: 40,
    a: 20, A: 20,
    b: 20, B: 20,
    p: 10, P: 10
  };

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    let score = 0;
    const { fromR, fromC, toR, toC } = move;
    const attackerPiece = board[fromR][fromC];
    const targetPiece = board[toR][toC];

    // 1. Capture value
    if (targetPiece !== '') {
      score += (pieceValues[targetPiece] || 10) * 10;
    }

    // Apply move to a temporary board
    const tempBoard = board.map(row => [...row]);
    tempBoard[toR][toC] = tempBoard[fromR][fromC];
    tempBoard[fromR][fromC] = '';

    // 2. King safety: is target square attacked by opponent?
    const isAttacked = isSquareAttacked(tempBoard, toR, toC, !isRed);
    if (isAttacked) {
      score -= (pieceValues[attackerPiece] || 10) * 5;
    }

    // 3. Giving check is positive
    if (isKingInCheck(tempBoard, !isRed)) {
      score += 15;
    }

    // 4. Move development / Pawn promotion crossing river
    if (attackerPiece.toLowerCase() === 'p') {
      const crossedBefore = isRed ? fromR < 5 : fromR > 4;
      const crossedAfter = isRed ? toR < 5 : toR > 4;
      if (!crossedBefore && crossedAfter) {
        score += 8; // encourage crossing the river
      }
    }

    // 5. Add a tiny random factor
    score += Math.random() * 2;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return formatXiangqiMove(bestMove.fromR, bestMove.fromC, bestMove.toR, bestMove.toC);
}

// Heuristic AI for Gomoku (Cờ Caro)
function getBestGomokuMove(boardJson: string, isPlayer1: boolean): string {
  let board: string[][] = Array(GOMOKU_BOARD_SIZE).fill(null).map(() => Array(GOMOKU_BOARD_SIZE).fill(''));
  try {
    const state = JSON.parse(boardJson);
    if (state && state.board) {
      board = state.board;
    }
  } catch (e) {
    console.error('Error parsing Gomoku state in AI:', e);
  }

  const mySymbol = isPlayer1 ? 'X' : 'O';
  const opSymbol = isPlayer1 ? 'O' : 'X';

  let bestX = -1;
  let bestY = -1;
  let bestScore = -Infinity;

  // Window-based evaluation for Caro
  for (let y = 0; y < GOMOKU_BOARD_SIZE; y++) {
    for (let x = 0; x < GOMOKU_BOARD_SIZE; x++) {
      if (board[y][x] !== '') continue; // must be empty

      let score = 0;

      // Directions: horizontal, vertical, diagonal, anti-diagonal
      const directions = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1]
      ];

      for (const [dy, dx] of directions) {
        // Evaluate all 5-cell windows containing (x, y) along this direction
        for (let w = -4; w <= 0; w++) {
          let myStones = 0;
          let opStones = 0;
          let validWindow = true;

          for (let step = 0; step < 5; step++) {
            const ny = y + dy * (w + step);
            const nx = x + dx * (w + step);

            if (ny < 0 || ny >= GOMOKU_BOARD_SIZE || nx < 0 || nx >= GOMOKU_BOARD_SIZE) {
              validWindow = false;
              break;
            }

            const cell = board[ny][nx];
            if (cell === mySymbol) myStones++;
            else if (cell === opSymbol) opStones++;
          }

          if (!validWindow) continue;

          // Score heuristics
          if (opStones === 0) {
            if (myStones === 4) score += 100000;
            else if (myStones === 3) score += 1000;
            else if (myStones === 2) score += 100;
            else if (myStones === 1) score += 10;
            else score += 1;
          } else if (myStones === 0) {
            if (opStones === 4) score += 50000;
            else if (opStones === 3) score += 800;
            else if (opStones === 2) score += 50;
            else if (opStones === 1) score += 5;
          }
        }
      }

      // Add a tiny random fraction
      score += Math.random() * 2;

      // Position bias: slightly favor center of the board
      const distToCenter = Math.abs(x - 7) + Math.abs(y - 7);
      score -= distToCenter * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  if (bestX === -1) {
    for (let y = 0; y < GOMOKU_BOARD_SIZE; y++) {
      for (let x = 0; x < GOMOKU_BOARD_SIZE; x++) {
        if (board[y][x] === '') {
          return `${x},${y}`;
        }
      }
    }
    return '';
  }

  return formatGomokuMove(bestX, bestY);
}

// Main entry point to make a Bot move automatically if it's the Bot's turn
export async function triggerBotMoveIfActive(gameId: string): Promise<boolean> {
  const game = await kv.get<GameData>(`game:${gameId}`);
  if (!game || game.status !== 'playing') return false;

  const currentTurnPlayer = game.currentTurn === 'player1' ? game.player1 : game.player2;
  if (!isBot(currentTurnPlayer)) {
    return false; // not bot's turn
  }

  console.log(`Bot ${currentTurnPlayer} is thinking on game ${gameId} (${game.type})...`);

  let bestMove = '';
  if (game.type === 'chess') {
    bestMove = getBestChessMove(game.boardState, game.currentTurn === 'player1');
  } else if (game.type === 'xiangqi') {
    bestMove = getBestXiangqiMove(game.boardState, game.currentTurn === 'player1');
  } else if (game.type === 'gomoku') {
    bestMove = getBestGomokuMove(game.boardState, game.currentTurn === 'player1');
  }

  if (!bestMove) {
    console.warn(`Bot ${currentTurnPlayer} could not find a legal move in game ${gameId}`);
    return false;
  }

  // Wait a small delay (e.g. 500ms) to feel more natural and not block execution
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log(`Bot ${currentTurnPlayer} plays ${bestMove} on game ${gameId}`);
  const { makeGameMove } = await import('./game-store');
  const result = await makeGameMove(gameId, currentTurnPlayer, bestMove);

  if (result.success) {
    // If the next turn is also a bot (e.g. testing or edge case), trigger again
    const nextTurnPlayer = result.game.currentTurn === 'player1' ? result.game.player1 : result.game.player2;
    if (isBot(nextTurnPlayer) && result.game.status === 'playing') {
      setTimeout(() => triggerBotMoveIfActive(gameId), 100);
    }
    return true;
  } else {
    console.error(`Bot ${currentTurnPlayer} failed to make move ${bestMove}: ${result.error}`);
    return false;
  }
}

// Periodic check: if a waiting game is created by human and waiting for > 1 minute, a Bot will join
export async function checkAndAutoJoinWaitingGames(waitingGamesList: Array<{ gameId: string; gameType: string; createdBy: string; createdAt: string }>) {
  const now = Date.now();
  for (const gameInfo of waitingGamesList) {
    if (isBot(gameInfo.createdBy)) {
      continue;
    }

    const gameAgeMs = now - new Date(gameInfo.createdAt).getTime();
    if (gameAgeMs >= 60000) { // 1 minute
      const availableBots = BOT_USERNAMES.filter(bot => bot !== gameInfo.createdBy);
      if (availableBots.length === 0) continue;

      const randomBot = availableBots[Math.floor(Math.random() * availableBots.length)];

      console.log(`Bot ${randomBot} auto-joins waiting game ${gameInfo.gameId} after 1 minute wait.`);
      
      await ensureBotsRegistered();

      const { joinGame } = await import('./game-store');
      const game = await joinGame(gameInfo.gameId, randomBot);
      if (game) {
        setTimeout(() => triggerBotMoveIfActive(gameInfo.gameId), 100);
        break; // join one game per request cycle to avoid overloading
      }
    }
  }
}

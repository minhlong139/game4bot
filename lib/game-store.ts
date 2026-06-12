import { kv } from './kv';
import { validateChessMove, CHESS_INITIAL_FEN } from './engines/chess';
import { validateGomokuMove, createInitialGomokuState } from './engines/gomoku';
import { validateXiangqiMove, XIANGQI_INITIAL_FEN } from './engines/xiangqi';

export type GameType = 'chess' | 'xiangqi' | 'gomoku';
export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface MoveHistoryEntry {
  move: string;
  san: string;
  boardBefore: string;
  boardAfter: string;
  player: 'player1' | 'player2';
  timestamp: string;
}

export interface GameData {
  id: string;
  type: GameType;
  status: GameStatus;
  player1: string;
  player2: string;
  boardState: string;
  currentTurn: 'player1' | 'player2';
  winner: 'player1' | 'player2' | 'draw' | null;
  history: MoveHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

// Help text or rules description to respond to Bots and show on UI
export const GAME_RULES: Record<GameType, string> = {
  chess: 'Cờ vua quốc tế tiêu chuẩn. Người tạo game là player1 (Quân Trắng, đi trước), người tham gia là player2 (Quân Đen, đi sau). Định dạng nước đi có thể là tọa độ từ-đến (ví dụ: "e2e4", "g1f3") hoặc ký hiệu SAN (ví dụ: "e4", "Nf3"). Phong cấp quân tốt được ký hiệu bằng cách thêm ký tự quân cờ ở cuối (ví dụ: "e7e8q" để phong Hậu).',
  xiangqi: 'Cờ tướng giản lược. Người tạo game là player1 (Quân Đỏ, đi trước), người tham gia là player2 (Quân Đen, đi sau). Bàn cờ gồm 9 cột (a-i) x 10 hàng (0-9). Định dạng nước đi bắt buộc là 4 ký tự tọa độ bắt đầu - kết thúc (ví dụ: "h7e7" để đi pháo đầu, "h0g2" để đi mã). Hệ thống xác thực luật di chuyển cơ bản của các quân cờ và chặn luật lộ tướng. Game kết thúc khi một bên bị ăn mất Tướng.',
  gomoku: 'Cờ caro tự do. Người tạo game là player1 (Quân Đen / ký hiệu "X", đi trước), người tham gia là player2 (Quân Trắng / ký hiệu "O", đi sau). Bàn cờ kích thước 15x15. Định dạng nước đi có thể là "x,y" (tọa độ từ 0-14, ví dụ: "7,7" là trung tâm) hoặc dạng cờ vua (a-o cho cột, 1-15 cho hàng, ví dụ: "h8"). Bên nào đạt được từ 5 quân liên tiếp hàng ngang, dọc hoặc chéo trước sẽ giành chiến thắng. Không áp dụng luật chặn hai đầu hay cấm nước đi.'
};

export async function createGame(creator: string, type: GameType): Promise<string> {
  const gameId = crypto.randomUUID();
  
  let initialBoardState = '';
  if (type === 'chess') {
    initialBoardState = CHESS_INITIAL_FEN;
  } else if (type === 'xiangqi') {
    initialBoardState = XIANGQI_INITIAL_FEN;
  } else if (type === 'gomoku') {
    initialBoardState = JSON.stringify(createInitialGomokuState());
  }

  const game: GameData = {
    id: gameId,
    type,
    status: 'waiting',
    player1: creator,
    player2: '',
    boardState: initialBoardState,
    currentTurn: 'player1',
    winner: null,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save game details
  await kv.set(`game:${gameId}`, game);
  // Add to waiting games set
  await kv.sadd('games:waiting', gameId);

  // Enforce total game limit of 100
  await enforceGameLimit();

  return gameId;
}

export async function enforceGameLimit(): Promise<void> {
  try {
    const waitingIds = await kv.smembers('games:waiting');
    const activeIds = await kv.smembers('games:active');
    const historyIds = await kv.lrange<string>('games:history', 0, -1);

    const allIds = Array.from(new Set([...waitingIds, ...activeIds, ...historyIds]));
    if (allIds.length <= 100) {
      return;
    }

    // Load game details to get their creation times
    const gamesWithMeta: { id: string; createdAt: number }[] = [];
    for (const id of allIds) {
      const g = await kv.get<GameData>(`game:${id}`);
      if (g) {
        gamesWithMeta.push({
          id: g.id,
          createdAt: new Date(g.createdAt || 0).getTime(),
        });
      } else {
        // Clean up orphaned ID from sets/lists
        await kv.srem('games:waiting', id);
        await kv.srem('games:active', id);
      }
    }

    // Sort by createdAt ascending (oldest first)
    gamesWithMeta.sort((a, b) => a.createdAt - b.createdAt);

    const overflowCount = gamesWithMeta.length - 100;
    if (overflowCount <= 0) return;

    const toDelete = gamesWithMeta.slice(0, overflowCount);
    const deleteIds = new Set(toDelete.map(item => item.id));

    for (const id of deleteIds) {
      // 1. Delete actual game data
      await kv.del(`game:${id}`);
      // 2. Remove from sets
      await kv.srem('games:waiting', id);
      await kv.srem('games:active', id);
    }

    // 3. Reconstruct games:history list without the deleted IDs
    const remainingHistoryIds = historyIds.filter(id => !deleteIds.has(id));
    await kv.del('games:history');
    if (remainingHistoryIds.length > 0) {
      await kv.lpush('games:history', ...[...remainingHistoryIds].reverse());
    }
  } catch (err) {
    console.error('Error enforcing game limit:', err);
  }
}

export async function joinGame(gameId: string, player2: string): Promise<GameData | null> {
  const game = await kv.get<GameData>(`game:${gameId}`);
  if (!game) return null;
  if (game.status !== 'waiting') return null;

  game.player2 = player2;
  game.status = 'playing';
  game.updatedAt = new Date().toISOString();

  await kv.set(`game:${gameId}`, game);
  await kv.srem('games:waiting', gameId);
  await kv.sadd('games:active', gameId);

  await triggerWebhook(game);

  return game;
}

export async function getGame(gameId: string): Promise<GameData | null> {
  return kv.get<GameData>(`game:${gameId}`);
}

export async function getWaitingGames(): Promise<Array<{ gameId: string; gameType: GameType; createdBy: string; createdAt: string }>> {
  const gameIds = await kv.smembers('games:waiting');
  const list = [];
  for (const id of gameIds) {
    const game = await kv.get<GameData>(`game:${id}`);
    if (game && game.status === 'waiting') {
      list.push({
        gameId: game.id,
        gameType: game.type,
        createdBy: game.player1,
        createdAt: game.createdAt
      });
    }
  }
  // Sort by created time descending
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getActiveGames(): Promise<GameData[]> {
  const gameIds = await kv.smembers('games:active');
  const list = [];
  for (const id of gameIds) {
    const game = await kv.get<GameData>(`game:${id}`);
    if (game && game.status === 'playing') {
      list.push(game);
    }
  }
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getCompletedGames(limit = 20): Promise<GameData[]> {
  // Retrieve completed game IDs from list
  const gameIds = await kv.lrange<string>('games:history', 0, limit - 1);
  const list = [];
  for (const id of gameIds) {
    const game = await kv.get<GameData>(`game:${id}`);
    if (game) {
      list.push(game);
    }
  }
  return list;
}

export interface MoveResult {
  success: boolean;
  error?: string;
  game: GameData;
}

export async function makeGameMove(gameId: string, username: string, moveStr: string): Promise<MoveResult> {
  const game = await kv.get<GameData>(`game:${gameId}`);
  if (!game) {
    return { success: false, error: 'Game not found', game: null as any };
  }

  if (game.status !== 'playing') {
    return { success: false, error: 'Game is not in playing status', game };
  }

  // Identify player role
  let role: 'player1' | 'player2' | null = null;
  if (game.player1 === username && game.currentTurn === 'player1') {
    role = 'player1';
  } else if (game.player2 === username && game.currentTurn === 'player2') {
    role = 'player2';
  }

  if (!role) {
    return {
      success: false,
      error: `Not your turn. Current turn belongs to ${game.currentTurn === 'player1' ? game.player1 : game.player2}`,
      game
    };
  }

  // Validate and execute move based on game type
  let engineResult;
  if (game.type === 'chess') {
    engineResult = validateChessMove(game.boardState, moveStr, role);
  } else if (game.type === 'xiangqi') {
    engineResult = validateXiangqiMove(game.boardState, moveStr, role);
  } else if (game.type === 'gomoku') {
    engineResult = validateGomokuMove(game.boardState, moveStr, role);
  } else {
    return { success: false, error: 'Unknown game type', game };
  }

  if (!engineResult.valid) {
    return { success: false, error: engineResult.error || 'Invalid move', game };
  }

  // Update game state
  game.boardState = engineResult.boardState;
  if (engineResult.historyEntry) {
    game.history.push(engineResult.historyEntry);
  }
  game.currentTurn = game.currentTurn === 'player1' ? 'player2' : 'player1';

  if (engineResult.isFinished) {
    game.status = 'finished';
    game.winner = engineResult.winner;
    
    // Update player scores
    await updatePlayerStats(game.player1, game.player2, engineResult.winner);
    
    // Update sets
    await kv.srem('games:active', gameId);
    await kv.lpush('games:history', gameId);
  }

  game.updatedAt = new Date().toISOString();
  await kv.set(`game:${gameId}`, game);

  await triggerWebhook(game);

  return { success: true, game };
}

async function updatePlayerStats(player1: string, player2: string, winner: 'player1' | 'player2' | 'draw' | null) {
  try {
    const p1Key = `user:${player1}`;
    const p2Key = `user:${player2}`;

    const p1 = await kv.hgetall<any>(p1Key);
    const p2 = await kv.hgetall<any>(p2Key);

    if (p1) {
      const wins = parseInt(p1.wins || '0', 10);
      const draws = parseInt(p1.draws || '0', 10);
      const losses = parseInt(p1.losses || '0', 10);
      if (winner === 'player1') {
        await kv.hset(p1Key, { wins: wins + 1 });
      } else if (winner === 'player2') {
        await kv.hset(p1Key, { losses: losses + 1 });
      } else {
        await kv.hset(p1Key, { draws: draws + 1 });
      }
    }

    // Don't update player2 stats if bot played with itself
    if (player1 === player2) return;

    if (p2) {
      const wins = parseInt(p2.wins || '0', 10);
      const draws = parseInt(p2.draws || '0', 10);
      const losses = parseInt(p2.losses || '0', 10);
      if (winner === 'player2') {
        await kv.hset(p2Key, { wins: wins + 1 });
      } else if (winner === 'player1') {
        await kv.hset(p2Key, { losses: losses + 1 });
      } else {
        await kv.hset(p2Key, { draws: draws + 1 });
      }
    }
  } catch (err) {
    console.error('Failed to update stats:', err);
  }
}

export interface LeaderboardEntry {
  username: string;
  wins: number;
  draws: number;
  losses: number;
  score: number; // wins * 3 + draws * 1
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    // Ideally we would index all users, but since Redis has scan/keys:
    // With Vercel KV, let's keep a leaderboard or scan for users.
    // Since this is a lightweight app, let's keep a set of all registered user names, or search KV keys.
    // For local mock / Redis, we can read the full mock store, or scan.
    // Let's implement user tracking by adding users to a set `users:all` on registration!
    // Wait, let's check if we added to a set. In our registration route, we didn't add it yet.
    // Let's modify the registration api route or just add a set addition helper here.
    // Let's write a wrapper. But wait, since we haven't registered anyone yet, we can update the registration api route
    // to add usernames to `users:all` so we can easily query them for the leaderboard!
    // Let's implement this set: `users:all`.
    const usernames = await kv.smembers('users:all');
    const board: LeaderboardEntry[] = [];
    for (const name of usernames) {
      const u = await kv.hgetall<any>(`user:${name}`);
      if (u) {
        const wins = parseInt(u.wins || '0', 10);
        const draws = parseInt(u.draws || '0', 10);
        const losses = parseInt(u.losses || '0', 10);
        board.push({
          username: name,
          wins,
          draws,
          losses,
          score: wins * 3 + draws
        });
      }
    }
    return board.sort((a, b) => b.score - a.score || b.wins - a.wins);
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
    return [];
  }
}

export async function cancelGame(gameId: string, username: string): Promise<boolean> {
  const game = await kv.get<GameData>(`game:${gameId}`);
  if (!game) return false;
  if (game.status !== 'waiting') return false;
  if (game.player1 !== username) return false;

  await kv.del(`game:${gameId}`);
  await kv.srem('games:waiting', gameId);

  return true;
}

export async function surrenderGame(gameId: string, username: string): Promise<boolean> {
  const game = await kv.get<GameData>(`game:${gameId}`);
  if (!game) return false;
  if (game.status !== 'playing') return false;

  let loserRole: 'player1' | 'player2' | null = null;
  if (game.player1 === username) {
    loserRole = 'player1';
  } else if (game.player2 === username) {
    loserRole = 'player2';
  }

  if (!loserRole) return false;

  const winnerRole = loserRole === 'player1' ? 'player2' : 'player1';

  game.status = 'finished';
  game.winner = winnerRole;
  game.history.push({
    move: 'surrender',
    san: `${username} đầu hàng`,
    boardBefore: game.boardState,
    boardAfter: game.boardState,
    player: loserRole,
    timestamp: new Date().toISOString()
  });
  game.updatedAt = new Date().toISOString();

  await kv.set(`game:${gameId}`, game);
  await kv.srem('games:active', gameId);
  await kv.lpush('games:history', gameId);

  // Update stats
  await updatePlayerStats(game.player1, game.player2, winnerRole);

  await triggerWebhook(game);

  return true;
}

async function triggerWebhook(game: GameData) {
  try {
    const nextPlayerUsername = game.status === 'playing'
      ? (game.currentTurn === 'player1' ? game.player1 : game.player2)
      : null;

    const playersToNotify = [];
    if (game.status === 'finished') {
      playersToNotify.push(game.player1);
      if (game.player2) playersToNotify.push(game.player2);
    } else if (nextPlayerUsername) {
      playersToNotify.push(nextPlayerUsername);
    }

    for (const username of playersToNotify) {
      const u = await kv.hgetall<{ webhookUrl?: string }>(`user:${username}`);
      if (u && u.webhookUrl) {
        // Fire webhook request
        fetch(u.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: game.status === 'finished' ? 'game_finished' : 'move_made',
            gameId: game.id,
            type: game.type,
            status: game.status,
            boardState: game.boardState,
            currentTurn: game.currentTurn,
            winner: game.winner,
            history: game.history,
            updatedAt: game.updatedAt,
          }),
        }).catch(err => {
          console.error(`Failed to send webhook to ${username}:`, err);
        });
      }
    }
  } catch (err) {
    console.error('Error in triggerWebhook:', err);
  }
}

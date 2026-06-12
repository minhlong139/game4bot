export const GOMOKU_BOARD_SIZE = 15;

export interface GomokuState {
  board: string[][]; // 15x15 grid, cells can be "", "X" (player1), "O" (player2)
  nextTurn: 'player1' | 'player2';
  lastMove: { x: number; y: number; player: 'player1' | 'player2' } | null;
}

export interface GomokuMoveResult {
  valid: boolean;
  error?: string;
  boardState: string; // JSON string of GomokuState
  isFinished: boolean;
  winner: 'player1' | 'player2' | 'draw' | null;
  historyEntry?: {
    move: string;
    san: string; // e.g. "h8"
    boardBefore: string;
    boardAfter: string;
    player: 'player1' | 'player2';
    timestamp: string;
  };
}

export function createInitialGomokuState(): GomokuState {
  const board = Array(GOMOKU_BOARD_SIZE)
    .fill(null)
    .map(() => Array(GOMOKU_BOARD_SIZE).fill(''));
  return {
    board,
    nextTurn: 'player1',
    lastMove: null,
  };
}

// Helper to convert coordinate e.g., "h8" to {x, y}
// Columns a-o, Rows 1-15 (a=0, b=1... o=14)
export function parseGomokuMove(moveStr: string): { x: number; y: number } | null {
  const clean = moveStr.trim().toLowerCase();
  
  // Try parsing "x,y" format
  if (clean.includes(',')) {
    const parts = clean.split(',');
    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    if (!isNaN(x) && x >= 0 && x < GOMOKU_BOARD_SIZE && !isNaN(y) && y >= 0 && y < GOMOKU_BOARD_SIZE) {
      return { x, y };
    }
  }

  // Try parsing "h8" style
  // First character is column (a-o)
  // Remaining characters are row (1-15)
  const colChar = clean.charCodeAt(0);
  const rowVal = parseInt(clean.substring(1), 10);

  const x = colChar - 97; // 'a' code is 97
  const y = rowVal - 1; // 1-indexed to 0-indexed

  if (x >= 0 && x < GOMOKU_BOARD_SIZE && !isNaN(y) && y >= 0 && y < GOMOKU_BOARD_SIZE) {
    return { x, y };
  }

  return null;
}

// Convert x, y coordinates back to standard string format e.g. "h8"
export function formatGomokuMove(x: number, y: number): string {
  const colChar = String.fromCharCode(97 + x); // a-o
  const rowStr = (y + 1).toString(); // 1-15
  return `${colChar}${rowStr}`;
}

export function checkGomokuWin(board: string[][], r: number, c: number, symbol: string): boolean {
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1],  // diagonal down-left
  ];

  for (const [dr, dc] of directions) {
    let count = 1;

    // Search positive direction
    let step = 1;
    while (true) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr >= 0 && nr < GOMOKU_BOARD_SIZE && nc >= 0 && nc < GOMOKU_BOARD_SIZE && board[nr][nc] === symbol) {
        count++;
        step++;
      } else {
        break;
      }
    }

    // Search negative direction
    step = 1;
    while (true) {
      const nr = r - dr * step;
      const nc = c - dc * step;
      if (nr >= 0 && nr < GOMOKU_BOARD_SIZE && nc >= 0 && nc < GOMOKU_BOARD_SIZE && board[nr][nc] === symbol) {
        count++;
        step++;
      } else {
        break;
      }
    }

    if (count >= 5) {
      return true;
    }
  }

  return false;
}

export function isGomokuBoardFull(board: string[][]): boolean {
  for (let r = 0; r < GOMOKU_BOARD_SIZE; r++) {
    for (let c = 0; c < GOMOKU_BOARD_SIZE; c++) {
      if (board[r][c] === '') {
        return false;
      }
    }
  }
  return true;
}

export function validateGomokuMove(
  stateJson: string,
  moveStr: string,
  player: 'player1' | 'player2'
): GomokuMoveResult {
  try {
    let state: GomokuState;
    if (!stateJson) {
      state = createInitialGomokuState();
    } else {
      state = JSON.parse(stateJson);
    }

    const { board, nextTurn } = state;

    // Validate turn
    if (nextTurn !== player) {
      return {
        valid: false,
        error: `It is not your turn. Current turn: ${nextTurn}`,
        boardState: JSON.stringify(state),
        isFinished: false,
        winner: null,
      };
    }

    // Parse move
    const coords = parseGomokuMove(moveStr);
    if (!coords) {
      return {
        valid: false,
        error: `Invalid coordinate format: '${moveStr}'. Use 'x,y' (0-14) or standard chess style (a-o for col, 1-15 for row, e.g., 'h8')`,
        boardState: JSON.stringify(state),
        isFinished: false,
        winner: null,
      };
    }

    const { x, y } = coords; // Note: x is col (0-14), y is row (0-14)
    // Map to grid board: row index is y, col index is x
    if (board[y][x] !== '') {
      return {
        valid: false,
        error: `Cell at (${x}, ${y}) is already occupied by '${board[y][x]}'`,
        boardState: JSON.stringify(state),
        isFinished: false,
        winner: null,
      };
    }

    const boardBefore = JSON.stringify(state);
    
    // Make move
    const symbol = player === 'player1' ? 'X' : 'O';
    board[y][x] = symbol;
    
    const opponent = player === 'player1' ? 'player2' : 'player1';
    state.nextTurn = opponent;
    state.lastMove = { x, y, player };

    const hasWon = checkGomokuWin(board, y, x, symbol);
    const isFull = isGomokuBoardFull(board);
    
    const isFinished = hasWon || isFull;
    let winner: 'player1' | 'player2' | 'draw' | null = null;
    if (hasWon) {
      winner = player;
    } else if (isFull) {
      winner = 'draw';
    }

    const boardAfter = JSON.stringify(state);
    const san = formatGomokuMove(x, y);

    return {
      valid: true,
      boardState: boardAfter,
      isFinished,
      winner,
      historyEntry: {
        move: moveStr,
        san,
        boardBefore,
        boardAfter,
        player,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error?.message || 'Error processing Gomoku move',
      boardState: stateJson,
      isFinished: false,
      winner: null,
    };
  }
}

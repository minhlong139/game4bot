export const XIANGQI_INITIAL_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r';

export interface XiangqiMoveResult {
  valid: boolean;
  error?: string;
  boardState: string; // FEN
  isFinished: boolean;
  winner: 'player1' | 'player2' | 'draw' | null;
  historyEntry?: {
    move: string;
    san: string;
    boardBefore: string;
    boardAfter: string;
    player: 'player1' | 'player2';
    timestamp: string;
  };
}

export function parseXiangqiFen(fen: string): { board: string[][]; turn: 'r' | 'b' } {
  const [boardPart, turnPart] = fen.split(' ');
  const rows = boardPart.split('/');
  const board = Array(10)
    .fill(null)
    .map(() => Array(9).fill(''));

  for (let r = 0; r < 10; r++) {
    const rowStr = rows[r];
    let c = 0;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (/[0-9]/.test(char)) {
        c += parseInt(char, 10);
      } else {
        board[r][c] = char;
        c++;
      }
    }
  }

  return { board, turn: turnPart === 'b' ? 'b' : 'r' };
}

export function serializeXiangqiFen(board: string[][], turn: 'r' | 'b'): string {
  const rows: string[] = [];
  for (let r = 0; r < 10; r++) {
    let rowStr = '';
    let emptyCount = 0;
    for (let c = 0; c < 9; c++) {
      const char = board[r][c];
      if (char === '') {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount.toString();
          emptyCount = 0;
        }
        rowStr += char;
      }
    }
    if (emptyCount > 0) {
      rowStr += emptyCount.toString();
    }
    rows.push(rowStr);
  }
  return `${rows.join('/')} ${turn}`;
}

// Map e.g. "b2e2" to {fromR, fromC, toR, toC}
// Columns a-i (a=0, i=8)
// Rows 0-9 (0 is top, 9 is bottom)
export function parseXiangqiMove(moveStr: string): { fromR: number; fromC: number; toR: number; toC: number } | null {
  const clean = moveStr.trim().toLowerCase();
  if (clean.length !== 4) return null;

  const fromC = clean.charCodeAt(0) - 97; // 'a' = 0
  const fromR = parseInt(clean[1], 10);
  const toC = clean.charCodeAt(2) - 97; // 'a' = 0
  const toR = parseInt(clean[3], 10);

  if (
    fromC >= 0 && fromC < 9 &&
    fromR >= 0 && fromR < 10 &&
    toC >= 0 && toC < 9 &&
    toR >= 0 && toR < 10
  ) {
    return { fromR, fromC, toR, toC };
  }

  return null;
}

export function formatXiangqiMove(fromR: number, fromC: number, toR: number, toC: number): string {
  const c1 = String.fromCharCode(97 + fromC);
  const r1 = fromR.toString();
  const c2 = String.fromCharCode(97 + toC);
  const r2 = toR.toString();
  return `${c1}${r1}${c2}${r2}`;
}

export function isPieceRed(char: string): boolean {
  return char !== '' && char === char.toUpperCase();
}

function countPiecesBetween(board: string[][], r1: number, c1: number, r2: number, c2: number): number {
  let count = 0;
  if (r1 === r2) {
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);
    for (let c = minC + 1; c < maxC; c++) {
      if (board[r1][c] !== '') count++;
    }
  } else if (c1 === c2) {
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    for (let r = minR + 1; r < maxR; r++) {
      if (board[r][c1] !== '') count++;
    }
  }
  return count;
}

export function checkFlyingGeneral(board: string[][]): boolean {
  // Find King positions
  let redKing = { r: -1, c: -1 };
  let blackKing = { r: -1, c: -1 };

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 'K') {
        redKing = { r, c };
      } else if (board[r][c] === 'k') {
        blackKing = { r, c };
      }
    }
  }

  // If one of the Kings is already captured, no flying general check needed
  if (redKing.r === -1 || blackKing.r === -1) {
    return false;
  }

  // If they are in the same column, check if there are pieces in between
  if (redKing.c === blackKing.c) {
    const count = countPiecesBetween(board, redKing.r, redKing.c, blackKing.r, blackKing.c);
    if (count === 0) {
      return true; // Two kings face each other directly
    }
  }

  return false;
}

export function isXiangqiMoveValid(
  board: string[][],
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  isRed: boolean
): { valid: boolean; error?: string } {
  const piece = board[fromR][fromC];
  if (piece === '') {
    return { valid: false, error: 'No piece at source square' };
  }

  if (isRed !== isPieceRed(piece)) {
    return { valid: false, error: "Cannot move opponent's piece" };
  }

  const target = board[toR][toC];
  if (target !== '' && isRed === isPieceRed(target)) {
    return { valid: false, error: 'Cannot capture your own piece' };
  }

  const dr = toR - fromR;
  const dc = toC - fromC;
  const absDr = Math.abs(dr);
  const absDc = Math.abs(dc);

  const pieceType = piece.toLowerCase();

  switch (pieceType) {
    case 'k': { // King (Tướng)
      // Must move 1 step orthogonally
      if (absDr + absDc !== 1) {
        return { valid: false, error: 'King must move exactly 1 step horizontally or vertically' };
      }
      // Palace constraints
      const inPalaceC = toC >= 3 && toC <= 5;
      const inPalaceR = isRed ? (toR >= 7 && toR <= 9) : (toR >= 0 && toR <= 2);
      if (!inPalaceC || !inPalaceR) {
        return { valid: false, error: 'King must remain in the palace' };
      }
      break;
    }
    case 'a': { // Advisor (Sĩ)
      // Must move 1 step diagonally
      if (absDr !== 1 || absDc !== 1) {
        return { valid: false, error: 'Advisor must move exactly 1 step diagonally' };
      }
      // Palace constraints
      const inPalaceC = toC >= 3 && toC <= 5;
      const inPalaceR = isRed ? (toR >= 7 && toR <= 9) : (toR >= 0 && toR <= 2);
      if (!inPalaceC || !inPalaceR) {
        return { valid: false, error: 'Advisor must remain in the palace' };
      }
      break;
    }
    case 'b': { // Elephant / Bishop (Tượng)
      // Must move exactly 2 steps diagonally
      if (absDr !== 2 || absDc !== 2) {
        return { valid: false, error: 'Elephant must move exactly 2 steps diagonally' };
      }
      // River constraint (Red cannot go above row 5, Black cannot go below row 4)
      if (isRed && toR < 5) {
        return { valid: false, error: 'Elephant cannot cross the river' };
      }
      if (!isRed && toR > 4) {
        return { valid: false, error: 'Elephant cannot cross the river' };
      }
      // Blocking eye check (cản mắt tượng)
      const midR = fromR + dr / 2;
      const midC = fromC + dc / 2;
      if (board[midR][midC] !== '') {
        return { valid: false, error: 'Elephant is blocked (cản mắt tượng)' };
      }
      break;
    }
    case 'n': { // Knight (Mã)
      // L-move check
      const isValidL = (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
      if (!isValidL) {
        return { valid: false, error: 'Knight must move in an L-shape' };
      }
      // Block check (cản chân mã)
      let blockR = fromR;
      let blockC = fromC;
      if (absDr === 2) {
        blockR += dr / 2;
      } else {
        blockC += dc / 2;
      }
      if (board[blockR][blockC] !== '') {
        return { valid: false, error: 'Knight is blocked (cản chân mã)' };
      }
      break;
    }
    case 'r': { // Rook (Xe)
      // Must move along row or col
      if (fromR !== toR && fromC !== toC) {
        return { valid: false, error: 'Rook must move in a straight line' };
      }
      // Path check
      const pieces = countPiecesBetween(board, fromR, fromC, toR, toC);
      if (pieces > 0) {
        return { valid: false, error: 'Rook path is blocked' };
      }
      break;
    }
    case 'c': { // Cannon (Pháo)
      // Must move along row or col
      if (fromR !== toR && fromC !== toC) {
        return { valid: false, error: 'Cannon must move in a straight line' };
      }
      const pieces = countPiecesBetween(board, fromR, fromC, toR, toC);
      if (target === '') {
        // Normal move, no pieces in between
        if (pieces > 0) {
          return { valid: false, error: 'Cannon path is blocked' };
        }
      } else {
        // Capture move, exactly 1 piece in between (the screen)
        if (pieces !== 1) {
          return { valid: false, error: 'Cannon must jump over exactly one piece to capture' };
        }
      }
      break;
    }
    case 'p': { // Pawn (Tốt)
      // Check forward move direction
      const forwardDir = isRed ? -1 : 1;
      const hasCrossedRiver = isRed ? fromR < 5 : fromR > 4;

      if (dr === forwardDir && dc === 0) {
        // Legal move forward
      } else if (hasCrossedRiver && dr === 0 && absDc === 1) {
        // Legal move sideways after crossing river
      } else {
        return {
          valid: false,
          error: hasCrossedRiver
            ? 'Pawn can only move 1 step forward or sideways'
            : 'Pawn cannot move sideways or backward before crossing the river',
        };
      }
      break;
    }
    default:
      return { valid: false, error: 'Unknown piece type' };
  }

  // Create hypothetical board to test flying generals
  const tempBoard = board.map(row => [...row]);
  tempBoard[toR][toC] = tempBoard[fromR][fromC];
  tempBoard[fromR][fromC] = '';

  if (checkFlyingGeneral(tempBoard)) {
    return { valid: false, error: 'Move violates the flying general rule (lộ tướng)' };
  }

  return { valid: true };
}

export function isSquareAttacked(
  board: string[][],
  targetR: number,
  targetC: number,
  attackerIsRed: boolean
): boolean {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece === '') continue;
      if (isPieceRed(piece) === attackerIsRed) {
        // Can this piece move to (targetR, targetC)?
        const res = isXiangqiMoveValid(board, r, c, targetR, targetC, attackerIsRed);
        if (res.valid) {
          return true;
        }
      }
    }
  }
  return false;
}

export function isKingInCheck(board: string[][], isRed: boolean): boolean {
  let kingR = -1;
  let kingC = -1;
  const kingChar = isRed ? 'K' : 'k';
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === kingChar) {
        kingR = r;
        kingC = c;
        break;
      }
    }
    if (kingR !== -1) break;
  }

  if (kingR === -1) return false;
  return isSquareAttacked(board, kingR, kingC, !isRed);
}

export function isMoveLegal(
  board: string[][],
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  isRed: boolean
): boolean {
  const val = isXiangqiMoveValid(board, fromR, fromC, toR, toC, isRed);
  if (!val.valid) return false;

  const tempBoard = board.map(row => [...row]);
  tempBoard[toR][toC] = tempBoard[fromR][fromC];
  tempBoard[fromR][fromC] = '';

  if (isKingInCheck(tempBoard, isRed)) {
    return false;
  }

  return true;
}

export function getLegalMoves(board: string[][], isRed: boolean): { fromR: number; fromC: number; toR: number; toC: number }[] {
  const moves: { fromR: number; fromC: number; toR: number; toC: number }[] = [];
  for (let fromR = 0; fromR < 10; fromR++) {
    for (let fromC = 0; fromC < 9; fromC++) {
      const piece = board[fromR][fromC];
      if (piece === '' || isPieceRed(piece) !== isRed) continue;

      for (let toR = 0; toR < 10; toR++) {
        for (let toC = 0; toC < 9; toC++) {
          if (fromR === toR && fromC === toC) continue;
          if (isMoveLegal(board, fromR, fromC, toR, toC, isRed)) {
            moves.push({ fromR, fromC, toR, toC });
          }
        }
      }
    }
  }
  return moves;
}

export function validateXiangqiMove(
  fen: string,
  moveStr: string,
  playerColor: 'player1' | 'player2' // player1 = Red ('r'), player2 = Black ('b')
): XiangqiMoveResult {
  try {
    const { board, turn } = parseXiangqiFen(fen);

    // Validate turn
    const expectedTurn = playerColor === 'player1' ? 'r' : 'b';
    if (turn !== expectedTurn) {
      return {
        valid: false,
        error: `It is not your turn. Current turn: ${turn === 'r' ? 'player1 (Red)' : 'player2 (Black)'}`,
        boardState: fen,
        isFinished: false,
        winner: null,
      };
    }

    const coords = parseXiangqiMove(moveStr);
    if (!coords) {
      return {
        valid: false,
        error: `Invalid move coordinate: '${moveStr}'. Format must be 4 characters like 'h2e2' (columns a-i, rows 0-9)`,
        boardState: fen,
        isFinished: false,
        winner: null,
      };
    }

    const { fromR, fromC, toR, toC } = coords;
    const validation = isXiangqiMoveValid(board, fromR, fromC, toR, toC, turn === 'r');

    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error || 'Illegal move',
        boardState: fen,
        isFinished: false,
        winner: null,
      };
    }

    // Now check if it leaves own king in check
    const tempBoard = board.map(row => [...row]);
    tempBoard[toR][toC] = tempBoard[fromR][fromC];
    tempBoard[fromR][fromC] = '';

    if (isKingInCheck(tempBoard, turn === 'r')) {
      return {
        valid: false,
        error: 'Move leaves your King in check (hoặc tướng bị chiếu/lộ tướng)',
        boardState: fen,
        isFinished: false,
        winner: null,
      };
    }

    const boardBefore = fen;

    // Apply move
    const capturedPiece = board[toR][toC];
    board[toR][toC] = board[fromR][fromC];
    board[fromR][fromC] = '';

    // Switch turn
    const nextTurn = turn === 'r' ? 'b' : 'r';
    const boardAfter = serializeXiangqiFen(board, nextTurn);

    // Check game termination (King captured)
    let isFinished = false;
    let winner: 'player1' | 'player2' | 'draw' | null = null;

    if (capturedPiece.toLowerCase() === 'k') {
      isFinished = true;
      winner = playerColor; // The player who made the move wins
    }

    // Double check if there are any kings left (just in case)
    let hasRedKing = false;
    let hasBlackKing = false;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 'K') hasRedKing = true;
        if (board[r][c] === 'k') hasBlackKing = true;
      }
    }
    if (!hasRedKing) {
      isFinished = true;
      winner = 'player2'; // Black wins
    } else if (!hasBlackKing) {
      isFinished = true;
      winner = 'player1'; // Red wins
    }

    // Check if the next player has any legal moves (Checkmate or Stalemate)
    if (!isFinished) {
      const nextPlayerIsRed = nextTurn === 'r';
      const nextLegalMoves = getLegalMoves(board, nextPlayerIsRed);
      if (nextLegalMoves.length === 0) {
        isFinished = true;
        winner = playerColor; // The current player wins
      }
    }

    return {
      valid: true,
      boardState: boardAfter,
      isFinished,
      winner,
      historyEntry: {
        move: moveStr,
        san: moveStr,
        boardBefore,
        boardAfter,
        player: playerColor,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error?.message || 'Error processing Xiangqi move',
      boardState: fen,
      isFinished: false,
      winner: null,
    };
  }
}

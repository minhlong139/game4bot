import { Chess } from 'chess.js';

export const CHESS_INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface ChessMoveResult {
  valid: boolean;
  error?: string;
  boardState: string;
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

export function validateChessMove(
  fen: string,
  moveStr: string,
  playerColor: 'player1' | 'player2' // player1 = White ('w'), player2 = Black ('b')
): ChessMoveResult {
  try {
    const chess = new Chess(fen);

    // Validate turn
    const expectedColor = playerColor === 'player1' ? 'w' : 'b';
    if (chess.turn() !== expectedColor) {
      return {
        valid: false,
        error: `It is not your turn. Current turn: ${chess.turn() === 'w' ? 'player1 (White)' : 'player2 (Black)'}`,
        boardState: fen,
        isFinished: chess.isGameOver(),
        winner: null,
      };
    }

    const boardBefore = fen;
    let moveObj;

    // Try parsing as standard algebraic or object-like e.g. e2e4 or e4
    try {
      // If moveStr is e2e4, parse it
      if (moveStr.length === 4 || (moveStr.length === 5 && ['q','r','b','n'].includes(moveStr[4]))) {
        const from = moveStr.substring(0, 2);
        const to = moveStr.substring(2, 4);
        const promotion = moveStr.length === 5 ? moveStr[4] : undefined;
        moveObj = chess.move({ from, to, promotion });
      } else {
        moveObj = chess.move(moveStr);
      }
    } catch (e) {
      return {
        valid: false,
        error: `Invalid move: ${moveStr}`,
        boardState: fen,
        isFinished: chess.isGameOver(),
        winner: null,
      };
    }

    if (!moveObj) {
      return {
        valid: false,
        error: `Move ${moveStr} is illegal in the current position`,
        boardState: fen,
        isFinished: chess.isGameOver(),
        winner: null,
      };
    }

    const boardAfter = chess.fen();
    const isFinished = chess.isGameOver();
    let winner: 'player1' | 'player2' | 'draw' | null = null;

    if (isFinished) {
      if (chess.isCheckmate()) {
        // Since chess.turn() changes to the other player after move,
        // the player who just moved is the one who did NOT have turn now.
        // Wait, if it is checkmate, the side whose turn it IS has lost.
        winner = chess.turn() === 'w' ? 'player2' : 'player1';
      } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
        winner = 'draw';
      }
    }

    return {
      valid: true,
      boardState: boardAfter,
      isFinished,
      winner,
      historyEntry: {
        move: moveStr,
        san: moveObj.san,
        boardBefore,
        boardAfter,
        player: playerColor,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error?.message || 'Error processing chess move',
      boardState: fen,
      isFinished: false,
      winner: null,
    };
  }
}

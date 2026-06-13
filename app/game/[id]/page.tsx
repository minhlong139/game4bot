'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

interface MoveHistoryEntry {
  move: string;
  san: string;
  boardBefore: string;
  boardAfter: string;
  player: 'player1' | 'player2';
  timestamp: string;
}

interface GameData {
  id: string;
  type: 'chess' | 'xiangqi' | 'gomoku';
  status: 'waiting' | 'playing' | 'finished';
  player1: string;
  player2: string;
  boardState: string;
  currentTurn: 'player1' | 'player2';
  winner: 'player1' | 'player2' | 'draw' | null;
  history: MoveHistoryEntry[];
  rules: string;
  createdAt: string;
  updatedAt: string;
}

// Unicode symbols for Chess
const CHESS_PIECE_SYMBOLS: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remainingSec = Math.floor(sec % 60);
  return `${min}m ${remainingSec}s`;
};

interface TurnMove {
  originalIndex: number;
  move: string;
  san: string;
  thinkingTimeMs: number;
  cumulativeTimeMs: number;
}

interface TurnEntry {
  turnNumber: number;
  move1?: TurnMove;
  move2?: TurnMove;
}

const getHistoryTurns = (history: MoveHistoryEntry[], gameCreatedAt: string): TurnEntry[] => {
  const turns: TurnEntry[] = [];
  let p1Time = 0;
  let p2Time = 0;

  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    const prevTime = i === 0 ? new Date(gameCreatedAt).getTime() : new Date(history[i - 1].timestamp).getTime();
    const currTime = new Date(h.timestamp).getTime();
    const thinkingTimeMs = Math.max(0, currTime - prevTime);

    let cumulativeTimeMs = 0;
    if (h.player === 'player1') {
      p1Time += thinkingTimeMs;
      cumulativeTimeMs = p1Time;
    } else {
      p2Time += thinkingTimeMs;
      cumulativeTimeMs = p2Time;
    }

    const turnIndex = Math.floor(i / 2);
    if (!turns[turnIndex]) {
      turns[turnIndex] = {
        turnNumber: turnIndex + 1,
      };
    }

    const moveData: TurnMove = {
      originalIndex: i,
      move: h.move,
      san: h.san,
      thinkingTimeMs,
      cumulativeTimeMs,
    };

    if (h.player === 'player1') {
      turns[turnIndex].move1 = moveData;
    } else {
      turns[turnIndex].move2 = moveData;
    }
  }

  return turns;
};


// Chinese characters for Xiangqi
const XIANGQI_PIECE_LABELS: Record<string, string> = {
  'K': '帥', 'A': '仕', 'B': '相', 'N': '傌', 'R': '俥', 'C': '炮', 'P': '兵',
  'k': '將', 'a': '士', 'b': '象', 'n': '馬', 'r': '車', 'c': '砲', 'p': '卒'
};

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

const ANIMALS = [
  { id: 'pig', name: 'Lợn Hồng', icon: '🐷', color: '#ec4899' },
  { id: 'dog', name: 'Chó Vàng', icon: '🐶', color: '#eab308' },
  { id: 'cat', name: 'Mèo Mun', icon: '🐱', color: '#94a3b8' },
  { id: 'monkey', name: 'Khỉ Con', icon: '🐵', color: '#f97316' },
  { id: 'chicken', name: 'Gà Trống', icon: '🐔', color: '#ef4444' },
  { id: 'bunny', name: 'Thỏ Ngọc', icon: '🐰', color: '#e2e8f0' },
  { id: 'panda', name: 'Gấu Trúc', icon: '🐼', color: '#f8fafc' },
  { id: 'bear', name: 'Gấu Nâu', icon: '🐻', color: '#854d0e' },
];

function formatPlayerName(username: string): string {
  if (!username) return '';
  if (username.startsWith('human_')) {
    const parts = username.split('_');
    if (parts.length >= 2) {
      const animalId = parts[1];
      const animal = ANIMALS.find(a => a.id === animalId);
      if (animal) {
        return `${animal.icon} ${animal.name}`;
      }
    }
  }
  return `🤖 ${username}`;
}

function findGomokuWinningLine(board: string[][]): Array<{r: number, c: number}> {
  const size = 15;
  const directions = [
    [0, 1],   // ngang
    [1, 0],   // dọc
    [1, 1],   // chéo xuôi
    [1, -1],  // chéo ngược
  ];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const symbol = board[r][c];
      if (symbol === '') continue;

      for (const [dr, dc] of directions) {
        const line = [{r, c}];
        let step = 1;
        while (step < 5) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === symbol) {
            line.push({r: nr, c: nc});
            step++;
          } else {
            break;
          }
        }
        if (line.length === 5) {
          return line;
        }
      }
    }
  }
  return [];
}

export default function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = use(params);
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 means live/latest board

  const [humanUser, setHumanUser] = useState<{ username: string; displayName: string; token: string; avatarColor: string } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null); // e.g. "e2" or "h7"
  const [makingMove, setMakingMove] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Read user cookie
  useEffect(() => {
    const cookieVal = getCookie('game4bot_user');
    if (cookieVal) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cookieVal));
        if (parsed && parsed.token) {
          setHumanUser(parsed);
        }
      } catch (e) {
        console.error('Error parsing user cookie:', e);
      }
    }
  }, []);

  const fetchGameStatus = async () => {
    try {
      const res = await fetch(`/api/public/games/${gameId}?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success') {
          setGame(json.game);
          setError(null);
        } else {
          setError(json.message || 'Không thể tải thông tin trận đấu');
        }
      } else {
        setError('Không tìm thấy trận đấu này');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameStatus();
  }, [gameId]);

  // Poll when game is waiting or playing, and user is looking at live board
  useEffect(() => {
    if (!game || game.status === 'finished' || historyIndex !== -1) return;

    const interval = setInterval(fetchGameStatus, 1500);
    return () => clearInterval(interval);
  }, [game?.status, historyIndex]);

  const isLive = historyIndex === -1;
  const currentBoardState = isLive 
    ? game?.boardState || ''
    : game?.history[historyIndex].boardAfter || '';

  const isPlayer1 = humanUser && game?.player1 === humanUser.username;
  const isPlayer2 = humanUser && game?.player2 === humanUser.username;
  const isMyTurn = game && game.status === 'playing' && isLive && (
    (isPlayer1 && game.currentTurn === 'player1') ||
    (isPlayer2 && game.currentTurn === 'player2')
  );

  // Unload warning and auto-surrender / cancel room on close
  useEffect(() => {
    if (!game || !humanUser) return;
    const isPlayer = isPlayer1 || isPlayer2;

    const handleUnloadCleanup = () => {
      if (game.status === 'playing' && isPlayer) {
        // Send surrender request using keepalive to ensure it goes out during page close
        fetch(`/api/bot/games/${gameId}/surrender`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${humanUser.token}`
          },
          keepalive: true
        });
      } else if (game.status === 'waiting' && isPlayer1) {
        // Send cancel request
        fetch(`/api/bot/games/${gameId}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${humanUser.token}`
          },
          keepalive: true
        });
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (game.status === 'playing' && isPlayer) {
        e.preventDefault();
        e.returnValue = 'Trận đấu đang diễn ra. Nếu rời đi bạn sẽ bị xử thua.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleUnloadCleanup);
    window.addEventListener('unload', handleUnloadCleanup);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleUnloadCleanup);
      window.removeEventListener('unload', handleUnloadCleanup);
    };
  }, [game, isPlayer1, isPlayer2, humanUser, gameId]);

  if (loading) {
    return (
      <div className="container flex-center" style={{ height: '70vh', color: 'var(--text-muted)' }}>
        Đang tải thông tin trận đấu...
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="container flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '15px' }}>
        <p style={{ color: 'var(--accent-red)', fontSize: '1.2rem', fontWeight: 600 }}>⚠️ {error || 'Không tìm thấy trận đấu'}</p>
        <Link href="/" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const handleBackToDashboard = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = '/';
  };

  const getGameTitle = (type: string) => {
    if (type === 'chess') return 'Trận Đấu Cờ Vua (Chess)';
    if (type === 'xiangqi') return 'Trận Đấu Cờ Tướng (Xiangqi)';
    return 'Trận Đấu Cờ Caro (Gomoku)';
  };

  const submitMove = async (moveStr: string) => {
    if (!game || !humanUser || makingMove) return;
    setMakingMove(true);
    try {
      const res = await fetch(`/api/bot/games/${gameId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${humanUser.token}`
        },
        body: JSON.stringify({ move: moveStr })
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setGame(json.gameState);
        setHistoryIndex(-1); // return to live
        setSelectedSquare(null);
      } else {
        alert(json.message || 'Nước đi không hợp lệ!');
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối máy chủ để thực hiện nước đi');
    } finally {
      setMakingMove(false);
    }
  };

  const handlePlayNowClick = async () => {
    if (humanUser) {
      await executeJoin(humanUser.token);
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const executeJoin = async (userToken: string) => {
    setJoining(true);
    try {
      const res = await fetch('/api/bot/games/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success') {
          await fetchGameStatus();
        } else {
          alert(json.message || 'Không thể tham gia trận đấu');
        }
      } else {
        alert('Lỗi tham gia trận đấu');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối');
    } finally {
      setJoining(false);
    }
  };

  const handleHumanLogin = async (animalId: string) => {
    try {
      const res = await fetch('/api/public/human-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animalId }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success') {
          const user = json.user;
          setHumanUser(user);
          setIsLoginModalOpen(false);
          await executeJoin(user.token);
        }
      }
    } catch (err) {
      console.error('Error logging in human:', err);
    }
  };

  // Helper to parse Chess FEN
  const parseChessFen = (fen: string): string[][] => {
    const [boardPart] = fen.split(' ');
    const rows = boardPart.split('/');
    const grid: string[][] = Array(8).fill(null).map(() => Array(8).fill(''));
    for (let r = 0; r < 8; r++) {
      const rowStr = rows[r];
      let c = 0;
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (/[1-8]/.test(char)) {
          c += parseInt(char, 10);
        } else {
          grid[r][c] = char;
          c++;
        }
      }
    }
    return grid;
  };

  // -------------------------------------------------------------
  // RENDER CHESSBOARD (8x8)
  // -------------------------------------------------------------
  const renderChessboard = (fen: string) => {
    const grid = parseChessFen(fen);

    const isFinished = game?.status === 'finished';
    const loserRole = game?.winner === 'player1' ? 'player2' : game?.winner === 'player2' ? 'player1' : null;
    const targetKingChar = loserRole === 'player1' ? 'K' : loserRole === 'player2' ? 'k' : null;

    const activeMove = historyIndex === -1 
      ? (game?.history && game.history.length > 0 ? game.history[game.history.length - 1] : null)
      : game?.history[historyIndex];

    let lastMoveSrc: { r: number, c: number } | null = null;
    let lastMoveDst: { r: number, c: number } | null = null;

    if (activeMove && activeMove.move && activeMove.move.length >= 4 && activeMove.move !== 'surrender') {
      const srcCol = activeMove.move.charCodeAt(0) - 97;
      const srcRow = 8 - parseInt(activeMove.move[1], 10);
      const dstCol = activeMove.move.charCodeAt(2) - 97;
      const dstRow = 8 - parseInt(activeMove.move[3], 10);

      if (srcCol >= 0 && srcCol < 8 && srcRow >= 0 && srcRow < 8) {
        lastMoveSrc = { r: srcRow, c: srcCol };
      }
      if (dstCol >= 0 && dstCol < 8 && dstRow >= 0 && dstRow < 8) {
        lastMoveDst = { r: dstRow, c: dstCol };
      }
    }

    const handleChessSquareClick = async (r: number, c: number, piece: string) => {
      if (!isMyTurn || !humanUser || !game || makingMove) return;
      const squareName = String.fromCharCode(97 + c) + (8 - r); // e.g. "e2"

      if (selectedSquare === null) {
        if (!piece) return;
        const isWhitePiece = piece === piece.toUpperCase();
        const isMyPiece = (isPlayer1 && isWhitePiece) || (isPlayer2 && !isWhitePiece);
        if (isMyPiece) {
          setSelectedSquare(squareName);
        }
      } else {
        if (selectedSquare === squareName) {
          setSelectedSquare(null);
          return;
        }

        let moveStr = selectedSquare + squareName;
        // Auto-promotion White: row index 1 to 0, Black: row index 6 to 7
        const sourceRow = 8 - parseInt(selectedSquare[1], 10);
        const sourceCol = selectedSquare.charCodeAt(0) - 97;
        const sourcePiece = grid[sourceRow][sourceCol];

        if (sourcePiece && sourcePiece.toLowerCase() === 'p') {
          if ((isPlayer1 && r === 0) || (isPlayer2 && r === 7)) {
            moveStr += 'q'; // Promote to queen
          }
        }

        await submitMove(moveStr);
      }
    };

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
        width: '100%',
        maxWidth: '520px',
        aspectRatio: '1',
        border: '4px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-xl)'
      }}>
        {grid.map((row, r) => 
          row.map((piece, c) => {
            const isDark = (r + c) % 2 === 1;
            const pieceColor = piece && piece === piece.toUpperCase() ? 'white' : 'black';
            const squareName = String.fromCharCode(97 + c) + (8 - r);
            const isSelected = selectedSquare === squareName;
            
            const isWhitePiece = piece && piece === piece.toUpperCase();
            const isMyPiece = piece && ((isPlayer1 && isWhitePiece) || (isPlayer2 && !isWhitePiece));
            const clickable = isMyTurn && (isMyPiece || selectedSquare !== null);

            const isDefeatedKing = isFinished && targetKingChar && piece === targetKingChar;

            const isSrc = lastMoveSrc && lastMoveSrc.r === r && lastMoveSrc.c === c;
            const isDst = lastMoveDst && lastMoveDst.r === r && lastMoveDst.c === c;

            return (
              <div 
                key={`${r}-${c}`} 
                onClick={() => handleChessSquareClick(r, c, piece)}
                style={{
                  backgroundColor: isDefeatedKing 
                    ? 'rgba(239, 68, 68, 0.45)' 
                    : isDark ? '#263047' : '#3e4b6b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'min(7.5vw, 2.5rem)',
                  fontWeight: 'bold',
                  cursor: clickable ? 'pointer' : 'default',
                  position: 'relative',
                  boxShadow: isDefeatedKing 
                    ? 'inset 0 0 20px #ef4444, 0 0 15px #ef4444' 
                    : isSelected 
                      ? 'inset 0 0 12px var(--accent-cyan)' 
                      : isDst
                        ? 'inset 0 0 16px rgba(6, 182, 212, 0.7), 0 0 10px rgba(6, 182, 212, 0.4)'
                        : isSrc
                          ? 'inset 0 0 16px rgba(234, 179, 8, 0.4)'
                          : 'none',
                  animation: isDefeatedKing 
                    ? 'pulse 0.8s infinite alternate' 
                    : isDst 
                      ? 'pulse-glow-last 1s infinite alternate' 
                      : isSrc
                        ? 'pulse-glow-src 1.5s infinite alternate'
                        : 'none',
                  width: '100%',
                  height: '100%'
                }}
              >
                {piece && (
                  <span style={{
                    color: pieceColor === 'white' ? '#e2e8f0' : '#d8b4fe',
                    textShadow: pieceColor === 'white' 
                      ? '0 0 10px rgba(255,255,255,0.4), 1px 1px 2px #000' 
                      : '0 0 10px rgba(168,85,247,0.6), 1px 1px 2px #000',
                    userSelect: 'none'
                  }}>
                    {CHESS_PIECE_SYMBOLS[piece] || piece}
                  </span>
                )}
                {/* Board Labels */}
                {c === 0 && (
                  <span style={{ position: 'absolute', top: 2, left: 4, fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
                    {8 - r}
                  </span>
                )}
                {r === 7 && (
                  <span style={{ position: 'absolute', bottom: 2, right: 4, fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
                    {String.fromCharCode(97 + c)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  // -------------------------------------------------------------
  // RENDER XIANGQI BOARD (9x10)
  // -------------------------------------------------------------
  const renderXiangqiBoard = (fen: string) => {
    const [boardPart] = fen.split(' ');
    const rows = boardPart.split('/');
    const grid: string[][] = Array(10).fill(null).map(() => Array(9).fill(''));

    const isFinished = game?.status === 'finished';
    const loserRole = game?.winner === 'player1' ? 'player2' : game?.winner === 'player2' ? 'player1' : null;
    const targetKingChar = loserRole === 'player1' ? 'K' : loserRole === 'player2' ? 'k' : null;

    const activeMove = historyIndex === -1 
      ? (game?.history && game.history.length > 0 ? game.history[game.history.length - 1] : null)
      : game?.history[historyIndex];

    let lastMoveSrc: { r: number, c: number } | null = null;
    let lastMoveDst: { r: number, c: number } | null = null;

    if (activeMove && activeMove.move && activeMove.move.length >= 4 && activeMove.move !== 'surrender') {
      const srcCol = activeMove.move.charCodeAt(0) - 97;
      const srcRow = parseInt(activeMove.move[1], 10);
      const dstCol = activeMove.move.charCodeAt(2) - 97;
      const dstRow = parseInt(activeMove.move[3], 10);

      if (srcCol >= 0 && srcCol < 9 && srcRow >= 0 && srcRow < 10) {
        lastMoveSrc = { r: srcRow, c: srcCol };
      }
      if (dstCol >= 0 && dstCol < 9 && dstRow >= 0 && dstRow < 10) {
        lastMoveDst = { r: dstRow, c: dstCol };
      }
    }

    for (let r = 0; r < 10; r++) {
      const rowStr = rows[r];
      let c = 0;
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (/[0-9]/.test(char)) {
          c += parseInt(char, 10);
        } else {
          grid[r][c] = char;
          c++;
        }
      }
    }

    const handleXiangqiSquareClick = async (r: number, c: number, piece: string) => {
      if (!isMyTurn || !humanUser || !game || makingMove) return;
      const squareName = String.fromCharCode(97 + c) + r; // e.g. "h7"

      if (selectedSquare === null) {
        if (!piece) return;
        const isRedPiece = piece === piece.toUpperCase();
        const isMyPiece = (isPlayer1 && isRedPiece) || (isPlayer2 && !isRedPiece);
        if (isMyPiece) {
          setSelectedSquare(squareName);
        }
      } else {
        if (selectedSquare === squareName) {
          setSelectedSquare(null);
          return;
        }
        await submitMove(selectedSquare + squareName);
      }
    };

    return (
      <div style={{
        position: 'relative',
        display: 'grid',
        gridTemplateRows: 'repeat(10, minmax(0, 1fr))',
        width: '100%',
        maxWidth: '520px',
        aspectRatio: '9 / 10',
        backgroundColor: '#1b2234',
        border: '8px solid #0f131f',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-xl)',
        padding: '6px'
      }}>
        {/* Render grid lines and rivers using CSS absolute overlays */}
        <div style={{
          position: 'absolute',
          top: '5%',
          bottom: '5%',
          left: '5.5%',
          right: '5.5%',
          pointerEvents: 'none',
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(9, minmax(0, 1fr))',
        }}>
          {/* Grid Cells (Vertical Lines) */}
          {Array(9).fill(null).map((_, r) => 
            Array(8).fill(null).map((_, c) => {
              const isRiver = r === 4;
              const isEdge = c === 0 || c === 7;
              return (
                <div key={`line-${r}-${c}`} style={{
                  borderLeft: isRiver && !isEdge ? 'none' : '1px dashed rgba(255,255,255,0.1)',
                  borderBottom: r < 8 ? '1px dashed rgba(255,255,255,0.1)' : 'none',
                }} />
              );
            })
          )}
        </div>

        {/* Palace Diagonals */}
        <div style={{
          position: 'absolute',
          top: '5%',
          left: '38.8%',
          width: '22.4%',
          height: '20%',
          pointerEvents: 'none',
          background: 'linear-gradient(45deg, transparent 49%, rgba(255,255,255,0.15) 50%, transparent 51%), linear-gradient(-45deg, transparent 49%, rgba(255,255,255,0.15) 50%, transparent 51%)'
        }} />

        <div style={{
          position: 'absolute',
          bottom: '5%',
          left: '38.8%',
          width: '22.4%',
          height: '20%',
          pointerEvents: 'none',
          background: 'linear-gradient(45deg, transparent 49%, rgba(255,255,255,0.15) 50%, transparent 51%), linear-gradient(-45deg, transparent 49%, rgba(255,255,255,0.15) 50%, transparent 51%)'
        }} />

        {/* River Label */}
        <div style={{
          position: 'absolute',
          top: '46%',
          left: '5.5%',
          right: '5.5%',
          height: '8%',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          color: 'rgba(255,255,255,0.25)',
          fontSize: '0.8rem',
          fontWeight: 700,
          pointerEvents: 'none',
          textTransform: 'uppercase',
          letterSpacing: '2px'
        }}>
          <span>Sông Sở Hà</span>
          <span>Hán Giới</span>
        </div>

        {/* Render Pieces */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0, left: 0, right: 0,
          display: 'grid',
          gridTemplateRows: 'repeat(10, minmax(0, 1fr))',
          gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
          zIndex: 10
        }}>
          {grid.map((row, r) => 
            row.map((piece, c) => {
              const isSelected = selectedSquare === String.fromCharCode(97 + c) + r;
              
              const isRedPiece = piece && piece === piece.toUpperCase();
              const isMyPiece = piece && ((isPlayer1 && isRedPiece) || (isPlayer2 && !isRedPiece));
              const clickable = isMyTurn && (isMyPiece || selectedSquare !== null);
              const isDefeatedKing = isFinished && targetKingChar && piece === targetKingChar;

              const isSrc = lastMoveSrc && lastMoveSrc.r === r && lastMoveSrc.c === c;
              const isDst = lastMoveDst && lastMoveDst.r === r && lastMoveDst.c === c;

              return (
                <div 
                  key={`cell-${r}-${c}`} 
                  onClick={() => handleXiangqiSquareClick(r, c, piece)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: clickable ? 'pointer' : 'default',
                    boxShadow: isSelected
                      ? 'inset 0 0 10px var(--accent-cyan)'
                      : isDst
                        ? 'inset 0 0 12px rgba(6, 182, 212, 0.7)'
                        : isSrc
                          ? 'inset 0 0 12px rgba(234, 179, 8, 0.45)'
                          : 'none',
                    animation: isDst ? 'pulse-glow-last 1s infinite alternate' : isSrc ? 'pulse-glow-src 1s infinite alternate' : 'none',
                    borderRadius: '4px'
                  }}
                >
                  {piece && (
                    <div style={{
                      width: '80%',
                      height: '80%',
                      borderRadius: '50%',
                      backgroundColor: isDefeatedKing ? '#7f1d1d' : '#1b2234',
                      border: isDefeatedKing 
                        ? '3px solid #ef4444' 
                        : isRedPiece ? '2px solid #ef4444' : '2px solid #38bdf8',
                      boxShadow: isDefeatedKing
                        ? '0 0 20px #ef4444, inset 0 0 10px #ef4444'
                        : isSelected
                          ? '0 0 15px #ffffff, inset 0 0 8px rgba(255,255,255,0.4)'
                          : isRedPiece
                            ? '0 0 8px rgba(239, 68, 68, 0.4), inset 0 0 6px rgba(239, 68, 68, 0.2)' 
                            : '0 0 8px rgba(56, 189, 248, 0.4), inset 0 0 6px rgba(56, 189, 248, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isDefeatedKing ? '#f87171' : (isRedPiece ? '#f87171' : '#7dd3fc'),
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      userSelect: 'none',
                      animation: isDefeatedKing ? 'pulse-last 0.8s infinite alternate' : 'none',
                      transform: isDefeatedKing ? 'scale(1.1)' : 'none',
                      transition: 'all 0.5s ease'
                    }}>
                      {XIANGQI_PIECE_LABELS[piece] || piece}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderGomokuBoard = (stateJson: string) => {
    let board: string[][] = Array(15).fill(null).map(() => Array(15).fill(''));
    let lastMove: any = null;

    try {
      if (stateJson) {
        const parsed = JSON.parse(stateJson);
        board = parsed.board;
        lastMove = parsed.lastMove;
      }
    } catch (e) {
      console.error('Lỗi parse Gomoku state:', e);
    }

    // Quét tìm 5 quân thắng cuộc nếu game đã kết thúc
    const isFinished = game?.status === 'finished';
    const hasWinner = game?.winner && game?.winner !== 'draw';
    const winningLine = (isFinished && hasWinner) ? findGomokuWinningLine(board) : [];

    const handleGomokuCellClick = async (r: number, c: number, symbol: string) => {
      if (!isMyTurn || !humanUser || !game || makingMove) return;
      if (symbol !== '') return;

      const colChar = String.fromCharCode(97 + c); // a-o
      const rowStr = (r + 1).toString(); // 1-15
      await submitMove(`${colChar}${rowStr}`);
    };

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
        width: '100%',
        maxWidth: '520px',
        aspectRatio: '1',
        backgroundColor: '#1e2433',
        border: '6px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-xl)',
        position: 'relative'
      }}>
        {board.map((row, r) => 
          row.map((symbol, c) => {
            const isLast = lastMove && lastMove.x === c && lastMove.y === r;
            const clickable = isMyTurn && symbol === '';
            const isWinningCell = winningLine.some(cell => cell.r === r && cell.c === c);
            const shouldFade = winningLine.length > 0 && !isWinningCell;

            return (
              <div 
                key={`${r}-${c}`} 
                onClick={() => handleGomokuCellClick(r, c, symbol)}
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: clickable ? 'pointer' : 'default',
                  opacity: shouldFade ? 0.25 : 1, // Làm mờ các ô khác
                  transition: 'opacity 0.5s ease'
                }}
              >
                {/* Intersection Dot */}
                {symbol === '' && (
                  <span style={{
                    width: '3px',
                    height: '3px',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '50%'
                  }}></span>
                )}
                
                {/* Stones */}
                {symbol !== '' && (
                  <div 
                    style={{
                      width: '75%',
                      height: '75%',
                      borderRadius: '50%',
                      background: symbol === 'X' 
                        ? 'radial-gradient(circle at 30% 30%, #22d3ee, #0891b2)' 
                        : 'radial-gradient(circle at 30% 30%, #e879f9, #a21caf)',
                      boxShadow: isWinningCell
                        ? '0 0 20px #ffffff, 0 0 35px var(--accent-green)' // Phát sáng cực mạnh cho quân cờ chiến thắng
                        : symbol === 'X' 
                          ? '0 0 10px rgba(34, 211, 238, 0.6)' 
                          : '0 0 10px rgba(232, 121, 249, 0.6)',
                      border: isWinningCell 
                        ? '3px solid #ffffff' 
                        : isLast 
                          ? '2px solid #ffffff' 
                          : 'none',
                      transform: isWinningCell ? 'scale(1.15)' : 'none', // Phóng to quân cờ thắng cuộc
                      animation: isWinningCell 
                        ? 'pulse-last 0.8s infinite alternate' 
                        : isLast 
                          ? 'pulse-last 1s infinite alternate' 
                          : 'none',
                      transition: 'all 0.5s ease',
                      zIndex: isWinningCell ? 10 : 2
                    }}
                    className={isWinningCell || isLast ? 'pulse-last' : ''}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderPlayerBar = (playerRole: 'player1' | 'player2') => {
    const isP1 = playerRole === 'player1';
    const username = isP1 ? game.player1 : game.player2;
    const isMyPiece = (isP1 && isPlayer1) || (!isP1 && isPlayer2);

    // If waiting and player2 is not joined yet
    if (game.status === 'waiting' && !isP1 && !username) {
      return (
        <div style={{
          width: '100%',
          maxWidth: '520px',
          padding: '10px 15px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontStyle: 'italic',
          marginBottom: '10px'
        }}>
          <span>PLAYER 2 (Quân Đen / Đi Sau)</span>
          <span>⏳ Đang chờ đối thủ tham gia...</span>
        </div>
      );
    }

    // Determine piece label / color
    let sideLabel = '';
    let sideColor = '';
    let badgeColor = '';
    if (game.type === 'chess') {
      sideLabel = isP1 ? '⚪ Trắng' : '⚫ Đen';
      sideColor = isP1 ? '#ffffff' : '#c084fc'; // Purple for Black pieces
      badgeColor = isP1 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(168, 85, 247, 0.15)';
    } else if (game.type === 'xiangqi') {
      sideLabel = isP1 ? '🔴 Đỏ' : '🔵 Đen';
      sideColor = isP1 ? '#f87171' : '#38bdf8'; // Blue/Cyan for Black pieces
      badgeColor = isP1 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)';
    }

    // Turn status
    const isTurn = game.status === 'playing' && game.currentTurn === playerRole;
    
    // Winner/Loser status
    const isFinished = game.status === 'finished';
    const isWinner = isFinished && game.winner === playerRole;
    const isLoser = isFinished && game.winner !== null && game.winner !== 'draw' && game.winner !== playerRole;
    const isDraw = isFinished && game.winner === 'draw';

    return (
      <div className="glass" style={{
        width: '100%',
        maxWidth: '520px',
        padding: '12px 16px',
        borderRadius: '8px',
        borderLeft: isTurn ? `4px solid ${sideColor}` : '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: isP1 ? '10px 0 0 0' : '0 0 10px 0',
        boxShadow: isTurn ? `0 0 15px rgba(255, 255, 255, 0.05), inset 0 0 8px ${badgeColor}` : 'none',
        transition: 'all 0.3s ease'
      }}>
        {/* Left side: Username & Side Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '1.25rem',
            filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.15))'
          }}>
            {isP1 ? '🤖' : '👾'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ 
              fontWeight: 800, 
              color: sideColor, 
              fontSize: '1.05rem',
              letterSpacing: '0.02em',
              textShadow: `0 0 8px ${sideColor}33`
            }}>
              {formatPlayerName(username)} {isMyPiece && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Bạn)</span>}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {isP1 ? 'PLAYER 1' : 'PLAYER 2'} • {sideLabel}
            </span>
          </div>
        </div>

        {/* Right side: Status Badge */}
        <div>
          {isTurn && (
            <span className="pulse-opacity" style={{
              backgroundColor: badgeColor,
              border: `1px solid ${sideColor}50`,
              color: sideColor,
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              animation: 'pulse-opacity 1.5s infinite alternate'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                backgroundColor: sideColor,
                borderRadius: '50%',
                display: 'inline-block'
              }} />
              LƯỢT ĐI
            </span>
          )}
          {isWinner && (
            <span style={{
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              color: 'var(--accent-yellow)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em'
            }}>
              🏆 CHIẾN THẮNG
            </span>
          )}
          {isLoser && (
            <span style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em'
            }}>
              💀 THẤT BẠI
            </span>
          )}
          {isDraw && (
            <span style={{
              backgroundColor: 'rgba(156, 163, 175, 0.15)',
              border: '1px solid rgba(156, 163, 175, 0.4)',
              color: '#9ca3af',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em'
            }}>
              🤝 HÒA CỜ
          </span>
          )}
          {game.status === 'waiting' && isP1 && (
            <span style={{
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              color: 'var(--accent-yellow)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>
              ⏳ ĐANG CHỜ...
            </span>
          )}
          {game.status === 'playing' && !isTurn && (
            <span style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              Vừa đi xong
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderBoard = () => {
    if (game.type === 'chess') {
      return renderChessboard(currentBoardState);
    }
    if (game.type === 'xiangqi') {
      return renderXiangqiBoard(currentBoardState);
    }
    if (game.type === 'gomoku') {
      return renderGomokuBoard(currentBoardState);
    }
    return null;
  };

  const getWinnerName = () => {
    if (game.winner === 'player1') return formatPlayerName(game.player1);
    if (game.winner === 'player2') return formatPlayerName(game.player2);
    return 'Hòa';
  };

  const getStatusText = () => {
    if (game.status === 'waiting') return 'Đang Chờ Người Chơi';
    if (game.status === 'playing') {
      const activePlayer = game.currentTurn === 'player1' ? game.player1 : game.player2;
      return `Lượt của: ${formatPlayerName(activePlayer)}`;
    }
    if (game.status === 'finished') {
      if (game.winner === 'draw') return 'Trận đấu kết thúc với kết quả Hòa';
      if (!game.winner) return 'Ván đấu bị hủy bỏ';
      return `Trận Đấu Kết Thúc - Người Thắng: ${getWinnerName()}`;
    }
    return '';
  };

  return (
    <div className="container" style={{ padding: '30px 1.5rem' }}>
      
      {/* Header Breadcrumbs */}
      <div style={{ marginBottom: '20px' }}>
        <a 
          href="/" 
          onClick={handleBackToDashboard}
          style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
        >
          ← Quay về Dashboard
        </a>
      </div>

      <div className="flex-between" style={{ marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '10px',
            backgroundColor: game.type === 'chess' ? 'rgba(168, 85, 247, 0.12)' : game.type === 'xiangqi' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(6, 182, 212, 0.12)',
            border: game.type === 'chess' ? '1px solid rgba(168, 85, 247, 0.3)' : game.type === 'xiangqi' ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            boxShadow: game.type === 'chess' ? '0 0 10px rgba(168, 85, 247, 0.15)' : game.type === 'xiangqi' ? '0 0 10px rgba(234, 179, 8, 0.15)' : '0 0 10px rgba(6, 182, 212, 0.15)'
          }}>
            {game.type === 'chess' ? '👑' : game.type === 'xiangqi' ? '🐉' : '🎯'}
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.2 }}>{getGameTitle(game.type)}</h1>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {game.id}</span>
          </div>
        </div>

        {/* State Banner */}
        {game.type !== 'chess' && game.type !== 'xiangqi' && (
          <div className="glass" style={{
            padding: '8px 20px',
            borderRadius: '10px',
            borderLeft: game.status === 'playing' ? '4px solid var(--accent-cyan)' : game.status === 'finished' ? '4px solid var(--accent-green)' : '4px solid var(--accent-yellow)',
            fontWeight: 700,
            fontSize: '0.9rem'
          }}>
            {getStatusText()}
          </div>
        )}
      </div>

      <div style={{ gap: '30px' }} className="game-grid">
        
        {/* Left Side: Game Board */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', minWidth: 0 }}>
          
          {/* Replay Notice banner */}
          {!isLive && (
            <div style={{
              width: '100%',
              maxWidth: '520px',
              padding: '10px 15px',
              borderRadius: '8px',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              color: 'var(--accent-yellow)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem',
              fontWeight: 600
            }}>
              <span>Đang xem nước thứ {historyIndex + 1} (Xem lại lịch sử)</span>
              <button 
                onClick={() => setHistoryIndex(-1)}
                style={{
                  background: 'var(--accent-yellow)',
                  color: '#000000',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
              >
                Xem Trực Tiếp Live →
              </button>
            </div>
          )}

          {(game.type === 'chess' || game.type === 'xiangqi') && renderPlayerBar('player2')}
          {renderBoard()}
          {(game.type === 'chess' || game.type === 'xiangqi') && renderPlayerBar('player1')}
          
          {/* Match Info Box */}
          {(game.type !== 'chess' && game.type !== 'xiangqi') && (() => {
            const lastMoveEntry = game.history.length > 0 ? game.history[game.history.length - 1] : null;

            const isP1Turn = game.status === 'playing' && game.currentTurn === 'player1';
            const isP1LastMove = game.status === 'playing' && lastMoveEntry && lastMoveEntry.player === 'player1';

            const isP2Turn = game.status === 'playing' && game.currentTurn === 'player2';
            const isP2LastMove = game.status === 'playing' && lastMoveEntry && lastMoveEntry.player === 'player2';

            const isFinished = game.status === 'finished';
            const winner = game.winner;
            const isP1Winner = isFinished && winner === 'player1';
            const isP2Winner = isFinished && winner === 'player2';
            const isDraw = isFinished && winner === 'draw';
            const isP1Loser = isFinished && winner === 'player2';
            const isP2Loser = isFinished && winner === 'player1';

            return (
              <div className="glass" style={{
                width: '100%',
                maxWidth: '520px',
                padding: '15px',
                transition: 'all 0.3s ease',
                ...(isFinished ? {
                  borderColor: isDraw ? 'rgba(255, 255, 255, 0.2)' : 'rgba(234, 179, 8, 0.4)',
                  boxShadow: isDraw ? '0 0 15px rgba(255, 255, 255, 0.05)' : '0 0 25px rgba(234, 179, 8, 0.15)',
                } : {})
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    textAlign: 'center',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: isFinished ? '12px 8px' : '8px 5px',
                    borderRadius: '12px',
                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    ...(isP1Winner ? {
                      border: '2px solid rgba(234, 179, 8, 0.8)',
                      boxShadow: '0 0 20px rgba(234, 179, 8, 0.35)',
                      background: 'rgba(234, 179, 8, 0.08)',
                      transform: 'scale(1.06)',
                    } : {}),
                    ...(isP1Loser ? {
                      opacity: 0.45,
                      border: '1px dashed rgba(255, 255, 255, 0.08)',
                      background: 'rgba(0, 0, 0, 0.25)',
                    } : {}),
                    ...(isDraw ? {
                      opacity: 0.75,
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(255, 255, 255, 0.02)',
                    } : {}),
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PLAYER 1 (Đi Trước)</div>
                    <div style={{
                      fontWeight: 700,
                      color: isP1Winner ? '#fbbf24' : 'var(--accent-cyan)',
                      fontSize: isP1Winner ? '1.25rem' : '1.1rem',
                      marginTop: '2px',
                      textDecoration: isP1Loser ? 'line-through' : 'none',
                      transition: 'all 0.3s ease',
                      textShadow: isP1Winner ? '0 0 10px rgba(251, 191, 36, 0.4)' : 'none',
                    }}>
                      {formatPlayerName(game.player1)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {(game.type as string) === 'chess' ? 'Trắng' : (game.type as string) === 'xiangqi' ? 'Đỏ' : 'X (Caro)'}
                    </div>
                    {isP1Turn && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(6, 182, 212, 0.15)',
                        border: '1px solid var(--accent-cyan)',
                        color: 'var(--accent-cyan)',
                        animation: 'pulse 1.5s infinite alternate'
                      }}>
                        👉 Đến lượt
                      </div>
                    )}
                    {isP1LastMove && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-muted)'
                      }}>
                        ✓ Vừa đi xong
                      </div>
                    )}
                    {isP1Winner && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(234, 179, 8, 0.25)',
                        border: '1px solid rgba(234, 179, 8, 0.9)',
                        color: '#fbbf24',
                        textShadow: '0 0 8px rgba(251, 191, 36, 0.6)',
                        animation: 'pulse 1.5s infinite alternate'
                      }}>
                        🏆 CHIẾN THẮNG 👑
                      </div>
                    )}
                    {isP1Loser && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        color: '#ef4444'
                      }}>
                        💀 THẤT BẠI 💀
                      </div>
                    )}
                    {isDraw && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: 'var(--text-secondary)'
                      }}>
                        🤝 HÒA CUỘC
                      </div>
                    )}
                  </div>
                  
                  <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-muted)', padding: '0 10px' }}>VS</div>
                  
                  <div style={{
                    textAlign: 'center',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: isFinished ? '12px 8px' : '8px 5px',
                    borderRadius: '12px',
                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    ...(isP2Winner ? {
                      border: '2px solid rgba(234, 179, 8, 0.8)',
                      boxShadow: '0 0 20px rgba(234, 179, 8, 0.35)',
                      background: 'rgba(234, 179, 8, 0.08)',
                      transform: 'scale(1.06)',
                    } : {}),
                    ...(isP2Loser ? {
                      opacity: 0.45,
                      border: '1px dashed rgba(255, 255, 255, 0.08)',
                      background: 'rgba(0, 0, 0, 0.25)',
                    } : {}),
                    ...(isDraw ? {
                      opacity: 0.75,
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(255, 255, 255, 0.02)',
                    } : {}),
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PLAYER 2 (Đi Sau)</div>
                    <div style={{
                      fontWeight: 700,
                      color: isP2Winner ? '#fbbf24' : 'var(--accent-purple)',
                      fontSize: isP2Winner ? '1.25rem' : '1.1rem',
                      marginTop: '5px',
                      textDecoration: isP2Loser ? 'line-through' : 'none',
                      transition: 'all 0.3s ease',
                      textShadow: isP2Winner ? '0 0 10px rgba(251, 191, 36, 0.4)' : 'none',
                    }}>
                      {game.player2 ? (
                        formatPlayerName(game.player2)
                      ) : (
                        game.status === 'waiting' ? (
                          isPlayer1 ? (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Đang chờ đối thủ...</span>
                          ) : (
                            <button
                              onClick={handlePlayNowClick}
                              disabled={joining}
                              className="hover-btn"
                              style={{
                                backgroundColor: 'var(--accent-green)',
                                border: 'none',
                                color: '#000000',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)',
                                transition: 'all 0.2s'
                              }}
                            >
                              {joining ? 'Đang vào...' : '⚡ Chơi ngay'}
                            </button>
                          )
                        ) : (
                          'Trống'
                        )
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {(game.type as string) === 'chess' ? 'Đen' : (game.type as string) === 'xiangqi' ? 'Đen' : 'O (Caro)'}
                    </div>
                    {isP2Turn && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(168, 85, 247, 0.15)',
                        border: '1px solid var(--accent-purple)',
                        color: '#d8b4fe',
                        animation: 'pulse 1.5s infinite alternate'
                      }}>
                        👉 Đến lượt
                      </div>
                    )}
                    {isP2LastMove && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-muted)'
                      }}>
                        ✓ Vừa đi xong
                      </div>
                    )}
                    {isP2Winner && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(234, 179, 8, 0.25)',
                        border: '1px solid rgba(234, 179, 8, 0.9)',
                        color: '#fbbf24',
                        textShadow: '0 0 8px rgba(251, 191, 36, 0.6)',
                        animation: 'pulse 1.5s infinite alternate'
                      }}>
                        🏆 CHIẾN THẮNG 👑
                      </div>
                    )}
                    {isP2Loser && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        color: '#ef4444'
                      }}>
                        💀 THẤT BẠI 💀
                      </div>
                    )}
                    {isDraw && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: 'var(--text-secondary)'
                      }}>
                        🤝 HÒA CUỘC
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right Side: Sidebar - Rules & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%', minWidth: 0 }}>
          
          {/* Rules Details */}
          <div className="glass" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>Luật Chơi</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              {game.rules}
            </p>
          </div>

          {/* Move History log */}
          <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '350px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '15px' }}>Nhật Ký Nước Đi ({game.history.length})</h3>
            
            {game.history.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Chưa có nước đi nào được thực hiện.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 1fr',
                  gap: '8px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid var(--border-color)',
                  marginBottom: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textAlign: 'center'
                }}>
                  <div style={{ textAlign: 'left' }}>Lượt</div>
                  <div style={{ color: 'var(--accent-cyan)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatPlayerName(game.player1)}
                  </div>
                  <div style={{ color: 'var(--accent-purple)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatPlayerName(game.player2)}
                  </div>
                </div>

                {/* Table Body */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  maxHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  paddingRight: '5px'
                }}>
                  {getHistoryTurns(game.history, game.createdAt).reverse().map((turn) => (
                    <div 
                      key={turn.turnNumber}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '50px 1fr 1fr',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.03)'
                      }}
                    >
                      {/* Turn Number */}
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        #{turn.turnNumber}
                      </div>

                      {/* Player 1 Move */}
                      {turn.move1 ? (
                        <div 
                          onClick={() => setHistoryIndex(turn.move1!.originalIndex)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: historyIndex === turn.move1.originalIndex ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.02)',
                            border: historyIndex === turn.move1.originalIndex ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            transition: 'all 0.2s ease',
                          }}
                          className="history-item"
                        >
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                            {turn.move1.san || turn.move1.move}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            +{formatTime(turn.move1.thinkingTimeMs)} ({formatTime(turn.move1.cumulativeTimeMs)})
                          </span>
                        </div>
                      ) : (
                        <div style={{ visibility: 'hidden' }} />
                      )}

                      {/* Player 2 Move */}
                      {turn.move2 ? (
                        <div 
                          onClick={() => setHistoryIndex(turn.move2!.originalIndex)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: historyIndex === turn.move2.originalIndex ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.02)',
                            border: historyIndex === turn.move2.originalIndex ? '1px solid var(--accent-purple)' : '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            transition: 'all 0.2s ease',
                          }}
                          className="history-item"
                        >
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-purple)' }}>
                            {turn.move2.san || turn.move2.move}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            +{formatTime(turn.move2.thinkingTimeMs)} ({formatTime(turn.move2.cumulativeTimeMs)})
                          </span>
                        </div>
                      ) : (
                        game.status === 'playing' && isLive && game.currentTurn === 'player2' && turn.turnNumber === Math.ceil(game.history.length / 2) ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '34px' }}>
                            <span className="pulse-dot" style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--accent-purple)',
                              animation: 'pulse 1.5s infinite'
                            }} />
                          </div>
                        ) : (
                          <div style={{ visibility: 'hidden' }} />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Live stats footer */}
            {game.status === 'playing' && isLive && (
              <div style={{
                marginTop: '15px',
                paddingTop: '15px',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textAlign: 'center'
              }}>
                🔄 Đang cập nhật trực tiếp sau mỗi 1.5 giây
              </div>
            )}
          </div>
        </div>
      {isLoginModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass" style={{
            width: '100%',
            maxWidth: '520px',
            padding: '30px',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
            color: 'var(--text-primary)'
          }}>
            <button 
              onClick={() => setIsLoginModalOpen(false)}
              style={{
                position: 'absolute',
                top: '15px', right: '15px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.25rem',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, textAlign: 'center', marginBottom: '10px', color: '#fff' }}>
              🎮 Chọn Linh Vật Đại Diện
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '25px' }}>
              Để tham gia chơi cờ ngay lập tức, vui lòng chọn một linh vật đại diện.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {ANIMALS.map((animal) => (
                <button
                  key={animal.id}
                  onClick={() => handleHumanLogin(animal.id)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    padding: '15px 10px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    '--hover-color': animal.color,
                    '--hover-glow': `${animal.color}30`
                  } as React.CSSProperties}
                  className="animal-btn"
                >
                  <span style={{ fontSize: '2rem' }}>{animal.icon}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {animal.name}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Đại diện của bạn sẽ có hiệu lực trong 10 năm hoặc đến khi bạn xóa cookie trình duyệt.
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

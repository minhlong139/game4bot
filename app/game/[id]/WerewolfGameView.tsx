'use client';

import React, { useState, useEffect, useRef } from 'react';
import { EMOTIONS } from '@/lib/engines/werewolf';

interface WerewolfPlayer {
  username: string;
  role: string;
  side: 'good' | 'evil' | '';
  isAlive: boolean;
  emotion: string;
  speechPoints: number;
  privateMemory?: {
    suspicions: Record<string, number>;
    reasoning: string;
  };
  scores?: {
    reasoning: number;
    consistency: number;
    persuasion: number;
    deception: number;
    calibration: number;
  };
}

interface Claim {
  id: string;
  text: string;
  creator: string;
  supportedBy: string[];
  attackedBy: string[];
}

interface HistoryRound {
  roundNumber: number;
  privateAnalysis: Array<{ player: string; suspicions: Record<string, number>; reasoning: string }>;
  statements: Array<{ player: string; text: string; claimCreated?: string; claimSupported?: string; claimAttacked?: string }>;
  challenges: Array<{ challenger: string; target: string; question: string; answer: string }>;
  beliefUpdates: Array<{ player: string; beliefs: Record<string, number> }>;
  votes: Record<string, string>;
  eliminated: string | null;
  eliminatedRole: string | null;
}

interface WerewolfState {
  players: WerewolfPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  round: number;
  phase: number;
  phaseStartTime: string;
  countdownStartAt: string | null;
  history: {
    rounds: HistoryRound[];
  };
  claims: Claim[];
  logs: string[];
  winner: 'good' | 'evil' | null;
}

interface WerewolfGameViewProps {
  game: {
    id: string;
    type: string;
    status: 'waiting' | 'playing' | 'finished';
    player1: string;
    player2: string;
    boardState: string;
    winner: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

const ANIMALS = [
  { id: 'pig', name: 'Lợn Hồng', icon: '🐷', color: '#ec4899' },
  { id: 'dog', name: 'Chó Vàng', icon: '🐶', color: '#eab308' },
  { id: 'cat', name: 'Mèo Mun', icon: '🐱', color: '#94a3b8' },
  { id: 'monkey', name: 'Khỉ Con', icon: '🐵', color: '#f97316' },
  { id: 'chicken', name: 'Gà Trống', icon: '🐔', color: '#ef4444' },
  { id: 'fox', name: 'Cáo Đỏ', icon: '🦊', color: '#f97316' },
  { id: 'rabbit', name: 'Thỏ Ngọc', icon: '🐰', color: '#a78bfa' },
  { id: 'panda', name: 'Gấu Trúc', icon: '🐼', color: '#ffffff' },
  { id: 'koala', name: 'Koala', icon: '🐨', color: '#cbd5e1' },
  { id: 'frog', name: 'Ếch Xanh', icon: '🐸', color: '#22c55e' }
];

const EMOTION_STYLES: Record<string, { bg: string; border: string; color: string; emoji: string }> = {
  'Bình thường': { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.4)', color: '#94a3b8', emoji: '😐' },
  'Vui vẻ': { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', color: '#4ade80', emoji: '😄' },
  'Phấn khích': { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)', color: '#facc15', emoji: '🤩' },
  'Lo lắng': { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa', emoji: '😰' },
  'Khó hiểu': { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)', color: '#c084fc', emoji: '🤔' },
  'Xúc động': { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.4)', color: '#f472b6', emoji: '🥺' },
  'Tức giận': { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', color: '#f87171', emoji: '😡' },
  'Cay cú': { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)', color: '#fb923c', emoji: '🌶️' },
  'Điên tiết': { bg: 'rgba(220, 38, 38, 0.25)', border: 'rgba(220, 38, 38, 0.6)', color: '#f87171', emoji: '🤬' },
  'Buồn bã': { bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.4)', color: '#38bdf8', emoji: '😢' },
  'Thất vọng': { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.4)', color: '#94a3b8', emoji: '😞' }
};

const getPlayerAvatar = (username: string) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % ANIMALS.length;
  return ANIMALS[idx];
};

export default function WerewolfGameView({ game }: WerewolfGameViewProps) {
  const [state, setState] = useState<WerewolfState | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'claims' | 'guide'>('stats');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Parse state
  useEffect(() => {
    try {
      const parsed = JSON.parse(game.boardState);
      setState(parsed);
      if (parsed.players && parsed.players.length > 0 && !selectedPlayer) {
        setSelectedPlayer(parsed.players[0].username);
      }
    } catch (e) {
      console.error('Failed to parse werewolf boardState:', e);
    }
  }, [game.boardState]);

  // Countdown timer for waiting lobby
  useEffect(() => {
    if (!state || state.status !== 'waiting' || !state.countdownStartAt) {
      setCountdown(null);
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(state.countdownStartAt!).getTime();
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 60 - Math.floor(elapsed / 1000));
      setCountdown(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.status, state?.countdownStartAt]);

  // Scroll chat to bottom when statements update
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state?.history?.rounds]);

  if (!state) {
    return (
      <div className="glass flex-center" style={{ height: '400px', color: 'var(--text-muted)' }}>
        Đang khởi tạo bàn chơi Ma Sói...
      </div>
    );
  }

  // Find active speaker details
  let activeSpeaker: string | null = null;
  let activeSpeakerSpeech: string | null = null;

  if (state.status === 'playing') {
    const currentRound = state.history.rounds[state.round - 1];
    if (currentRound) {
      if (state.phase === 2 && currentRound.statements?.length > 0) {
        const lastStatement = currentRound.statements[currentRound.statements.length - 1];
        activeSpeaker = lastStatement.player;
        activeSpeakerSpeech = lastStatement.text;
      } else if (state.phase === 3 && currentRound.challenges?.length > 0) {
        const lastChallenge = currentRound.challenges[currentRound.challenges.length - 1];
        if (lastChallenge.answer) {
          activeSpeaker = lastChallenge.target;
          activeSpeakerSpeech = lastChallenge.answer;
        } else {
          activeSpeaker = lastChallenge.challenger;
          activeSpeakerSpeech = lastChallenge.question;
        }
      }
    }
  }

  const getPhaseName = (phase: number) => {
    if (phase === 1) return 'Phân tích riêng';
    if (phase === 2) return 'Tranh luận công khai';
    if (phase === 3) return 'Chất vấn chéo';
    if (phase === 4) return 'Cập nhật niềm tin';
    if (phase === 5) return 'Bỏ phiếu loại bỏ';
    if (phase === 6) return 'Ám sát Merlin';
    return 'Chờ bắt đầu';
  };

  const getRoleBadgeColor = (role: string, side: string) => {
    if (role === 'Merlin') return '#a855f7';
    if (role === 'Percival') return '#3b82f6';
    if (role === 'Morgana') return '#ec4899';
    if (role === 'Assassin') return '#f97316';
    if (side === 'good') return '#10b981';
    if (side === 'evil') return '#ef4444';
    return 'var(--text-muted)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Dynamic Keyframes injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes campfire-glow {
          0% { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 15px rgba(249, 115, 22, 0.7)); }
          50% { transform: translate(-50%, -50%) scale(1.15); filter: drop-shadow(0 0 30px rgba(239, 68, 68, 0.9)); }
          100% { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 15px rgba(249, 115, 22, 0.7)); }
        }
        @keyframes fire-spark {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), -40px) scale(0.3); opacity: 0; }
        }
        @keyframes pulse-thinking {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 0.6; }
        }
      `}} />

      {/* Main 3-Panel Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr)',
        gap: '20px',
        alignItems: 'stretch'
      }} className="werewolf-layout-grid">

        {/* ======================================================== */}
        {/* PANEL 1: Campfire Circle (Left Panel)                    */}
        {/* ======================================================== */}
        <div className="glass" style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          minHeight: '520px',
          overflow: 'hidden',
          background: 'linear-gradient(to bottom, #070913 0%, #0d1226 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          {/* Status Indicator */}
          <div style={{
            position: 'absolute',
            top: '15px',
            left: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 10
          }}>
            🌕 Trạng thái: <strong style={{ color: 'var(--accent-yellow)' }}>
              {state.status === 'waiting' ? 'Phòng chờ' : state.status === 'playing' ? `Vòng ${state.round} - ${getPhaseName(state.phase)}` : 'Kết thúc'}
            </strong>
          </div>

          {/* Lobby info */}
          {state.status === 'waiting' && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 100,
              width: '80%',
              textAlign: 'center',
              backgroundColor: 'rgba(6, 10, 24, 0.85)',
              padding: '25px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 800 }}>🐺 ĐANG CHỜ AI BOT THAM GIA</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                Hệ thống yêu cầu 6 đến 10 bot của bên thứ ba tham gia qua API để tự động bắt đầu trò chơi.
              </p>
              
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-yellow)', marginBottom: '10px' }}>
                {state.players.length} / 10
              </div>

              {countdown !== null ? (
                <div style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: 600 }}>
                  ⏳ Bắt đầu đếm ngược: <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#3b82f6' }}>{countdown}s</span>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Đang đợi tối thiểu 6 người chơi...
                </div>
              )}
            </div>
          )}

          {/* Forest Atmosphere / Campfire Circle */}
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1/1',
            maxWidth: '430px',
            margin: '20px 0'
          }}>
            {/* The campfire in the center */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#ea580c',
              animation: 'campfire-glow 2.5s infinite ease-in-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3
            }}>
              <span style={{ fontSize: '3rem', userSelect: 'none', filter: 'drop-shadow(0 0 8px #f97316)' }}>🔥</span>
              
              {/* Floating sparks */}
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: '#fdba74',
                  bottom: '30px',
                  left: `${20 + i * 8}px`,
                  animation: `fire-spark ${1 + Math.random()}s infinite linear`,
                  animationDelay: `${i * 0.25}s`,
                  ['--dx' as any]: `${(i - 3) * 12}px`
                }} />
              ))}
            </div>

            {/* Render players in a circle */}
            {state.players.map((p, idx) => {
              const N = state.players.length;
              const angle = (idx * 360 / N) * (Math.PI / 180);
              const x = 50 + 36 * Math.cos(angle);
              const y = 50 + 36 * Math.sin(angle);
              const isSelected = selectedPlayer === p.username;
              const isSpeaker = activeSpeaker === p.username;
              const avatar = getPlayerAvatar(p.username);
              const isDead = !p.isAlive;

              return (
                <div
                  key={p.username}
                  onClick={() => setSelectedPlayer(p.username)}
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    zIndex: isSpeaker ? 15 : 5,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {/* Speech Bubble */}
                  {isSpeaker && activeSpeakerSpeech && (
                    <div style={{
                      position: 'absolute',
                      bottom: '75px',
                      backgroundColor: 'rgba(6, 10, 24, 0.95)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      width: '180px',
                      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.5)',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      animation: 'float 3s infinite ease-in-out',
                      zIndex: 100
                    }}>
                      <div style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.3
                      }}>
                        {activeSpeakerSpeech}
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: '10px',
                        height: '10px',
                        backgroundColor: 'rgba(6, 10, 24, 0.95)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                      }} />
                    </div>
                  )}

                  {/* Avatar Frame */}
                  <div style={{
                    width: isSpeaker ? '64px' : '52px',
                    height: isSpeaker ? '64px' : '52px',
                    borderRadius: '50%',
                    backgroundColor: isDead ? 'rgba(30, 41, 59, 0.9)' : `${avatar.color}15`,
                    border: isSpeaker 
                      ? `3px solid var(--accent-cyan)` 
                      : isSelected 
                        ? `2px solid var(--accent-yellow)` 
                        : isDead 
                          ? '2px dashed #475569' 
                          : `2.5px solid ${avatar.color}75`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isSpeaker ? '2.1rem' : '1.7rem',
                    boxShadow: isSpeaker 
                      ? '0 0 15px rgba(6, 182, 212, 0.6)' 
                      : isSelected 
                        ? '0 0 10px rgba(234, 179, 8, 0.4)' 
                        : 'none',
                    filter: isDead ? 'grayscale(80%)' : 'none',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    animation: isSpeaker ? 'pulse-thinking 1.5s infinite ease-in-out' : 'none'
                  }}>
                    {isDead ? '💀' : avatar.icon}
                    
                    {/* Role badge if revealed */}
                    {p.role && (
                      <span style={{
                        position: 'absolute',
                        bottom: '-4px',
                        right: '-4px',
                        backgroundColor: getRoleBadgeColor(p.role, p.side),
                        color: '#000',
                        fontSize: '0.55rem',
                        fontWeight: 900,
                        padding: '1px 4px',
                        borderRadius: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        lineHeight: 1
                      }}>
                        {p.role.startsWith('Loyal Servant') ? 'Servant' : p.role}
                      </span>
                    )}

                    {/* Emotion emoticon bubble */}
                    {!isDead && p.emotion && EMOTION_STYLES[p.emotion] && (
                      <span style={{
                        position: 'absolute',
                        top: '-3px',
                        left: '-3px',
                        backgroundColor: EMOTION_STYLES[p.emotion].bg,
                        border: `1px solid ${EMOTION_STYLES[p.emotion].border}`,
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        color: EMOTION_STYLES[p.emotion].color
                      }} title={p.emotion}>
                        {EMOTION_STYLES[p.emotion].emoji}
                      </span>
                    )}
                  </div>

                  {/* Name Label */}
                  <span style={{
                    marginTop: '6px',
                    fontSize: '0.7rem',
                    fontWeight: isSpeaker || isSelected ? 800 : 600,
                    color: isDead ? '#475569' : isSelected ? 'var(--accent-yellow)' : '#fff',
                    maxWidth: '85px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                    textDecoration: isDead ? 'line-through' : 'none'
                  }}>
                    {p.username}
                  </span>

                  {/* Speech Points */}
                  {!isDead && (
                    <span style={{
                      fontSize: '0.6rem',
                      color: 'var(--text-muted)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                    }}>
                      💬 {p.speechPoints}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* PANEL 2: Debate Log & Timeline (Center Panel)            */}
        {/* ======================================================== */}
        <div className="glass" style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '520px',
          background: 'rgba(6, 10, 24, 0.65)'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: '#fff' }}>
            💬 NHẬT KÝ TRANH LUẬN
          </h2>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '5px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            fontSize: '0.8rem',
            maxHeight: '430px'
          }}>
            {state.history.rounds.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '50px' }}>
                Đang chờ vòng đấu đầu tiên khởi tranh...
              </div>
            ) : (
              state.history.rounds.map((r, rIdx) => {
                return (
                  <div key={r.roundNumber} style={{
                    borderLeft: '2px solid rgba(255,255,255,0.05)',
                    paddingLeft: '12px',
                    marginBottom: '10px'
                  }}>
                    {/* Round Header */}
                    <div style={{
                      fontWeight: 800,
                      color: 'var(--accent-yellow)',
                      marginBottom: '8px',
                      fontSize: '0.85rem'
                    }}>
                      VÒNG {r.roundNumber}
                    </div>

                    {/* Private Analysis */}
                    {r.privateAnalysis && r.privateAnalysis.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                          🧠 Phân tích nội bộ:
                        </div>
                        {r.privateAnalysis.map((pa, idx) => (
                          <div key={idx} style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.02)', margin: '2px 0', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <strong style={{ color: '#c084fc' }}>{pa.player}</strong>: {pa.reasoning}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Statements */}
                    {r.statements && r.statements.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                          🗣️ Phát biểu công khai:
                        </div>
                        {r.statements.map((s, idx) => {
                          const avatar = getPlayerAvatar(s.player);
                          return (
                            <div key={idx} style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.03)', margin: '4px 0', borderLeft: `3px solid ${avatar.color}` }}>
                              <strong style={{ color: avatar.color }}>{avatar.icon} {s.player}</strong>: {s.text}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Challenges (Cross Examination) */}
                    {r.challenges && r.challenges.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                          ⚔️ Chất vấn chéo:
                        </div>
                        {r.challenges.map((c, idx) => {
                          const challengerAv = getPlayerAvatar(c.challenger);
                          const targetAv = getPlayerAvatar(c.target);
                          return (
                            <div key={idx} style={{
                              padding: '8px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(0,0,0,0.2)',
                              margin: '6px 0',
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                              <div style={{ color: 'var(--accent-red)', marginBottom: '3px' }}>
                                ❓ <strong>{challengerAv.icon} {c.challenger}</strong> chất vấn <strong>{targetAv.icon} {c.target}</strong>:
                              </div>
                              <div style={{ fontStyle: 'italic', paddingLeft: '8px', borderLeft: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '6px' }}>
                                "{c.question}"
                              </div>
                              {c.answer && (
                                <div>
                                  <div style={{ color: 'var(--accent-green)', marginBottom: '2px' }}>
                                    💡 <strong>{targetAv.icon} {c.target}</strong> trả lời:
                                  </div>
                                  <div style={{ paddingLeft: '8px', borderLeft: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                    "{c.answer}"
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Votes */}
                    {r.votes && Object.keys(r.votes).length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                          🗳️ Kết quả bỏ phiếu loại bỏ:
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                          gap: '6px'
                        }}>
                          {Object.entries(r.votes).map(([voter, voted]) => (
                            <div key={voter} style={{ padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.7rem' }}>
                              👤 <strong>{voter}</strong> 🗳️ <strong>{voted}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Elimination result */}
                    {r.eliminated && (
                      <div style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        textAlign: 'center',
                        fontWeight: 700
                      }}>
                        💀 {r.eliminated} đã bị đa số bỏ phiếu loại bỏ!
                        {r.eliminatedRole && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Vai trò thực tế: <strong>{r.eliminatedRole}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Winner Banner if finished */}
          {state.status === 'finished' && (
            <div style={{
              marginTop: '15px',
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: state.winner === 'good' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: state.winner === 'good' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
              textAlign: 'center',
              fontWeight: 800,
              fontSize: '0.9rem',
              color: state.winner === 'good' ? '#10b981' : '#ef4444'
            }}>
              🏆 TRẬN ĐẤU KẾT THÚC! PHE {state.winner === 'good' ? 'THIỆN (GOOD)' : 'ÁC (EVIL)'} CHIẾN THẮNG! 👑
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* PANEL 3: Stats, Claims & Integration Guide (Right Panel) */}
        {/* ======================================================== */}
        <div className="glass" style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '520px',
          background: 'rgba(6, 10, 24, 0.65)'
        }}>
          {/* Tabs header */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '15px',
            gap: '5px'
          }}>
            <button
              onClick={() => setActiveTab('stats')}
              style={{
                flex: 1,
                padding: '8px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'stats' ? '2px solid var(--accent-cyan)' : 'none',
                color: activeTab === 'stats' ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === 'stats' ? 800 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              📊 Chỉ số AI
            </button>
            <button
              onClick={() => setActiveTab('claims')}
              style={{
                flex: 1,
                padding: '8px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'claims' ? '2px solid var(--accent-cyan)' : 'none',
                color: activeTab === 'claims' ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === 'claims' ? 800 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              📜 Claims
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              style={{
                flex: 1,
                padding: '8px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'guide' ? '2px solid var(--accent-cyan)' : 'none',
                color: activeTab === 'guide' ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === 'guide' ? 800 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              📖 Hướng dẫn
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', fontSize: '0.8rem' }}>
            {/* TAB 1: AI Stats & Suspicion matrix */}
            {activeTab === 'stats' && (() => {
              const playerObj = state.players.find(p => p.username === selectedPlayer);
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {playerObj ? (
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '1.5rem' }}>{getPlayerAvatar(playerObj.username).icon}</span>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{playerObj.username}</strong>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: playerObj.isAlive ? '#10b981' : '#ef4444' }}>
                            {playerObj.isAlive ? '🟢 Còn sống' : '🔴 Đã chết'}
                          </span>
                        </div>
                      </div>

                      {/* Display stats if exists */}
                      {playerObj.scores ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>NĂNG LỰC AI:</div>
                          {[
                            { name: 'Reasoning (Lập luận)', val: playerObj.scores.reasoning, color: '#a855f7' },
                            { name: 'Consistency (Nhất quán)', val: playerObj.scores.consistency, color: '#3b82f6' },
                            { name: 'Persuasion (Thuyết phục)', val: playerObj.scores.persuasion, color: '#10b981' },
                            { name: 'Deception (Đánh lừa)', val: playerObj.scores.deception, color: '#ef4444' },
                            { name: 'Calibration (Tự đánh giá)', val: playerObj.scores.calibration, color: '#eab308' }
                          ].map((sk) => (
                            <div key={sk.name}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '2px' }}>
                                <span>{sk.name}</span>
                                <strong>{sk.val.toFixed(0)}/100</strong>
                              </div>
                              <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                <div style={{ width: `${sk.val}%`, height: '100%', borderRadius: '3px', backgroundColor: sk.color }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          Đang tải chỉ số đánh giá...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>Hãy chọn một player để xem năng lực AI.</div>
                  )}

                  {/* Belief / Suspicion Matrix */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#fff', marginBottom: '8px' }}>
                      🔍 MA TRẬN NGHI NGỜ (BELIEF MATRIX)
                    </div>
                    
                    {state.status === 'finished' ? (
                      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', textAlign: 'center' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                              <th style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>{"Nghi ngờ ->"}</th>
                              {state.players.map(p => (
                                <th key={p.username} style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.6rem' }}>
                                  {p.username.substring(0, 5)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {state.players.map(p => (
                              <tr key={p.username}>
                                <td style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.05)', fontWeight: 800 }}>
                                  {p.username.substring(0, 5)}
                                </td>
                                {state.players.map(target => {
                                  if (p.username === target.username) {
                                    return <td key={target.username} style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>-</td>;
                                  }
                                  const probability = p.privateMemory?.suspicions?.[target.username] ?? 0;
                                  // Color scale from green to red based on suspicion probability
                                  const color = `hsl(${(1 - probability) * 120}, 75%, 45%)`;
                                  return (
                                    <td key={target.username} style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.05)', color, fontWeight: 700 }}>
                                      {(probability * 100).toFixed(0)}%
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{
                        padding: '15px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px dashed rgba(255,255,255,0.08)',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem'
                      }}>
                        🔒 Ma trận nghi ngờ đang được các AI cập nhật ẩn trong đầu... Sẽ công bố đầy đủ sau khi trận đấu kết thúc.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB 2: Claim System */}
            {activeTab === 'claims' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Hệ thống Claim lưu trữ các tuyên bố, cáo buộc và phe phái tự phong của các AI Agent để theo dõi tính nhất quán.
                </p>
                {state.claims.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '30px' }}>
                    Chưa có Claim nào được đưa ra.
                  </div>
                ) : (
                  state.claims.map(claim => (
                    <div key={claim.id} style={{
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ fontWeight: 800, color: 'var(--accent-yellow)', marginBottom: '3px' }}>
                        👤 {claim.creator} tuyên bố:
                      </div>
                      <div style={{ fontSize: '0.75rem', fontStyle: 'italic', marginBottom: '6px', color: '#fff' }}>
                        "{claim.text}"
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.65rem' }}>
                        <span style={{ color: 'var(--accent-green)' }}>
                          👍 Đồng thuận ({claim.supportedBy.length}): {claim.supportedBy.join(', ') || 'không có'}
                        </span>
                        <span style={{ color: 'var(--accent-red)' }}>
                          👎 Phản đối ({claim.attackedBy.length}): {claim.attackedBy.join(', ') || 'không có'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: Integration Guide */}
            {activeTab === 'guide' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', margin: 0 }}>🐺 HƯỚNG DẪN TÍCH HỢP CHO BOT</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.4 }}>
                  Developer có thể tự viết bot bằng mọi ngôn ngữ để tham gia phòng chơi Ma Sói. Quy trình giao tiếp của bot qua các API sau:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong style={{ color: 'var(--accent-cyan)' }}>1. Tham gia phòng chờ</strong>
                    <code style={{ display: 'block', padding: '3px', backgroundColor: '#000', borderRadius: '4px', fontSize: '0.65rem', marginTop: '3px', color: '#60a5fa' }}>
                      POST /api/bot/games/join
                    </code>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Body: <code>{"{ \"gameId\": \"...\" }"}</code></span>
                  </div>

                  <div style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong style={{ color: 'var(--accent-cyan)' }}>2. Lấy thông tin & Vai trò ẩn</strong>
                    <code style={{ display: 'block', padding: '3px', backgroundColor: '#000', borderRadius: '4px', fontSize: '0.65rem', marginTop: '3px', color: '#60a5fa' }}>
                      GET /api/bot/games/[gameId]
                    </code>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Cung cấp token Bearer để thấy được vai trò ẩn và memory riêng của bot mình.</span>
                  </div>

                  <div style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong style={{ color: 'var(--accent-cyan)' }}>3. Gửi hành động theo Phase</strong>
                    <code style={{ display: 'block', padding: '3px', backgroundColor: '#000', borderRadius: '4px', fontSize: '0.65rem', marginTop: '3px', color: '#60a5fa' }}>
                      POST /api/bot/games/[gameId]/werewolf/action
                    </code>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <span>• Phase 1: <code>{"{\"action\": \"analysis\", \"suspicions\": {...}, \"reasoning\": \"...\"}"}</code></span>
                      <span>• Phase 2: <code>{"{\"action\": \"statement\", \"text\": \"...\"}"}</code></span>
                      <span>• Phase 3: <code>{"{\"action\": \"challenge\", \"target\": \"...\", \"question\": \"...\"}"}</code> hoặc <code>{"{\"action\": \"response\", \"answer\": \"...\"}"}</code></span>
                      <span>• Phase 4: <code>{"{\"action\": \"beliefs\", \"beliefs\": {...}}"}</code></span>
                      <span>• Phase 5: <code>{"{\"action\": \"vote\", \"vote\": \"...\"}"}</code></span>
                      <span>• Bất kỳ lúc nào (Độc lập lượt đi): <code>{"{\"action\": \"emotion\", \"emotion\": \"Cay cú\"}"}</code></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

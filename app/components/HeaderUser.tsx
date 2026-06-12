'use client';

import { useEffect, useState } from 'react';

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

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default function HeaderUser() {
  const [humanUser, setHumanUser] = useState<{ username: string; displayName: string; token: string; avatarColor: string } | null>(null);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);

  const loadUser = () => {
    const cookieVal = getCookie('game4bot_user');
    if (cookieVal) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cookieVal));
        if (parsed && parsed.token) {
          setHumanUser(parsed);
          return;
        }
      } catch (e) {
        console.error('Error parsing user cookie:', e);
      }
    }
    setHumanUser(null);
  };

  useEffect(() => {
    loadUser();
    const interval = setInterval(loadUser, 2000);
    return () => clearInterval(interval);
  }, []);

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
          setIsLoginPopupOpen(false);
          loadUser();
          window.location.reload();
        }
      }
    } catch (err) {
      console.error('Error logging in human:', err);
    }
  };

  if (!humanUser) {
    return (
      <>
        <button
          onClick={() => setIsLoginPopupOpen(true)}
          className="hover-btn"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🎮 Chọn linh vật chơi
        </button>

        {isLoginPopupOpen && renderModal()}
      </>
    );
  }

  const displayName = humanUser.displayName;
  const parts = displayName.split(' ');
  const icon = parts[0] || '👤';
  const nameOnly = parts.slice(1).join(' ');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Xin chào,</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#ffffff' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${humanUser.avatarColor || 'var(--border-color)'}`,
            fontSize: '0.9rem'
          }}>
            {icon}
          </span>
          <span>{nameOnly}</span>
        </div>
        <button
          onClick={() => setIsLoginPopupOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-cyan)',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '0.8rem',
            padding: 0
          }}
        >
          (Thay đổi)
        </button>
      </div>

      {isLoginPopupOpen && renderModal()}
    </>
  );

  function renderModal() {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(5, 7, 12, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999, // z-index cực lớn để đè lên mọi thứ khác
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
          textAlign: 'center', // Căn giữa nội dung
          color: 'var(--text-primary)' // Reset màu chữ
        }}>
          <button
            onClick={() => setIsLoginPopupOpen(false)}
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
            Để tham gia hoặc bắt đầu chơi cờ, vui lòng chọn một linh vật đại diện. Biệt danh này sẽ được lưu trữ trong cookie của bạn.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)', // 3 cột chuẩn
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
                  padding: '15px 10px', // Padding chuẩn
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
                  {animal.name} {/* Hiển thị đầy đủ tên */}
                </span>
              </button>
            ))}
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Đại diện của bạn sẽ có hiệu lực trong 10 năm hoặc đến khi bạn xóa cookie trình duyệt.
          </div>
        </div>
      </div>
    );
  }
}

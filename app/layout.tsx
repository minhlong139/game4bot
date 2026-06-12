import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import HeaderUser from './components/HeaderUser';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'GameHub As the Service | AI Agent Showdown',
  description: 'Giao diện trực quan theo dõi các AI Agent (Bot) thi đấu đối kháng trực tiếp các môn cờ: Cờ vua, Cờ tướng, Cờ caro.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <div className="main-gradient-bg"></div>
        
        {/* Navigation Bar */}
        <header style={{
          borderBottom: '1px solid var(--border-color)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(9, 11, 17, 0.7)'
        }}>
          <div className="container flex-between" style={{ height: '64px' }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontWeight: 800,
                fontSize: '1.25rem',
                letterSpacing: '-0.025em',
                background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                GAMEHUB.AI
              </span>
              <span style={{
                fontSize: '0.65rem',
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '2px 6px',
                borderRadius: '9999px',
                color: 'var(--text-secondary)',
                fontWeight: 600
              }}>
                SERVICE
              </span>
            </a>
            <nav style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', fontWeight: 500, alignItems: 'center' }}>
              <HeaderUser />
              <a href="https://github.com/minhlong139/game4bot" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                GitHub
              </a>
            </nav>
          </div>
        </header>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>

        <footer style={{
          borderTop: '1px solid var(--border-color)',
          padding: '20px 0',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          textAlign: 'center'
        }}>
          <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>© 2026 GameHub As the Service. Phát triển cho AI Agent thi đấu qua API.</div>
            <div>
              <a href="https://github.com/minhlong139/game4bot" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>
                github.com/minhlong139/game4bot
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

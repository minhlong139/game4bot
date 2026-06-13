import { NextResponse } from 'next/server';
import { getWaitingGames, getActiveGames, getCompletedGames, getLeaderboard, getRecentActivities } from '@/lib/game-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [waitingGames, activeGames, completedGames, leaderboard, activities] = await Promise.all([
      getWaitingGames(),
      getActiveGames(),
      getCompletedGames(50), // Fetch up to 50 for load more capability
      getLeaderboard(),
      getRecentActivities()
    ]);

    return NextResponse.json({
      status: 'success',
      waitingGames: waitingGames.map(g => ({
        id: g.gameId,
        type: g.gameType,
        player1: g.createdBy,
        player2: '',
        movesCount: 0,
        updatedAt: g.createdAt
      })),
      activeGames: activeGames.map(g => ({
        id: g.id,
        type: g.type,
        player1: g.player1,
        player2: g.player2,
        currentTurn: g.currentTurn,
        movesCount: g.history.length,
        updatedAt: g.updatedAt
      })),
      completedGames: completedGames.map(g => ({
        id: g.id,
        type: g.type,
        player1: g.player1,
        player2: g.player2,
        winner: g.winner,
        movesCount: g.history.length,
        completedAt: g.updatedAt
      })),
      leaderboard,
      activities
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getLeaderboard } from '@/lib/game-store';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized. Provide valid Bearer token in Authorization header.' },
        { status: 401 }
      );
    }

    const leaderboard = await getLeaderboard();
    return NextResponse.json({ status: 'success', leaderboard });
  } catch (error) {
    console.error('Error fetching bot leaderboard:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

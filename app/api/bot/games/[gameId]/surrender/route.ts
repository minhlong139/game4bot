import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { surrenderGame } from '@/lib/game-store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { gameId } = await params;
    const success = await surrenderGame(gameId, user);

    if (!success) {
      return NextResponse.json(
        { status: 'error', message: 'Đầu hàng không thành công. Trận đấu không tồn tại, đã kết thúc, hoặc bạn không phải người chơi.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error surrendering game:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

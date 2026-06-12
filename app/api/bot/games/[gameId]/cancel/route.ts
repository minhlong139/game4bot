import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { cancelGame } from '@/lib/game-store';

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
    const success = await cancelGame(gameId, user);

    if (!success) {
      return NextResponse.json(
        { status: 'error', message: 'Hủy phòng không thành công. Phòng không tồn tại, không ở trạng thái chờ, hoặc bạn không phải chủ phòng.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error cancelling game:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

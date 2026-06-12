import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { verifyPassword } from '@/lib/crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { status: 'error', message: 'Missing username or password' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const userKey = `user:${trimmedUsername}`;
    
    const user = await kv.hgetall<{ passwordHash: string; token: string; webhookUrl?: string }>(userKey);
    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid username or password' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: 'success',
      token: user.token,
      webhookUrl: user.webhookUrl || null
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

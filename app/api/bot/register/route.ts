import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { hashPassword, generateToken } from '@/lib/crypto';

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
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      return NextResponse.json(
        { status: 'error', message: 'Username must be between 3 and 20 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { status: 'error', message: 'Username can only contain alphanumeric characters, underscores, and hyphens' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { status: 'error', message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user exists
    const userKey = `user:${trimmedUsername}`;
    const existingUser = await kv.hgetall<{ passwordHash: string }>(userKey);
    if (existingUser) {
      return NextResponse.json(
        { status: 'error', message: 'Username is already taken' },
        { status: 400 }
      );
    }

    // Hash password & generate token
    const passwordHash = hashPassword(password);
    const token = generateToken();

    // Store in KV
    await kv.hset(userKey, {
      username: trimmedUsername,
      passwordHash,
      token,
      registeredAt: new Date().toISOString(),
      wins: 0,
      draws: 0,
      losses: 0,
    });

    await kv.set(`token:${token}`, trimmedUsername);
    await kv.sadd('users:all', trimmedUsername);

    return NextResponse.json({ status: 'success', token });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

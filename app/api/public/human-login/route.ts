import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { hashPassword, generateToken } from '@/lib/crypto';
import cryptoModule from 'crypto';
import { addActivity } from '@/lib/game-store';

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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { animalId } = body;

    let animal = ANIMALS.find((a) => a.id === animalId);
    if (!animal) {
      animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    }

    const randomId = Math.floor(100 + Math.random() * 900);
    const username = `human_${animal.id}_${randomId}`;
    const displayName = `${animal.icon} ${animal.name} #${randomId}`;
    const password = `human_pwd_${cryptoModule.randomUUID()}`;
    const avatarColor = animal.color;

    const userKey = `user:${username}`;

    // Hash password & generate token
    const passwordHash = hashPassword(password);
    const token = generateToken();

    // Store in KV
    await kv.hset(userKey, {
      username,
      displayName,
      passwordHash,
      token,
      avatarColor,
      registeredAt: new Date().toISOString(),
      wins: 0,
      draws: 0,
      losses: 0,
    });

    await kv.set(`token:${token}`, username);
    await kv.sadd('users:all', username);

    const userData = { username, displayName, token, avatarColor };

    await addActivity(`[Đăng ký] Người chơi ${displayName} (${username}) đã tham gia.`);

    const response = NextResponse.json({ status: 'success', user: userData });

    // Set cookie (expiry: 10 years)
    response.cookies.set('game4bot_user', JSON.stringify(userData), {
      maxAge: 10 * 365 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Human login error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

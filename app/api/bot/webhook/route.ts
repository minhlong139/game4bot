import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { kv } from '@/lib/kv';

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized. Provide valid Bearer token in Authorization header.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { webhookUrl } = body;

    // Validate URL if provided
    if (webhookUrl && !webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid webhookUrl. Must start with http:// or https://' },
        { status: 400 }
      );
    }

    // Save webhookUrl to user profile
    await kv.hset(`user:${user}`, { webhookUrl: webhookUrl || '' });

    return NextResponse.json({
      status: 'success',
      message: webhookUrl ? 'Webhook configured successfully' : 'Webhook cleared successfully',
      webhookUrl: webhookUrl || null,
    });
  } catch (error) {
    console.error('Error configuring webhook:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

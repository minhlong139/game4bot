import { kv } from './kv';

export async function getAuthUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }
  const username = await kv.get<string>(`token:${token}`);
  return username || null;
}

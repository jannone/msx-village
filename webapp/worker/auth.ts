import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';

export function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function randomToken(): string { return randomBytes(32).toString('hex'); }
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [version, salt, hex] = stored.split('$');
  if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(hex)) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hex, 'hex'));
}
export interface User { id: string; username: string }
export async function sessionUser(request: Request, db: D1Database): Promise<User | null> {
  const token = /(?:^|;\s*)village_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie') ?? '')?.[1];
  if (!token) return null;
  return db.prepare('SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ? AND s.expires_at > ?').bind(digest(token), Math.floor(Date.now() / 1000)).first<User>();
}
export async function createSession(user: User, db: D1Database): Promise<string> {
  const token = randomToken();
  await db.prepare('INSERT INTO sessions(hash, user_id, expires_at) VALUES (?, ?, ?)').bind(digest(token), user.id, Math.floor(Date.now() / 1000) + 30 * 86400).run();
  return `village_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 86400}`;
}

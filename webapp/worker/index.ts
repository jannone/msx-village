import { createSession, digest, hashPassword, sessionUser, verifyPassword } from './auth';
import { initialSettlement, migrateSettlement, validateSettlement } from '../shared/settlement';
import { assembleSnapshot } from '../shared/snapshot';
import { CORE_ROM } from './rom-template';

class HttpError extends Error {
  constructor(public status: number, message: string, public detail: Record<string, unknown> = {}) { super(message); }
}
interface PlotRow { id: string; x: number; y: number; revision: number; content: string; updated_at: number; username: string }
const now = () => Math.floor(Date.now() / 1000);
const json = (value: unknown, status = 200, cookie?: string) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
const plot = (row: PlotRow) => ({ ...row, content: migrateSettlement(JSON.parse(row.content)) });
async function body(request: Request, fields: string[]): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'Use application/json');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing body');
  let length = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      length += next.value.length;
      if (length > 20000) { await reader.cancel(); throw new HttpError(413, 'Request too large'); }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).some(key => !fields.includes(key))) throw new Error('fields');
    return parsed as Record<string, unknown>;
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid request body'); }
}
async function rate(db: D1Database, key: string, limit: number): Promise<void> {
  const time = now();
  const row = await db.prepare(`INSERT INTO request_limits(key, window_start, attempts) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN window_start < ? THEN 1 ELSE attempts + 1 END,
    window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END RETURNING attempts`)
    .bind(digest(key), time, time - 600, time - 600).first<{ attempts: number }>();
  if (!row || row.attempts > limit) throw new HttpError(429, 'Too many attempts. Try again in ten minutes.');
}
const ownPlot = (db: D1Database, userId: string) => db.prepare('SELECT p.id,p.x,p.y,p.revision,p.content,p.updated_at,u.username FROM plots p JOIN users u ON u.id=p.owner_id WHERE p.owner_id=?').bind(userId).first<PlotRow>();
function coordinate(value: unknown, max = 29996): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || Math.abs(value) > max) throw new HttpError(400, 'Invalid coordinates');
  return value;
}
async function region(db: D1Database, x: number, y: number): Promise<PlotRow[]> {
  return (await db.prepare('SELECT p.id,p.x,p.y,p.revision,p.content,p.updated_at,u.username FROM plots p JOIN users u ON u.id=p.owner_id WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ? ORDER BY y,x').bind(x-4,x+4,y-4,y+4).all<PlotRow>()).results;
}
async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url); const path = url.pathname; const db = env.DB;
  if (!['GET','POST','PUT'].includes(request.method)) throw new HttpError(405, 'Method not allowed');
  if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) throw new HttpError(403, 'Invalid request origin');
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (path === '/api/auth/register' && request.method === 'POST') {
    await rate(db, `register:${ip}`, 10);
    const b = await body(request, ['username','password','invitation']);
    if (typeof b.username !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(b.username) || typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 128 || typeof b.invitation !== 'string' || !/^[a-f0-9]{64}$/.test(b.invitation)) throw new HttpError(400, 'Use a 3–16 character username, a 12–128 character password, and a valid invitation');
    const user = { id: crypto.randomUUID(), username: b.username };
    const password = await hashPassword(b.password); const invite = digest(b.invitation);
    try {
      const result = await db.prepare('INSERT INTO users(id,username,password_hash,invitation_hash,created_at) SELECT ?,?,?,?,? FROM invitations WHERE hash=? AND expires_at>?').bind(user.id,user.username,password,invite,now(),invite,now()).run();
      if (result.meta.changes !== 1) throw new HttpError(400, 'Invitation is invalid or expired');
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (String(error).includes('UNIQUE constraint')) throw new HttpError(409, 'Username or invitation already used');
      throw error;
    }
    return json({ user }, 201, await createSession(user, db));
  }
  if (path === '/api/auth/login' && request.method === 'POST') {
    await rate(db, `login:${ip}`, 30);
    const b = await body(request, ['username','password']);
    if (typeof b.username !== 'string' || typeof b.password !== 'string' || b.username.length > 16 || b.password.length > 128) throw new HttpError(400, 'Invalid credentials');
    await rate(db, `login-user:${b.username.toLowerCase()}`, 10);
    const user = await db.prepare('SELECT id,username,password_hash FROM users WHERE username=?').bind(b.username).first<{id:string;username:string;password_hash:string}>();
    const valid = await verifyPassword(b.password, user?.password_hash ?? `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(64)}`);
    if (!user || !valid) throw new HttpError(401, 'Invalid username or password');
    return json({ user: { id: user.id, username: user.username } }, 200, await createSession(user, db));
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const token = /(?:^|;\s*)village_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie') ?? '')?.[1];
    if (token) await db.prepare('DELETE FROM sessions WHERE hash=?').bind(digest(token)).run();
    return json({ ok:true }, 200, 'village_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  }
  const user = await sessionUser(request, db);
  if (path === '/api/me' && request.method === 'GET') {
    const owned = user && await ownPlot(db, user.id);
    return json({ user, plot: owned ? plot(owned) : null });
  }
  if (path === '/api/world' && request.method === 'GET') {
    const x = coordinate(Number(url.searchParams.get('x') ?? 0)); const y = coordinate(Number(url.searchParams.get('y') ?? 0));
    return json({ center: {x,y}, plots: (await region(db,x,y)).map(plot) });
  }
  if (path === '/api/plots/claim' && request.method === 'POST') {
    if (!user) throw new HttpError(401, 'Sign in to claim a plot');
    const b = await body(request, ['x','y']); const x = coordinate(b.x,100); const y = coordinate(b.y,100);
    try {
      await db.prepare('INSERT INTO plots(id,owner_id,x,y,revision,content,updated_at) VALUES (?,?,?,?,0,?,?)').bind(crypto.randomUUID(),user.id,x,y,JSON.stringify(initialSettlement()),now()).run();
    } catch (error) {
      if (String(error).includes('UNIQUE constraint')) throw new HttpError(409, 'You already own a plot, or that location has been claimed');
      throw error;
    }
    return json({ plot: plot((await ownPlot(db,user.id))!) },201);
  }
  if (path === '/api/settlement' && request.method === 'PUT') {
    if (!user) throw new HttpError(401, 'Sign in to save your work');
    const b = await body(request, ['expectedRevision','settlement']);
    if (!Number.isSafeInteger(b.expectedRevision) || (b.expectedRevision as number) < 0) throw new HttpError(400, 'Invalid revision');
    let content: string;
    try { content = JSON.stringify(validateSettlement(b.settlement)); } catch (error) { throw new HttpError(400, (error as Error).message); }
    const time = now(); const revision = (b.expectedRevision as number) + 1;
    const result = await db.prepare('UPDATE plots SET content=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=? RETURNING revision').bind(content,time,user.id,b.expectedRevision).run();
    if (result.results.length !== 1) {
      const owned = await ownPlot(db,user.id);
      if (!owned) throw new HttpError(404, 'Claim a plot before saving');
      throw new HttpError(409, 'A newer revision has been saved', { currentRevision: owned.revision });
    }
    return json({ revision });
  }
  if (path === '/api/snapshot.rom' && request.method === 'GET') {
    const owned = user && await ownPlot(db,user.id);
    const x = coordinate(Number(url.searchParams.get('x') ?? owned?.x ?? 0));
    const y = coordinate(Number(url.searchParams.get('y') ?? owned?.y ?? 0));
    const plots = (await region(db,x,y)).map(row => ({ ...row, content: migrateSettlement(JSON.parse(row.content)) }));
    const core = Uint8Array.from(atob(CORE_ROM), char => char.charCodeAt(0));
    const rom = assembleSnapshot(core, plots, x, y, owned || undefined);
    return new Response(rom, { headers: { 'Content-Type':'application/octet-stream', 'Content-Disposition':`attachment; filename="msx-village-${x}-${y}.rom"`, 'Cache-Control':'private, no-store' } });
  }
  throw new HttpError(404, 'Not found');
}
export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message, ...error.detail }, error.status);
      console.error('API request failed', { path: new URL(request.url).pathname, error: String(error) });
      return json({ error: 'The server could not complete this request' },500);
    }
  },
} satisfies ExportedHandler<Env>;

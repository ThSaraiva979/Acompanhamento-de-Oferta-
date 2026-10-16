import { type AuthDB, type SafeUser, type UserRecord } from './db'
import { digestSecret, expireSessionCookie, hashPassword, makeSessionCookie, newSecret, readSessionCookie, validPassword, verifyPassword } from './crypto'

const hours12 = 12 * 60 * 60
const windowSeconds = 15 * 60
const maxFailures = 8
const now = () => Math.floor(Date.now() / 1000)
export function reply(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } })
}
export function safeUser(user: UserRecord): SafeUser {
  return { id: user.id, username: user.username, displayName: user.display_name, role: user.role, mustChangePassword: Boolean(user.must_change_password) }
}
async function parseBody(request: Request, max = 4096): Promise<Record<string, unknown> | null> {
  const body = await request.text()
  if (body.length > max) return null
  try {
    const parsed: unknown = JSON.parse(body)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch { return null }
}
export async function getOwnerSetupStatus(db: AuthDB): Promise<'pending' | 'complete'> {
  const owner = await db.prepare("SELECT password_hash FROM users WHERE role='OWNER'").first<{password_hash:string|null}>()
  return owner?.password_hash ? 'complete' : 'pending'
}
export async function activateOwner(request: Request, db: AuthDB): Promise<Response> {
  const body = await parseBody(request)
  const code = body?.code
  const password = body?.password
  if (typeof code !== 'string' || !/^[a-f0-9]{64}$/i.test(code) || !validPassword(password)) {
    return reply({ error: 'Dados de ativação inválidos.' }, 400)
  }
  if (await getOwnerSetupStatus(db) !== 'pending') return reply({ error: 'Administrador já ativado.' }, 403)
  const digest = await digestSecret(code)
  const time = now()
  const key = await attemptKey(request, 'activate-owner')
  const attempts = await db.prepare('SELECT failures, window_until FROM login_attempts WHERE identifier=?').bind(key).first<{failures:number;window_until:number}>()
  if (attempts && attempts.window_until > time && attempts.failures >= maxFailures)
    return reply({ error:'Muitas tentativas. Aguarde alguns minutos.' },429)
  const token = await db.prepare('SELECT token_hash FROM owner_activations WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?').bind(digest,time).first<{token_hash:string}>()
  if (!token) {
    await db.prepare('INSERT INTO login_attempts(identifier,failures,window_until) VALUES(?,1,?) ON CONFLICT(identifier) DO UPDATE SET failures=CASE WHEN window_until<=? THEN 1 ELSE failures+1 END,window_until=CASE WHEN window_until<=? THEN excluded.window_until ELSE window_until END').bind(key,time+windowSeconds,time,time).run()
    return reply({ error: 'Código inválido ou expirado.' }, 400)
  }
  const hashed = await hashPassword(password)
  const updates = await db.batch([
    db.prepare("UPDATE owner_activations SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM users WHERE role='OWNER' AND password_hash IS NULL)").bind(time,digest,time),
    db.prepare("UPDATE users SET password_hash=?, password_salt=?, password_iterations=?, must_change_password=0, updated_at=CURRENT_TIMESTAMP WHERE role='OWNER' AND password_hash IS NULL AND EXISTS (SELECT 1 FROM owner_activations WHERE token_hash=? AND consumed_at=?)").bind(hashed.hash,hashed.salt,hashed.iterations,digest,time),
  ])
  if (updates[0]?.meta?.changes !== 1 || updates[1]?.meta?.changes !== 1) return reply({ error: 'Código inválido ou já utilizado.' }, 400)
  await db.prepare('DELETE FROM login_attempts WHERE identifier=?').bind(key).run()
  return reply({ activated: true })
}
export async function getSession(request: Request, db: AuthDB): Promise<UserRecord | null> {
  const token = readSessionCookie(request)
  if (!token) return null
  const digest = await digestSecret(token)
  return db.prepare(`SELECT u.id, u.username, u.display_name, u.role, u.password_hash, u.password_salt,
         u.password_iterations, u.is_active, u.must_change_password
      FROM sessions s JOIN users u ON s.user_id=u.id
      WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?
        AND u.is_active=1 AND u.password_hash IS NOT NULL`).bind(digest,now()).first<UserRecord>()
}
async function attemptKey(request: Request, username: string): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  return digestSecret(ip + ':' + username.toLocaleLowerCase('pt-BR'))
}
export async function login(request: Request, db: AuthDB): Promise<Response> {
  const body = await parseBody(request)
  const username = body?.username
  const password = body?.password
  if (typeof username !== 'string' || username.length < 3 || username.length > 64 || typeof password !== 'string' || new TextEncoder().encode(password).length > 128) {
    return reply({ error: 'Usuário ou senha inválidos.' }, 401)
  }
  const key = await attemptKey(request, username)
  const time = now()
  const attempts = await db.prepare('SELECT failures, window_until FROM login_attempts WHERE identifier=?').bind(key).first<{failures:number;window_until:number}>()
  if (attempts && attempts.window_until > time && attempts.failures >= maxFailures) return reply({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429)
  const user = await db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE AND is_active=1').bind(username.trim()).first<UserRecord>()
  const ok = !!(user?.password_hash && user.password_salt && user.password_iterations && await verifyPassword(password, {hash:user.password_hash,salt:user.password_salt,iterations:user.password_iterations}))
  if (!ok || !user) {
    await db.prepare('INSERT INTO login_attempts(identifier,failures,window_until) VALUES(?,1,?) ON CONFLICT(identifier) DO UPDATE SET failures=CASE WHEN window_until<=? THEN 1 ELSE failures+1 END,window_until=CASE WHEN window_until<=? THEN excluded.window_until ELSE window_until END').bind(key,time+windowSeconds,time,time).run()
    return reply({ error: 'Usuário ou senha inválidos.' }, 401)
  }
  await db.prepare('DELETE FROM login_attempts WHERE identifier=?').bind(key).run()
  const token = newSecret()
  await db.prepare('INSERT INTO sessions(user_id,token_hash,created_at,expires_at) VALUES(?,?,?,?)').bind(user.id,await digestSecret(token),time,time+hours12).run()
  return reply({ user: safeUser(user) }, 200, { 'Set-Cookie': makeSessionCookie(token,hours12) })
}
export async function logout(request: Request, db: AuthDB): Promise<Response> {
  const token = readSessionCookie(request)
  if (!token || !await getSession(request,db)) return reply({ error: 'Não autenticado.' }, 401)
  await db.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=?').bind(now(), await digestSecret(token)).run()
  return reply({ success: true }, 200, { 'Set-Cookie': expireSessionCookie() })
}
export async function changePassword(request: Request, db: AuthDB, user: UserRecord): Promise<Response> {
  const body = await parseBody(request)
  const current = body?.currentPassword, next = body?.newPassword
  if (typeof current !== 'string' || !validPassword(next) || !user.password_hash || !user.password_salt || !user.password_iterations)
    return reply({ error: 'Senha atual ou nova senha inválida.' }, 400)
  if (!await verifyPassword(current, {hash:user.password_hash,salt:user.password_salt,iterations:user.password_iterations}))
    return reply({ error: 'Senha atual incorreta.' }, 401)
  const hashed = await hashPassword(next)
  await db.batch([
    db.prepare('UPDATE users SET password_hash=?, password_salt=?, password_iterations=?,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(hashed.hash,hashed.salt,hashed.iterations,user.id),
    db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(now(),user.id),
  ])
  return reply({ success:true, loginRequired:true },200,{ 'Set-Cookie': expireSessionCookie() })
}

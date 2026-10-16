import type { AuthDB, SafeUser, UserRecord } from './db'
import { hashPassword, newSecret } from './crypto'
import { reply, safeUser } from './auth'

const validUsername = (s: unknown): s is string => typeof s === 'string' && s.length >= 3 && s.length <= 64 && /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(s) && s.trim() === s
const validName = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0 && s.length <= 100
async function parse(request: Request): Promise<Record<string, unknown> | null> {
  const raw = await request.text()
  if (raw.length > 4096) return null
  try { const value: unknown = JSON.parse(raw); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : null }
  catch { return null }
}
export async function listUsers(db: AuthDB): Promise<SafeUser[]> {
  const all = await db.prepare('SELECT id,username,display_name,role,must_change_password FROM users ORDER BY role,id').all<UserRecord>()
  return all.results.map(safeUser)
}
export async function createViewer(db: AuthDB, username: string, displayName: string): Promise<{user:SafeUser;temporaryPassword:string}> {
  if (!validUsername(username) || !validName(displayName)) throw new Error('invalid')
  const temporaryPassword = newSecret()
  const hashed = await hashPassword(temporaryPassword)
  await db.prepare("INSERT INTO users(username,display_name,role,password_hash,password_salt,password_iterations,is_active,must_change_password) VALUES(?,?,'VIEWER',?,?,?,1,1)")
    .bind(username,displayName.trim(),hashed.hash,hashed.salt,hashed.iterations).run()
  const user = await db.prepare('SELECT id,username,display_name,role,must_change_password FROM users WHERE username=? COLLATE NOCASE').bind(username).first<UserRecord>()
  if (!user) throw new Error('no user')
  return { user: safeUser(user), temporaryPassword }
}
export async function updateViewer(db: AuthDB, id: number, action: 'activate' | 'deactivate' | 'reset-password'): Promise<Response> {
  const target = await db.prepare("SELECT id,role FROM users WHERE id=? AND role='VIEWER'").bind(id).first<{id:number;role:string}>()
  if (!target) return reply({ error:'Usuário não encontrado.' },404)
  if (action === 'activate') {
    await db.prepare("UPDATE users SET is_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='VIEWER'").bind(id).run()
    return reply({ success:true })
  }
  if (action === 'deactivate') {
    await db.batch([
      db.prepare("UPDATE users SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='VIEWER'").bind(id),
      db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),
    ])
    return reply({ success:true })
  }
  const temporaryPassword = newSecret()
  const hashed = await hashPassword(temporaryPassword)
  await db.batch([
    db.prepare("UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='VIEWER'").bind(hashed.hash,hashed.salt,hashed.iterations,id),
    db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),
  ])
  return reply({ success:true, temporaryPassword })
}
export async function handleUsers(request:Request, db:AuthDB, path:string): Promise<Response> {
  if(path === '/api/admin/users' && request.method === 'GET') return reply({ users: await listUsers(db) })
  if(path === '/api/admin/users' && request.method === 'POST') {
    const body=await parse(request)
    if(!validUsername(body?.username) || !validName(body?.displayName)) return reply({error:'Usuário ou nome inválido.'},400)
    try {return reply(await createViewer(db,body.username,body.displayName),201)}
    catch{return reply({error:'Não foi possível criar usuário. Verifique se o nome já existe.'},409)}
  }
  const match=/^\/api\/admin\/users\/(\d+)$/.exec(path)
  if(match && request.method === 'PATCH') {
    const body=await parse(request)
    const action=body?.action
    if(action!=='activate' && action!=='deactivate' && action!=='reset-password') return reply({error:'Ação inválida.'},400)
    return updateViewer(db,Number(match[1]),action)
  }
  return reply({error:'Endpoint não encontrado.'},404)
}

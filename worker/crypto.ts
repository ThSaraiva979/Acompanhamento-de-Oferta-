const encoder = new TextEncoder()
const iterationsDefault = 600_000
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}
function fromHex(text: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(text)) throw new Error('Hash inválido')
  return new Uint8Array(text.match(/../g)!.map(p => parseInt(p, 16)))
}
function constantEqual(a: Uint8Array, b: Uint8Array): boolean {
  let mismatch = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return mismatch === 0
}
export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && encoder.encode(value).length >= 12 && encoder.encode(value).length <= 128
}
export function newSecret(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}
export async function digestSecret(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
}
export async function hashPassword(password: string, iterations = iterationsDefault): Promise<{ hash: string; salt: string; iterations: number }> {
  if (!validPassword(password)) throw new Error('Senha deve ter 12 a 128 bytes.')
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bytes = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(salt) as BufferSource, iterations, hash: 'SHA-256' }, key, 256))
  return { hash: toHex(bytes), salt, iterations }
}
export async function verifyPassword(password: string, record: { hash: string; salt: string; iterations: number }): Promise<boolean> {
  if (typeof password !== 'string' || encoder.encode(password).length > 128) return false
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(record.salt) as BufferSource, iterations: record.iterations, hash: 'SHA-256' }, key, 256)
    return constantEqual(new Uint8Array(bits), fromHex(record.hash))
  } catch { return false }
}
export const cookieName = '__Host-ao_session'
export function makeSessionCookie(token: string, maxAgeSeconds: number): string {
  return cookieName + '=' + token + '; Path=/; Max-Age=' + maxAgeSeconds + '; HttpOnly; Secure; SameSite=Strict'
}
export function expireSessionCookie(): string {
  return makeSessionCookie('', 0)
}
export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? ''
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))
  const token = match?.slice(cookieName.length + 1)
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : null
}

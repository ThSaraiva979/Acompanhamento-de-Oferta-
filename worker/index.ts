import { type AuthDB, type Statement } from './db'
import { activateOwner, changePassword, getOwnerSetupStatus, getSession, login, logout, reply, safeUser } from './auth'
import { handleUsers } from './users'

export type Status = 'ATIVA' | 'BREVE' | 'ENCERRADA'

export interface Promotion {
  code: string
  name: string
  oldPrice: string
  price: string
  store: string
  start: string
  end: string
  detail: string
  status: Status
}

interface Env {
  DB?: AuthDB
  ASSETS: { fetch(request: Request): Promise<Response> }
}

const fields: Array<keyof Promotion> = [
  'code', 'name', 'oldPrice', 'price', 'store', 'start', 'end', 'detail', 'status',
]

const maxLength: Record<keyof Promotion, number> = {
  code: 80, name: 250, oldPrice: 60, price: 60,
  store: 120, start: 40, end: 40, detail: 250, status: 9,
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function validate(row: unknown): Promotion | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const record = row as Record<string, unknown>
  const parsed: Partial<Promotion> = {}
  for (const field of fields) {
    if (typeof record[field] !== 'string' || (record[field] as string).length > maxLength[field]) return null
    ;(parsed as Record<string, unknown>)[field] = (record[field] as string).trim()
  }
  if (!parsed.code || !parsed.name || !parsed.store || !parsed.price) return null
  if (parsed.status !== 'ATIVA' && parsed.status !== 'BREVE' && parsed.status !== 'ENCERRADA') return null
  return parsed as Promotion
}

async function readPromotions(db: AuthDB): Promise<Promotion[]> {
  const query = `SELECT p.code AS code, p.name AS name, pr.old_price AS oldPrice,
      pr.price AS price, s.name AS store, pr.start_date AS start,
      pr.end_date AS end, pr.detail AS detail, pr.status AS status
    FROM promotions pr
    JOIN products p ON p.code = pr.product_code
    JOIN stores s ON s.id = pr.store_id
    ORDER BY pr.id DESC`
  const result = await db.prepare(query).all<Promotion>()
  return result.results
}

async function importPromotions(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'Banco de dados indisponível.' }, 503)
  let payload: unknown
  try {
    const raw = await request.text()
    if (raw.length > 2_000_000) return json({ error: 'Arquivo excede o tamanho permitido.' }, 413)
    payload = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido.' }, 400)
  }

  if (!payload || typeof payload !== 'object' || !('promotions' in payload)) {
    return json({ error: 'Campo promotions obrigatório.' }, 400)
  }
  const entries = (payload as { promotions: unknown }).promotions
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 1000) {
    return json({ error: 'Envie de 1 a 1.000 promoções por importação.' }, 400)
  }
  const rows: Promotion[] = []
  const products = new Map<string, string>()
  const stores = new Set<string>()
  for (const value of entries) {
    const row = validate(value)
    if (!row) return json({ error: 'Promoção inválida: verifique campos, preços e status.' }, 400)
    if (products.has(row.code) && products.get(row.code) !== row.name) {
      return json({ error: 'Um mesmo código não pode ter nomes diferentes.' }, 400)
    }
    products.set(row.code, row.name)
    stores.add(row.store)
    rows.push(row)
  }

  try {
    const db = env.DB
    const statements: Statement[] = [
      db.prepare('DELETE FROM promotions'),
      db.prepare('DELETE FROM products'),
      db.prepare('DELETE FROM stores'),
    ]

    for (const store of stores) {
      statements.push(db.prepare('INSERT INTO stores (name) VALUES (?)').bind(store))
    }
    for (const [code, name] of products) {
      statements.push(db.prepare('INSERT INTO products (code, name) VALUES (?, ?)').bind(code, name))
    }
    for (const row of rows) {
      statements.push(db.prepare(`INSERT INTO promotions
        (product_code, store_id, old_price, price, start_date, end_date, detail, status)
        VALUES (?, (SELECT id FROM stores WHERE name = ?), ?, ?, ?, ?, ?, ?)`
      ).bind(row.code, row.store, row.oldPrice, row.price, row.start, row.end, row.detail, row.status))
    }
    statements.push(db.prepare('INSERT INTO import_batches (row_count) VALUES (?)').bind(rows.length))
    await db.batch(statements)
    return json({ count: rows.length })
  } catch {
    return json({ error: 'Erro ao salvar as promoções. Os dados anteriores foram preservados.' }, 500)
  }
}

function sameOrigin(request: Request): boolean {
  return request.headers.get('Origin') === new URL(request.url).origin
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request)
    if (!env.DB) return reply({ error:'Banco de dados indisponível.' },503)
    const db = env.DB

    if(request.method !== 'GET' && !sameOrigin(request))
      return reply({error:'Origem não permitida.'},403)

    try {
      if(path === '/api/auth/setup-status' && request.method === 'GET')
        return reply({status:await getOwnerSetupStatus(db)})
      if(path === '/api/auth/activate-owner' && request.method === 'POST')
        return activateOwner(request,db)
      if(path === '/api/auth/login' && request.method === 'POST')
        return login(request,db)
      const user = await getSession(request,db)
      if(!user) return reply({error:'Sessão expirada ou inexistente.'},401)

      if(path === '/api/auth/me' && request.method === 'GET') return reply({user:safeUser(user)})
      if(path === '/api/auth/logout' && request.method === 'POST') return logout(request,db)
      if(path === '/api/auth/change-password' && request.method === 'POST')
        return changePassword(request,db,user)

      if(user.must_change_password)
        return reply({error:'É necessário definir uma nova senha.'},403)

      if(path === '/api/promocoes' && request.method === 'GET')
        return reply({promotions:await readPromotions(db)})
      if(path === '/api/promocoes/import' && request.method === 'POST') {
        if(user.role !== 'OWNER') return reply({error:'Sem permissão para importar.'},403)
        return importPromotions(request,env)
      }
      if(path.startsWith('/api/admin/')) {
        if(user.role !== 'OWNER') return reply({error:'Sem permissão administrativa.'},403)
        return handleUsers(request,db,path)
      }
      return reply({error:'Endpoint não encontrado.'},404)
    } catch {
      return reply({error:'Não foi possível concluir a operação.'},503)
    }
  },
}

import { describe, expect, it, vi } from 'vitest'
import worker from './index'

const item = (overrides = {}) => ({
  code: '789', name: 'Arroz 5kg', oldPrice: 'R$ 29,90', price: 'R$ 24,90',
  store: 'Centro', start: '15/10/2026', end: '20/10/2026',
  detail: 'Importada da planilha', status: 'ATIVA', ...overrides,
})

function context() {
  const statements: Array<{ sql: string; params: unknown[] }> = []
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...params: unknown[]) => ({ sql, params }),
      all: async () => ({ results: [item()] }),
    })),
    batch: vi.fn(async (batch: Array<{ sql: string; params: unknown[] }>) => {
      statements.push(...batch)
      return []
    }),
  }
  const assets = { fetch: vi.fn(async () => new Response('website', { status: 200 })) }
  return { db, statements, env: { DB: db, ASSETS: assets, IMPORT_TOKEN: 'secret-test-value' }, assets }
}

function post(body: unknown, token = 'secret-test-value') {
  return new Request('https://example.com/api/promocoes/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })
}

describe('Worker API e segurança D1', () => {
  it('busca promoções com JOIN na base em vez de servir HTML do SPA', async () => {
    const { env, db, assets } = context()
    const response = await worker.fetch(new Request('https://example.com/api/promocoes'), env)
    expect(response.status).toBe(200)
    expect((await response.json()).promotions).toEqual([item()])
    expect(db.prepare.mock.calls[0][0]).toMatch(/JOIN products/)
    expect(assets.fetch).not.toHaveBeenCalled()
  })

  it('encaminha páginas e recursos estáticos ao assets binding', async () => {
    const { env, assets } = context()
    const response = await worker.fetch(new Request('https://example.com/dashboard'), env)
    expect(await response.text()).toBe('website')
    expect(assets.fetch).toHaveBeenCalledOnce()
  })

  it('rejeita qualquer escrita sem token correto antes de chamar o banco', async () => {
    const { env, db } = context()
    const response = await worker.fetch(post({ promotions: [item()] }, 'incorreta'), env)
    expect(response.status).toBe(401)
    expect(db.batch).not.toHaveBeenCalled()
  })

  it('rejeita importação quando segredo do servidor não estiver configurado', async () => {
    const { env } = context()
    const response = await worker.fetch(post({ promotions: [item()] }), { ...env, IMPORT_TOKEN: undefined })
    expect(response.status).toBe(503)
  })

  it('rejeita payload inválido sem apagar registros anteriores', async () => {
    const { env, db } = context()
    const response = await worker.fetch(post({ promotions: [item({ status: 'INEXISTENTE' })] }), env)
    expect(response.status).toBe(400)
    expect(db.batch).not.toHaveBeenCalled()
  })

  it('rejeita produtos com mesmo código e nomes inconsistentes', async () => {
    const { env, db } = context()
    const response = await worker.fetch(post({
      promotions: [item(), item({ name: 'Café', store: 'Norte' })],
    }), env)
    expect(response.status).toBe(400)
    expect(db.batch).not.toHaveBeenCalled()
  })

  it('salva substituição atômica, deduplicando produtos e lojas', async () => {
    const { env, db, statements } = context()
    const promotions = [item(), item({ store: 'Norte', price: 'R$ 22,90' })]
    const response = await worker.fetch(post({ promotions }), env)
    expect(response.status).toBe(200)
    expect((await response.json()).count).toBe(2)
    expect(db.batch).toHaveBeenCalledOnce()
    expect(statements.filter((p) => /INSERT INTO products/.test(p.sql))).toHaveLength(1)
    expect(statements.filter((p) => /INSERT INTO stores/.test(p.sql))).toHaveLength(2)
    expect(statements.filter((p) => /INSERT INTO promotions/.test(p.sql))).toHaveLength(2)
    expect(statements[0].sql).toMatch(/DELETE FROM promotions/)
  })

  it('rejeita lote acima do limite para evitar sobrecarga', async () => {
    const { env, db } = context()
    const response = await worker.fetch(post({ promotions: Array.from({ length: 1001 }, () => item()) }), env)
    expect(response.status).toBe(400)
    expect(db.batch).not.toHaveBeenCalled()
  })

  it('responde 500 sem expor erro de banco nem executar atualização parcial', async () => {
    const { env, db } = context()
    db.batch.mockRejectedValueOnce(new Error('internal SQL error'))
    const response = await worker.fetch(post({ promotions: [item()] }), env)
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('internal SQL error')
  })
})

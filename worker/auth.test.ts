import { describe, expect, it } from 'vitest'
import { makeSessionCookie, hashPassword, verifyPassword } from './crypto'
import worker from './index'

describe('login obrigatório', () => {
  it('gera hashes de senha com salt e verifica senhas', async () => {
    const record = await hashPassword('SenhaSegura12345!')
    expect(record.hash).toBeTruthy()
    expect(record.salt).toBeTruthy()
    expect(await verifyPassword('SenhaSegura12345!', record)).toBe(true)
    expect(await verifyPassword('senha-incorreta', record)).toBe(false)
  })

  it('emite cookie HttpOnly e Secure', () => {
    expect(makeSessionCookie('token', 3600)).toMatch(/HttpOnly; Secure; SameSite=Strict/)
  })

  it('não permite ler promoções sem sessão', async () => {
    const db = { prepare: () => ({ all: async () => ({ results: [] }) }), batch: async () => [] }
    const response = await worker.fetch(new Request('https://exemplo.com/api/promocoes'), { DB: db, ASSETS: { fetch: async () => new Response('site') } })
    expect(response.status).toBe(401)
  })
})

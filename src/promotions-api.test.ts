import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPromotions, savePromotions } from './promotions-api'

afterEach(() => vi.unstubAllGlobals())

describe('API de promoções', () => {
  it('consulta dados salvos no D1 via Worker', async () => {
    const fetchMock = vi.fn(async () => Response.json({ promotions: [{ code: '123', name: 'Teste' }] }))
    vi.stubGlobal('fetch', fetchMock)
    const rows = await loadPromotions()
    expect(rows[0].code).toBe('123')
    expect(fetchMock).toHaveBeenCalledWith('/api/promocoes', { cache: 'no-store' })
  })

  it('exige resposta HTTP correta para não mascarar erro de conexão', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Sem banco', { status: 503 })))
    await expect(loadPromotions()).rejects.toThrow()
  })

  it('envia chave somente no cabeçalho e retorna contagem de registros persistidos', async () => {
    const fetchMock = vi.fn(async () => Response.json({ count: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const rows = [{ code: '123', name: 'Arroz', price: 'R$ 12,99', oldPrice: '', store: 'Centro', start: '', end: '', detail: '', status: 'ATIVA' as const }]
    const count = await savePromotions(rows, 'chave-secreta')
    expect(count).toBe(1)
    const [path, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(path).toBe('/api/promocoes/import')
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer chave-secreta')
    expect(options.body).not.toContain('chave-secreta')
  })

  it('não informa sucesso se importação for recusada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Não autorizado', { status: 401 })))
    await expect(savePromotions([], 'errada')).rejects.toThrow(/autorização|chave/i)
  })
})

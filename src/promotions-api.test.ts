import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPromotions, savePromotions } from './promotions-api'
afterEach(()=>vi.unstubAllGlobals())
describe('API de promoções com sessão',()=>{
 it('consulta D1 com cookie e sem chave',async()=>{
  const mocked=vi.fn(async()=>Response.json({promotions:[{code:'12'}]}))
  vi.stubGlobal('fetch',mocked)
  expect((await loadPromotions())[0].code).toBe('12')
  expect(mocked).toHaveBeenCalledWith('/api/promocoes',{cache:'no-store',credentials:'same-origin'})
 })
 it('importa usando cookie e nenhum header Authorization',async()=>{
  const mocked=vi.fn(async()=>Response.json({count:1}))
  vi.stubGlobal('fetch',mocked)
  const count=await savePromotions([{code:'123',name:'Arroz',price:'R$ 2,00',oldPrice:'',store:'Sul',start:'',end:'',detail:'',status:'ATIVA'}])
  expect(count).toBe(1)
  const [,opts]=mocked.mock.calls[0] as unknown as [string,RequestInit]
  expect(opts.credentials).toBe('same-origin')
  expect((opts.headers as Record<string,string>).Authorization).toBeUndefined()
 })
 it('identifica sessão expirada em 401',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:401})))
  await expect(loadPromotions()).rejects.toThrow(/sessão/i)
  await expect(savePromotions([])).rejects.toThrow(/sessão/i)
 })
 it('nega importação 403 com mensagem de permissão',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:403})))
  await expect(savePromotions([])).rejects.toThrow(/permissão/i)
 })
})

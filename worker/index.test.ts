import { describe, expect, it, vi } from 'vitest'
import worker from './index'
import { cookieName } from './crypto'

const cookie = cookieName+'='+'a'.repeat(64)
const owner={id:1,username:'Thiago Saraiva',display_name:'Thiago Saraiva',role:'OWNER',password_hash:'hash',password_salt:'salt',password_iterations:600000,is_active:1,must_change_password:0}
const viewer={...owner,id:2,username:'consulta',display_name:'Consulta',role:'VIEWER'}
const item = (overrides={})=>({code:'789',name:'Arroz',oldPrice:'R$ 20,00',price:'R$ 15,00',store:'Centro',start:'',end:'',detail:'',status:'ATIVA',...overrides})
function context(user:typeof owner | null = owner) {
 const statements:Array<{sql:string;params:unknown[]}>= []
 const db={
  prepare:vi.fn((sql:string)=>{
   const stmt={sql,params:[] as unknown[],bind(...values:unknown[]){this.params=values;return this},
     async first(){return sql.includes('FROM sessions s JOIN users')?user:sql.includes('FROM users WHERE role=')?{password_hash:'hash'}:sql.includes('FROM login_attempts')?null:null},
     async all(){return {results:sql.includes('FROM promotions pr')?[item()]:sql.includes('FROM users ORDER')?[owner,viewer]:[]}},
     async run(){return {meta:{changes:1}}}
   };return stmt
  }),
  batch:vi.fn(async (batch:Array<{sql:string;params:unknown[]}>)=>{statements.push(...batch);return batch.map(()=>({meta:{changes:1}}))})
 }
 const assets={fetch:vi.fn(async()=>new Response('website'))}
 return {db,env:{DB:db,ASSETS:assets},assets,statements}
}
function req(path:string,method='GET',body?:unknown,{authenticate=true,origin='https://example.com'}={}) {
 const headers:Record<string,string>={}
 if(authenticate)headers.Cookie=cookie
 if(method!=='GET'){headers.Origin=origin;headers['Content-Type']='application/json'}
 return new Request('https://example.com'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)})
}
describe('Worker com autenticação obrigatória',()=>{
 it('rejeita GET de promoções sem login (401)',async()=>{
  const {env,db}=context()
  const response=await worker.fetch(req('/api/promocoes','GET',undefined,{authenticate:false}),env)
  expect(response.status).toBe(401)
  expect(db.prepare).not.toHaveBeenCalled()
 })
 it('retorna promoções apenas à sessão válida',async()=>{
  const {env}=context()
  const response=await worker.fetch(req('/api/promocoes'),env)
  expect(response.status).toBe(200)
  expect((await response.json()).promotions).toEqual([item()])
 })
 it('serve assets sem consultar dados',async()=>{
  const {env,assets}=context()
  const response=await worker.fetch(req('/dashboard'),env)
  expect(response.status).toBe(200)
  expect(assets.fetch).toHaveBeenCalledOnce()
 })
 it('não aceita importação por chave antiga sem cookie',async()=>{
  const {env,db}=context()
  const r=req('/api/promocoes/import','POST',{promotions:[item()]},{authenticate:false})
  r.headers.set('Authorization','Bearer antigo')
  expect((await worker.fetch(r,env)).status).toBe(401)
  expect(db.batch).not.toHaveBeenCalled()
 })
 it('bloqueia usuário de consulta ao importar e administrar',async()=>{
  const {env,db}=context(viewer)
  expect((await worker.fetch(req('/api/promocoes/import','POST',{promotions:[item()]}),env)).status).toBe(403)
  expect((await worker.fetch(req('/api/admin/users'),env)).status).toBe(403)
  expect(db.batch).not.toHaveBeenCalled()
 })
 it('bloqueia requisição mutável com origem diferente',async()=>{
  const {env,db}=context()
  const response=await worker.fetch(req('/api/promocoes/import','POST',{promotions:[item()]},{origin:'https://attacker.com'}),env)
  expect(response.status).toBe(403)
  expect(db.batch).not.toHaveBeenCalled()
 })
 it('permite importação transacional ao proprietário',async()=>{
  const {env,db,statements}=context()
  const rows=[item(),item({store:'Norte'})]
  const response=await worker.fetch(req('/api/promocoes/import','POST',{promotions:rows}),env)
  expect(response.status).toBe(200)
  expect((await response.json()).count).toBe(2)
  expect(db.batch).toHaveBeenCalledOnce()
  expect(statements.filter(x=>/INSERT INTO promotions/.test(x.sql))).toHaveLength(2)
 })
 it('não altera base com lote inválido',async()=>{
  const {env,db}=context()
  expect((await worker.fetch(req('/api/promocoes/import','POST',{promotions:[item({status:'INVALIDO'})]}),env)).status).toBe(400)
  expect(db.batch).not.toHaveBeenCalled()
 })
 it('obriga usuário com senha temporária a mudar senha',async()=>{
  const {env}=context({...viewer,must_change_password:1})
  expect((await worker.fetch(req('/api/promocoes'),env)).status).toBe(403)
 })
 it('rejeita cookie inválido mesmo com header de autenticação',async()=>{
  const {env}=context()
  const r=req('/api/promocoes');r.headers.set('Cookie',cookieName+'=invalid')
  expect((await worker.fetch(r,env)).status).toBe(401)
 })
 it('não mostra erro SQL interno',async()=>{
  const {env,db}=context()
  db.batch.mockRejectedValueOnce(new Error('internal SQL error'))
  const r=await worker.fetch(req('/api/promocoes/import','POST',{promotions:[item()]}),env)
  expect(r.status).toBe(500)
  expect(await r.text()).not.toContain('internal SQL error')
 })
})

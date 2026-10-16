import {describe,expect,it,vi} from 'vitest'
import {createViewer,updateViewer,listUsers} from './users'
const owner={id:1,username:'Thiago Saraiva',display_name:'Thiago Saraiva',role:'OWNER',must_change_password:0}
const viewer={id:2,username:'consulta',display_name:'Consulta',role:'VIEWER',must_change_password:1}
function db(){
 const events:string[]=[]
 return {events,prepare(sql:string){
  const st={bind(...a:unknown[]){void a;return st},
   async first(){return sql.includes('WHERE id=')?viewer:viewer},
   async all(){return {results:[owner,viewer]}},
   async run(){events.push(sql);return {meta:{changes:1}}}
  };return st
 },async batch(stmts:unknown[]){return stmts.map(()=>({meta:{changes:1}}))}}
}
describe('administração protegida',()=>{
 it('lista usuários sem hashes ou senhas',async()=>{
  const users=await listUsers(db())
  expect(users).toHaveLength(2)
  expect(JSON.stringify(users)).not.toContain('password_hash')
  expect(users[0].role).toBe('OWNER')
 })
 it('cria apenas VIEWER, com senha temporária aleatória',async()=>{
  const target=db()
  const data=await createViewer(target,'consulta2','Novo usuário')
  expect(data.user.role).toBe('VIEWER')
  expect(data.temporaryPassword.length).toBeGreaterThanOrEqual(32)
  expect(target.events.some(x=>x.includes("'VIEWER'"))).toBe(true)
 })
 it('nega username inválido',async()=>{
  await expect(createViewer(db(),'x','Pessoa')).rejects.toThrow()
 })
 it('não usa nova senha estática ao redefinir',async()=>{
  const res=await updateViewer(db(),2,'reset-password')
  expect(res.status).toBe(200)
  const payload=await res.json()
  expect(payload.temporaryPassword.length).toBeGreaterThanOrEqual(32)
 })
 it('desativa viewer sem tocar owner',async()=>{
  const target=db()
  const res=await updateViewer(target,2,'deactivate')
  expect(res.status).toBe(200)
 })
})

import {describe,expect,it,vi} from 'vitest'
import {activateOwner,getOwnerSetupStatus,login,logout} from './auth'
import {digestSecret,hashPassword,readSessionCookie} from './crypto'

describe('ativação única e sessão de acesso',()=>{
 it('status do proprietário pendente quando sem senha',async()=>{
  const db={prepare:()=>({first:async()=>({password_hash:null})})}
  expect(await getOwnerSetupStatus(db as never)).toBe('pending')
 })
 it('rejeita código de ativação inválido',async()=>{
  const db={prepare:vi.fn()}
  const req=new Request('https://site.test/api/auth/activate-owner',{method:'POST',body:JSON.stringify({code:'bad',password:'SenhaSegura12345!'})})
  const res=await activateOwner(req,db as never)
  expect(res.status).toBe(400)
  expect(db.prepare).not.toHaveBeenCalled()
 })
 it('não permite login com credenciais incorretas',async()=>{
  const events:string[]=[]
  const db={prepare:(sql:string)=>{const st={bind(){return st},async first(){return null},async run(){events.push(sql);return {meta:{changes:1}}}};return st}}
  const req=new Request('https://site.test/api/auth/login',{method:'POST',body:JSON.stringify({username:'notfound',password:'wrong'})})
  const res=await login(req,db as never)
  expect(res.status).toBe(401)
  expect(res.headers.get('set-cookie')).toBeNull()
 })
 it('login correto cria cookie de sessão',async()=>{
  const secret='SenhaSegura12345!'
  const hashed=await hashPassword(secret,1000)
  const record={id:1,username:'Thiago Saraiva',display_name:'Thiago Saraiva',role:'OWNER',is_active:1,must_change_password:0,password_hash:hashed.hash,password_salt:hashed.salt,password_iterations:hashed.iterations}
  const db={prepare:(sql:string)=>{const st={bind(){return st},async first(){return sql.includes('FROM users WHERE username')?record:null},async run(){return {meta:{changes:1}}}};return st}}
  const req=new Request('https://site.test/api/auth/login',{method:'POST',body:JSON.stringify({username:'Thiago Saraiva',password:secret})})
  const res=await login(req,db as never)
  expect(res.status).toBe(200)
  expect(res.headers.get('set-cookie')).toContain('HttpOnly')
  const token=readSessionCookie(new Request('https://site.test',{headers:{Cookie:res.headers.get('set-cookie')!}}))
  expect(token?.length).toBe(64)
 })
 it('limita tentativas de ativação por origem',async()=>{
  const future=Math.floor(Date.now()/1000)+800
  const calls:string[]=[]
  const db={prepare:(sql:string)=>{
    calls.push(sql)
    const st={bind(..._:unknown[]){return st},async first(){
      if(sql.includes("FROM users WHERE role='OWNER'")) return {password_hash:null}
      if(sql.includes('FROM login_attempts')) return {failures:8,window_until:future}
      return null
    },async run(){return {meta:{changes:1}}}}
    return st
  }}
  const code='a'.repeat(64)
  const req=new Request('https://site.test/api/auth/activate-owner',{method:'POST',body:JSON.stringify({code,password:'SenhaForte123456'}),headers:{'CF-Connecting-IP':'192.0.2.1'}})
  const res=await activateOwner(req,db as never)
  expect(res.status).toBe(429)
  expect(calls.some(x=>x.includes('FROM owner_activations'))).toBe(false)
 })

})

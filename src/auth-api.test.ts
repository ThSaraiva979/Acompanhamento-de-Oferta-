import {afterEach,describe,expect,it,vi} from 'vitest'
import {getSession,login,logout,getSetupStatus,createViewer,updateViewer} from './auth-api'
afterEach(()=>vi.unstubAllGlobals())
const user={id:1,username:'Thiago Saraiva',displayName:'Thiago Saraiva',role:'OWNER',mustChangePassword:false}
describe('API de autenticação',()=>{
 it('não considera erro 401 uma sessão válida',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:401})))
  expect(await getSession()).toBeNull()
 })
 it('faz login com usuário e senha só no corpo, com cookies',async()=>{
  const mock=vi.fn(async()=>Response.json({user}))
  vi.stubGlobal('fetch',mock)
  expect((await login('Thiago Saraiva','test-secret')).role).toBe('OWNER')
  const [path,opts]=mock.mock.calls[0] as unknown as [string,RequestInit]
  expect(path).toBe('/api/auth/login')
  expect(opts.credentials).toBe('same-origin')
  expect(opts.body).toContain('Thiago Saraiva')
  expect((opts.headers as Record<string,string>).Authorization).toBeUndefined()
 })
 it('não publica tokens no estado de cliente',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({status:'complete'})))
  expect(await getSetupStatus()).toBe('complete')
 })
 it('envia logout ao servidor',async()=>{
  const mock=vi.fn(async()=>Response.json({success:true}))
  vi.stubGlobal('fetch',mock)
  await logout()
  expect(mock.mock.calls[0][0]).toBe('/api/auth/logout')
 })
 it('permite ao dono criar e alterar viewer',async()=>{
  const mock=vi.fn(async()=>Response.json({user:{...user,role:'VIEWER'},temporaryPassword:'temporary'}))
  vi.stubGlobal('fetch',mock)
  expect((await createViewer('teste','Consulta')).temporaryPassword).toBe('temporary')
  await updateViewer(2,'deactivate')
  expect(mock.mock.calls[1][0]).toBe('/api/admin/users/2')
 })
})

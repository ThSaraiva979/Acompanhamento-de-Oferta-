// @vitest-environment jsdom
import React from 'react'
import {cleanup,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest'
import App from './App'

const admin={id:1,username:'Thiago Saraiva',displayName:'Thiago Saraiva',role:'OWNER',mustChangePassword:false}
const viewer={...admin,id:2,username:'Consulta',displayName:'Consulta',role:'VIEWER'}
function mockApp(user:typeof admin|null=admin, promotions:unknown[]=[]){
 const mock=vi.fn(async(url:string)=>{
  if(url==='/api/auth/me')return user?Response.json({user}):new Response('',{status:401})
  if(url==='/api/auth/setup-status')return Response.json({status:'complete'})
  if(url==='/api/promocoes')return Response.json({promotions})
  if(url==='/api/auth/logout')return Response.json({success:true})
  return Response.json({})
 })
 vi.stubGlobal('fetch',mock)
 return mock
}
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
beforeEach(()=>{localStorage.clear();document.documentElement.removeAttribute('data-theme');mockApp()})

describe('acesso obrigatório',()=>{
 test('sem sessão mostra login e não consulta dados',async()=>{
  const mock=mockApp(null)
  render(<App/>)
  expect(await screen.findByRole('heading',{name:'Bem-vindo de volta'})).toBeTruthy()
  expect(screen.queryByText('Desconto médio')).toBeNull()
  expect(mock.mock.calls.some(([url])=>url==='/api/promocoes')).toBe(false)
 })
 test('autenticado entra no dashboard sem chave de importação',async()=>{
  render(<App/>)
  expect(await screen.findByText('Desconto médio')).toBeTruthy()
  await userEvent.setup().click(screen.getAllByRole('button',{name:'Importar planilha'})[0])
  expect(screen.queryByLabelText(/chave de importação/i)).toBeNull()
 })
 test('viewer não pode ver importação nem gerenciar usuários',async()=>{
  mockApp(viewer)
  render(<App/>)
  expect(await screen.findByText('Desconto médio')).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Importar planilha'})).toBeNull()
  expect(screen.queryByRole('button',{name:'Usuários'})).toBeNull()
 })
 test('usuário temporário vê tela para trocar senha',async()=>{
  mockApp({...viewer,mustChangePassword:true})
  render(<App/>)
  expect(await screen.findByRole('heading',{name:'Defina sua nova senha'})).toBeTruthy()
  expect(screen.queryByText('Desconto médio')).toBeNull()
 })
 test('logout mostra login',async()=>{
  const user=userEvent.setup()
  render(<App/>)
  await user.click(await screen.findByRole('button',{name:'Sair da conta'}))
  expect(await screen.findByRole('heading',{name:'Bem-vindo de volta'})).toBeTruthy()
 })
 test('navegação mantém aria-current',async()=>{
  const user=userEvent.setup()
  render(<App/>)
  const overview=await screen.findByRole('button',{name:'Visão geral'})
  const promos=screen.getByRole('button',{name:'Promoções'})
  expect(overview.getAttribute('aria-current')).toBe('page')
  await user.click(promos)
  expect(promos.getAttribute('aria-current')).toBe('page')
 })
 test('persistência conserva estado vazio e não usa dados demonstrativos',async()=>{
  render(<App/>)
  expect(await screen.findByText('0 registros exibidos')).toBeTruthy()
  expect(screen.queryByText('Coca-Cola 2L')).toBeNull()
 })
 test('mantém modo escuro',async()=>{
  const user=userEvent.setup()
  render(<App/>)
  const toggle=await screen.findByRole('button',{name:/ativar modo escuro/i})
  await user.click(toggle)
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem('theme')).toBe('dark')
 })
 test('mostra indicadores trazidos do D1',async()=>{
  mockApp(admin,[
   {code:'789456',name:'Coca-Cola 2L',oldPrice:'R$ 12,99',price:'R$ 8,99',store:'Loja Centro',start:'',end:'',detail:'',status:'ATIVA'},
   {code:'123789',name:'Arroz Tipo 1 5kg',oldPrice:'R$ 29,90',price:'R$ 24,90',store:'Loja Norte',start:'',end:'',detail:'',status:'BREVE'},
   {code:'456321',name:'Café Torrado 500g',oldPrice:'R$ 18,90',price:'R$ 14,99',store:'Loja Sul',start:'',end:'',detail:'',status:'ATIVA'},
   {code:'987654',name:'Detergente 500ml',oldPrice:'R$ 3,49',price:'R$ 2,49',store:'Loja Centro',start:'',end:'',detail:'',status:'ENCERRADA'}
  ])
  render(<App/>)
  expect(await screen.findByText('24.2%')).toBeTruthy()
 })
})

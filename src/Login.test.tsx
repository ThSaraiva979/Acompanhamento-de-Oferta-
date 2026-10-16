// @vitest-environment jsdom
import React from 'react'
import {render,screen,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {Login} from './Login'
import * as api from './auth-api'
vi.mock('./auth-api',()=>({login:vi.fn(),activateOwner:vi.fn(),changePassword:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
describe('tela de login',()=>{
 it('esconde senha por padrão e permite mostrar',async()=>{
  render(<Login setupStatus="complete" onAuthenticated={vi.fn()}/>)
  const input=screen.getByLabelText('Senha') as HTMLInputElement
  expect(input.type).toBe('password')
  await userEvent.setup().click(screen.getByRole('button',{name:'Mostrar senha'}))
  expect(input.type).toBe('text')
 })
 it('envia usuário e senha ao backend e autentica',async()=>{
  const user={id:1,username:'Thiago Saraiva',displayName:'Thiago Saraiva',role:'OWNER',mustChangePassword:false} as const
  vi.mocked(api.login).mockResolvedValue(user)
  const called=vi.fn()
  render(<Login setupStatus="complete" onAuthenticated={called}/>)
  const u=userEvent.setup()
  await u.type(screen.getByLabelText('Senha'),'SenhaForte12345!')
  await u.click(screen.getByRole('button',{name:'Entrar'}))
  expect(api.login).toHaveBeenCalledWith('Thiago Saraiva','SenhaForte12345!')
  expect(called).toHaveBeenCalledWith(user)
 })
 it('mostra ativação somente com setup pendente',async()=>{
  render(<Login setupStatus="pending" onAuthenticated={vi.fn()}/>)
  await userEvent.setup().click(screen.getByRole('button',{name:'Primeiro acesso do administrador'}))
  expect(screen.getByLabelText('Código de ativação')).toBeTruthy()
  expect(screen.getByLabelText('Confirmar nova senha')).toBeTruthy()
 })
})

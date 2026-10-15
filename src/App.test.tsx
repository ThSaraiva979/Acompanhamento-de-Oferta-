// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ promotions: [] })))
})

describe('alternância de tema', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  test('alterna entre tema claro e escuro e persiste a preferência', async () => {
    const user = userEvent.setup()
    render(<App />)

    const toggle = screen.getByRole('button', { name: /ativar modo escuro/i })

    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(toggle)

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(screen.getByRole('button', { name: /ativar modo claro/i })).toBeTruthy()
  })
})

describe('navegação principal', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  test('expõe semanticamente a página ativa ao navegar', async () => {
    const user = userEvent.setup()
    render(<App />)

    const overview = screen.getByRole('button', { name: 'Visão geral' })
    const promotions = screen.getByRole('button', { name: 'Promoções' })

    expect(overview.getAttribute('aria-current')).toBe('page')
    expect(promotions.getAttribute('aria-current')).toBeNull()

    await user.click(promotions)

    expect(promotions.getAttribute('aria-current')).toBe('page')
    expect(overview.getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Promoções', level: 1 })).toBeTruthy()
  })
})


describe('indicadores de pricing no dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  test('resume desconto, concentração e próximas promoções vindas do D1', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ promotions: [
      { code: '789456', name: 'Coca-Cola 2L', oldPrice: 'R$ 12,99', price: 'R$ 8,99', store: 'Loja Centro', start: '', end: '', detail: '', status: 'ATIVA' },
      { code: '123789', name: 'Arroz Tipo 1 5kg', oldPrice: 'R$ 29,90', price: 'R$ 24,90', store: 'Loja Norte', start: '', end: '', detail: '', status: 'BREVE' },
      { code: '456321', name: 'Café Torrado 500g', oldPrice: 'R$ 18,90', price: 'R$ 14,99', store: 'Loja Sul', start: '', end: '', detail: '', status: 'ATIVA' },
      { code: '987654', name: 'Detergente 500ml', oldPrice: 'R$ 3,49', price: 'R$ 2,49', store: 'Loja Centro', start: '', end: '', detail: '', status: 'ENCERRADA' },
    ] }))))
    render(<App />)

    expect(screen.getByText('Desconto médio')).toBeTruthy()
    expect(await screen.findByText('24.2%')).toBeTruthy()

    const summary = screen.getByRole('region', { name: 'Resumo estratégico' })
    expect(summary.textContent).toContain('Maior desconto')
    expect(summary.textContent).toContain('30.8%')
    expect(summary.textContent).toContain('Loja Centro')
    expect(summary.textContent).toContain('2 promoções')
    expect(summary.textContent).toContain('1 promoção em breve')
  })
})

describe('persistência D1', () => {
  test('mostra a base vazia em vez de dados demonstrativos', async () => {
    render(<App />)
    expect(await screen.findByText('0 registros exibidos')).toBeTruthy()
    expect(screen.queryByText('Coca-Cola 2L')).toBeNull()
  })

  test('solicita chave de importação sem salvá-la no localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Importar planilha' }))
    const input = screen.getByRole('textbox', { name: /chave de importação/i }) as HTMLInputElement
    await user.type(input, 'minha-chave')
    expect(input.value).toBe('minha-chave')
    expect(localStorage.getItem('import-token')).toBeNull()
  })
})

// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import App from './App'

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

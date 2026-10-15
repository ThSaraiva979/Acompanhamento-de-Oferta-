import { describe, expect, it } from 'vitest'
import { parseMoney, formatImportedPrice } from './prices'

describe('preços de planilhas brasileiras e Excel', () => {
  it('entende preços brasileiros com milhar e centavos', () => {
    expect(parseMoney('R$ 1.234,56')).toBe(1234.56)
    expect(parseMoney('R$ 8,99')).toBe(8.99)
  })

  it('entende preço numérico decimal exportado pelo Excel', () => {
    expect(parseMoney('8.99')).toBe(8.99)
    expect(formatImportedPrice('8.99')).toBe('R$ 8,99')
  })

  it('formata valores para exibição em reais, sem perder milhares', () => {
    expect(formatImportedPrice('1.234,56')).toBe('R$ 1.234,56')
    expect(formatImportedPrice('')).toBe('')
  })

  it('trata entrada inválida como dado não numérico', () => {
    expect(parseMoney('indisponível')).toBe(0)
    expect(formatImportedPrice('indisponível')).toBe('indisponível')
  })
})

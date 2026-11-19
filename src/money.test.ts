import { describe, expect, it } from 'vitest'
import { amountText, approx, currencyHeading, decimalsOf, money, parseAmount, percentOf, rateText } from './money'

describe('money', () => {
  it('uses symbols and the right decimals', () => {
    expect(money(79464.4, 'TWD')).toBe('NT$79,464')
    expect(money(54000, 'JPY')).toBe('¥54,000')
    expect(money(1260, 'USD')).toBe('$1,260.00')
    expect(money(12.345, 'USD')).toBe('$12.35')
    expect(money(5000, 'KRW')).toBe('₩5,000')
    expect(money(12.5, 'CHF')).toBe('CHF 12.50')
  })

  it('keeps the sign and never writes minus zero', () => {
    expect(money(-120, 'USD')).toBe('−$120.00')
    expect(money(-30536.4, 'TWD')).toBe('−NT$30,536')
    expect(money(-0.2, 'TWD')).toBe('NT$0')
  })

  it('drops decimals when asked', () => {
    expect(money(2483.25, 'USD', { whole: true })).toBe('$2,483')
  })

  it('knows each currency’s decimals and heading', () => {
    expect(decimalsOf('JPY')).toBe(0)
    expect(decimalsOf('TWD')).toBe(0)
    expect(decimalsOf('USD')).toBe(2)
    expect(amountText(-1234.5, 'USD')).toBe('1,234.50')
    expect(currencyHeading('JPY')).toBe('¥ JPY')
    expect(currencyHeading('CHF')).toBe('CHF')
    expect(approx(11340, 'TWD')).toBe('≈ NT$11,340')
  })

  it('reads typed amounts', () => {
    expect(parseAmount('54,000')).toBe(54000)
    expect(parseAmount(' ¥54000 ')).toBe(54000)
    expect(parseAmount('1260.5')).toBe(1260.5)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
  })

  it('writes rates and percentages', () => {
    expect(rateText(0.21)).toBe('0.21')
    expect(rateText(32)).toBe('32')
    expect(rateText(0.21 / 32)).toBe('0.0065625')
    expect(percentOf(30536, 110000)).toBe('28%')
    expect(percentOf(5, null)).toBeNull()
    expect(percentOf(5, 0)).toBeNull()
  })
})

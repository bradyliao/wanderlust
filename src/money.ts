// Money as text (items 54–56): a symbol for the common currencies (NT$, ¥, $),
// no decimals for currencies that have none in practice (JPY, TWD, …), two for
// the rest (USD). Pure functions, tested in money.test.ts.

const SYMBOLS: Record<string, string> = { TWD: 'NT$', USD: '$', JPY: '¥', EUR: '€', GBP: '£', KRW: '₩' }

/** Currencies written without decimals. TWD has cents on paper but nobody uses them. */
const WHOLE = new Set(['JPY', 'TWD', 'KRW', 'VND', 'IDR', 'CLP', 'ISK', 'HUF'])

export const currencySymbol = (currency: string): string => SYMBOLS[currency] ?? ''

/** Decimals shown for a currency: 0 for JPY, TWD and the like, else 2. */
export const decimalsOf = (currency: string): number => (WHOLE.has(currency) ? 0 : 2)

/** `12,345` or `1,260.50` with the currency's decimals, no symbol. */
export function amountText(amount: number, currency: string, whole = false): string {
  const d = whole ? 0 : decimalsOf(currency)
  return Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/**
 * `NT$79,464`, `¥54,000`, `$1,260.00`; `KRW 5,000` → `₩5,000`; an unknown code
 * is written before the number (`CHF 12.50`). Negative amounts keep their sign.
 * `whole` drops the decimals (the top bar's running total).
 */
export function money(amount: number, currency: string, opts: { whole?: boolean } = {}): string {
  const d = opts.whole ? 0 : decimalsOf(currency)
  const rounded = Number(amount.toFixed(d))
  const symbol = SYMBOLS[currency] ?? `${currency} `
  return `${rounded < 0 ? '−' : ''}${symbol}${amountText(rounded, currency, opts.whole)}`
}

/** `≈ NT$11,340` for an amount converted with a typed-in rate. */
export const approx = (amount: number, currency: string): string => `≈ ${money(amount, currency)}`

/** Column heading for a currency: `¥ JPY`, `$ USD`, `CHF`. */
export function currencyHeading(currency: string): string {
  const symbol = SYMBOLS[currency]
  return symbol ? `${symbol} ${currency}` : currency
}

/**
 * Read an amount typed by the user: `54,000`, `¥54000`, ` 1260.5 `. Null when
 * empty or not a number of 0 or more.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s,]/g, '').replace(/^[^\d.-]+/, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** A rate as typed: up to 6 significant digits, no trailing zeros (`0.21`, `32`, `0.00656`). */
export function rateText(rate: number): string {
  return String(Number(rate.toPrecision(6)))
}

/** `28%` of a whole; null when there is no whole. */
export function percentOf(part: number, whole: number | null): string | null {
  if (whole == null || whole <= 0) return null
  return `${Math.round((part / whole) * 100)}%`
}

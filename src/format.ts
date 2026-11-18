// Display helpers: dates as numbers (12/02), money, labels.

import type { Author, Group, Mode } from './types'

/** Travel modes in Google Maps order, with their labels (item 33). */
export const MODES: { id: Mode; label: string }[] = [
  { id: 'drive', label: 'Drive' },
  { id: 'transit', label: 'Transit' },
  { id: 'walk', label: 'Walk' },
  { id: 'twoWheeler', label: 'Two-wheeler' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'ride', label: 'Ride / taxi' },
]

export const modeLabel = (mode: Mode) => MODES.find((m) => m.id === mode)?.label ?? mode

/** The six groups in display order (item 81). */
export const GROUPS: { id: Group; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'activity', label: 'Activity' },
  { id: 'transport', label: 'Transport' },
  { id: 'lodging', label: 'Lodging' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'other', label: 'Other' },
]

export const groupLabel = (group: Group) => GROUPS.find((g) => g.id === group)?.label ?? group

/** `2026-12-02` → `12/02`. */
export function monthDay(date: string): string {
  const [, m, d] = date.split('-')
  return `${m}/${d}`
}

/** `12/02–12/06/2026`; with the year on both ends when they differ. */
export function dateRange(start: string, end: string): string {
  const ys = start.slice(0, 4)
  const ye = end.slice(0, 4)
  if (ys === ye) return `${monthDay(start)}–${monthDay(end)}/${ye}`
  return `${monthDay(start)}/${ys}–${monthDay(end)}/${ye}`
}

const SYMBOLS: Record<string, string> = { TWD: 'NT$', USD: 'US$', JPY: '¥' }

/** `NT$79,464`. Whole units; negative amounts keep their sign. */
export function money(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `
  const n = Math.round(amount)
  const text = Math.abs(n).toLocaleString('en-US')
  return `${n < 0 ? '−' : ''}${symbol}${text}`
}

/** Top bar budget: `NT$x / NT$y`, or "No budget". */
export function budgetLine(planned: number, budget: number | null, currency: string): string {
  if (budget == null) return planned > 0 ? `${money(planned, currency)} · No budget` : 'No budget'
  return `${money(planned, currency)} / ${money(budget, currency)}`
}

export function authorLabel(author: Author): string {
  if (author.type === 'user') return 'You'
  return author.source ? `AI (${author.source})` : 'AI'
}

/** ISO timestamp → `11/19 14:05` in local time. */
export function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** A file name for an exported trip: `tokyo-kyoto.trip.json`. */
export function tripFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'trip'}.trip.json`
}

import { describe, expect, it } from 'vitest'
import { authorLabel, budgetLine, dateRange, money, monthDay, tripFileName } from './format'
import { DEFAULT_PREFS, loadPrefs, parsePrefs, savePrefs } from './prefs'
import { sortSummaries } from './storage'

describe('format', () => {
  it('writes dates as numbers', () => {
    expect(monthDay('2026-12-02')).toBe('12/02')
    expect(dateRange('2026-12-02', '2026-12-06')).toBe('12/02–12/06/2026')
    expect(dateRange('2026-12-30', '2027-01-03')).toBe('12/30/2026–01/03/2027')
  })

  it('writes money and the top bar budget', () => {
    expect(money(79464.4, 'TWD')).toBe('NT$79,464')
    expect(money(-120, 'USD')).toBe('−$120.00')
    expect(money(5, 'CHF')).toBe('CHF 5.00')
    expect(budgetLine(79464, 110000, 'TWD')).toBe('NT$79,464 / NT$110,000')
    expect(budgetLine(0, null, 'TWD')).toBe('No budget')
    expect(budgetLine(500, null, 'TWD')).toBe('NT$500 · No budget')
  })

  it('names who made a change', () => {
    expect(authorLabel({ type: 'user' })).toBe('You')
    expect(authorLabel({ type: 'ai', source: 'dinner.json' })).toBe('AI (dinner.json)')
    expect(authorLabel({ type: 'ai', source: null })).toBe('AI')
  })

  it('makes export file names', () => {
    expect(tripFileName('Tokyo & Kyoto')).toBe('tokyo-kyoto.trip.json')
    expect(tripFileName('東京 2026')).toBe('東京-2026.trip.json')
    expect(tripFileName('  !! ')).toBe('trip.trip.json')
  })
})

describe('prefs', () => {
  it('falls back to defaults on missing or broken values', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('{oops')).toEqual(DEFAULT_PREFS)
    const p = parsePrefs(JSON.stringify({ layout: 'columns', placesWidth: 'wide', timetableShare: 5, collapsed: { map: true } }))
    expect(p.layout).toBe('columns')
    expect(p.placesWidth).toBe(DEFAULT_PREFS.placesWidth)
    expect(p.timetableShare).toBe(0.9)
    expect(p.collapsed).toEqual({ places: false, timetable: false, map: true })
  })

  it('keeps the timetable view and sizes within limits (item 44)', () => {
    const p = parsePrefs(JSON.stringify({ timetableView: 'list', columnWidth: 9999, hourHeight: 3 }))
    expect(p.timetableView).toBe('list')
    expect(p.columnWidth).toBe(420)
    expect(p.hourHeight).toBe(24)
    expect(parsePrefs(JSON.stringify({ timetableView: 'week', columnWidth: 200.4 })).timetableView).toBe('days')
    expect(parsePrefs(JSON.stringify({ columnWidth: 200.4 })).columnWidth).toBe(200)
  })

  it('works when localStorage is not available', () => {
    expect(() => savePrefs(DEFAULT_PREFS)).not.toThrow()
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
  })
})

describe('storage', () => {
  it('lists the newest saved trip first', () => {
    const s = (id: string, savedAt: string) => ({ id, name: id, startDate: '2026-12-02', endDate: '2026-12-06', savedAt })
    expect(sortSummaries([s('a', '2026-11-18T10:00:00Z'), s('b', '2026-11-19T09:00:00Z')]).map((t) => t.id)).toEqual(['b', 'a'])
  })
})

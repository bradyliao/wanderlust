import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  bookingCommands,
  bookingDate,
  bookingSections,
  clockInput,
  deadlineText,
  deadlinesSoon,
  emptyFields,
  fieldsFromItem,
  groupCounts,
  mapsLink,
  maskConfirmation,
  nightDates,
  parseClock,
  rowMeta,
  staySpan,
  timetableSpot,
  tripCurrencies,
  whenText,
} from './bookings'
import { amountIn, budgetSegments, currenciesInUse, dayColumns, estimateCommand, groupBar, sourceLabel, today } from './budget'
import * as core from './core'
import type { Trip } from './types'

beforeAll(() => {
  core.loadCoreSync(readFileSync(new URL('../core/pkg/wanderlust_core_bg.wasm', import.meta.url)))
})

/** The invented sample trip (docs/samples), as the app would load it. */
function sample(): Trip {
  const t = core.newTrip('Tokyo & Kyoto', '2026-12-02', '2026-12-06')
  const text = readFileSync(new URL('../docs/samples/sample-trip.changes.json', import.meta.url), 'utf8')
  return core.applyChangeFile(t, text, 'sample').trip
}

const item = (t: Trip, id: string) => t.items.find((i) => i.id === id)!

describe('booking helpers', () => {
  it('reads and writes times and dates', () => {
    expect(parseClock('09:30')).toBe(570)
    expect(parseClock('9:05')).toBe(545)
    expect(parseClock('24:00')).toBe(1440)
    expect(parseClock('25:00')).toBeNull()
    expect(parseClock('')).toBeNull()
    expect(clockInput(570)).toBe('09:30')
    expect(clockInput(null)).toBe('')
    expect(nightDates({ checkInDate: '2026-12-02', checkOutDate: '2026-12-05' })).toEqual(['2026-12-02', '2026-12-03', '2026-12-04'])
    expect(nightDates({ checkInDate: '2026-12-31', checkOutDate: '2027-01-01' })).toEqual(['2026-12-31'])
    expect(deadlineText('2026-11-25 23:59')).toBe('11/25 23:59')
    expect(maskConfirmation('SAMPLE1')).toBe('••••E1')
    expect(maskConfirmation('A')).toBe('••••')
  })

  it('puts bookings in date order with undated ones last', () => {
    const t = sample()
    const sections = bookingSections(t)
    expect(sections.map((s) => s.date)).toEqual(['2026-12-02', '2026-12-05', null])
    expect(sections[0].heading).toEqual({ date: '12/02', weekday: 'WED', city: 'Tokyo' })
    // Shinkansen 9:00 before the Kyoto check-in at 18:15.
    expect(sections[1].items.map((i) => i.id)).toEqual(['i-shinkansen', 'i-stay2'])
    expect(sections[2].items.map((i) => i.id)).toEqual(['i-flights'])
    expect(bookingSections(t, 'lodging').flatMap((s) => s.items.map((i) => i.id))).toEqual(['i-stay1', 'i-stay2'])
    const counts = groupCounts(t)
    expect(counts.all).toBe(4)
    expect(counts.transport).toBe(2)
    expect(counts.food).toBe(0)
  })

  it('says when and whether it is on the timetable', () => {
    const t = sample()
    expect(whenText(item(t, 'i-stay1'))).toBe('12/02 → 12/05')
    expect(whenText(item(t, 'i-shinkansen'))).toBe('12/05 9:00–11:15')
    expect(whenText(item(t, 'i-flights'))).toBe('No date')
    expect(whenText({ id: 'x', title: 'Sushi', kind: 'food', booking: { kind: 'food', date: '2026-12-05' } })).toBe('12/05 · no time yet')
    expect(timetableSpot(item(t, 'i-stay1'))).toEqual({ date: '2026-12-02', start: 1190 })
    expect(timetableSpot(item(t, 'i-flights'))).toBeNull()
    expect(bookingDate(item(t, 'i-stay2'))).toBe('2026-12-05')
    expect(rowMeta(item(t, 'i-stay1'))).toMatch(/^3 nights · check-in from 15:00 · conf\. ••••/)
  })

  it('draws a stay across its nights and finds deadlines coming up', () => {
    const t = sample()
    // Five trip days 12/02–12/06; nights 12/02–12/04 are the first three fifths.
    expect(staySpan(item(t, 'i-stay1').stay!, t)).toEqual({ from: 0, to: 0.6 })
    const withDeadline: Pick<Trip, 'items'> = {
      items: [
        { id: 'a', title: 'A', kind: 'lodging', booking: { kind: 'lodging', cancelDeadline: '2026-11-27 23:59' } },
        { id: 'b', title: 'B', kind: 'lodging', booking: { kind: 'lodging', cancelDeadline: '2026-11-25 23:59' } },
        { id: 'c', title: 'C', kind: 'lodging', booking: { kind: 'lodging', cancelDeadline: '2026-12-25 10:00' } },
        { id: 'd', title: 'D', kind: 'lodging', booking: { kind: 'lodging', cancelDeadline: '2026-11-01 10:00' } },
      ],
    }
    expect(deadlinesSoon(withDeadline, '2026-11-19').map((d) => d.item.id)).toEqual(['b', 'a'])
  })

  it('links to Google Maps and lists the price currencies', () => {
    const t = sample()
    const hotel = t.places.find((p) => p.id === 'p-hotel1')
    expect(mapsLink(item(t, 'i-stay1'), hotel)).toContain('google.com/maps')
    expect(mapsLink({ id: 'x', title: 'X', kind: 'food', booking: { kind: 'food', address: '1-2 Ginza' } }, undefined)).toBe(
      'https://www.google.com/maps/search/?api=1&query=1-2%20Ginza',
    )
    expect(tripCurrencies(t)).toEqual(['TWD', 'JPY', 'USD'])
  })
})

describe('booking form', () => {
  it('adds a timed booking as a fixed block, accepted by the core', () => {
    const t = sample()
    const f = { ...emptyFields(t), kind: 'food' as const, title: 'Sushi dinner', date: '2026-12-05', start: '19:00', amount: '27000', currency: 'JPY', perPerson: false }
    const r = bookingCommands(f, 'b-1')
    if ('error' in r) throw new Error(r.error)
    const next = core.applyCommands(t, r.commands, core.userStamp('Add booking'))
    const added = item(next, 'b-1')
    expect(added.slot).toMatchObject({ date: '2026-12-05', start: 1140, end: 1200, fixed: true, fixedReason: 'Ticket booked' })
    expect(added.booking?.kind).toBe('food')
    expect(added.cost).toMatchObject({ amount: 27000, currency: 'JPY', status: 'booked' })
  })

  it('adds a date-only booking and a stay', () => {
    const t = sample()
    const dateOnly = bookingCommands({ ...emptyFields(t), kind: 'food', title: 'Sushi', date: '2026-12-05' }, 'b-2')
    if ('error' in dateOnly) throw new Error(dateOnly.error)
    expect(dateOnly.commands[0]).toMatchObject({ op: 'addItem', item: { slot: null, booking: { date: '2026-12-05' } } })
    const stay = bookingCommands({ ...emptyFields(t), title: 'Ryokan', checkInDate: '2026-12-05', checkOutDate: '2026-12-06', checkInFrom: '15:00', amount: '20000', currency: 'JPY', perNight: true }, 'b-3')
    if ('error' in stay) throw new Error(stay.error)
    const next = core.applyCommands(t, stay.commands, core.userStamp('Add booking'))
    expect(item(next, 'b-3').stay).toMatchObject({ checkInDate: '2026-12-05', checkOutDate: '2026-12-06', checkInFrom: 900, checkIn: null })
  })

  it('refuses incomplete forms in plain words', () => {
    const t = sample()
    expect(bookingCommands({ ...emptyFields(t), title: '' }, 'x')).toEqual({ error: 'Give the booking a title.' })
    expect(bookingCommands({ ...emptyFields(t), title: 'Hotel' }, 'x')).toEqual({ error: 'A stay needs check-in and check-out dates.' })
    expect(bookingCommands({ ...emptyFields(t), kind: 'food', title: 'X', date: '2026-12-05', start: '19:00', end: '18:00' }, 'x')).toEqual({
      error: 'The end time must be after the start.',
    })
    expect(bookingCommands({ ...emptyFields(t), kind: 'food', title: 'X', amount: 'abc' }, 'x')).toEqual({ error: 'The price is not a number of 0 or more.' })
  })

  it('edits only what changed, and moves a fixed booked block', () => {
    const t = sample()
    const train = item(t, 'i-shinkansen')
    const unchanged = bookingCommands(fieldsFromItem(train, t), train.id, train)
    expect(unchanged).toEqual({ commands: [] })
    const later = bookingCommands({ ...fieldsFromItem(train, t), start: '10:00', end: '12:15' }, train.id, train)
    if ('error' in later) throw new Error(later.error)
    expect(later.commands.map((c) => c.op)).toEqual(['updateItem', 'setFixed'])
    const next = core.applyCommands(t, later.commands, core.userStamp('Edit booking'))
    expect(item(next, train.id).slot).toMatchObject({ start: 600, end: 735, fixed: true, fixedReason: 'Ticket booked' })
  })

  it('keeps the replaced estimate when booking a price', () => {
    const t = sample()
    const souvenirs = item(t, 'i-souvenirs')
    const f = { ...fieldsFromItem(souvenirs, t), kind: 'shopping' as const, date: '2026-12-04', amount: '8000', status: 'booked' as const }
    const r = bookingCommands(f, souvenirs.id, souvenirs)
    if ('error' in r) throw new Error(r.error)
    const next = core.applyCommands(t, r.commands, core.userStamp('Book'))
    expect(item(next, souvenirs.id).cost?.replacedEstimate).toEqual({ amount: 9000, currency: 'JPY' })
  })
})

describe('budget helpers', () => {
  it('fills bars against the limit or the largest group', () => {
    expect(groupBar(6000, 12000, 50000)).toEqual({ fill: 0.5, over: false })
    expect(groupBar(15000, 12000, 50000)).toEqual({ fill: 1, over: true })
    expect(groupBar(10000, null, 40000)).toEqual({ fill: 0.25, over: false })
    expect(groupBar(0, null, 0)).toEqual({ fill: 0, over: false })
  })

  it('shapes the budget bar and the per-day chart from the core summary', () => {
    const s = core.budgetSummary(sample())
    const segs = budgetSegments(s)
    expect(segs.map((x) => x.group)).toEqual(s.groups.filter((g) => g.home > 0).map((g) => g.group))
    expect(segs.reduce((a, x) => a + x.fraction, 0)).toBeCloseTo(s.planned / Math.max(s.budget ?? 0, s.planned))
    const cols = dayColumns(s)
    expect(cols.slice(0, 5).map((c) => c.label)).toEqual(['12/02', '12/03', '12/04', '12/05', '12/06'])
    // Flights, souvenirs and local travel have no date.
    expect(cols[cols.length - 1]).toMatchObject({ key: 'undated', label: 'No date' })
    const tallest = Math.max(...cols.map((c) => c.home))
    const top = cols.find((c) => c.home === tallest)!
    expect(top.segments.reduce((a, x) => a + x.fraction, 0)).toBeCloseTo(1)
  })

  it('knows which currencies are in use and labels sources', () => {
    const t = sample()
    expect([...currenciesInUse(t)].sort()).toEqual(['JPY', 'USD'])
    expect(sourceLabel('budget')).toBe('added on Budget')
    expect(amountIn({ amount: 5, currency: 'JPY' }, 'JPY')).toBe(5)
    expect(amountIn({ amount: 5, currency: 'JPY' }, 'USD')).toBeNull()
    expect(today(new Date(2026, 10, 9))).toBe('2026-11-09')
  })

  it('adds an estimated cost the core accepts', () => {
    const t = sample()
    const r = estimateCommand({ title: 'Onsen day', kind: 'other', amount: '3,000', currency: 'JPY', date: '2026-12-04' }, 'e-1')
    if ('error' in r) throw new Error(r.error)
    const s = core.budgetSummary(core.applyCommands(t, [r.command], core.userStamp('Add cost')))
    expect(s.rows.find((x) => x.itemId === 'e-1')).toMatchObject({ status: 'estimated', source: 'budget', dateLabel: '12/04', amount: 3000 })
    expect(estimateCommand({ title: '', kind: 'other', amount: '1', currency: 'JPY', date: '' }, 'e')).toEqual({ error: 'Give the cost a name.' })
  })
})

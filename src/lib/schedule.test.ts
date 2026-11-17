import { describe, expect, it } from 'vitest'
import { sampleTrip } from '../sample'
import { readTrip } from '../store'
import { buildGuideHtml } from './guide'
import { budget, dayBlocks, dayLegs, estimateLeg, parseLatLng, swapDays, tripWarnings } from './schedule'
import { fmtTime, parseTime, tripDays, weekdayName } from './time'

describe('time', () => {
  it('lists every day of the trip inclusive', () => {
    expect(tripDays({ startDate: '2026-11-28', endDate: '2026-12-01' })).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'])
    expect(tripDays({ startDate: '2026-12-02', endDate: '2026-12-01' })).toEqual([])
  })
  it('formats and parses clock times', () => {
    expect(fmtTime(570)).toBe('09:30')
    expect(parseTime('09:30')).toBe(570)
    expect(parseTime('')).toBeUndefined()
    expect(weekdayName('2026-11-28')).toBe('Sat')
  })
})

describe('legs', () => {
  const trip = sampleTrip()
  const place = (id: string) => trip.places.find((p) => p.id === id)!

  it('walks short hops and rides long ones', () => {
    expect(estimateLeg(place('sensoji'), place('kappabashi'), 'standard').mode).toBe('walk')
    expect(estimateLeg(place('sensoji'), place('shibuyasky'), 'standard').mode).toBe('transit')
  })
  it('gives a relaxed pace more time than a packed one', () => {
    const relaxed = estimateLeg(place('sensoji'), place('kappabashi'), 'relaxed').minutes
    const packed = estimateLeg(place('sensoji'), place('kappabashi'), 'packed').minutes
    expect(relaxed).toBeGreaterThan(packed)
  })
  it('uses what the user entered instead of the estimate', () => {
    const leg = dayLegs(trip, '2026-11-28').find((l) => l.key === 'b1>b2')!
    expect(leg).toMatchObject({ minutes: 50, verified: true, cost: 600, gap: 60, tight: false })
    expect(dayLegs(trip, '2026-11-28').filter((l) => !l.verified).length).toBeGreaterThan(0)
  })
})

describe('warnings', () => {
  it('flags overlaps, closed days, opening hours and tight transfers', () => {
    const trip = sampleTrip()
    // Monday 30 Nov: the museum is closed on Mondays.
    trip.blocks.push({ id: 'x1', day: '2026-11-30', start: 18 * 60, end: 19 * 60, placeId: 'tnm', title: 'Museum', category: 'sight' })
    // Starts before the previous block ends, and after the garden has closed.
    trip.blocks.push({ id: 'x2', day: '2026-11-29', start: 17 * 60, end: 18 * 60, placeId: 'rikugien', title: 'Garden again', category: 'sight' })
    // Five minutes to cross the city.
    trip.blocks.push({ id: 'x3', day: '2026-12-01', start: 18 * 60 + 20, end: 19 * 60, placeId: 'skytree', title: 'Skytree', category: 'sight' })
    const ids = tripWarnings(trip).map((w) => w.id)
    expect(ids).toContain('closed:x1')
    expect(ids).toContain('overlap:b8:x2')
    expect(ids).toContain('late:x2')
    expect(ids).toContain('tight:b16>x3')
  })
})

describe('swapping days', () => {
  it('exchanges the blocks of two days and nothing else', () => {
    const trip = sampleTrip()
    const a = dayBlocks(trip, '2026-11-29').map((b) => b.id)
    const b = dayBlocks(trip, '2026-11-30').map((x) => x.id)
    const swapped = swapDays(trip, '2026-11-29', '2026-11-30')
    expect(dayBlocks(swapped, '2026-11-30').map((x) => x.id)).toEqual(a)
    expect(dayBlocks(swapped, '2026-11-29').map((x) => x.id)).toEqual(b)
    expect(dayBlocks(swapped, '2026-11-28')).toEqual(dayBlocks(trip, '2026-11-28'))
  })
})

describe('budget', () => {
  it('adds block costs and checked fares per person', () => {
    const totals = budget(sampleTrip())
    expect(totals.perPerson).toBe(2500 + 2400 + 300 + 500 + 2500 + 3000 + 600)
    expect(totals.byCategory.find((r) => r.label === 'transport')?.perPerson).toBe(600)
    expect(totals.byDay).toHaveLength(4)
  })
})

describe('pasted locations', () => {
  it('reads coordinates from links and plain pairs', () => {
    expect(parseLatLng('35.7148, 139.7967')).toEqual({ lat: 35.7148, lng: 139.7967 })
    expect(parseLatLng('https://www.google.com/maps/place/X/@35.7148,139.7967,17z')).toEqual({ lat: 35.7148, lng: 139.7967 })
    expect(parseLatLng('https://www.google.com/maps/place/X/@35.1,139.1,17z/data=!3d35.7148!4d139.7967')).toEqual({ lat: 35.7148, lng: 139.7967 })
    expect(parseLatLng('Senso-ji')).toBeUndefined()
  })
})

describe('opening a trip file', () => {
  it('rejects things that are not trips', () => {
    expect(readTrip({ name: 'x' })).toBeUndefined()
    expect(readTrip(null)).toBeUndefined()
  })
  it('upgrades a file saved before ratings replaced named travellers', () => {
    const { partySize: _partySize, ...old } = sampleTrip()
    const legacy = { ...old, travelers: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], places: old.places.map((p) => ({ ...p, wishes: { a: 'want' } })) }
    const trip = readTrip(legacy)!
    expect(trip.partySize).toBe(3)
    expect('travelers' in trip).toBe(false)
    expect('wishes' in trip.places[0]).toBe(false)
    expect(trip.places[0].rating).toBe(old.places[0].rating)
  })
})

describe('trip guide', () => {
  it('cannot be broken out of by text in the trip', () => {
    const trip = sampleTrip()
    trip.name = '</script><script>alert(1)</script>'
    trip.blocks[0].note = '</script><img src=x onerror=alert(1)>'
    const html = buildGuideHtml(trip)
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('<img src=x')
    expect(html.match(/<\/script>/g)).toHaveLength(2)
  })
})

import { describe, expect, it } from 'vitest'
import type { Block, LegView, Mode, PlanDay, Place } from '../types'
import {
  boundsOf,
  dashFor,
  dayStops,
  defaultHighlight,
  fitPoints,
  legendModes,
  legLines,
  mapInfo,
  mapPins,
  primaryDate,
  svgDash,
  toggleDate,
  toggleGroup,
} from './mapData'

const place = (id: string, over: Partial<Place> = {}): Place => ({ id, name: id.toUpperCase(), kind: 'sight', rating: 'mustGo', lat: 35.7, lng: 139.8, ...over })

const block = (key: string, placeId: string | null, start: number): Block => ({
  key,
  itemId: key,
  part: 'main',
  title: key,
  date: '',
  start,
  end: start + 60,
  fixed: false,
  reason: null,
  placeId,
})

const leg = (from: string, to: string, mode: Mode, line: [number, number][] = []): LegView => ({
  date: '',
  fromKey: `i-${from}`,
  toKey: `i-${to}`,
  fromPlaceId: from,
  toPlaceId: to,
  fromEnd: 0,
  toStart: 0,
  gapMinutes: 30,
  tight: false,
  travel: { mode, minutes: 10, source: 'estimate', distanceKm: 1, walkHint: null, options: [], line, mapsUrl: null },
})

const day = (date: string, blocks: Block[], legs: LegView[] = []): PlanDay => ({
  date,
  label: date.slice(5).replace('-', '/'),
  weekday: 'Wed',
  city: null,
  mode: 'transit',
  modeIsOverride: false,
  blocks: blocks.map((b) => ({ ...b, date })),
  legs: legs.map((l) => ({ ...l, date })),
  night: null,
  warnings: [],
  location: null,
  sun: null,
  daylight: [],
})

const places = [
  place('a', { lng: 139.79, lat: 35.71 }),
  place('b', { lng: 139.81, lat: 35.69, kind: 'food' }),
  place('c', { lng: 139.7, lat: 35.66 }),
  place('nopos', { lat: null, lng: null }),
  place('forgot', { rating: 'forget' }),
  place('cafe', { kind: 'cafe', lng: 139.6, lat: 35.6 }),
]
const D1 = '2026-12-02'
const D2 = '2026-12-03'
const days = [
  // Out of order on purpose: numbering follows time.
  day(D1, [block('i-b', 'b', 660), block('i-a', 'a', 540), block('i-nopos', 'nopos', 600), block('i-book', null, 700)], [leg('a', 'b', 'walk')]),
  day(D2, [block('i-c', 'c', 540), block('i-a2', 'a', 720)], [leg('c', 'a', 'transit', [[139.7, 35.66], [139.75, 35.7], [139.79, 35.71]])]),
]

describe('highlight chips (item 40)', () => {
  it('defaults to the focus day and every group', () => {
    expect(defaultHighlight(D1)).toEqual({ dates: [D1], groups: null })
    expect(defaultHighlight(null)).toEqual({ dates: [], groups: null })
  })

  it('switches days on and off, keeping trip order', () => {
    const order = [D1, D2]
    const both = toggleDate({ dates: [D2], groups: null }, D1, order)
    expect(both.dates).toEqual([D1, D2])
    expect(toggleDate(both, D2, order).dates).toEqual([D1])
    expect(toggleDate({ dates: [D1], groups: null }, D1, order).dates).toEqual([])
  })

  it('a group click from "every group" keeps only that group; the last one off goes back to every group', () => {
    let h = toggleGroup(defaultHighlight(D1), 'food')
    expect(h.groups).toEqual(['food'])
    h = toggleGroup(h, 'activity')
    expect(h.groups).toEqual(['food', 'activity'])
    h = toggleGroup(h, 'food')
    expect(h.groups).toEqual(['activity'])
    expect(toggleGroup(h, 'activity').groups).toBeNull()
  })

  it('switching every group on is the same as no filter', () => {
    let h = toggleGroup(defaultHighlight(D1), 'food')
    for (const g of ['activity', 'transport', 'lodging', 'shopping', 'other'] as const) h = toggleGroup(h, g)
    expect(h.groups).toBeNull()
  })

  it('the primary day is the focus day when on, else the first day on', () => {
    expect(primaryDate({ dates: [D1, D2], groups: null }, D2)).toBe(D2)
    expect(primaryDate({ dates: [D2], groups: null }, D1)).toBe(D2)
    expect(primaryDate({ dates: [], groups: null }, D1)).toBeNull()
  })
})

describe('stops and pins (items 9, 38)', () => {
  const byId = new Map(places.map((p) => [p.id, p]))

  it('numbers a day in time order, skipping places off the map and bookings without a place', () => {
    const stops = dayStops(days[0], byId)
    expect(stops.map((s) => [s.placeId, s.n])).toEqual([
      ['a', 1],
      ['nopos', null],
      ['b', 2],
    ])
  })

  it('shows every place with a position except Forget, grey ones first', () => {
    const pins = mapPins(places, days, defaultHighlight(D1), D1)
    expect(pins.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'cafe'])
    expect(pins.find((p) => p.id === 'a')).toMatchObject({ look: 'day', label: '1', pos: [139.79, 35.71] })
    expect(pins.find((p) => p.id === 'c')).toMatchObject({ look: 'grey', label: '' })
    expect(pins[0].look).toBe('grey')
    expect(pins[pins.length - 1].look).toBe('day')
  })

  it('shows a Forget place when it is a highlighted stop', () => {
    const d = day(D1, [block('i-f', 'forgot', 540)])
    expect(mapPins(places, [d], defaultHighlight(D1), D1).some((p) => p.id === 'forgot')).toBe(true)
  })

  it('a compared day is drawn as "compare"; a place on both keeps the stronger look and both numbers', () => {
    const pins = mapPins(places, days, { dates: [D1, D2], groups: null }, D1)
    expect(pins.find((p) => p.id === 'c')).toMatchObject({ look: 'compare', label: '1' })
    expect(pins.find((p) => p.id === 'a')).toMatchObject({ look: 'day', label: '1·2' })
  })

  it('the group filter colours pool places in those groups and greys stops outside them', () => {
    const pins = mapPins(places, days, { dates: [D1], groups: ['food'] }, D1)
    expect(pins.find((p) => p.id === 'b')).toMatchObject({ look: 'day', label: '2' })
    expect(pins.find((p) => p.id === 'a')).toMatchObject({ look: 'grey', label: '' })
    expect(pins.find((p) => p.id === 'cafe')).toMatchObject({ look: 'group' })
    expect(pins.find((p) => p.id === 'c')).toMatchObject({ look: 'grey' })
  })
})

describe('legs (items 37, 39)', () => {
  it('uses the stored route, else a straight line, and marks the primary day', () => {
    const lines = legLines(days, places, { dates: [D1, D2], groups: null }, D2)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ index: 0, mode: 'walk', routed: false, primary: false, coords: [[139.79, 35.71], [139.81, 35.69]] })
    expect(lines[1]).toMatchObject({ index: 1, mode: 'transit', routed: true, primary: true })
    expect(lines[1].coords).toHaveLength(3)
  })

  it('leaves out legs of days not highlighted and legs with an end off the map', () => {
    expect(legLines(days, places, defaultHighlight(D1), D1)).toHaveLength(1)
    const d = day(D1, [], [leg('a', 'nopos', 'walk'), leg('a', 'a', 'walk')])
    expect(legLines([d], places, defaultHighlight(D1), D1)).toHaveLength(0)
  })

  it('one line style per mode: transit solid, walk dotted, drive dashed, the rest distinct', () => {
    expect(dashFor('transit')).toBeNull()
    expect(dashFor('walk')![0]).toBeLessThan(0.1)
    expect(dashFor('drive')).toEqual([3, 2])
    const all: Mode[] = ['drive', 'transit', 'walk', 'twoWheeler', 'cycle', 'ride']
    expect(new Set(all.map((m) => JSON.stringify(dashFor(m)))).size).toBe(all.length)
    expect(svgDash('drive', 2)).toBe('6 4')
    expect(svgDash('transit', 2)).toBeUndefined()
  })

  it('the legend lists the modes drawn, in Google Maps order, saying which are straight lines', () => {
    const lines = legLines(days, places, { dates: [D1, D2], groups: null }, D1)
    expect(legendModes(lines)).toEqual([
      { mode: 'transit', text: 'Transit' },
      { mode: 'walk', text: 'Walk (straight line for now)' },
    ])
  })
})

describe('view', () => {
  it('bounds around points', () => {
    expect(boundsOf([])).toBeNull()
    expect(
      boundsOf([
        [1, 5],
        [3, 2],
        [2, 4],
      ]),
    ).toEqual([
      [1, 2],
      [3, 5],
    ])
  })

  it('fits the primary day, else highlighted pins, else every pin', () => {
    const h = defaultHighlight(D1)
    const pins = mapPins(places, days, h, D1)
    expect(fitPoints(pins, legLines(days, places, h, D1))).toContainEqual([139.81, 35.69])
    const none = mapPins(places, days, { dates: [], groups: null }, D1)
    expect(fitPoints(none, [])).toHaveLength(4)
  })

  it('header text for the focus day', () => {
    expect(mapInfo(days, D1, places)).toBe('Focus: 12/02 Wed · 3 stops')
    expect(mapInfo(days, '2027-01-01', places)).toBeUndefined()
  })
})

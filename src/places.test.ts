import { describe, expect, it } from 'vitest'
import {
  changedFields,
  clock,
  newPlace,
  dayHours,
  detailsMissing,
  fieldList,
  groupRows,
  hoursShort,
  PLACE_KINDS,
  scheduleLabel,
  schedules,
  stayShort,
  weekRuns,
  weekdayShort,
} from './places'
import type { Item, OpeningHours, Place } from './types'

const r = (open: number, close: number) => ({ open, close })
const every = (ranges: { open: number; close: number }[]): OpeningHours => ({
  mon: ranges,
  tue: ranges,
  wed: ranges,
  thu: ranges,
  fri: ranges,
  sat: ranges,
  sun: ranges,
})

const place = (id: string, more: Partial<Place> = {}): Place => ({ id, name: id, kind: 'sight', rating: 'unrated', ...more })

describe('stay and hours', () => {
  it('writes the usual stay', () => {
    expect(stayShort(90)).toBe('1.5 h')
    expect(stayShort(60)).toBe('1 h')
    expect(stayShort(75)).toBe('1.25 h')
    expect(stayShort(45)).toBe('45 min')
    expect(stayShort(100)).toBe('1 h 40 min')
    expect(stayShort(null)).toBeNull()
    expect(stayShort(0)).toBeNull()
  })

  it('writes clock times without a leading zero', () => {
    expect(clock(360)).toBe('6:00')
    expect(clock(1050)).toBe('17:30')
    expect(clock(1440)).toBe('24:00')
    expect(clock(0)).toBe('0:00')
  })

  it('writes one day', () => {
    expect(dayHours(undefined)).toBeNull()
    expect(dayHours([])).toBe('closed')
    expect(dayHours([r(0, 1440)])).toBe('open 24 h')
    expect(dayHours([r(660, 840), r(1020, 1320)])).toBe('11:00–14:00, 17:00–22:00')
    expect(dayHours([r(1020, 120)])).toBe('17:00–2:00')
  })

  it('writes the week in short form', () => {
    expect(hoursShort(null)).toBeNull()
    expect(hoursShort({})).toBeNull()
    expect(hoursShort(every([r(360, 1020)]))).toBe('6:00–17:00')
    expect(hoursShort({ ...every([r(540, 1020)]), wed: [] })).toBe('9:00–17:00 · closed Wed')
    expect(hoursShort({ ...every([r(600, 1080)]), sat: [], sun: [] })).toBe('10:00–18:00 · closed Sat, Sun')
    expect(hoursShort(every([r(0, 1440)]))).toBe('open 24 h')
    expect(hoursShort({ ...every([r(600, 1200)]), fri: [r(600, 1320)], mon: [] })).toBe('10:00–20:00 · varies · closed Mon')
    expect(hoursShort(every([]))).toBe('closed every day')
    // Unknown days are left out of the short form.
    expect(hoursShort({ mon: [r(600, 1020)], tue: null, sun: [] })).toBe('10:00–17:00 · closed Sun')
  })
})

describe('week in the details', () => {
  it('joins days with the same hours', () => {
    expect(weekRuns(every([r(360, 1020)]))).toEqual([{ days: 'Mon–Sun', text: '6:00–17:00', closed: false, known: true }])
    expect(weekRuns({ ...every([r(540, 1020)]), wed: [], sun: null }).map((x) => `${x.days} ${x.text}`)).toEqual([
      'Mon–Tue 9:00–17:00',
      'Wed closed',
      'Thu–Sat 9:00–17:00',
      'Sun not known',
    ])
  })
})

describe('places', () => {
  it('offers 14 place sub-categories, without Local travel', () => {
    expect(PLACE_KINDS).toHaveLength(14)
    expect(PLACE_KINDS.some((k) => k.id === 'localTravel')).toBe(false)
  })

  it('knows a link-only place', () => {
    expect(detailsMissing(place('a', { googleMapsUrl: 'https://maps.app.goo.gl/x' }))).toBe(true)
    expect(detailsMissing(place('a', { googleMapsUrl: 'https://maps.app.goo.gl/x', area: 'Ueno' }))).toBe(false)
    expect(detailsMissing(place('a'))).toBe(false)
  })

  it('names fields in words, each once', () => {
    expect(fieldList(['lat', 'lng', 'openingHours', 'mystery'])).toBe('coordinates, opening hours, mystery')
  })

  it('reads dates as weekdays', () => {
    expect(weekdayShort('2026-12-02')).toBe('WED')
  })
})

describe('schedules', () => {
  const items: Item[] = [
    { id: 'i1', title: 'A', placeId: 'a', kind: 'sight', slot: { date: '2026-12-04', start: 540, end: 600 } },
    { id: 'i2', title: 'A', placeId: 'a', kind: 'sight', slot: { date: '2026-12-02', start: 540, end: 600 } },
    { id: 'i3', title: 'A', placeId: 'a', kind: 'sight', slot: { date: '2026-12-02', start: 900, end: 960 } },
    {
      id: 'i4',
      title: 'Hotel',
      placeId: 'h',
      kind: 'lodging',
      stay: {
        checkInDate: '2026-12-02',
        checkOutDate: '2026-12-05',
        checkIn: { date: '2026-12-02', start: 900, end: 920 },
        checkOut: { date: '2026-12-05', start: 600, end: 630 },
      },
    },
    { id: 'i5', title: 'Sushi', placeId: 's', kind: 'food', booking: { kind: 'food', date: '2026-12-05' } },
    { id: 'i6', title: 'Ramen booking', kind: 'food', booking: { kind: 'food', date: '2026-12-03' } },
  ]

  it('lists each date once, in order, with stays and waiting bookings', () => {
    const s = schedules({ items })
    expect(s.get('a')).toEqual({ dates: ['2026-12-02', '2026-12-04'], waiting: [] })
    expect(s.get('h')?.dates).toEqual(['2026-12-02', '2026-12-05'])
    expect(s.get('s')).toEqual({ dates: [], waiting: ['2026-12-05'] })
    expect(scheduleLabel(s.get('a'))).toEqual({ text: '12/02 · 12/04', kind: 'dates' })
    expect(scheduleLabel(s.get('s'))).toEqual({ text: '12/05 · no time', kind: 'waiting' })
    expect(scheduleLabel(undefined)).toEqual({ text: 'Not scheduled', kind: 'none' })
  })

  const places: Place[] = [
    place('a', { name: 'Senso-ji', area: 'Asakusa', rating: 'mustGo' }),
    place('h', { name: 'Hotel', area: 'asakusa', kind: 'lodging', rating: 'soSo' }),
    place('s', { name: 'Sushi dinner', area: 'Kyoto', kind: 'food', rating: 'forget' }),
    place('z', { name: 'Zoo', kind: 'nature' }),
    place('m', { name: 'museum', area: 'Ueno', kind: 'museum', rating: 'mustGo' }),
  ]
  const trip = { places, items }
  const names = (rows: ReturnType<typeof groupRows>[number]['rows']) =>
    rows.map((r) => (r.type === 'place' ? r.place.name : `item:${r.item.title}`))

  it('groups by area, case-insensitive, No area last, Forget kept in its area', () => {
    const s = groupRows(trip, 'area')
    expect(s.map((x) => x.title)).toEqual(['Asakusa', 'Kyoto', 'Ueno', 'No area'])
    expect(names(s[0].rows)).toEqual(['Hotel', 'Senso-ji'])
    expect(names(s[1].rows)).toEqual(['Sushi dinner'])
    expect(names(s[3].rows)).toEqual(['item:Ramen booking', 'Zoo'])
  })

  it('groups by rating with Forget collapsed', () => {
    const s = groupRows(trip, 'rating')
    expect(s.map((x) => x.title)).toEqual(['Must Go', 'So-So', 'Unrated', 'Forget'])
    expect(names(s[0].rows)).toEqual(['museum', 'Senso-ji'])
    expect(s[3].collapsed).toBe(true)
    expect(s[0].collapsed).toBe(false)
  })

  it('groups by type in group order, sub-categories in order', () => {
    const s = groupRows(trip, 'type')
    expect(s.map((x) => x.group)).toEqual(['food', 'activity', 'lodging'])
    expect(names(s[0].rows)).toEqual(['item:Ramen booking', 'Sushi dinner'])
    expect(names(s[1].rows)).toEqual(['Senso-ji', 'museum', 'Zoo'])
  })

  it('groups by scheduled or not: not scheduled first, then per date', () => {
    const s = groupRows(trip, 'scheduled')
    expect(s.map((x) => `${x.title} ${x.sub ?? ''}`.trim())).toEqual(['Not scheduled', '12/02 WED', '12/04 FRI', '12/05 SAT'])
    expect(names(s[0].rows)).toEqual(['museum', 'item:Ramen booking', 'Sushi dinner', 'Zoo'])
    expect(names(s[1].rows)).toEqual(['Hotel', 'Senso-ji'])
  })
})

describe('adding and editing by hand', () => {
  const fields = {
    name: 'Ueno Zoo',
    kind: 'nature' as const,
    area: 'Ueno',
    city: '',
    googleMapsUrl: '',
    usualStayMinutes: 120,
    notes: '',
    coords: null,
  }

  it('makes a new Unrated place with nothing unverified', () => {
    const p = newPlace('p-1', { ...fields, coords: [35.7164, 139.7713] })
    expect(p).toMatchObject({ id: 'p-1', rating: 'unrated', unverified: [], city: null, lat: 35.7164, lng: 139.7713 })
  })

  it('sends only changed fields, and typed fields leave unverified', () => {
    const p = place('p', { name: 'Ueno Zoo', kind: 'nature', area: 'Ueno', usualStayMinutes: 120, unverified: ['area', 'openingHours'] })
    expect(changedFields(p, fields)).toEqual({})
    expect(changedFields(p, { ...fields, area: 'Ueno Park' })).toEqual({ area: 'Ueno Park', unverified: ['openingHours'] })
    expect(changedFields(p, { ...fields, area: '' })).toEqual({ area: null, unverified: ['openingHours'] })
    // A new link with a position moves the place.
    expect(changedFields(p, { ...fields, googleMapsUrl: 'https://x/@1,2', coords: [1, 2] })).toEqual({
      googleMapsUrl: 'https://x/@1,2',
      lat: 1,
      lng: 2,
    })
  })
})

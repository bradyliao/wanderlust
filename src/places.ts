// Place List logic as pure functions (items 16–18, 64, 81): sub-categories and
// groups, ratings, stay and hours in short form, scheduled dates, and the four
// groupings. No React here, so it is tested directly (places.test.ts).

import { monthDay } from './format'
import type { Group, Item, Kind, OpeningHours, Place, Rating, TimeRange, Trip, Weekday } from './types'

// ---------- sub-categories and groups (item 81) ----------

export const KINDS: { id: Kind; label: string; group: Group }[] = [
  { id: 'food', label: 'Food', group: 'food' },
  { id: 'cafe', label: 'Café', group: 'food' },
  { id: 'dessert', label: 'Dessert', group: 'food' },
  { id: 'sight', label: 'Sight', group: 'activity' },
  { id: 'museum', label: 'Museum', group: 'activity' },
  { id: 'nature', label: 'Nature', group: 'activity' },
  { id: 'nightlife', label: 'Nightlife', group: 'activity' },
  { id: 'flight', label: 'Flight', group: 'transport' },
  { id: 'train', label: 'Train', group: 'transport' },
  { id: 'bus', label: 'Bus', group: 'transport' },
  { id: 'car', label: 'Car', group: 'transport' },
  { id: 'localTravel', label: 'Local travel', group: 'transport' },
  { id: 'lodging', label: 'Lodging', group: 'lodging' },
  { id: 'shopping', label: 'Shopping', group: 'shopping' },
  { id: 'other', label: 'Other', group: 'other' },
]

/** The 14 sub-categories a place may have (all but Local travel). */
export const PLACE_KINDS = KINDS.filter((k) => k.id !== 'localTravel')

export const kindLabel = (kind: Kind) => KINDS.find((k) => k.id === kind)?.label ?? kind
export const kindGroup = (kind: Kind): Group => KINDS.find((k) => k.id === kind)?.group ?? 'other'
const kindOrder = (kind: Kind) => KINDS.findIndex((k) => k.id === kind)

// ---------- ratings (item 17a) ----------

/** The four ratings in the order the control and the Rating grouping use. */
export const RATINGS: { id: Rating; label: string }[] = [
  { id: 'mustGo', label: 'Must Go' },
  { id: 'soSo', label: 'So-So' },
  { id: 'unrated', label: 'Unrated' },
  { id: 'forget', label: 'Forget' },
]

export const ratingLabel = (rating: Rating) => RATINGS.find((r) => r.id === rating)?.label ?? rating

// ---------- stay and hours ----------

/** `90` → `1.5 h`, `45` → `45 min`, `75` → `1.25 h`, `100` → `1 h 40 min`. */
export function stayShort(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null
  if (minutes < 60) return `${minutes} min`
  if (minutes % 15 === 0) return `${Number((minutes / 60).toFixed(2))} h`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/** Minutes from midnight → `9:30`; 1440 → `24:00`. */
export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  const h = minutes === 1440 ? 24 : Math.floor(m / 60)
  return `${h}:${String(m % 60).padStart(2, '0')}`
}

export const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
]

const isAllDay = (ranges: TimeRange[]) => ranges.length === 1 && ranges[0].open === 0 && ranges[0].close === 1440

/** One day's ranges: `6:00–17:00`, `11:00–14:00, 17:00–22:00`, `open 24 h`, `closed`, or null when unknown. */
export function dayHours(ranges: TimeRange[] | null | undefined): string | null {
  if (ranges == null) return null
  if (ranges.length === 0) return 'closed'
  if (isAllDay(ranges)) return 'open 24 h'
  return ranges.map((r) => `${clock(r.open)}–${clock(r.close)}`).join(', ')
}

/**
 * The week for the details (item 18): consecutive days with the same hours
 * joined, `Mon–Fri 9:00–17:00`, `Sat closed`; unknown days say `not known`.
 */
export function weekRuns(hours: OpeningHours): { days: string; text: string; closed: boolean; known: boolean }[] {
  const runs: { from: number; to: number; text: string | null }[] = []
  WEEKDAYS.forEach((d, i) => {
    const text = dayHours(hours[d.id])
    const last = runs[runs.length - 1]
    if (last && last.text === text) last.to = i
    else runs.push({ from: i, to: i, text })
  })
  return runs.map((r) => ({
    days: r.from === r.to ? WEEKDAYS[r.from].label : `${WEEKDAYS[r.from].label}–${WEEKDAYS[r.to].label}`,
    text: r.text ?? 'not known',
    closed: r.text === 'closed',
    known: r.text != null,
  }))
}

/**
 * The week in short form for a row (item 16): the most common opening hours,
 * then `varies` when other open days differ, then the closed days:
 * `6:00–17:00 · closed Wed`. Unknown days are left out; null when no day is known.
 */
export function hoursShort(hours: OpeningHours | null | undefined): string | null {
  if (!hours) return null
  const known = WEEKDAYS.map((d) => ({ day: d, text: dayHours(hours[d.id]) })).filter((d) => d.text != null)
  if (known.length === 0) return null
  const closed = known.filter((d) => d.text === 'closed')
  const open = known.filter((d) => d.text !== 'closed')
  if (open.length === 0) return known.length === 7 ? 'closed every day' : `closed ${closed.map((d) => d.day.label).join(', ')}`
  const counts = new Map<string, number>()
  for (const d of open) counts.set(d.text!, (counts.get(d.text!) ?? 0) + 1)
  // Most common pattern; ties go to the one that comes first in the week.
  let main = open[0].text!
  for (const d of open) if (counts.get(d.text!)! > counts.get(main)!) main = d.text!
  const parts = [main]
  if (counts.size > 1) parts.push('varies')
  if (closed.length) parts.push(`closed ${closed.map((d) => d.day.label).join(', ')}`)
  return parts.join(' · ')
}

/** Only a name and a Google Maps link: imported as "details missing" (item 67). */
export function detailsMissing(p: Place): boolean {
  return (
    !!p.googleMapsUrl &&
    !p.area &&
    !p.city &&
    !p.address &&
    p.lat == null &&
    !p.usualStayMinutes &&
    !p.openingHours &&
    !p.notes
  )
}

// ---------- scheduled dates and bookings waiting for a time ----------

/** Every date an item has a block on: its slot, a stay's check-in and check-out. */
function itemDates(item: Item): string[] {
  const dates: string[] = []
  if (item.slot) dates.push(item.slot.date)
  if (item.stay?.checkIn) dates.push(item.stay.checkIn.date)
  if (item.stay?.checkOut) dates.push(item.stay.checkOut.date)
  return dates
}

/** Booked for a date but with no time yet (item 64). */
export function waitsForTime(item: Item): boolean {
  return !!item.booking?.date && !item.slot && !item.stay && item.kind !== 'localTravel'
}

export interface Schedule {
  /** Dates with a block for this place, sorted, each once. */
  dates: string[]
  /** Dates of bookings that wait in the list for a time (item 64). */
  waiting: string[]
}

/** Scheduled dates and waiting bookings for every place id. */
export function schedules(trip: Pick<Trip, 'items'>): Map<string, Schedule> {
  const out = new Map<string, Schedule>()
  for (const item of trip.items) {
    if (!item.placeId) continue
    const s = out.get(item.placeId) ?? { dates: [], waiting: [] }
    s.dates.push(...itemDates(item))
    if (waitsForTime(item)) s.waiting.push(item.booking!.date!)
    out.set(item.placeId, s)
  }
  for (const s of out.values()) {
    s.dates = [...new Set(s.dates)].sort()
    s.waiting = [...new Set(s.waiting)].sort()
  }
  return out
}

/** `12/02` or `12/02 · 12/04`; for a waiting booking `12/05 · no time`; else `Not scheduled`. */
export function scheduleLabel(s: Schedule | undefined): { text: string; kind: 'dates' | 'waiting' | 'none' } {
  if (s?.dates.length) return { text: s.dates.map(monthDay).join(' · '), kind: 'dates' }
  if (s?.waiting.length) return { text: `${s.waiting.map(monthDay).join(' · ')} · no time`, kind: 'waiting' }
  return { text: 'Not scheduled', kind: 'none' }
}

/** `2026-12-02` → `WED`. */
export function weekdayShort(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? '' : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getUTCDay()]
}

// ---------- groupings (item 17) ----------

export type GroupBy = 'area' | 'rating' | 'type' | 'scheduled'

export const GROUP_BYS: { id: GroupBy; label: string }[] = [
  { id: 'area', label: 'Area' },
  { id: 'rating', label: 'Rating' },
  { id: 'type', label: 'Type' },
  { id: 'scheduled', label: 'Scheduled or not' },
]

/** A row in the list: a place, or a booking with no place that waits for a time (item 64). */
export type Row = { type: 'place'; place: Place } | { type: 'item'; item: Item }

export interface Section {
  /** Stable within a grouping, for collapsing. */
  key: string
  title: string
  /** Small text after the title, for example `WED`. */
  sub?: string
  /** Colour group for Type sections. */
  group?: Group
  rows: Row[]
  /** Starts collapsed (Forget in the Rating grouping, item 17). */
  collapsed?: boolean
}

const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })
const rowName = (r: Row) => (r.type === 'place' ? r.place.name : r.item.title)
const rowKind = (r: Row) => (r.type === 'place' ? r.place.kind : r.item.kind)
const sortRows = (rows: Row[]) => rows.sort((a, b) => byName(rowName(a), rowName(b)))
export const NO_AREA = 'No area'

/** Split places (and waiting bookings without a place) into sections. Empty sections are left out. */
export function groupRows(trip: Pick<Trip, 'places' | 'items'>, by: GroupBy): Section[] {
  const rows: Row[] = [
    ...trip.places.map((place): Row => ({ type: 'place', place })),
    ...trip.items.filter((i) => !i.placeId && waitsForTime(i)).map((item): Row => ({ type: 'item', item })),
  ]
  const sched = schedules(trip)

  if (by === 'area') {
    const map = new Map<string, Row[]>()
    for (const r of rows) {
      const area = (r.type === 'place' ? r.place.area?.trim() : '') || NO_AREA
      const key = area.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    const titles = new Map<string, string>()
    for (const [key, list] of map) titles.set(key, list.map((r) => (r.type === 'place' ? r.place.area?.trim() : '')).find(Boolean) || NO_AREA)
    return [...map.keys()]
      .sort((a, b) => (a === NO_AREA.toLowerCase() ? 1 : b === NO_AREA.toLowerCase() ? -1 : byName(a, b)))
      .map((key) => ({ key: `area:${key}`, title: titles.get(key)!, rows: sortRows(map.get(key)!) }))
  }

  if (by === 'rating') {
    return RATINGS.map((r) => ({
      key: `rating:${r.id}`,
      title: r.label,
      // Waiting bookings without a place have no rating: they go with Unrated.
      rows: sortRows(rows.filter((row) => (row.type === 'place' ? row.place.rating : 'unrated') === r.id)),
      collapsed: r.id === 'forget',
    })).filter((s) => s.rows.length)
  }

  if (by === 'type') {
    const groups: Group[] = ['food', 'activity', 'transport', 'lodging', 'shopping', 'other']
    const labels: Record<Group, string> = {
      food: 'Food',
      activity: 'Activity',
      transport: 'Transport',
      lodging: 'Lodging',
      shopping: 'Shopping',
      other: 'Other',
    }
    return groups
      .map((g) => ({
        key: `type:${g}`,
        title: labels[g],
        group: g,
        rows: rows
          .filter((r) => kindGroup(rowKind(r)) === g)
          .sort((a, b) => kindOrder(rowKind(a)) - kindOrder(rowKind(b)) || byName(rowName(a), rowName(b))),
      }))
      .filter((s) => s.rows.length)
  }

  // Scheduled or not: not scheduled first, then one section per date. A place
  // on two dates shows in both. Waiting bookings count as not scheduled.
  const none: Row[] = []
  const perDate = new Map<string, Row[]>()
  for (const r of rows) {
    const dates = r.type === 'place' ? (sched.get(r.place.id)?.dates ?? []) : []
    if (!dates.length) none.push(r)
    for (const d of dates) {
      if (!perDate.has(d)) perDate.set(d, [])
      perDate.get(d)!.push(r)
    }
  }
  const sections: Section[] = []
  if (none.length) sections.push({ key: 'scheduled:none', title: 'Not scheduled', rows: sortRows(none) })
  for (const d of [...perDate.keys()].sort()) {
    sections.push({ key: `scheduled:${d}`, title: monthDay(d), sub: weekdayShort(d), rows: sortRows(perDate.get(d)!) })
  }
  return sections
}

// ---------- field names, for the import preview and unverified marks ----------

const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  nameLocal: 'local name',
  kind: 'type',
  area: 'area',
  city: 'city',
  country: 'country',
  googleMapsUrl: 'Google Maps link',
  lat: 'coordinates',
  lng: 'coordinates',
  address: 'address',
  usualStayMinutes: 'usual stay',
  openingHours: 'opening hours',
  hoursNote: 'hours note',
  estimatedCost: 'estimated cost',
  rating: 'rating',
  tags: 'tags',
  notes: 'notes',
  aiNotes: 'AI notes',
  source: 'source',
}

/** Place field names in words, each once: `["lat", "lng", "openingHours"]` → `coordinates, opening hours`. */
export function fieldList(fields: string[]): string {
  return [...new Set(fields.map((f) => FIELD_LABELS[f] ?? f))].join(', ')
}

// ---------- adding and editing by hand ----------

/** What the form collects. Empty text = not known. */
export interface PlaceFields {
  name: string
  kind: Kind
  area: string
  city: string
  googleMapsUrl: string
  /** Minutes, or null when not known. */
  usualStayMinutes: number | null
  notes: string
  /** Read from the link, when it has any. */
  coords: [number, number] | null
}

/** The `addPlace` place for new fields. */
export function newPlace(id: string, f: PlaceFields): Place {
  return {
    id,
    name: f.name,
    kind: f.kind,
    area: f.area || null,
    city: f.city || null,
    googleMapsUrl: f.googleMapsUrl || null,
    lat: f.coords?.[0] ?? null,
    lng: f.coords?.[1] ?? null,
    usualStayMinutes: f.usualStayMinutes,
    notes: f.notes || null,
    rating: 'unrated',
    tags: [],
    unverified: [],
  }
}

/**
 * The `updatePlace` fields that changed. Fields the user typed are checked by
 * definition, so they leave `unverified`. A new link with a position moves the
 * place; a link without one keeps the old position.
 */
export function changedFields(p: Place, f: PlaceFields): Record<string, unknown> {
  const set: Record<string, unknown> = {}
  const text = (key: 'name' | 'area' | 'city' | 'googleMapsUrl' | 'notes', value: string) => {
    if ((p[key] ?? '') !== value) set[key] = value || null
  }
  text('name', f.name)
  if (p.kind !== f.kind) set.kind = f.kind
  text('area', f.area)
  text('city', f.city)
  text('googleMapsUrl', f.googleMapsUrl)
  if ((p.usualStayMinutes ?? null) !== f.usualStayMinutes) set.usualStayMinutes = f.usualStayMinutes
  text('notes', f.notes)
  if ('googleMapsUrl' in set && f.coords && (p.lat !== f.coords[0] || p.lng !== f.coords[1])) {
    set.lat = f.coords[0]
    set.lng = f.coords[1]
  }
  const unverified = p.unverified ?? []
  const left = unverified.filter((k) => !(k in set))
  if (Object.keys(set).length && left.length !== unverified.length) set.unverified = left
  return set
}

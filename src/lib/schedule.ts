import type { Block, LegMode, Pace, Place, Trip } from '../types'
import { fmtTime, tripDays, weekday, weekdayName } from './time'

/** How each pace changes the estimates. Walking speed in km/h. */
export const PACE: Record<Pace, { label: string; walkKmh: number; hint: string }> = {
  relaxed: { label: 'Relaxed', walkKmh: 3.2, hint: 'Slower walking, fewer stops a day. Good with elders or small children.' },
  standard: { label: 'Standard', walkKmh: 4.5, hint: 'Average walking speed.' },
  packed: { label: 'Packed', walkKmh: 5.2, hint: 'Brisk walking, tight transfers.' },
}

export interface Leg {
  key: string
  from: Block
  to: Block
  mode: LegMode
  minutes: number
  cost?: number
  note?: string
  /** False while the numbers are the app's own rough estimate. */
  verified: boolean
  /** Minutes available between the two stays. */
  gap: number
  tight: boolean
}

export interface Warning {
  id: string
  day: string
  blockId?: string
  legKey?: string
  text: string
}

export function legKey(from: Block, to: Block): string {
  return `${from.id}>${to.id}`
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * Rough travel time from straight-line distance. It stands in until a real
 * routing provider is connected, and is always shown as an estimate.
 */
export function estimateLeg(from: Place, to: Place, pace: Pace): { mode: LegMode; minutes: number } {
  const km = distanceKm(from, to)
  const round5 = (n: number) => Math.max(5, Math.ceil(n / 5) * 5)
  if (km <= 1.2) {
    // Streets are not straight: assume the walk is 30% longer than the crow flies.
    return { mode: 'walk', minutes: round5(((km * 1.3) / PACE[pace].walkKmh) * 60) }
  }
  // Station access and waiting, then an average door-to-door speed for city transit.
  const overhead = pace === 'relaxed' ? 14 : pace === 'packed' ? 8 : 10
  return { mode: 'transit', minutes: round5(overhead + (km / 25) * 60) }
}

export function dayBlocks(trip: Trip, day: string): Block[] {
  return trip.blocks.filter((b) => b.day === day).sort((a, b) => a.start - b.start || a.end - b.end)
}

export function placeOf(trip: Trip, block: Block): Place | undefined {
  return block.placeId ? trip.places.find((p) => p.id === block.placeId) : undefined
}

/** Travel between each pair of consecutive stays that are in different known places. */
export function dayLegs(trip: Trip, day: string): Leg[] {
  const blocks = dayBlocks(trip, day)
  const legs: Leg[] = []
  for (let i = 0; i < blocks.length - 1; i++) {
    const from = blocks[i]
    const to = blocks[i + 1]
    const a = placeOf(trip, from)
    const b = placeOf(trip, to)
    if (!a || !b || a.id === b.id) continue
    const key = legKey(from, to)
    const override = trip.legs[key]
    const base = override ?? { ...estimateLeg(a, b, trip.pace), verified: false }
    const gap = to.start - from.end
    legs.push({ key, from, to, ...base, gap, tight: gap < base.minutes })
  }
  return legs
}

export function tripWarnings(trip: Trip): Warning[] {
  const out: Warning[] = []
  for (const day of tripDays(trip)) {
    const blocks = dayBlocks(trip, day)
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      const next = blocks[i + 1]
      if (next && next.start < b.end) {
        out.push({ id: `overlap:${b.id}:${next.id}`, day, blockId: next.id, text: `${next.title} starts before ${b.title} ends.` })
      }
      const place = placeOf(trip, b)
      if (!place) continue
      if (place.closedDays?.includes(weekday(day))) {
        out.push({ id: `closed:${b.id}`, day, blockId: b.id, text: `${place.name} is closed on ${weekdayName(day)}.` })
      } else {
        if (place.open !== undefined && b.start < place.open) {
          out.push({ id: `early:${b.id}`, day, blockId: b.id, text: `${place.name} opens at ${fmtTime(place.open)}.` })
        }
        if (place.close !== undefined && b.end > place.close) {
          out.push({ id: `late:${b.id}`, day, blockId: b.id, text: `${place.name} closes at ${fmtTime(place.close)}.` })
        }
      }
    }
    for (const leg of dayLegs(trip, day)) {
      if (leg.tight && leg.gap >= 0) {
        out.push({
          id: `tight:${leg.key}`,
          day,
          legKey: leg.key,
          text: `${leg.from.title} to ${leg.to.title} needs about ${leg.minutes} min, the timetable leaves ${leg.gap}.`,
        })
      }
    }
  }
  return out
}

/** Swap everything scheduled on two days. Fixed blocks move too: the user is told before confirming. */
export function swapDays(trip: Trip, a: string, b: string): Trip {
  return {
    ...trip,
    blocks: trip.blocks.map((blk) => (blk.day === a ? { ...blk, day: b } : blk.day === b ? { ...blk, day: a } : blk)),
  }
}

export interface BudgetRow {
  label: string
  perPerson: number
}

/** Per-person totals in the trip currency, by category and by day. */
export function budget(trip: Trip): { byCategory: BudgetRow[]; byDay: BudgetRow[]; perPerson: number } {
  const cat = new Map<string, number>()
  const byDay: BudgetRow[] = []
  let perPerson = 0
  for (const day of tripDays(trip)) {
    let dayTotal = 0
    for (const b of dayBlocks(trip, day)) {
      if (!b.cost) continue
      cat.set(b.category, (cat.get(b.category) ?? 0) + b.cost)
      dayTotal += b.cost
    }
    for (const leg of dayLegs(trip, day)) {
      if (!leg.cost) continue
      cat.set('transport', (cat.get('transport') ?? 0) + leg.cost)
      dayTotal += leg.cost
    }
    byDay.push({ label: day, perPerson: dayTotal })
    perPerson += dayTotal
  }
  const byCategory = [...cat.entries()].map(([label, v]) => ({ label, perPerson: v })).sort((x, y) => y.perPerson - x.perPerson)
  return { byCategory, byDay, perPerson }
}

/** Pull coordinates out of a pasted Google Maps link or a "lat, lng" pair. */
export function parseLatLng(text: string): { lat: number; lng: number } | undefined {
  const patterns = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/, /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/]
  for (const p of patterns) {
    const m = p.exec(text)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
  }
  return undefined
}

export function mapsPlaceUrl(p: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
}

export function mapsDirectionsUrl(a: { lat: number; lng: number }, b: { lat: number; lng: number }, mode: LegMode): string {
  const travelmode = mode === 'walk' ? 'walking' : mode === 'drive' ? 'driving' : 'transit'
  return `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=${travelmode}`
}

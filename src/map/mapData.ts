// Map pane logic as pure functions (items 9, 37–40): which days and groups are
// highlighted (the chips), the highlighted days' stops numbered in time order,
// each pin's look, the legs as lines (stored route, else straight), the line
// dash per mode, and the bounds to fit. No MapLibre or React here, so it is
// tested directly (mapData.test.ts).

import { GROUPS, modeLabel } from '../format'
import { kindGroup } from '../places'
import type { Group, Kind, LegView, Mode, PlanDay, Place } from '../types'

export type LngLat = [number, number]

// ---------- highlight chips (item 40) ----------

export interface Highlight {
  /** Highlighted trip dates. Default: the focus day. */
  dates: string[]
  /** Groups whose pins are highlighted; null = every group (no filter). */
  groups: Group[] | null
}

export const defaultHighlight = (focusDate: string | null): Highlight => ({ dates: focusDate ? [focusDate] : [], groups: null })

/** Switch one date on or off; dates stay in trip order (`order`). */
export function toggleDate(h: Highlight, date: string, order: string[]): Highlight {
  const on = new Set(h.dates)
  if (on.has(date)) on.delete(date)
  else on.add(date)
  return { ...h, dates: order.filter((d) => on.has(d)) }
}

/**
 * Group chips filter. From "every group", a click keeps only that group; later
 * clicks add or remove groups; removing the last (or switching all on) goes
 * back to every group.
 */
export function toggleGroup(h: Highlight, group: Group): Highlight {
  const all = GROUPS.map((g) => g.id)
  if (h.groups == null) return { ...h, groups: [group] }
  const on = new Set(h.groups)
  if (on.has(group)) on.delete(group)
  else on.add(group)
  const groups = all.filter((g) => on.has(g))
  return { ...h, groups: groups.length === 0 || groups.length === all.length ? null : groups }
}

export const groupOn = (h: Highlight, group: Group) => h.groups == null || h.groups.includes(group)

/** The day drawn in full accent: the focus day if highlighted, else the first highlighted day. */
export function primaryDate(h: Highlight, focusDate: string | null): string | null {
  if (focusDate && h.dates.includes(focusDate)) return focusDate
  return h.dates[0] ?? null
}

// ---------- positions ----------

export const placePos = (p: Place | undefined): LngLat | null =>
  p && p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? [p.lng, p.lat] : null

// ---------- stops in time order (item 9) ----------

export interface Stop {
  /** 1, 2, 3 … for stops on the map; null when the place has no position. */
  n: number | null
  placeId: string
  title: string
  start: number
}

/** A day's blocks that have a place, in time order, numbered when the place is on the map. */
export function dayStops(day: PlanDay, places: Map<string, Place>): Stop[] {
  const blocks = day.blocks.filter((b) => b.placeId).sort((a, b) => a.start - b.start || a.end - b.end)
  let n = 0
  return blocks.map((b) => {
    const p = places.get(b.placeId!)
    const mapped = placePos(p) != null
    return { n: mapped ? ++n : null, placeId: b.placeId!, title: p?.name ?? b.title, start: b.start }
  })
}

// ---------- pins (items 38, 40, 41) ----------

/** grey: a pool place; group: in a highlighted group; day: a stop of the primary day; compare: a stop of another highlighted day. */
export type PinLook = 'grey' | 'group' | 'day' | 'compare'

export interface Pin {
  id: string
  name: string
  kind: Kind
  group: Group
  pos: LngLat
  look: PinLook
  /** The stop numbers, `1` or `2·5` (one place twice); empty for unnumbered pins. */
  label: string
}

const LOOK_RANK: Record<PinLook, number> = { grey: 0, group: 1, compare: 2, day: 3 }

/**
 * Every place with a position except Forget, plus any highlighted stop (even a
 * Forget one, since it is on the day). A stop outside the group filter stays grey.
 */
export function mapPins(places: Place[], days: PlanDay[], h: Highlight, focusDate: string | null): Pin[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  const primary = primaryDate(h, focusDate)
  const numbers = new Map<string, { look: PinLook; ns: number[] }>()
  for (const day of days) {
    if (!h.dates.includes(day.date)) continue
    const look: PinLook = day.date === primary ? 'day' : 'compare'
    for (const s of dayStops(day, byId)) {
      if (s.n == null) continue
      const p = byId.get(s.placeId)!
      if (!groupOn(h, kindGroup(p.kind))) continue
      const cur = numbers.get(s.placeId)
      if (!cur) numbers.set(s.placeId, { look, ns: [s.n] })
      else {
        if (LOOK_RANK[look] > LOOK_RANK[cur.look]) cur.look = look
        cur.ns.push(s.n)
      }
    }
  }
  const pins: Pin[] = []
  for (const p of places) {
    const pos = placePos(p)
    if (!pos) continue
    const stop = numbers.get(p.id)
    if (!stop && p.rating === 'forget') continue
    const group = kindGroup(p.kind)
    const look: PinLook = stop ? stop.look : h.groups != null && h.groups.includes(group) ? 'group' : 'grey'
    pins.push({ id: p.id, name: p.name, kind: p.kind, group, pos, look, label: stop ? stop.ns.join('·') : '' })
  }
  // Grey first, so highlighted pins draw on top.
  return pins.sort((a, b) => LOOK_RANK[a.look] - LOOK_RANK[b.look])
}

// ---------- legs (items 37, 39) ----------

export interface LegLine {
  /** Index into the list returned, also the feature id. */
  index: number
  leg: LegView
  mode: Mode
  coords: LngLat[]
  /** From the stored route (`travel.line`), not a straight line. */
  routed: boolean
  primary: boolean
}

/** The highlighted days' legs: along the stored route, else a straight line. Legs with an end off the map are left out. */
export function legLines(days: PlanDay[], places: Place[], h: Highlight, focusDate: string | null): LegLine[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  const primary = primaryDate(h, focusDate)
  const out: LegLine[] = []
  for (const day of days) {
    if (!h.dates.includes(day.date)) continue
    for (const leg of day.legs) {
      const a = placePos(byId.get(leg.fromPlaceId))
      const b = placePos(byId.get(leg.toPlaceId))
      const routed = leg.travel.line.length >= 2
      if (!routed && (!a || !b)) continue
      if (!routed && a![0] === b![0] && a![1] === b![1]) continue
      out.push({ index: out.length, leg, mode: leg.travel.mode, coords: routed ? leg.travel.line : [a!, b!], routed, primary: day.date === primary })
    }
  }
  return out
}

/**
 * Dash pattern per mode, in line widths (MapLibre `line-dasharray`): Transit
 * solid, Walk dotted, Drive dashed, the others distinct. null = solid.
 */
export function dashFor(mode: Mode): number[] | null {
  switch (mode) {
    case 'transit':
      return null
    case 'walk':
      return [0.01, 2]
    case 'drive':
      return [3, 2]
    case 'twoWheeler':
      return [3, 1.5, 0.01, 1.5]
    case 'cycle':
      return [1.2, 1.2]
    case 'ride':
      return [6, 1.5, 1.5, 1.5]
  }
}

/** The same pattern for an SVG stroke of `width` (legend swatches). Walk dots need a round cap. */
export function svgDash(mode: Mode, width: number): string | undefined {
  const d = dashFor(mode)
  return d ? d.map((x) => Math.max(x * width, 0.01)).join(' ') : undefined
}

/** One legend row per mode drawn, in Google Maps order, saying when some are straight lines. */
export function legendModes(lines: LegLine[]): { mode: Mode; text: string }[] {
  const order: Mode[] = ['drive', 'transit', 'walk', 'twoWheeler', 'cycle', 'ride']
  return order
    .filter((m) => lines.some((l) => l.mode === m))
    .map((m) => ({ mode: m, text: lines.some((l) => l.mode === m && !l.routed) ? `${modeLabel(m)} (straight line for now)` : modeLabel(m) }))
}

// ---------- view ----------

/** `[[west, south], [east, north]]` around the points, or null when there are none. */
export function boundsOf(points: LngLat[]): [LngLat, LngLat] | null {
  if (points.length === 0) return null
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const [x, y] of points) {
    w = Math.min(w, x)
    e = Math.max(e, x)
    s = Math.min(s, y)
    n = Math.max(n, y)
  }
  return [
    [w, s],
    [e, n],
  ]
}

/** What to fit when the focus day changes: the primary day's stops (and leg lines), else every pin. */
export function fitPoints(pins: Pin[], lines: LegLine[]): LngLat[] {
  const day = pins.filter((p) => p.look === 'day').map((p) => p.pos)
  if (day.length) return [...day, ...lines.filter((l) => l.primary).flatMap((l) => l.coords)]
  const lit = pins.filter((p) => p.look !== 'grey').map((p) => p.pos)
  return lit.length ? lit : pins.map((p) => p.pos)
}

/** Pane header: `Focus: 12/02 Wed · 6 stops`. */
export function mapInfo(days: PlanDay[], focusDate: string | null, places: Place[]): string | undefined {
  const day = days.find((d) => d.date === focusDate)
  if (!day) return undefined
  const byId = new Map(places.map((p) => [p.id, p]))
  const n = dayStops(day, byId).length
  return `Focus: ${day.label} ${day.weekday} · ${n} ${n === 1 ? 'stop' : 'stops'}`
}

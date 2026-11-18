// Timetable layout maths as pure functions (items 11, 13, 21–23, 27, 29–30):
// minutes ↔ pixels, 15-minute snapping, move and resize, side-by-side lanes
// for overlapping blocks, the daylight gradient and the closed-hours hatching.
// Minutes are local clock minutes from midnight, as in the core.

import { clock, kindGroup } from './places'
import type { Block, DaylightStop, Group, Item, Kind, LegView, Neighbour, PlanDay, Stage, Trip } from './types'

export const DAY_MINUTES = 1440
/** Snap step for drops, moves and resizes (items 11, 13). */
export const SNAP = 15
/** The shortest block a resize leaves. */
export const MIN_BLOCK = SNAP
/** Where multi-day view starts scrolled to, and the hours it is sized for. */
export const VIEW_START = 6 * 60
export const VIEW_END = 22 * 60
/** Closed-hours hatching fades out over this many minutes into the open hours (item 27). */
export const HATCH_FADE = 30
/** Length of the blend between two daylight stages, each side of the stop. */
export const DAYLIGHT_BLEND = 20
/** Block length when a place has no usual stay (item 11). */
export const DEFAULT_STAY = 60

// ---------- minutes and pixels ----------

export const minuteToPx = (minute: number, hourHeight: number) => (minute / 60) * hourHeight
export const pxToMinute = (px: number, hourHeight: number) => (px / hourHeight) * 60

/** Nearest multiple of `step`. */
export const snap = (minute: number, step = SNAP) => Math.round(minute / step) * step

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export interface Slot {
  start: number
  end: number
}

/**
 * Where a place dropped at `pointer` goes: the block starts at the snapped
 * pointer and lasts the usual stay, kept inside the day.
 */
export function dropSlot(pointer: number, stay: number | null | undefined): Slot {
  const length = clamp(stay && stay > 0 ? stay : DEFAULT_STAY, MIN_BLOCK, DAY_MINUTES)
  const start = clamp(snap(pointer), 0, DAY_MINUTES - length)
  return { start, end: start + length }
}

/**
 * Moving a block of `length` minutes that was grabbed `grab` minutes below its
 * top: the new slot for the pointer at `pointer`, snapped and inside the day.
 */
export function moveSlot(pointer: number, grab: number, length: number): Slot {
  const start = clamp(snap(pointer - grab), 0, DAY_MINUTES - length)
  return { start, end: start + length }
}

/** Dragging the top edge changes the start (end stays); the bottom edge changes the end (item 13). */
export function resizeSlot(edge: 'top' | 'bottom', slot: Slot, pointer: number): Slot {
  const m = snap(pointer)
  if (edge === 'top') return { start: clamp(m, 0, slot.end - MIN_BLOCK), end: slot.end }
  return { start: slot.start, end: clamp(m, slot.start + MIN_BLOCK, DAY_MINUTES) }
}

// ---------- overlapping blocks ----------

export interface Lane {
  lane: number
  lanes: number
}

/**
 * Side-by-side lanes for blocks that overlap: each cluster of overlapping
 * blocks shares the column width; a block takes the first free lane.
 */
export function layoutLanes(blocks: { key: string; start: number; end: number }[]): Map<string, Lane> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end || a.key.localeCompare(b.key))
  const out = new Map<string, Lane>()
  let cluster: { key: string; lane: number }[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const c of cluster) out.set(c.key, { lane: c.lane, lanes: laneEnds.length })
    cluster = []
    laneEnds = []
  }
  for (const b of sorted) {
    if (b.start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= b.start)
    if (lane < 0) lane = laneEnds.push(b.end) - 1
    else laneEnds[lane] = b.end
    cluster.push({ key: b.key, lane })
    clusterEnd = Math.max(clusterEnd, b.end)
  }
  flush()
  return out
}

// ---------- daylight (items 21–23, 26) ----------

/** The theme token for each stage of the sky. */
export function stageColor(stage: Stage): string {
  const name = { night: 'night', twilight: 'twilight', goldenHour: 'golden', day: 'day' }[stage]
  return `var(--daylight-${name})`
}

const pct = (m: number, from: number, to: number) => `${Number((((m - from) / (to - from)) * 100).toFixed(2))}%`

/**
 * A vertical CSS gradient for the daylight stops, drawn over minutes
 * `from`..`to` (the whole day for a column, a block's time for a list row).
 * Each stage holds its colour and blends into the next over
 * `DAYLIGHT_BLEND` minutes each side of the stop. No stops (a day with no
 * location yet) gives plain day.
 */
export function daylightGradient(stops: DaylightStop[], from = 0, to = DAY_MINUTES): string {
  const sorted = [...stops].sort((a, b) => a.minute - b.minute).filter((s, i, all) => i === 0 || s.stage !== all[i - 1].stage)
  if (sorted.length === 0) return `linear-gradient(${stageColor('day')}, ${stageColor('day')})`
  const segments = sorted.map((s, i) => ({ stage: s.stage, start: i === 0 ? 0 : s.minute, end: sorted[i + 1]?.minute ?? DAY_MINUTES }))
  const parts: string[] = []
  segments.forEach((seg, i) => {
    const half = (seg.end - seg.start) / 2
    const blendIn = i === 0 ? 0 : Math.min(DAYLIGHT_BLEND, half, (seg.start - segments[i - 1].start) / 2)
    const blendOut = i === segments.length - 1 ? 0 : Math.min(DAYLIGHT_BLEND, half, (segments[i + 1].end - seg.end) / 2)
    const color = stageColor(seg.stage)
    parts.push(`${color} ${pct(seg.start + blendIn, from, to)}`, `${color} ${pct(seg.end - blendOut, from, to)}`)
  })
  return `linear-gradient(to bottom, ${parts.join(', ')})`
}

/** Sunrise and sunset marks inside a column (item 21). */
export function sunMarks(sun: { sunrise: number | null; sunset: number | null } | null): { minute: number; kind: 'sunrise' | 'sunset'; text: string }[] {
  if (!sun) return []
  const out: { minute: number; kind: 'sunrise' | 'sunset'; text: string }[] = []
  if (sun.sunrise != null) out.push({ minute: sun.sunrise, kind: 'sunrise', text: `Sunrise ${clock(sun.sunrise)}` })
  if (sun.sunset != null) out.push({ minute: sun.sunset, kind: 'sunset', text: `Sunset ${clock(sun.sunset)}` })
  return out
}

// ---------- closed hours (item 27) ----------

export interface Hatch {
  /** Solid part: the closed hours. */
  start: number
  end: number
  /** Drawn area, including the fades into the open hours. */
  from: number
  to: number
  /** CSS mask over the drawn area: transparent → solid → transparent. */
  mask: string
}

export interface HatchTag {
  minute: number
  text: string
  /** Sits above (`closes`) or below (`opens`) the line. */
  side: 'above' | 'below'
}

/** Join touching or overlapping ranges and keep them inside the day. */
function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = ranges
    .map(([a, b]) => [clamp(a, 0, DAY_MINUTES), clamp(b, 0, DAY_MINUTES)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])
  const out: [number, number][] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else out.push([...r])
  }
  return out
}

/**
 * Hatching for a day's closed ranges: each band is solid over the closed
 * hours and fades out over `fade` minutes into the open hours, never past
 * the day's edges. Tags give the exact opening and closing times.
 */
export function hatchBands(ranges: [number, number][] | null, fade = HATCH_FADE): { bands: Hatch[]; tags: HatchTag[]; allDay: boolean } {
  const merged = mergeRanges(ranges ?? [])
  const allDay = merged.length === 1 && merged[0][0] === 0 && merged[0][1] === DAY_MINUTES
  const bands = merged.map(([start, end]) => {
    const from = Math.max(0, start - fade)
    const to = Math.min(DAY_MINUTES, end + fade)
    const len = to - from
    const p = (m: number) => `${Number((((m - from) / len) * 100).toFixed(2))}%`
    const mask = `linear-gradient(to bottom, ${start > from ? 'transparent 0%, ' : ''}#000 ${p(start)}, #000 ${p(end)}${to > end ? ', transparent 100%' : ''})`
    return { start, end, from, to, mask }
  })
  const tags: HatchTag[] = []
  if (allDay) tags.push({ minute: VIEW_START, text: 'Closed all day', side: 'below' })
  else
    for (const [start, end] of merged) {
      if (start > 0) tags.push({ minute: start, text: `Closes ${clock(start)}`, side: 'above' })
      if (end < DAY_MINUTES) tags.push({ minute: end, text: `Opens ${clock(end)}`, side: 'below' })
    }
  return { bands, tags, allDay }
}

// ---------- travel (items 19, 29, 30) ----------

/** `25 min`, `1 h 10 min`, `2 h`. */
export function minutesText(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}

/** `9:00–10:30` */
export const timeRange = (start: number, end: number) => `${clock(start)}–${clock(end)}`

export interface TravelBand {
  from: number
  to: number
  fits: boolean
  text: string
}

/**
 * The band shown while dragging between a neighbour and the dragged slot:
 * blue with "25 min · fits", or red with "needs 25 min, has 10" (items 29, 30).
 * None when the travel is unknown or the neighbour is the same place.
 */
export function travelBand(n: Neighbour | null, slot: Slot, side: 'before' | 'after'): TravelBand | null {
  if (!n || n.needs == null || n.needs === 0 || n.fits == null) return null
  const from = side === 'before' ? n.end : slot.end
  const to = side === 'before' ? slot.start : n.start
  const text = n.fits ? `${minutesText(n.needs)} · fits` : (n.message ?? `needs ${n.needs} min, has ${Math.max(0, n.has)}`)
  return { from: Math.min(from, to), to: Math.max(from, to), fits: n.fits, text }
}

// ---------- scrolling ----------

/** Where to scroll so `minute` sits a little below the top. */
export function scrollTopFor(minute: number, hourHeight: number): number {
  return Math.max(0, minuteToPx(minute - 30, hourHeight))
}

// ---------- blocks ----------

/** `Senso-ji`, `Check-in · Hotel in Asakusa`. */
export function blockName(b: Block): string {
  if (b.part === 'checkIn') return `Check-in · ${b.title}`
  if (b.part === 'checkOut') return `Check-out · ${b.title}`
  return b.title
}

/** The block's group colour follows its item's sub-category (item 81); stays are Lodging. */
export function blockGroup(b: Block, items: Map<string, Item>): Group {
  if (b.part !== 'main') return 'lodging'
  const item = items.get(b.itemId)
  return item ? kindGroup(item.kind) : 'other'
}

export function blockKind(b: Block, items: Map<string, Item>): Kind {
  if (b.part !== 'main') return 'lodging'
  return items.get(b.itemId)?.kind ?? 'other'
}

/** Warning messages per block key (item 28). */
export function warningsByBlock(day: PlanDay): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const w of day.warnings) out.set(w.blockKey, [...(out.get(w.blockKey) ?? []), w.message])
  return out
}

/** Does the trip store a mode for this leg itself (not the day's)? */
export function legHasOwnMode(trip: Trip, leg: LegView): boolean {
  return (trip.legs as { from?: string; to?: string; mode?: string | null }[]).some((l) => l.from === leg.fromKey && l.to === leg.toKey && l.mode != null)
}


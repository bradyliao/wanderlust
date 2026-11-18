// Per-device view preferences (layout, pane sizes). localStorage can be
// missing or throw (private windows, blocked storage), so every access is
// wrapped and falls back to the defaults.

export type Layout = 'stacked' | 'columns'
export type PaneId = 'places' | 'timetable' | 'map'

export interface Prefs {
  layout: Layout
  /** Place List width in px. */
  placesWidth: number
  /** Timetable width in px (Three columns). */
  timetableWidth: number
  /** Timetable share of the right side's height (Stacked), 0..1. */
  timetableShare: number
  collapsed: Record<PaneId, boolean>
  /** The trip open last time. */
  lastTripId: string | null
}

export const DEFAULT_PREFS: Prefs = {
  layout: 'stacked',
  placesWidth: 300,
  timetableWidth: 560,
  timetableShare: 0.58,
  collapsed: { places: false, timetable: false, map: false },
  lastTripId: null,
}

const KEY = 'wanderlust.prefs'

/** Merge stored values over the defaults, ignoring anything malformed. */
export function parsePrefs(text: string | null): Prefs {
  if (!text) return structuredClone(DEFAULT_PREFS)
  let raw: Partial<Prefs>
  try {
    raw = JSON.parse(text)
  } catch {
    return structuredClone(DEFAULT_PREFS)
  }
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const c = (raw.collapsed ?? {}) as Partial<Record<PaneId, unknown>>
  return {
    layout: raw.layout === 'columns' ? 'columns' : 'stacked',
    placesWidth: num(raw.placesWidth, DEFAULT_PREFS.placesWidth),
    timetableWidth: num(raw.timetableWidth, DEFAULT_PREFS.timetableWidth),
    timetableShare: Math.min(0.9, Math.max(0.1, num(raw.timetableShare, DEFAULT_PREFS.timetableShare))),
    collapsed: { places: c.places === true, timetable: c.timetable === true, map: c.map === true },
    lastTripId: typeof raw.lastTripId === 'string' ? raw.lastTripId : null,
  }
}

export function loadPrefs(): Prefs {
  try {
    return parsePrefs(localStorage.getItem(KEY))
  } catch {
    return structuredClone(DEFAULT_PREFS)
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Storage unavailable: the choice lasts until the page is closed.
  }
}

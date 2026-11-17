import type { Trip } from '../types'

const DAY_MS = 86_400_000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Dates are handled as UTC midnights so the local time zone never shifts a day. */
function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "09:30" to 570. Returns undefined for an empty or malformed value. */
export function parseTime(value: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return undefined
  return Number(m[1]) * 60 + Number(m[2])
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function tripDays(trip: Pick<Trip, 'startDate' | 'endDate'>): string[] {
  const start = parse(trip.startDate).getTime()
  const end = parse(trip.endDate).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return []
  const days: string[] = []
  for (let t = start; t <= end && days.length < 60; t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  return days
}

export function weekday(iso: string): number {
  return parse(iso).getUTCDay()
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[weekday(iso)]
}

export function shortDate(iso: string): string {
  const d = parse(iso)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

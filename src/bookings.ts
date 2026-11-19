// Bookings page logic as pure functions (items 49–51, 58–64, 81): which items
// are bookings, their date and time, the date sections, the group filter,
// cancellation deadlines coming up, and the add / edit form turned into
// commands. No React here, so it is tested directly (bookings.test.ts).

import { monthDay } from './format'
import { money, parseAmount } from './money'
import { clock, kindGroup, weekdayShort } from './places'
import type { Booking, Command, Cost, CostForms, CostStatus, Group, Item, Kind, Place, Slot, Stay, Trip } from './types'

// ---------- dates and times ----------

/** `09:30` → 570; null when empty or not a time. */
export function parseClock(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null
  return h * 60 + min
}

/** 570 → `09:30`, for `<input type="time">`. */
export function clockInput(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  const m = Math.min(Math.max(minutes, 0), 1439)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Dates from `a` up to the day before `b` (a stay's nights). */
export function nightDates(stay: Pick<Stay, 'checkInDate' | 'checkOutDate'>): string[] {
  const out: string[] = []
  const d = new Date(`${stay.checkInDate}T00:00:00Z`)
  const end = new Date(`${stay.checkOutDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime())) return out
  while (d < end && out.length < 366) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** `12/02 WED`. */
export const dayText = (date: string) => `${monthDay(date)} ${weekdayShort(date)}`

/** `2026-11-25 23:59` → `11/25 23:59`. */
export function deadlineText(deadline: string): string {
  const [date, time] = deadline.split(' ')
  return time ? `${monthDay(date)} ${time}` : monthDay(date)
}

// ---------- which items, and when ----------

export const isBooking = (item: Item) => item.booking != null

/** The date a booking sits under: its block, else its booking date, else its check-in. */
export function bookingDate(item: Item): string | null {
  return item.slot?.date ?? item.booking?.date ?? item.stay?.checkInDate ?? null
}

/** Minutes for ordering within a date: the block's start, the check-in block, the hotel's "from". */
function bookingStart(item: Item): number {
  return item.slot?.start ?? item.stay?.checkIn?.start ?? item.stay?.checkInFrom ?? 1441
}

/** Where the booking is on the timetable: its block, or the check-in, else the check-out. Null = not on the timetable. */
export function timetableSpot(item: Item): { date: string; start: number } | null {
  const s = item.slot ?? item.stay?.checkIn ?? item.stay?.checkOut
  return s ? { date: s.date, start: s.start } : null
}

/** The time column of a row: `12/05 9:00–11:15`, `12/02 → 12/05`, `12/05 · no time yet`, `No date`. */
export function whenText(item: Item): string {
  if (item.stay) return `${monthDay(item.stay.checkInDate)} → ${monthDay(item.stay.checkOutDate)}`
  if (item.slot) return `${monthDay(item.slot.date)} ${clock(item.slot.start)}–${clock(item.slot.end)}`
  if (item.booking?.date) return `${monthDay(item.booking.date)} · no time yet`
  return 'No date'
}

/** `••••92`: the last two characters only (item 51). */
export function maskConfirmation(code: string): string {
  const c = code.trim()
  return c.length <= 2 ? '••••' : `••••${c.slice(-2)}`
}

/** The second line of a row: nights and check-in for stays, the confirmation, the provider. */
export function rowMeta(item: Item): string {
  const parts: string[] = []
  if (item.stay) {
    const n = nightDates(item.stay).length
    parts.push(`${n} ${n === 1 ? 'night' : 'nights'}`)
    if (item.stay.checkInFrom != null) parts.push(`check-in from ${clock(item.stay.checkInFrom)}`)
  }
  if (item.booking?.confirmation) parts.push(`conf. ${maskConfirmation(item.booking.confirmation)}`)
  if (item.booking?.provider) parts.push(item.booking.provider)
  return parts.join(' · ')
}

// ---------- sections and filter ----------

export type GroupFilter = Group | 'all'

export interface BookingSection {
  /** Null = bookings with no date yet, listed last. */
  date: string | null
  /** `12/02 WED · Tokyo`, or `No date`. */
  heading: { date: string; weekday: string; city: string | null } | null
  items: Item[]
}

export const bookingGroup = (item: Item): Group => kindGroup(item.booking?.kind ?? item.kind)

/** Bookings per group, for the chips; `all` counts every booking. */
export function groupCounts(trip: Pick<Trip, 'items'>): Record<GroupFilter, number> {
  const out: Record<GroupFilter, number> = { all: 0, food: 0, activity: 0, transport: 0, lodging: 0, shopping: 0, other: 0 }
  for (const item of trip.items.filter(isBooking)) {
    out.all++
    out[bookingGroup(item)]++
  }
  return out
}

/** Bookings in date order under each date (item 50); undated ones last. */
export function bookingSections(trip: Pick<Trip, 'items' | 'days'>, filter: GroupFilter = 'all'): BookingSection[] {
  const items = trip.items.filter((i) => isBooking(i) && (filter === 'all' || bookingGroup(i) === filter))
  const byDate = new Map<string | null, Item[]>()
  for (const item of items) {
    const d = bookingDate(item)
    byDate.set(d, [...(byDate.get(d) ?? []), item])
  }
  const dates = [...byDate.keys()].sort((a, b) => (a == null ? 1 : b == null ? -1 : a.localeCompare(b)))
  return dates.map((date) => ({
    date,
    heading: date ? { date: monthDay(date), weekday: weekdayShort(date), city: trip.days.find((d) => d.date === date)?.city ?? null } : null,
    items: byDate.get(date)!.sort((a, b) => bookingStart(a) - bookingStart(b) || a.title.localeCompare(b.title)),
  }))
}

/** Where a stay's span sits on the trip's days, as fractions 0–1, for the bar under a hotel row. */
export function staySpan(stay: Stay, trip: Pick<Trip, 'startDate' | 'endDate'>): { from: number; to: number } | null {
  const days = nightDates({ checkInDate: trip.startDate, checkOutDate: addDays(trip.endDate, 1) })
  if (days.length === 0) return null
  const nights = nightDates(stay)
  if (nights.length === 0) return null
  const first = days.indexOf(nights[0])
  const last = days.indexOf(nights[nights.length - 1])
  const a = first < 0 ? (nights[0] < days[0] ? 0 : days.length) : first
  const b = last < 0 ? (nights[nights.length - 1] < days[0] ? -1 : days.length - 1) : last
  if (b < a) return null
  return { from: a / days.length, to: (b + 1) / days.length }
}

/** Cancellation deadlines from `today` up to `days` ahead, soonest first (shown in the mock, to confirm). */
export function deadlinesSoon(trip: Pick<Trip, 'items'>, today: string, days = 10): { item: Item; deadline: string }[] {
  const until = addDays(today, days)
  return trip.items
    .filter((i) => i.booking?.cancelDeadline)
    .map((item) => ({ item, deadline: item.booking!.cancelDeadline! }))
    .filter(({ deadline }) => {
      const d = deadline.slice(0, 10)
      return d >= today && d <= until
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
}

/** A Google Maps link for the booking: the place's own link, else a search for the address. */
export function mapsLink(item: Item, place: Place | undefined): string | null {
  if (place?.googleMapsUrl) return place.googleMapsUrl
  const address = item.booking?.address ?? place?.address
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  if (place?.lat != null && place?.lng != null) return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
  return null
}

/** Currencies a price can be in: the home currency, then the trip's (item 56a). */
export function tripCurrencies(trip: Pick<Trip, 'settings'>): string[] {
  return [trip.settings.homeCurrency, ...trip.settings.currencies.map((c) => c.code).filter((c) => c !== trip.settings.homeCurrency)]
}

// ---------- add and edit form ----------

/** The add / edit booking form, as typed. Times are `HH:MM`, dates `YYYY-MM-DD`; empty = not set. */
export interface BookingFields {
  kind: Kind
  title: string
  placeId: string
  /** Not a stay: the date, and optionally a time (which puts it on the timetable). */
  date: string
  start: string
  end: string
  /** A timed booking makes a fixed block ("Ticket booked", item 49). */
  fixed: boolean
  /** Stays (Lodging). */
  checkInDate: string
  checkOutDate: string
  checkInTime: string
  checkOutTime: string
  checkInFrom: string
  checkOutBy: string
  confirmation: string
  provider: string
  url: string
  address: string
  /** `YYYY-MM-DDTHH:MM` from `<input type="datetime-local">`. */
  cancelDeadline: string
  cancelNote: string
  notes: string
  amount: string
  currency: string
  perNight: boolean
  perPerson: boolean
  /** Empty = everyone on the trip (item 59). */
  people: string
  status: CostStatus
  countInBudget: boolean
}

export const isStayKind = (kind: Kind) => kind === 'lodging'

export function emptyFields(trip: Pick<Trip, 'settings' | 'startDate'>): BookingFields {
  return {
    kind: 'lodging',
    title: '',
    placeId: '',
    date: '',
    start: '',
    end: '',
    fixed: true,
    checkInDate: '',
    checkOutDate: '',
    checkInTime: '',
    checkOutTime: '',
    checkInFrom: '',
    checkOutBy: '',
    confirmation: '',
    provider: '',
    url: '',
    address: '',
    cancelDeadline: '',
    cancelNote: '',
    notes: '',
    amount: '',
    // The first currency added to the trip (a trip abroad is mostly paid in it), else the home currency.
    currency: tripCurrencies(trip)[1] ?? tripCurrencies(trip)[0],
    perNight: false,
    perPerson: false,
    people: '',
    status: 'booked',
    countInBudget: true,
  }
}

export function fieldsFromItem(item: Item, trip: Pick<Trip, 'settings' | 'startDate'>): BookingFields {
  const b = item.booking
  const c = item.cost
  return {
    ...emptyFields(trip),
    kind: b?.kind ?? item.kind,
    title: item.title,
    placeId: item.placeId ?? '',
    date: item.slot?.date ?? b?.date ?? '',
    start: clockInput(item.slot?.start),
    end: clockInput(item.slot?.end),
    fixed: item.slot ? !!item.slot.fixed : true,
    checkInDate: item.stay?.checkInDate ?? '',
    checkOutDate: item.stay?.checkOutDate ?? '',
    checkInTime: clockInput(item.stay?.checkIn?.start),
    checkOutTime: clockInput(item.stay?.checkOut?.start),
    checkInFrom: clockInput(item.stay?.checkInFrom),
    checkOutBy: clockInput(item.stay?.checkOutBy),
    confirmation: b?.confirmation ?? '',
    provider: b?.provider ?? '',
    url: b?.url ?? '',
    address: b?.address ?? '',
    cancelDeadline: b?.cancelDeadline ? b.cancelDeadline.replace(' ', 'T') : '',
    cancelNote: b?.cancelNote ?? '',
    notes: item.notes ?? '',
    amount: c ? String(c.amount) : '',
    currency: c?.currency ?? tripCurrencies(trip)[0],
    perNight: !!c?.perNight,
    perPerson: !!c?.perPerson,
    people: c?.people != null ? String(c.people) : '',
    status: c?.status ?? 'booked',
    countInBudget: b?.countInBudget ?? true,
  }
}

const orNull = (s: string) => (s.trim() === '' ? null : s.trim())

/** Check-in and check-out blocks last 30 minutes, like the sample's. */
const STAY_BLOCK_MINUTES = 30

function blockAt(date: string, start: number, minutes: number, was: Slot | null | undefined): Slot {
  const end = Math.min(start + minutes, 1440)
  // Keep a lock the block already had; otherwise new check-in / check-out blocks start unlocked.
  return { date, start, end, fixed: was?.fixed ?? false, fixedReason: was?.fixedReason ?? null }
}

type Built = { item: Item } | { error: string }

/** The item the form describes, built on `base` (the item being edited, if any). */
export function buildItem(f: BookingFields, id: string, base?: Item): Built {
  const title = f.title.trim()
  if (!title) return { error: 'Give the booking a title.' }
  let slot: Slot | null = null
  let stay: Stay | null = null
  let date: string | null = null

  if (isStayKind(f.kind)) {
    if (!f.checkInDate || !f.checkOutDate) return { error: 'A stay needs check-in and check-out dates.' }
    if (f.checkOutDate <= f.checkInDate) return { error: 'Check-out must be after check-in.' }
    const times = [f.checkInTime, f.checkOutTime, f.checkInFrom, f.checkOutBy].map((t) => (t ? parseClock(t) : null))
    if ([f.checkInTime, f.checkOutTime, f.checkInFrom, f.checkOutBy].some((t, i) => t && times[i] == null)) return { error: 'A time is not in HH:MM form.' }
    const [inT, outT, from, by] = times
    stay = {
      checkInDate: f.checkInDate,
      checkOutDate: f.checkOutDate,
      checkIn: inT == null ? null : blockAt(f.checkInDate, inT, STAY_BLOCK_MINUTES, base?.stay?.checkIn),
      checkOut: outT == null ? null : blockAt(f.checkOutDate, outT, STAY_BLOCK_MINUTES, base?.stay?.checkOut),
      checkInFrom: from,
      checkOutBy: by,
    }
  } else if (f.start) {
    if (!f.date) return { error: 'A booking with a time needs a date.' }
    const start = parseClock(f.start)
    if (start == null) return { error: 'The start time is not in HH:MM form.' }
    const end = f.end ? parseClock(f.end) : Math.min(start + 60, 1440)
    if (end == null) return { error: 'The end time is not in HH:MM form.' }
    if (end <= start) return { error: 'The end time must be after the start.' }
    const keepReason = base?.slot?.fixed && f.fixed ? base.slot.fixedReason : null
    slot = { date: f.date, start, end, fixed: f.fixed, fixedReason: f.fixed ? (keepReason ?? 'Ticket booked') : null }
  } else if (f.date) {
    date = f.date
  }

  const booking: Booking = {
    ...(base?.booking ?? {}),
    kind: f.kind,
    confirmation: orNull(f.confirmation),
    provider: orNull(f.provider),
    url: orNull(f.url),
    address: orNull(f.address),
    date,
    cancelDeadline: f.cancelDeadline ? f.cancelDeadline.replace('T', ' ').slice(0, 16) : null,
    cancelNote: orNull(f.cancelNote),
    files: base?.booking?.files ?? [],
    countInBudget: f.countInBudget,
  }

  let cost: Cost | null = null
  if (f.amount.trim()) {
    const amount = parseAmount(f.amount)
    if (amount == null) return { error: 'The price is not a number of 0 or more.' }
    let people: number | null = null
    if (f.people.trim()) {
      people = Number(f.people)
      if (!Number.isInteger(people) || people < 1) return { error: 'People is a whole number, 1 or more.' }
    }
    cost = {
      amount,
      currency: f.currency,
      perNight: f.perNight,
      perPerson: f.perPerson,
      people,
      status: f.status,
      replacedEstimate: base?.cost?.replacedEstimate ?? null,
      date: base?.cost?.date ?? null,
    }
  }

  return {
    item: {
      id,
      title,
      placeId: orNull(f.placeId),
      kind: f.kind,
      slot,
      stay,
      booking,
      cost,
      notes: orNull(f.notes),
    },
  }
}

/** JSON with sorted keys and null / missing fields dropped, so field order and absent-vs-null don't count as a change. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v).sort()) {
      const x = (v as Record<string, unknown>)[k]
      if (x != null) out[k] = canonical(x)
    }
    return out
  }
  return v ?? null
}

export const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/**
 * Commands for the form: one `addItem` for a new booking; for an edit, only
 * what changed. A fixed block whose time is edited here is unlocked and locked
 * again in the same step, since the booking form is where a booked time changes.
 */
export function bookingCommands(f: BookingFields, id: string, base?: Item): { commands: Command[] } | { error: string } {
  const built = buildItem(f, id, base)
  if ('error' in built) return built
  const next = built.item
  if (!base) return { commands: [{ op: 'addItem', item: next }] }

  const commands: Command[] = []
  const set: Record<string, unknown> = {}
  for (const key of ['title', 'placeId', 'kind', 'notes'] as const) {
    if (!same(base[key], next[key])) set[key] = next[key] ?? null
  }
  let relock: Slot | null = null
  if (!same(base.slot, next.slot)) {
    const moved = base.slot && next.slot && (base.slot.date !== next.slot.date || base.slot.start !== next.slot.start || base.slot.end !== next.slot.end)
    if (moved && base.slot!.fixed && next.slot!.fixed) {
      set.slot = { ...next.slot, fixed: false, fixedReason: null }
      relock = next.slot ?? null
    } else {
      set.slot = next.slot
    }
  }
  if (Object.keys(set).length) commands.push({ op: 'updateItem', id, set })
  if (relock) commands.push({ op: 'setFixed', id, fixed: true, reason: relock.fixedReason ?? null })
  if (!same(base.stay, next.stay)) commands.push({ op: 'setStay', id, stay: next.stay ?? null })
  if (!same(base.booking, next.booking)) commands.push({ op: 'setBooking', id, booking: next.booking ?? null })
  if (!same(base.cost, next.cost)) commands.push({ op: 'setCost', id, cost: next.cost ?? null })
  return { commands }
}

// ---------- price forms (items 58–60) ----------

/** Item 58: neither on is the whole booking; both on is per person per night. */
export function basisHint(perNight: boolean, perPerson: boolean): string {
  if (perNight && perPerson) return 'Both on: the price is per person per night.'
  if (perNight) return 'The price is per night.'
  if (perPerson) return 'The price is per person.'
  return 'Neither on: the price is the whole booking (total).'
}

/** The forms the user didn't type, marked as calculated (item 60). */
export function calculated(f: CostForms): string[] {
  const m = (n: number) => `≈ ${money(n, f.currency)}`
  const out: string[] = []
  if (f.basis !== 'perNight' && f.perNight != null && f.nights > 1) out.push(`${m(f.perNight)} / night`)
  if (f.basis !== 'perPerson' && f.people > 1) out.push(`${m(f.perPerson)} per person`)
  if (f.basis !== 'perPersonPerNight' && f.perPersonPerNight != null && f.nights > 1 && f.people > 1) out.push(`${m(f.perPersonPerNight)} per person / night`)
  return out.length ? out : ['nothing else to work out']
}

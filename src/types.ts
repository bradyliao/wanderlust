// JSON shapes returned by the Rust core (core/src/model.rs, api.rs, budget.rs).
// Only the fields the app shell reads are typed; the rest stay `unknown` and
// are passed back to the core untouched.

/** Travel modes in Google Maps order (item 33). */
export type Mode = 'drive' | 'transit' | 'walk' | 'twoWheeler' | 'cycle' | 'ride'

/** The six groups (item 81). */
export type Group = 'food' | 'activity' | 'transport' | 'lodging' | 'shopping' | 'other'

export interface CurrencyRate {
  code: string
  rateToHome: number
  setOn: string | null
}

export interface Settings {
  people: number
  defaultMode: Mode
  homeCurrency: string
  currencies: CurrencyRate[]
  budget: number | null
  limits: Partial<Record<Group, number>>
}

export type Author = { type: 'user' } | { type: 'ai'; source: string | null }

/** One undo step in the change log (item 76). */
export interface LogGroup {
  id: string
  author: Author
  at: string
  label: string
  changes: unknown[]
}

export interface Trip {
  format: string
  version: number
  id: string
  name: string
  startDate: string
  endDate: string
  settings: Settings
  days: unknown[]
  places: Place[]
  items: Item[]
  legs: unknown[]
  /** Newest last. */
  log: LogGroup[]
}

/** The 15 sub-categories (item 81). Places use all but `localTravel`. */
export type Kind =
  | 'food'
  | 'cafe'
  | 'dessert'
  | 'sight'
  | 'museum'
  | 'nature'
  | 'nightlife'
  | 'flight'
  | 'train'
  | 'bus'
  | 'car'
  | 'localTravel'
  | 'lodging'
  | 'shopping'
  | 'other'

/** Unrated, then the three ratings (items 17a, 68). */
export type Rating = 'unrated' | 'forget' | 'soSo' | 'mustGo'

/** Minutes from local midnight; `close <= open` runs past midnight, `0..1440` is all day. */
export interface TimeRange {
  open: number
  close: number
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

/** Per weekday: missing or null = unknown, `[]` = closed. */
export type OpeningHours = Partial<Record<Weekday, TimeRange[] | null>>

export interface PlaceCost {
  amount: number
  currency: string
  perPerson: boolean
}

/** A place in the Place List (model.rs `Place`). */
export interface Place {
  id: string
  name: string
  nameLocal?: string | null
  kind: Kind
  area?: string | null
  city?: string | null
  country?: string | null
  googleMapsUrl?: string | null
  lat?: number | null
  lng?: number | null
  address?: string | null
  usualStayMinutes?: number | null
  openingHours?: OpeningHours | null
  hoursNote?: string | null
  estimatedCost?: PlaceCost | null
  rating: Rating
  tags?: string[]
  notes?: string | null
  aiNotes?: string | null
  /** Field names (camelCase) that came from an import and are not checked yet (item 69). */
  unverified?: string[]
  source?: unknown
  updatedAt?: string | null
}

export interface Slot {
  date: string
  start: number
  end: number
  fixed?: boolean
  fixedReason?: string | null
}

/** Only the parts of an item the Place List reads (model.rs `Item`). */
export interface Item {
  id: string
  title: string
  placeId?: string | null
  kind: Kind
  slot?: Slot | null
  stay?: { checkInDate: string; checkOutDate: string; checkIn?: Slot | null; checkOut?: Slot | null } | null
  booking?: { kind: Kind; date?: string | null } | null
  cost?: unknown
  notes?: string | null
}

/** One place in an import preview (import.rs `PreviewPlace`). */
export interface PreviewPlace {
  number: number
  name: string
  area: string | null
  kind: Kind | null
  rating: Rating
}

export interface PreviewDuplicate {
  number: number
  name: string
  matchedBy: 'link' | 'nameAndArea'
  existingPlaceId: string | null
  sameAsNumber: number | null
  existingName: string
  /** Place field names it would fill; empty = nothing new. */
  fills: string[]
}

/** What a place import would do (import.rs `Preview`, item 70). */
export interface ImportPreview {
  newPlaces: PreviewPlace[]
  linkOnly: PreviewPlace[]
  duplicates: PreviewDuplicate[]
  problems: string[]
}

/** Who made a change and when (api.rs `StampIn`). */
export interface Stamp {
  groupId: string
  at: string
  label: string
  aiSource?: string
}

/** A command (core/src/commands.rs). Only the ones the shell sends are typed. */
export type Command =
  | { op: 'setPeople'; people: number }
  | { op: 'setDefaultMode'; mode: Mode }
  | { op: 'addPlace'; place: Place }
  /** `set` holds place fields (camelCase); `null` clears one. */
  | { op: 'updatePlace'; id: string; set: Record<string, unknown> }
  | { op: 'ratePlace'; id: string; rating: Rating }
  | { op: 'removePlace'; id: string }

/** One day of `planView`. */
export interface PlanDay {
  date: string
  /** `12/02` */
  label: string
  /** `Wed` */
  weekday: string
  city: string | null
  mode: Mode
  modeIsOverride: boolean
  blocks: unknown[]
  legs: unknown[]
  night: unknown
  warnings: unknown[]
  location: [number, number] | null
}

export interface GroupLine {
  group: Group
  home: number
  bookedHome: number
  estimatedHome: number
  limit: number | null
}

/** The fields of `budgetSummary` the shell shows. */
export interface BudgetSummary {
  homeCurrency: string
  people: number
  planned: number
  booked: number
  estimated: number
  perPerson: number
  budget: number | null
  left: number | null
  groups: GroupLine[]
  missingRates: string[]
}

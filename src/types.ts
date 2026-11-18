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
  places: unknown[]
  items: unknown[]
  legs: unknown[]
  /** Newest last. */
  log: LogGroup[]
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

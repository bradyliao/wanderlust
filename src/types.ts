export type Category = 'sight' | 'food' | 'lodging' | 'shopping' | 'transport' | 'other'
export type Wish = 'want' | 'maybe' | 'skip'
export type Pace = 'relaxed' | 'standard' | 'packed'
export type LegMode = 'walk' | 'transit' | 'drive'

export interface Traveler {
  id: string
  name: string
}

/** A candidate spot in the pool. Not every place ends up on the timetable. */
export interface Place {
  id: string
  name: string
  area: string
  category: Category
  lat: number
  lng: number
  /** Suggested length of a visit, minutes. */
  stayMin: number
  /** Opening and closing time, minutes from midnight. */
  open?: number
  close?: number
  /** Weekdays it is closed, 0 = Sunday. */
  closedDays?: number[]
  seasonal?: string
  note?: string
  /** Where the idea came from, e.g. a post link. */
  source?: string
  wishes: Record<string, Wish>
}

/** A stay on the timetable. Travel between stays is derived, see lib/schedule.ts. */
export interface Block {
  id: string
  /** ISO date, YYYY-MM-DD. */
  day: string
  /** Minutes from midnight. */
  start: number
  end: number
  title: string
  category: Category
  placeId?: string
  note?: string
  /** Fixed blocks (flights, sunsets, bus departures) cannot be dragged. */
  locked?: boolean
  /** Not decided yet; drawn dashed. */
  tentative?: boolean
  /** Cost per person in the trip currency. */
  cost?: number
}

/** What the user confirmed for the travel between two stays, replacing the estimate. */
export interface LegOverride {
  mode: LegMode
  minutes: number
  /** Fare per person in the trip currency. */
  cost?: number
  note?: string
  verified: boolean
}

export interface ChecklistItem {
  id: string
  text: string
  note?: string
  done: boolean
}

export interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  travelers: Traveler[]
  pace: Pace
  /** Currency prices are entered in, e.g. JPY. */
  currency: string
  /** Currency the traveller thinks in, e.g. TWD. */
  homeCurrency: string
  /** 1 unit of `currency` in `homeCurrency`. */
  rate: number
  rateDate: string
  places: Place[]
  blocks: Block[]
  /** Keyed by `${fromBlockId}>${toBlockId}`. */
  legs: Record<string, LegOverride>
  checklist: ChecklistItem[]
}

export type Selection =
  | { type: 'block'; id: string }
  | { type: 'place'; id: string }
  | { type: 'leg'; key: string }
  | null

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'sight', label: 'Sight' },
  { id: 'food', label: 'Food' },
  { id: 'lodging', label: 'Lodging' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'transport', label: 'Transport' },
  { id: 'other', label: 'Other' },
]

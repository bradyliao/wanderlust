import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react'
import { sampleTrip } from './sample'
import { swapDays } from './lib/schedule'
import { tripDays } from './lib/time'
import type { Block, ChecklistItem, LegOverride, Place, Selection, Trip } from './types'

const STORAGE_KEY = 'travel-planner:trip:v1'
const HISTORY_LIMIT = 40

export type Action =
  | { type: 'load'; trip: Trip }
  | { type: 'undo' }
  | { type: 'updateTrip'; patch: Partial<Trip> }
  | { type: 'addPlace'; place: Place }
  | { type: 'updatePlace'; id: string; patch: Partial<Place> }
  | { type: 'removePlace'; id: string }
  | { type: 'addBlock'; block: Block }
  | { type: 'updateBlock'; id: string; patch: Partial<Block> }
  | { type: 'removeBlock'; id: string }
  | { type: 'swapDays'; a: string; b: string }
  | { type: 'setLeg'; key: string; leg: LegOverride | undefined }
  | { type: 'addCheck'; item: ChecklistItem }
  | { type: 'updateCheck'; id: string; patch: Partial<ChecklistItem> }
  | { type: 'removeCheck'; id: string }

interface State {
  trip: Trip
  past: Trip[]
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function apply(trip: Trip, action: Action): Trip {
  switch (action.type) {
    case 'updateTrip':
      return { ...trip, ...action.patch }
    case 'addPlace':
      return { ...trip, places: [...trip.places, action.place] }
    case 'updatePlace':
      return { ...trip, places: trip.places.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) }
    case 'removePlace':
      return {
        ...trip,
        places: trip.places.filter((p) => p.id !== action.id),
        blocks: trip.blocks.map((b) => (b.placeId === action.id ? { ...b, placeId: undefined } : b)),
      }
    case 'addBlock':
      return { ...trip, blocks: [...trip.blocks, action.block] }
    case 'updateBlock':
      return { ...trip, blocks: trip.blocks.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)) }
    case 'removeBlock':
      return { ...trip, blocks: trip.blocks.filter((b) => b.id !== action.id) }
    case 'swapDays':
      return swapDays(trip, action.a, action.b)
    case 'setLeg': {
      const legs = { ...trip.legs }
      if (action.leg) legs[action.key] = action.leg
      else delete legs[action.key]
      return { ...trip, legs }
    }
    case 'addCheck':
      return { ...trip, checklist: [...trip.checklist, action.item] }
    case 'updateCheck':
      return { ...trip, checklist: trip.checklist.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) }
    case 'removeCheck':
      return { ...trip, checklist: trip.checklist.filter((c) => c.id !== action.id) }
    default:
      return trip
  }
}

function reducer(state: State, action: Action): State {
  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    return previous ? { trip: previous, past: state.past.slice(0, -1) } : state
  }
  const trip = action.type === 'load' ? action.trip : apply(state.trip, action)
  if (trip === state.trip) return state
  return { trip, past: [...state.past, state.trip].slice(-HISTORY_LIMIT) }
}

/**
 * Checks stored or imported data and brings older files up to the current shape.
 * Returns undefined when the value is not a trip.
 */
export function readTrip(value: unknown): Trip | undefined {
  const t = value as Trip & { travelers?: unknown[] }
  const ok = !!t && typeof t === 'object' && typeof t.name === 'string' && typeof t.startDate === 'string' && Array.isArray(t.places) && Array.isArray(t.blocks) && Array.isArray(t.checklist) && !!t.legs && typeof t.legs === 'object'
  if (!ok) return undefined
  // Files from before ratings listed travellers by name, each with their own wishes.
  const { travelers, ...rest } = t
  const partySize = typeof t.partySize === 'number' && t.partySize >= 1 ? t.partySize : Math.max(1, travelers?.length ?? 1)
  const places = t.places.map((p) => {
    const { wishes: _wishes, ...place } = p as Place & { wishes?: unknown }
    return place
  })
  return { ...rest, partySize, places }
}

function initialTrip(): Trip {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const trip = readTrip(JSON.parse(raw))
      if (trip) return trip
    }
  } catch {
    // Storage is unavailable or the saved trip is unreadable: start from the sample.
  }
  return sampleTrip()
}

interface AppContext {
  trip: Trip
  days: string[]
  canUndo: boolean
  dispatch: Dispatch<Action>
  selection: Selection
  select: (s: Selection) => void
  activeDay: string
  setActiveDay: (day: string) => void
}

const Ctx = createContext<AppContext | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ trip: initialTrip(), past: [] }))
  const [selection, select] = useState<Selection>(null)
  const days = useMemo(() => tripDays(state.trip), [state.trip])
  const [pickedDay, setActiveDay] = useState('')
  const activeDay = days.includes(pickedDay) ? pickedDay : (days[0] ?? '')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trip))
    } catch {
      // Saving is best effort; the trip can still be exported as a file.
    }
  }, [state.trip])

  const value = useMemo<AppContext>(
    () => ({ trip: state.trip, days, canUndo: state.past.length > 0, dispatch, selection, select, activeDay, setActiveDay }),
    [state, days, selection, activeDay],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

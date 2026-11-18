// Typed wrapper around the Rust core (core/pkg, built by `npm run core`).
// Every call JSON-stringifies its inputs, parses the result, and throws a
// CoreError with the core's plain-words message when `ok` is false.

import init, * as wasm from '../core/pkg/wanderlust_core.js'
import wasmUrl from '../core/pkg/wanderlust_core_bg.wasm?url'
import type { BudgetSummary, Command, PlanDay, Stamp, Trip } from './types'

export class CoreError extends Error {
  /** Index of the failing command, when a list of commands failed. */
  readonly index?: number
  constructor(message: string, index?: number) {
    super(message)
    this.name = 'CoreError'
    this.index = index
  }
}

let ready = false
let loading: Promise<void> | null = null

/** Load the Wasm in the browser. Safe to call more than once. */
export function loadCore(): Promise<void> {
  loading ??= init({ module_or_path: wasmUrl }).then(
    () => {
      ready = true
    },
    (e: unknown) => {
      loading = null
      throw new CoreError(`The planner core could not be loaded: ${messageOf(e)}`)
    },
  )
  return loading
}

/** Load the Wasm from bytes (tests, Node). */
export function loadCoreSync(bytes: BufferSource): void {
  if (ready) return
  wasm.initSync({ module: bytes })
  ready = true
}

type Ok<T> = T & { ok: true }

function read<T>(text: string): Ok<T> {
  let result: { ok?: boolean; error?: string; index?: number }
  try {
    result = JSON.parse(text)
  } catch {
    throw new CoreError('The planner core returned something unreadable.')
  }
  if (!result.ok) throw new CoreError(result.error ?? 'Something went wrong.', result.index)
  return result as Ok<T>
}

function call<T>(run: () => string): Ok<T> {
  if (!ready) throw new CoreError('The planner core is not loaded yet.')
  return read<T>(run())
}

const json = (value: unknown) => JSON.stringify(value)

/** A stamp for a change made by the user now. */
export function userStamp(label: string): Stamp {
  return { groupId: crypto.randomUUID(), at: new Date().toISOString(), label }
}

export function newTrip(name: string, startDate: string, endDate: string): Trip {
  return call<{ trip: Trip }>(() => wasm.newTrip(crypto.randomUUID(), name, startDate, endDate)).trip
}

/** Check a trip file's text and return the trip. */
export function openTrip(text: string): Trip {
  return call<{ trip: Trip }>(() => wasm.openTrip(text)).trip
}

/** Apply commands as one undo step. */
export function applyCommands(trip: Trip, commands: Command[], stamp: Stamp): Trip {
  return call<{ trip: Trip }>(() => wasm.applyCommands(json(trip), json(commands), json(stamp))).trip
}

/** Apply an AI change file (`wanderlust-changes`) live, as one log group. */
export function applyChangeFile(trip: Trip, fileText: string, source: string): { trip: Trip; count: number } {
  const r = call<{ trip: Trip; count: number }>(() =>
    wasm.applyChangeFile(json(trip), fileText, crypto.randomUUID(), new Date().toISOString(), source),
  )
  return { trip: r.trip, count: r.count }
}

/** Undo the newest step. `undone` is its label, or null when the log is empty. */
export function undoLast(trip: Trip): { trip: Trip; undone: string | null } {
  const r = call<{ trip: Trip; undone: string | null }>(() => wasm.undoLast(json(trip)))
  return { trip: r.trip, undone: r.undone }
}

/** Undo `groupId` and everything after it. */
export function undoTo(trip: Trip, groupId: string): { trip: Trip; steps: number } {
  const r = call<{ trip: Trip; steps: number }>(() => wasm.undoTo(json(trip), groupId))
  return { trip: r.trip, steps: r.steps }
}

export function planView(trip: Trip): PlanDay[] {
  return call<{ days: PlanDay[] }>(() => wasm.planView(json(trip))).days
}

export function budgetSummary(trip: Trip): BudgetSummary {
  return call<BudgetSummary>(() => wasm.budgetSummary(json(trip)))
}

/** Plain-words message for anything thrown while calling the core. */
export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

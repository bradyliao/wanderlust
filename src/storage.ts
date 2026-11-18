// Trips in IndexedDB (decisions.md, Backend: local-first). One object store,
// keyed by trip id; each record is the trip itself plus when it was saved.

import type { Trip } from './types'

const DB_NAME = 'wanderlust'
const DB_VERSION = 1
const STORE = 'trips'

interface Stored {
  id: string
  savedAt: string
  trip: Trip
}

/** What the trip picker shows. */
export interface TripSummary {
  id: string
  name: string
  startDate: string
  endDate: string
  savedAt: string
}

export function summarize(record: Stored): TripSummary {
  const { id, name, startDate, endDate } = record.trip
  return { id, name, startDate, endDate, savedAt: record.savedAt }
}

/** Newest saved first. */
export function sortSummaries(list: TripSummary[]): TripSummary[] {
  return [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser cannot store trips (IndexedDB is not available).'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new Error(`Trips could not be opened: ${req.error?.message ?? 'unknown error'}`))
    req.onblocked = () => reject(new Error('Trips are locked by another Wanderlust tab. Close it and reload.'))
  })
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode)
        const req = work(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(new Error(`The trip could not be saved: ${tx.error?.message ?? 'unknown error'}`))
        tx.onabort = () => reject(new Error(`The trip could not be saved: ${tx.error?.message ?? 'aborted'}`))
      }),
  )
}

export async function listTrips(): Promise<TripSummary[]> {
  const all = await run<Stored[]>('readonly', (s) => s.getAll())
  return sortSummaries(all.map(summarize))
}

export async function loadTrip(id: string): Promise<Trip | null> {
  const rec = await run<Stored | undefined>('readonly', (s) => s.get(id))
  return rec?.trip ?? null
}

export async function hasTrip(id: string): Promise<boolean> {
  const n = await run<number>('readonly', (s) => s.count(id))
  return n > 0
}

export async function saveTrip(trip: Trip): Promise<void> {
  const record: Stored = { id: trip.id, savedAt: new Date().toISOString(), trip }
  await run('readwrite', (s) => s.put(record))
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImportDialog } from './components/ImportDialog'
import { TopBar, type Page } from './components/TopBar'
import { TripDialog } from './components/TripDialog'
import * as core from './core'
import { download, takePickedFile } from './files'
import { modeLabel, tripFileName } from './format'
import { PlanPage } from './pages/PlanPage'
import { BookingsPage } from './pages/BookingsPage'
import { BudgetPage } from './pages/BudgetPage'
import { loadPrefs, savePrefs, type Prefs } from './prefs'
import { SelectionContext, type SelectFrom, type Selection } from './selection'
import { hasTrip, listTrips, loadTrip, saveTrip, type TripSummary } from './storage'
import type { Command, ImportPreview, LogGroup, Mode, Trip } from './types'

type Notice = { kind: 'info' | 'error'; text: string }
type Boot = { state: 'loading' } | { state: 'failed'; message: string } | { state: 'ready' }

function attempt<T>(work: () => T): T | null {
  try {
    return work()
  } catch {
    return null
  }
}

export default function App() {
  const [boot, setBoot] = useState<Boot>({ state: 'loading' })
  const [trip, setTrip] = useState<Trip | null>(null)
  const tripRef = useRef<Trip | null>(null)
  const [dialog, setDialog] = useState<TripSummary[] | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [page, setPage] = useState<Page>('plan')
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const tripFileInput = useRef<HTMLInputElement>(null)
  const changeFileInput = useRef<HTMLInputElement>(null)
  const placesFileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<{ name: string; text: string; preview: ImportPreview } | null>(null)

  // Selected and hovered place, shared by the panes (items 5–8).
  const [selected, setSelected] = useState<{ id: string | null; from: SelectFrom | null }>({ id: null, from: null })
  const [hovered, setHovered] = useState<string | null>(null)
  // The day in focus (item 10), kept per trip; falls back to the first day.
  const [focus, setFocus] = useState<{ tripId: string; date: string } | null>(null)
  const focusDate =
    trip && focus?.tripId === trip.id && focus.date >= trip.startDate && focus.date <= trip.endDate ? focus.date : (trip?.startDate ?? null)
  const tripId = trip?.id
  const selection = useMemo<Selection>(
    () => ({
      selectedPlaceId: selected.id,
      selectedFrom: selected.from,
      hoveredPlaceId: hovered,
      select: (id, from) => setSelected({ id, from }),
      hover: setHovered,
      focusDate,
      setFocusDate: (date) => {
        if (tripId) setFocus({ tripId, date })
      },
    }),
    [selected, hovered, focusDate, tripId],
  )

  useEffect(() => savePrefs(prefs), [prefs])

  const info = useCallback((text: string) => setNotice({ kind: 'info', text }), [])
  const fail = useCallback((text: string) => setNotice({ kind: 'error', text }), [])

  // Info notices fade after a few seconds; errors stay until closed.
  useEffect(() => {
    if (notice?.kind !== 'info') return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  /** Show a trip and save it (autosave after every change). */
  const commit = useCallback(
    (next: Trip) => {
      tripRef.current = next
      setTrip(next)
      setPrefs((p) => (p.lastTripId === next.id ? p : { ...p, lastTripId: next.id }))
      saveTrip(next).catch((e) => fail(core.messageOf(e)))
    },
    [fail],
  )

  // Load the core, then the last trip (or ask for one).
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        await core.loadCore()
      } catch (e) {
        if (live) setBoot({ state: 'failed', message: core.messageOf(e) })
        return
      }
      try {
        const lastId = loadPrefs().lastTripId
        const last = lastId ? await loadTrip(lastId) : null
        if (!live) return
        if (last) {
          const checked = core.openTrip(JSON.stringify(last))
          tripRef.current = checked
          setTrip(checked)
        } else {
          setDialog(await listTrips())
        }
      } catch (e) {
        if (!live) return
        fail(core.messageOf(e))
        setDialog([])
      }
      if (live) setBoot({ state: 'ready' })
    })()
    return () => {
      live = false
    }
  }, [fail])

  // ----- changes, through commands only (items 72–76)

  /** Apply commands as one undo step. False when the core refused (the notice says why). */
  const apply = useCallback(
    (commands: Command[], label: string): boolean => {
      const t = tripRef.current
      if (!t) return false
      try {
        commit(core.applyCommands(t, commands, core.userStamp(label)))
        return true
      } catch (e) {
        fail(core.messageOf(e))
        return false
      }
    },
    [commit, fail],
  )

  /** From the Bookings page: the Plan page with that day in focus and the place selected. */
  const showOnTimetable = (date: string, placeId: string | null) => {
    if (tripId) setFocus({ tripId, date })
    if (placeId) setSelected({ id: placeId, from: 'bookings' })
    setPage('plan')
  }

  const setPeople = (people: number) => apply([{ op: 'setPeople', people }], `People: ${people}`)
  const setMode = (mode: Mode) => apply([{ op: 'setDefaultMode', mode }], `Transport: ${modeLabel(mode)}`)

  const undo = useCallback(() => {
    const t = tripRef.current
    if (!t) return
    try {
      const r = core.undoLast(t)
      if (r.undone == null) return info('Nothing to undo.')
      commit(r.trip)
      info(`Undid “${r.undone}”.`)
    } catch (e) {
      fail(core.messageOf(e))
    }
  }, [commit, fail, info])

  const undoTo = (group: LogGroup) => {
    const t = tripRef.current
    if (!t) return
    const index = t.log.findIndex((g) => g.id === group.id)
    const count = index < 0 ? 0 : t.log.length - index
    if (count > 1 && !window.confirm(`Undo ${count} changes, back to before “${group.label}”? This can't be redone.`)) return
    try {
      const r = core.undoTo(t, group.id)
      commit(r.trip)
      info(r.steps === 1 ? `Undid “${group.label}”.` : `Undid ${r.steps} changes.`)
    } catch (e) {
      fail(core.messageOf(e))
    }
  }

  // ⌘Z / Ctrl+Z, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if (!tripRef.current) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  // ----- trips and files

  const showTrips = async () => {
    try {
      setDialog(await listTrips())
    } catch (e) {
      fail(core.messageOf(e))
    }
  }

  const createTrip = async (name: string, start: string, end: string) => {
    const t = core.newTrip(name, start, end) // throws in plain words; the dialog shows it
    commit(t)
    setDialog(null)
    setPage('plan')
  }

  const pickTrip = async (id: string) => {
    try {
      const t = await loadTrip(id)
      if (!t) return fail('That trip is not saved here any more.')
      const checked = core.openTrip(JSON.stringify(t))
      tripRef.current = checked
      setTrip(checked)
      setPrefs((p) => ({ ...p, lastTripId: checked.id }))
      setDialog(null)
    } catch (e) {
      fail(core.messageOf(e))
    }
  }

  const openTripFile = async () => {
    const input = tripFileInput.current
    if (!input) return
    try {
      const file = await takePickedFile(input)
      if (!file) return
      const t = core.openTrip(file.text)
      const exists = await hasTrip(t.id).catch(() => false)
      if (exists && !window.confirm(`“${t.name}” is already saved here. Replace it with the copy in ${file.name}?`)) return
      commit(t)
      setDialog(null)
      info(`Opened ${file.name}.`)
    } catch (e) {
      fail(`That trip file could not be opened: ${core.messageOf(e)}`)
    }
  }

  const exportTrip = () => {
    const t = tripRef.current
    if (!t) return
    download(JSON.stringify(t, null, 2), tripFileName(t.name))
  }

  const importChangeFile = async () => {
    const input = changeFileInput.current
    const t = tripRef.current
    if (!input || !t) return
    let name = 'the change file'
    try {
      const file = await takePickedFile(input)
      if (!file) return
      name = file.name
      const r = core.applyChangeFile(t, file.text, file.name)
      commit(r.trip)
      info(`Applied ${r.count} ${r.count === 1 ? 'change' : 'changes'} from ${file.name}. Undo takes the whole file back.`)
    } catch (e) {
      fail(`${name} was not applied: ${core.messageOf(e)}`)
    }
  }

  // Place import (items 66–71): pick a file, preview, then import as one step.
  const pickPlacesFile = async () => {
    const input = placesFileInput.current
    const t = tripRef.current
    if (!input || !t) return
    let name = 'the places file'
    try {
      const file = await takePickedFile(input)
      if (!file) return
      name = file.name
      setPendingImport({ ...file, preview: core.importPreview(t, file.text) })
    } catch (e) {
      fail(`${name} could not be read: ${core.messageOf(e)}`)
    }
  }

  const confirmImport = () => {
    const t = tripRef.current
    const pending = pendingImport
    if (!t || !pending) return
    setPendingImport(null)
    try {
      const added = pending.preview.newPlaces.length + pending.preview.linkOnly.length
      const r = core.importPlaces(t, pending.text, `imp-${core.shortId()}`, core.userStamp(`Imported places from ${pending.name}`))
      commit(r.trip)
      const filled = r.count - added
      const parts = [`${added} ${added === 1 ? 'place' : 'places'} added`, filled > 0 ? `${filled} filled in` : null].filter(Boolean)
      info(`Imported ${pending.name}: ${parts.join(', ')}. Undo takes the whole import back.`)
    } catch (e) {
      fail(`${pending.name} was not imported: ${core.messageOf(e)}`)
    }
  }

  // ----- views from the core

  const days = useMemo(() => (trip ? attempt(() => core.planView(trip)) : null), [trip])
  const budget = useMemo(() => (trip ? attempt(() => core.budgetSummary(trip)) : null), [trip])

  if (boot.state === 'loading') return <div className="loading">Loading…</div>
  if (boot.state === 'failed') return <div className="loading">{boot.message}</div>

  return (
    <div className="app">
      {trip && (
        <TopBar
          trip={trip}
          budget={budget}
          page={page}
          onPage={setPage}
          layout={prefs.layout}
          onLayout={(layout) => setPrefs((p) => ({ ...p, layout }))}
          onPeople={setPeople}
          onMode={setMode}
          onUndo={undo}
          onUndoTo={undoTo}
          onTrips={showTrips}
          onNewTrip={() => setDialog([])}
          onOpenFile={() => tripFileInput.current?.click()}
          onExport={exportTrip}
          onChangeFile={() => changeFileInput.current?.click()}
          onImportPlaces={() => placesFileInput.current?.click()}
        />
      )}

      {notice && (
        <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <span className="text">{notice.text}</span>
          <button type="button" className="btn ghost" onClick={() => setNotice(null)}>
            Close
          </button>
        </div>
      )}

      {trip && page === 'plan' && (
        <SelectionContext.Provider value={selection}>
          <PlanPage
            trip={trip}
            days={days}
            prefs={prefs}
            onPrefs={setPrefs}
            apply={apply}
            onImportPlaces={() => placesFileInput.current?.click()}
          />
        </SelectionContext.Provider>
      )}
      {trip && page === 'bookings' && <BookingsPage trip={trip} apply={apply} onShowOnTimetable={showOnTimetable} />}
      {trip && page === 'budget' && <BudgetPage trip={trip} summary={budget} apply={apply} />}

      {dialog && (
        <TripDialog
          trips={dialog}
          onCreate={createTrip}
          onPick={pickTrip}
          onOpenFile={() => tripFileInput.current?.click()}
          onCancel={trip ? () => setDialog(null) : undefined}
        />
      )}

      <input ref={tripFileInput} type="file" accept=".json,application/json" hidden onChange={openTripFile} />
      {pendingImport && (
        <ImportDialog
          fileName={pendingImport.name}
          preview={pendingImport.preview}
          onConfirm={confirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}

      <input ref={placesFileInput} type="file" accept=".json,application/json" hidden onChange={pickPlacesFile} />
      <input ref={changeFileInput} type="file" accept=".json,application/json" hidden onChange={importChangeFile} />
    </div>
  )
}

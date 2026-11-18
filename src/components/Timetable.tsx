// The Timetable pane (phase 4): multi-day view and list view (item 3).
//
// Multi-day view: day columns over a 24-hour grid that opens at 6:00 and
// scrolls both ways (items 4, 43); each column's background follows that
// day's daylight (items 21–23). Places are dragged in from the Place List
// (HTML drag and drop, item 11); blocks are moved and resized with pointer
// events (item 13) and dragged back onto the Place List to unschedule
// (item 14). While dragging, the core's preview gives the closed hours to
// hatch (item 27) and the travel needed before and after (items 29, 30); the
// preview is asked only when the snapped slot changes.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import * as core from '../core'
import { listDrag } from '../dragging'
import { modeLabel, monthDay } from '../format'
import { clock, kindGroup, ratingLabel, waitsForTime } from '../places'
import { clampTo, COLUMN_WIDTH, HOUR_HEIGHT, type Prefs, type TimetableView } from '../prefs'
import { useSelection } from '../selection'
import {
  blockGroup,
  blockName,
  DAY_MINUTES,
  daylightGradient,
  dropSlot,
  hatchBands,
  layoutLanes,
  legHasOwnMode,
  minuteToPx,
  moveSlot,
  pxToMinute,
  resizeSlot,
  scrollTopFor,
  sunMarks,
  timeRange,
  travelBand,
  VIEW_START,
  warningsByBlock,
  type Slot,
} from '../timetable'
import type { Block, Command, DayClosed, DragPreview, Group, Item, Kind, LegView, Mode, Place, PlanDay, Trip } from '../types'
import { ChevronSide, KindIcon } from './icons'
import { BlockIcon, DayLabel, LockButton, LockForm, ModePicker, TravelLabel, WarnMark } from './TimetableParts'

interface Props {
  trip: Trip
  days: PlanDay[]
  prefs: Prefs
  onPrefs: (update: (p: Prefs) => Prefs) => void
  apply: (commands: Command[], label: string) => boolean
}

/** Multi-day / List toggle for the pane header (item 3). */
export function TimetableTools({ view, onView }: { view: TimetableView; onView: (v: TimetableView) => void }) {
  return (
    <>
      <div className="seg" role="group" aria-label="Timetable view">
        <button type="button" aria-pressed={view === 'days'} onClick={() => onView('days')}>
          Multi-day
        </button>
        <button type="button" aria-pressed={view === 'list'} onClick={() => onView('list')}>
          List
        </button>
      </div>
      <span className="spacer" />
    </>
  )
}

type Pop = { type: 'leg'; leg: LegView; anchor: DOMRect } | { type: 'lock'; block: Block; anchor: DOMRect } | null

/** What both views can do to blocks and legs. */
export interface Actions {
  items: Map<string, Item>
  places: Map<string, Place>
  toggleLock: (b: Block, anchor: DOMRect) => void
  openLeg: (leg: LegView, anchor: DOMRect) => void
  walk: (leg: LegView) => void
}

export function Timetable({ trip, days, prefs, onPrefs, apply }: Props) {
  const [pop, setPop] = useState<Pop>(null)
  const items = useMemo(() => new Map(trip.items.map((i) => [i.id, i])), [trip])
  const places = useMemo(() => new Map(trip.places.map((p) => [p.id, p])), [trip])
  const blockByKey = useMemo(() => new Map(days.flatMap((d) => d.blocks).map((b) => [b.key, b])), [days])

  const setLegMode = useCallback(
    (leg: LegView, mode: Mode | null) => {
      const to = blockByKey.get(leg.toKey)
      const name = to ? blockName(to) : 'the next stop'
      apply([{ op: 'setLegMode', from: leg.fromKey, to: leg.toKey, mode }], `Travel to ${name}: ${mode ? modeLabel(mode) : "the day's mode"}`)
    },
    [apply, blockByKey],
  )

  const actions = useMemo<Actions>(
    () => ({
      items,
      places,
      toggleLock: (b, anchor) => {
        if (b.fixed) apply([{ op: 'setFixed', id: b.itemId, part: b.part, fixed: false }], `Unlocked ${blockName(b)}`)
        else setPop({ type: 'lock', block: b, anchor })
      },
      openLeg: (leg, anchor) => setPop({ type: 'leg', leg, anchor }),
      walk: (leg) => setLegMode(leg, 'walk'),
    }),
    [items, places, apply, setLegMode],
  )

  const close = useCallback(() => setPop(null), [])
  const legDay = pop?.type === 'leg' ? days.find((d) => d.date === pop.leg.date) : undefined

  if (days.length === 0) return <p className="placeholder tt-empty">This trip has no days.</p>

  return (
    <>
      {prefs.timetableView === 'list' ? (
        <DayList days={days} actions={actions} />
      ) : (
        <MultiDay trip={trip} days={days} prefs={prefs} onPrefs={onPrefs} apply={apply} actions={actions} />
      )}
      {pop?.type === 'leg' && (
        <ModePicker
          leg={pop.leg}
          anchor={pop.anchor}
          toTitle={(() => {
            const b = blockByKey.get(pop.leg.toKey)
            return b ? blockName(b) : 'the next stop'
          })()}
          explicit={legHasOwnMode(trip, pop.leg)}
          dayMode={legDay?.mode ?? trip.settings.defaultMode}
          onPick={(mode) => {
            setLegMode(pop.leg, mode)
            close()
          }}
          onClose={close}
        />
      )}
      {pop?.type === 'lock' && (
        <LockForm
          block={pop.block}
          anchor={pop.anchor}
          onLock={(reason) => {
            const b = pop.block
            apply([{ op: 'setFixed', id: b.itemId, part: b.part, fixed: true, reason }], `Fixed ${blockName(b)}`)
            close()
          }}
          onClose={close}
        />
      )}
    </>
  )
}

// ---------- multi-day view ----------

type Source =
  | { kind: 'place'; placeId: string }
  | { kind: 'item'; itemId: string }
  | { kind: 'block'; block: Block; edge: 'move' | 'top' | 'bottom' }

interface Ghost {
  source: Source
  title: string
  group: Group
  kindId: Kind
  date: string
  start: number
  end: number
  preview: DragPreview | null
  /** Over the Place List: dropping unschedules (item 14). */
  toList: boolean
}

interface Session {
  block: Block
  edge: 'move' | 'top' | 'bottom'
  x0: number
  y0: number
  /** Minutes between the block's top and where it was grabbed. */
  grab: number
  started: boolean
}

const DRAG_THRESHOLD = 4
const EDGE_ZONE = 36
const EDGE_SPEED = 14

const placesPane = () => document.querySelector<HTMLElement>('.pane[aria-label="Places"]')

function inside(r: DOMRect, x: number, y: number) {
  return x >= r.left && x < r.right && y >= r.top && y < r.bottom
}

function MultiDay({ trip, days, prefs, onPrefs, apply, actions }: Props & { actions: Actions }) {
  const sel = useSelection()
  const H = prefs.hourHeight
  const { items, places } = actions
  const scrollRef = useRef<HTMLDivElement>(null)
  const cols = useRef(new Map<string, HTMLDivElement>())
  const [ghost, setGhostState] = useState<Ghost | null>(null)
  const ghostRef = useRef<Ghost | null>(null)
  const session = useRef<Session | null>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const raf = useRef<number | null>(null)
  const suppressClick = useRef(false)
  // Latest values for the window listeners of a drag in progress.
  const live = useRef({ trip, days, H, items, places, apply, sel })
  useLayoutEffect(() => {
    live.current = { trip, days, H, items, places, apply, sel }
  })

  const setGhost = (g: Ghost | null) => {
    ghostRef.current = g
    setGhostState(g)
  }

  // ----- where the pointer is

  const locate = (x: number, y: number): { date: string; minute: number } | null => {
    const { days, H } = live.current
    for (const d of days) {
      const el = cols.current.get(d.date)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x < r.right) return { date: d.date, minute: pxToMinute(y - r.top, H) }
    }
    return null
  }

  const previewFor = (source: Source, date: string, slot: Slot): DragPreview | null => {
    const { trip } = live.current
    try {
      if (source.kind === 'place') return core.dragPreview(trip, source.placeId, date, slot.start, slot.end)
      if (source.kind === 'item') return core.movePreview(trip, source.itemId, date, slot.start, slot.end)
      return core.movePreview(trip, source.block.key, date, slot.start, slot.end)
    } catch {
      return null
    }
  }

  /** Show the ghost at a slot; ask the core only when the slot changed. */
  const showAt = (base: Omit<Ghost, 'date' | 'start' | 'end' | 'preview' | 'toList'>, date: string, slot: Slot, toList = false) => {
    const g = ghostRef.current
    if (g && g.date === date && g.start === slot.start && g.end === slot.end && g.toList === toList && g.title === base.title) return
    const preview = toList ? (g?.preview ?? null) : previewFor(base.source, date, slot)
    setGhost({ ...base, date, start: slot.start, end: slot.end, preview, toList })
  }

  const markPlaces = (on: boolean) => placesPane()?.classList.toggle('unschedule-target', on)

  // ----- a place dragged in from the Place List (item 11)

  const listSource = () => {
    const d = listDrag()
    if (!d) return null
    const { places, items } = live.current
    if (d.type === 'place') {
      const p = places.get(d.id)
      if (!p) return null
      return { base: { source: { kind: 'place', placeId: p.id } as Source, title: p.name, group: kindGroup(p.kind), kindId: p.kind }, stay: p.usualStayMinutes }
    }
    const it = items.get(d.id)
    if (!it) return null
    return { base: { source: { kind: 'item', itemId: it.id } as Source, title: it.title, group: kindGroup(it.kind), kindId: it.kind }, stay: null }
  }

  const trackList = (x: number, y: number) => {
    const s = listSource()
    const loc = s && locate(x, y)
    if (!s || !loc) return
    showAt(s.base, loc.date, dropSlot(loc.minute, s.stay))
  }

  // ----- a block moved or resized (item 13)

  const trackBlock = (x: number, y: number) => {
    const s = session.current
    if (!s) return
    const { items, H } = live.current
    const b = s.block
    const base = { source: { kind: 'block', block: b, edge: s.edge } as Source, title: blockName(b), group: blockGroup(b, items), kindId: b.part === 'main' ? (items.get(b.itemId)?.kind ?? 'other') : ('lodging' as Kind) }
    if (s.edge === 'move') {
      const pane = placesPane()
      const overList = b.part === 'main' && !!pane && inside(pane.getBoundingClientRect(), x, y)
      markPlaces(overList)
      if (overList) return showAt(base, b.date, b, true)
      const loc = locate(x, y)
      if (!loc) return
      return showAt(base, loc.date, moveSlot(loc.minute, s.grab, b.end - b.start))
    }
    const col = cols.current.get(b.date)
    if (!col) return
    const minute = pxToMinute(y - col.getBoundingClientRect().top, H)
    showAt(base, b.date, resizeSlot(s.edge, b, minute))
  }

  const track = (x: number, y: number) => (session.current ? trackBlock(x, y) : trackList(x, y))

  // ----- scrolling while dragging near an edge

  const autoScroll = () => {
    if (raf.current != null) return
    raf.current = requestAnimationFrame(() => {
      raf.current = null
      const el = scrollRef.current
      const p = pointer.current
      if (!el || !p || !ghostRef.current || ghostRef.current.toList) return
      const r = el.getBoundingClientRect()
      const head = el.querySelector<HTMLElement>('.tt-head')?.offsetHeight ?? 0
      const gutter = el.querySelector<HTMLElement>('.tt-gutter')?.offsetWidth ?? 0
      let dx = 0
      let dy = 0
      if (inside(r, p.x, p.y)) {
        if (p.y < r.top + head + EDGE_ZONE) dy = -EDGE_SPEED
        else if (p.y > r.bottom - EDGE_ZONE) dy = EDGE_SPEED
        if (p.x < r.left + gutter + EDGE_ZONE) dx = -EDGE_SPEED
        else if (p.x > r.right - EDGE_ZONE) dx = EDGE_SPEED
      }
      if (!dx && !dy) return
      const before = [el.scrollLeft, el.scrollTop]
      el.scrollBy(dx, dy)
      if (el.scrollLeft === before[0] && el.scrollTop === before[1]) return
      track(p.x, p.y)
      autoScroll()
    })
  }

  // ----- committing

  const label = (title: string, date: string, start: number) => `${title} ${monthDay(date)} ${clock(start)}`

  const dropFromList = () => {
    const g = ghostRef.current
    setGhost(null)
    if (!g) return
    const { trip, apply, sel } = live.current
    const slot = { date: g.date, start: g.start, end: g.end }
    if (g.source.kind === 'place') {
      const placeId = g.source.placeId
      // A booking for this place on this date that waits for a time takes the slot (item 64).
      const waiting = trip.items.find((i) => i.placeId === placeId && waitsForTime(i) && i.booking?.date === g.date)
      const ok = waiting
        ? apply([{ op: 'moveItem', id: waiting.id, part: 'main', ...slot }], `Scheduled ${label(waiting.title, g.date, g.start)}`)
        : apply([{ op: 'schedulePlace', placeId, itemId: `i-${core.shortId()}`, ...slot }], `Scheduled ${label(g.title, g.date, g.start)}`)
      if (ok) sel.setFocusDate(g.date)
    } else if (g.source.kind === 'item') {
      if (apply([{ op: 'moveItem', id: g.source.itemId, part: 'main', ...slot }], `Scheduled ${label(g.title, g.date, g.start)}`)) sel.setFocusDate(g.date)
    }
  }

  const finishBlock = (commit: boolean) => {
    const s = session.current
    session.current = null
    pointer.current = null
    document.body.classList.remove('tt-dragging')
    markPlaces(false)
    window.removeEventListener('pointermove', onWindowMove)
    window.removeEventListener('pointerup', onWindowUp)
    window.removeEventListener('pointercancel', onWindowCancel)
    window.removeEventListener('keydown', onWindowKey, true)
    const g = ghostRef.current
    setGhost(null)
    if (!s?.started) return
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), 0)
    if (!commit || !g) return
    const { apply, sel } = live.current
    const b = s.block
    if (g.toList) {
      apply([{ op: 'unschedule', id: b.itemId }], `Unscheduled ${b.title}`)
      return
    }
    if (g.date === b.date && g.start === b.start && g.end === b.end) return
    const what = s.edge === 'move' ? `Moved ${label(blockName(b), g.date, g.start)}` : `Changed ${blockName(b)} to ${timeRange(g.start, g.end)}`
    if (apply([{ op: 'moveItem', id: b.itemId, part: b.part, date: g.date, start: g.start, end: g.end }], what)) sel.setFocusDate(g.date)
  }

  // Window listeners for a block drag. Everything they touch is read through
  // refs (`live`, `session`, `ghostRef`), so the first render's closures stay right.
  const handlers = useRef({
    move: (e: PointerEvent) => {
      const s = session.current
      if (!s) return
      if (!s.started) {
        if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) < DRAG_THRESHOLD) return
        s.started = true
        document.body.classList.add('tt-dragging')
      }
      pointer.current = { x: e.clientX, y: e.clientY }
      trackBlock(e.clientX, e.clientY)
      autoScroll()
    },
    up: () => finishBlock(true),
    cancel: () => finishBlock(false),
    key: (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      finishBlock(false)
    },
  })
  const [{ onWindowMove, onWindowUp, onWindowCancel, onWindowKey }] = useState(() => ({
    onWindowMove: (e: PointerEvent) => handlers.current.move(e),
    onWindowUp: () => handlers.current.up(),
    onWindowCancel: () => handlers.current.cancel(),
    onWindowKey: (e: KeyboardEvent) => handlers.current.key(e),
  }))

  const startBlockDrag = (e: ReactPointerEvent, b: Block, edge: Session['edge']) => {
    if (e.button !== 0 || b.fixed || session.current) return
    const col = cols.current.get(b.date)
    if (!col) return
    e.preventDefault()
    const minute = pxToMinute(e.clientY - col.getBoundingClientRect().top, H)
    session.current = { block: b, edge, x0: e.clientX, y0: e.clientY, grab: minute - b.start, started: false }
    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowUp)
    window.addEventListener('pointercancel', onWindowCancel)
    window.addEventListener('keydown', onWindowKey, true)
  }

  // Leaving the page mid-drag.
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowUp)
      window.removeEventListener('pointercancel', onWindowCancel)
      window.removeEventListener('keydown', onWindowKey, true)
      document.body.classList.remove('tt-dragging')
      if (raf.current != null) cancelAnimationFrame(raf.current)
    },
    [onWindowMove, onWindowUp, onWindowCancel, onWindowKey],
  )

  // A list drag that ends anywhere (dropped elsewhere, or Escape) clears the ghost.
  useEffect(() => {
    const clear = () => {
      if (!session.current && ghostRef.current) setGhost(null)
      pointer.current = null
    }
    document.addEventListener('dragend', clear)
    return () => document.removeEventListener('dragend', clear)
  }, [])

  // ----- opening scroll, and scrolling to a place selected elsewhere (items 5, 7)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const first = Math.min(VIEW_START, ...live.current.days.flatMap((d) => d.blocks.map((b) => b.start)))
    el.scrollTop = scrollTopFor(first, live.current.H)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    const id = sel.selectedPlaceId
    if (!el || !id || sel.selectedFrom === 'timetable') return
    const block = el.querySelector<HTMLElement>(`.tt-block[data-place-id="${CSS.escape(id)}"]`)
    if (!block) return
    const r = el.getBoundingClientRect()
    const b = block.getBoundingClientRect()
    const head = el.querySelector<HTMLElement>('.tt-head')?.offsetHeight ?? 0
    const gutter = el.querySelector<HTMLElement>('.tt-gutter')?.offsetWidth ?? 0
    let dy = 0
    let dx = 0
    if (b.top < r.top + head) dy = b.top - (r.top + head) - 12
    else if (b.bottom > r.bottom) dy = Math.min(b.bottom - r.bottom + 12, b.top - (r.top + head) - 12)
    if (b.left < r.left + gutter) dx = b.left - (r.left + gutter) - 8
    else if (b.right > r.right) dx = b.right - r.right + 8
    if (dx || dy) el.scrollBy({ left: dx, top: dy, behavior: 'smooth' })
  }, [sel.selectedPlaceId, sel.selectedFrom])

  // ----- closed hours: while dragging, or for the selected place (item 27)

  const selectedClosed = useMemo(() => {
    const p = sel.selectedPlaceId ? places.get(sel.selectedPlaceId) : undefined
    if (!p?.openingHours) return null
    try {
      return core.dragPreview(trip, p.id, trip.startDate, VIEW_START, VIEW_START + 60).closed
    } catch {
      return null
    }
  }, [trip, places, sel.selectedPlaceId])
  const closed: DayClosed[] | null = ghost ? (ghost.preview?.closed ?? null) : selectedClosed
  const closedByDate = useMemo(() => new Map((closed ?? []).map((c) => [c.date, c])), [closed])

  // ----- sizes (item 44)

  const resizeColumn = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget
    const width = handle.parentElement?.getBoundingClientRect().width ?? prefs.columnWidth
    const x0 = e.clientX
    handle.setPointerCapture(e.pointerId)
    document.body.classList.add('resizing')
    const move = (ev: PointerEvent) => onPrefs((p) => ({ ...p, columnWidth: clampTo(width + ev.clientX - x0, COLUMN_WIDTH) }))
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      document.body.classList.remove('resizing')
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  const resizeHour = (e: ReactPointerEvent<HTMLDivElement>, hour: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    const h0 = H
    const y0 = e.clientY
    handle.setPointerCapture(e.pointerId)
    document.body.classList.add('resizing')
    // The edge under the pointer is the end of `hour`, so it moves (hour + 1) times as fast as one hour.
    const move = (ev: PointerEvent) => onPrefs((p) => ({ ...p, hourHeight: clampTo(h0 + (ev.clientY - y0) / (hour + 1), HOUR_HEIGHT) }))
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      document.body.classList.remove('resizing')
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  const hours = Array.from({ length: 24 }, (_, h) => h)
  const gridStyle = {
    '--hour-h': `${H}px`,
    gridTemplateColumns: `var(--tt-gutter-w) repeat(${days.length}, minmax(${prefs.columnWidth}px, 1fr))`,
    gridTemplateRows: `auto ${minuteToPx(DAY_MINUTES, H)}px`,
  } as CSSProperties

  const onBlockClick = (b: Block) => {
    if (suppressClick.current) return
    sel.select(b.placeId, 'timetable')
    sel.setFocusDate(b.date)
  }

  return (
    <div
      className="tt-scroll"
      ref={scrollRef}
      onDragOver={(e) => {
        if (!listDrag()) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        pointer.current = { x: e.clientX, y: e.clientY }
        trackList(e.clientX, e.clientY)
        autoScroll()
      }}
      onDragLeave={(e) => {
        if (!scrollRef.current?.contains(e.relatedTarget as Node | null) && !session.current) setGhost(null)
      }}
      onDrop={(e) => {
        if (!listDrag()) return
        e.preventDefault()
        dropFromList()
      }}
    >
      <div className="tt-grid" style={gridStyle}>
        <div className="tt-corner" />
        {days.map((d) => (
          <div
            key={d.date}
            className={`tt-head ${d.date === sel.focusDate ? 'focus' : ''}`}
            onClick={() => sel.setFocusDate(d.date)}
            title={`${d.label} ${d.weekday}: set as the day in focus`}
          >
            <DayLabel day={d} />
            <div className="col-resize" role="separator" aria-orientation="vertical" aria-label="Drag to change the day width" onPointerDown={resizeColumn} onClick={(e) => e.stopPropagation()} />
          </div>
        ))}
        <div className="tt-gutter">
          {hours.map((h) => (
            <div key={h} className="tt-hour" style={{ top: h * H, height: H }}>
              {h > 0 && <span className="tt-hour-label">{h}:00</span>}
              <div className="hour-resize" role="separator" aria-orientation="horizontal" aria-label="Drag to change the hour height" onPointerDown={(e) => resizeHour(e, h)} />
            </div>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn
            key={d.date}
            day={d}
            H={H}
            actions={actions}
            ghost={ghost && ghost.date === d.date ? ghost : null}
            movingKey={ghost?.source.kind === 'block' ? ghost.source.block.key : null}
            closed={closedByDate.get(d.date) ?? null}
            selectedPlaceId={sel.selectedPlaceId}
            hoveredPlaceId={sel.hoveredPlaceId}
            onHover={sel.hover}
            onBlockClick={onBlockClick}
            onBlockPointerDown={startBlockDrag}
            refFor={(el) => {
              if (el) cols.current.set(d.date, el)
              else cols.current.delete(d.date)
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface ColumnProps {
  day: PlanDay
  H: number
  actions: Actions
  ghost: Ghost | null
  movingKey: string | null
  closed: DayClosed | null
  selectedPlaceId: string | null
  hoveredPlaceId: string | null
  onHover: (id: string | null) => void
  onBlockClick: (b: Block) => void
  onBlockPointerDown: (e: ReactPointerEvent, b: Block, edge: Session['edge']) => void
  refFor: (el: HTMLDivElement | null) => void
}

function DayColumn({ day, H, actions, ghost, movingKey, closed, selectedPlaceId, hoveredPlaceId, onHover, onBlockClick, onBlockPointerDown, refFor }: ColumnProps) {
  const px = (m: number) => minuteToPx(m, H)
  const lanes = useMemo(() => layoutLanes(day.blocks), [day.blocks])
  const warnings = useMemo(() => warningsByBlock(day), [day])
  const background = useMemo(() => daylightGradient(day.daylight), [day.daylight])
  const hatch = useMemo(() => (closed ? hatchBands(closed.ranges) : null), [closed])
  const preview = ghost && !ghost.toList ? ghost.preview : null
  const bands = preview && ghost ? [travelBand(preview.before, ghost, 'before'), travelBand(preview.after, ghost, 'after')].filter((b) => b != null) : []
  const overFixed = (preview?.overFixed.length ?? 0) > 0

  return (
    <div className="tt-col" ref={refFor} style={{ '--daylight': background } as CSSProperties} data-date={day.date}>
      {sunMarks(day.sun).map((m) => (
        <div key={m.kind} className={`sun-mark ${m.kind}`} style={{ top: px(m.minute) }} title={m.text}>
          <span>
            {m.kind === 'sunrise' ? '↑' : '↓'} {clock(m.minute)}
          </span>
        </div>
      ))}

      {day.blocks.map((b) => {
        const lane = lanes.get(b.key) ?? { lane: 0, lanes: 1 }
        const height = Math.max(px(b.end - b.start), 14)
        const warn = warnings.get(b.key)
        const cls = [
          'tt-block',
          `g-${blockGroup(b, actions.items)}`,
          b.fixed && 'fixed',
          b.placeId && b.placeId === selectedPlaceId && 'selected',
          b.placeId && b.placeId === hoveredPlaceId && 'hovered',
          b.key === movingKey && 'moving',
          height < 34 && 'compact',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div
            key={b.key}
            className={cls}
            data-place-id={b.placeId ?? undefined}
            data-key={b.key}
            style={{ top: px(b.start), height, left: `calc(${(lane.lane / lane.lanes) * 100}% + 3px)`, width: `calc(${100 / lane.lanes}% - 6px)` }}
            onPointerDown={(e) => onBlockPointerDown(e, b, 'move')}
            onClick={() => onBlockClick(b)}
            onMouseEnter={() => onHover(b.placeId)}
            onMouseLeave={() => onHover(null)}
            title={b.fixed ? `${blockName(b)} is fixed${b.reason ? `: ${b.reason}` : ''}. Unlock it to move it.` : undefined}
          >
            {!b.fixed && <div className="resize-edge top" onPointerDown={(e) => (e.stopPropagation(), onBlockPointerDown(e, b, 'top'))} />}
            <div className="tt-block-head">
              <BlockIcon block={b} items={actions.items} />
              <span className="tt-block-title">{blockName(b)}</span>
              {warn && <WarnMark messages={warn} />}
              <LockButton block={b} onToggle={actions.toggleLock} />
            </div>
            <div className="tt-block-time">
              {timeRange(b.start, b.end)}
              {b.fixed && b.reason ? ` · ${b.reason}` : ''}
            </div>
            {!b.fixed && <div className="resize-edge bottom" onPointerDown={(e) => (e.stopPropagation(), onBlockPointerDown(e, b, 'bottom'))} />}
          </div>
        )
      })}

      {!ghost &&
        day.legs.map((leg) => (
          <TravelLabel
            key={`${leg.fromKey}>${leg.toKey}`}
            leg={leg}
            onOpen={actions.openLeg}
            onWalk={actions.walk}
            style={{ top: px(leg.gapMinutes >= 0 ? (leg.fromEnd + leg.toStart) / 2 : leg.toStart) }}
          />
        ))}

      {hatch?.bands.map((h) => (
        <div key={h.from} className="tt-hatch" style={{ top: px(h.from), height: px(h.to - h.from), maskImage: h.mask, WebkitMaskImage: h.mask }} />
      ))}
      {hatch?.tags.map((t) => (
        <span key={t.text} className={`hatch-tag ${t.side}`} style={{ top: px(t.minute) }}>
          {t.text}
        </span>
      ))}

      {bands.map((b) => (
        <div key={b.from} className={`travel-band ${b.fits ? 'fits' : 'tight'}`} style={{ top: px(b.from), height: Math.max(px(b.to - b.from), 2) }}>
          <span>{b.text}</span>
        </div>
      ))}

      {ghost && !ghost.toList && (
        <div
          className={`tt-ghost g-${ghost.group} ${overFixed ? 'refused' : ''} ${preview?.inClosedHours ? 'closed' : ''}`}
          style={{ top: px(ghost.start), height: Math.max(px(ghost.end - ghost.start), 14) }}
        >
          <div className="tt-block-head">
            <span className="block-icon">
              <KindIcon kind={ghost.kindId} />
            </span>
            <span className="tt-block-title">{ghost.title}</span>
          </div>
          <div className="tt-block-time">{timeRange(ghost.start, ghost.end)}</div>
          {overFixed ? <div className="ghost-note">Can't drop over a fixed block</div> : preview?.hoursMessage && <div className="ghost-note">{preview.hoursMessage}</div>}
        </div>
      )}

      {day.night && (
        <div className="night-band" title={`Night ${day.night.night} of ${day.night.nights} at ${day.night.title}`}>
          <KindIcon kind="lodging" />
          <span>Night: {day.night.title}</span>
        </div>
      )}
    </div>
  )
}

// ---------- list view (items 3, 26) ----------

function DayList({ days, actions }: { days: PlanDay[]; actions: Actions }) {
  const sel = useSelection()
  const listRef = useRef<HTMLDivElement>(null)
  const index = Math.max(0, days.findIndex((d) => d.date === sel.focusDate))
  const day = days[index]
  const warnings = useMemo(() => warningsByBlock(day), [day])
  const legs = useMemo(() => new Map(day.legs.map((l) => [`${l.fromKey}>${l.toKey}`, l])), [day.legs])

  // A place selected elsewhere shows its day (items 5, 7).
  const { selectedPlaceId: selId, selectedFrom: selFrom, setFocusDate } = sel
  useEffect(() => {
    if (!selId || selFrom === 'timetable') return
    if (day.blocks.some((b) => b.placeId === selId)) return
    const other = days.find((d) => d.blocks.some((b) => b.placeId === selId))
    if (other) setFocusDate(other.date)
    // Only when the selection changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, selFrom])

  useEffect(() => {
    if (!selId || selFrom === 'timetable') return
    listRef.current?.querySelector(`[data-place-id="${CSS.escape(selId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selId, selFrom, day.date])

  const go = (step: number) => {
    const d = days[index + step]
    if (d) setFocusDate(d.date)
  }
  const strip = (from: number, to: number) => ({ background: daylightGradient(day.daylight, from, Math.max(to, from + 1)) })
  const sun = day.sun

  return (
    <div className="tt-list" ref={listRef}>
      <div className="tt-list-head">
        <button type="button" className="icon-btn" aria-label="Previous day" disabled={index === 0} onClick={() => go(-1)}>
          <ChevronSide dir="left" />
        </button>
        <div className="tt-list-day">
          <DayLabel day={day} />
        </div>
        <button type="button" className="icon-btn" aria-label="Next day" disabled={index === days.length - 1} onClick={() => go(1)}>
          <ChevronSide dir="right" />
        </button>
        <span className="spacer" />
        {sun?.sunrise != null && sun.sunset != null && (
          <span className="muted sun-text">
            Sunrise {clock(sun.sunrise)} · Sunset {clock(sun.sunset)}
          </span>
        )}
      </div>

      {day.blocks.length === 0 ? (
        <p className="placeholder tt-empty">Nothing planned on {day.label}. Drag places in from the Place List in multi-day view.</p>
      ) : (
        <ol className="tt-rows">
          {day.blocks.map((b, i) => {
            const next = day.blocks[i + 1]
            const leg = next ? legs.get(`${b.key}>${next.key}`) : undefined
            const place = b.placeId ? actions.places.get(b.placeId) : undefined
            const warn = warnings.get(b.key)
            const sub = [place?.area, place && place.rating !== 'unrated' ? ratingLabel(place.rating) : null, b.fixed && b.reason].filter(Boolean)
            const cls = [
              'tt-card',
              `g-${blockGroup(b, actions.items)}`,
              b.fixed && 'fixed',
              b.placeId && b.placeId === sel.selectedPlaceId && 'selected',
              b.placeId && b.placeId === sel.hoveredPlaceId && 'hovered',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <li key={b.key} className="tt-row-group">
                <div className="tt-row">
                  <div className="tt-times">
                    <span>{clock(b.start)}</span>
                    <span className="muted">{clock(b.end)}</span>
                  </div>
                  <div className="tt-strip" style={strip(b.start, b.end)} />
                  <div
                    className={cls}
                    data-place-id={b.placeId ?? undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => sel.select(b.placeId, 'timetable')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        sel.select(b.placeId, 'timetable')
                      }
                    }}
                    onMouseEnter={() => sel.hover(b.placeId)}
                    onMouseLeave={() => sel.hover(null)}
                  >
                    <div className="tt-block-head">
                      <BlockIcon block={b} items={actions.items} />
                      <span className="tt-block-title">{blockName(b)}</span>
                      {warn && <WarnMark messages={warn} />}
                      <LockButton block={b} onToggle={actions.toggleLock} />
                    </div>
                    {sub.length > 0 && <div className="tt-card-sub">{sub.join(' · ')}</div>}
                  </div>
                </div>
                {next && (
                  <div className="tt-row travel">
                    <div className="tt-times" />
                    <div className="tt-strip" style={strip(b.end, next.start)} />
                    <div className="tt-travel-cell">{leg ? <TravelLabel leg={leg} onOpen={actions.openLeg} onWalk={actions.walk} /> : <span className="muted">·</span>}</div>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {day.night && (
        <div className="night-band in-list" title={`Night ${day.night.night} of ${day.night.nights}`}>
          <KindIcon kind="lodging" />
          <span>Night: {day.night.title}</span>
        </div>
      )}
    </div>
  )
}

import { useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { dayBlocks, dayLegs, tripWarnings } from '../lib/schedule'
import { fmtTime, shortDate, weekdayName } from '../lib/time'
import { newId, useApp } from '../store'
import type { Block } from '../types'

const DAY_START = 6 * 60
const DAY_END = 24 * 60
const PX_PER_MIN = 0.9
const SNAP = 15
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i)
const MODE_LABEL = { walk: 'Walk', transit: 'Transit', drive: 'Drive' } as const

const snap = (min: number) => Math.round(min / SNAP) * SNAP
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const top = (min: number) => (min - DAY_START) * PX_PER_MIN

interface Draft {
  id: string
  day: string
  start: number
  end: number
}

export function Timetable() {
  const { trip, days, dispatch, selection, select, activeDay, setActiveDay } = useApp()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dropDay, setDropDay] = useState('')
  const colRefs = useRef(new Map<string, HTMLDivElement>())
  const warnings = useMemo(() => tripWarnings(trip), [trip])
  const flagged = useMemo(() => new Set(warnings.map((w) => w.blockId).filter(Boolean)), [warnings])

  function dayAt(clientX: number, fallback: string): string {
    for (const [day, el] of colRefs.current) {
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX < r.right) return day
    }
    return fallback
  }

  function startDrag(e: ReactPointerEvent, block: Block, mode: 'move' | 'resize') {
    if (e.button !== 0) return
    e.stopPropagation()
    select({ type: 'block', id: block.id })
    setActiveDay(block.day)
    if (block.locked) return
    e.preventDefault()
    const origin = { x: e.clientX, y: e.clientY }
    const length = block.end - block.start
    let latest: Draft | null = null

    const move = (ev: PointerEvent) => {
      if (!latest && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 4) return
      const delta = snap((ev.clientY - origin.y) / PX_PER_MIN)
      if (mode === 'move') {
        const start = clamp(block.start + delta, DAY_START, DAY_END - length)
        latest = { id: block.id, day: dayAt(ev.clientX, block.day), start, end: start + length }
      } else {
        latest = { id: block.id, day: block.day, start: block.start, end: clamp(block.end + delta, block.start + SNAP, DAY_END) }
      }
      setDraft(latest)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (latest) {
        dispatch({ type: 'updateBlock', id: block.id, patch: { day: latest.day, start: latest.start, end: latest.end } })
        setActiveDay(latest.day)
      }
      setDraft(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  function onDrop(e: DragEvent<HTMLDivElement>, day: string) {
    e.preventDefault()
    setDropDay('')
    const place = trip.places.find((p) => p.id === e.dataTransfer.getData('text/place-id'))
    if (!place) return
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const start = clamp(snap(DAY_START + y / PX_PER_MIN), DAY_START, DAY_END - SNAP)
    const id = newId('b')
    dispatch({ type: 'addBlock', block: { id, day, start, end: Math.min(start + place.stayMin, DAY_END), placeId: place.id, title: place.name, category: place.category } })
    select({ type: 'block', id })
    setActiveDay(day)
  }

  function nudge(block: Block, minutes: number) {
    if (block.locked) return
    const start = clamp(block.start + minutes, DAY_START, DAY_END - (block.end - block.start))
    dispatch({ type: 'updateBlock', id: block.id, patch: { start, end: start + (block.end - block.start) } })
  }

  if (days.length === 0) {
    return (
      <section className="timetable" aria-label="Timetable">
        <p className="empty">Set the trip dates in Trip settings to start a timetable.</p>
      </section>
    )
  }

  const height = (DAY_END - DAY_START) * PX_PER_MIN

  return (
    <section className="timetable" aria-label="Timetable">
      <div className="tt-scroll">
        <div className="tt-grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(148px, 1fr))` }}>
          <div className="tt-corner" />
          {days.map((day) => {
            const count = warnings.filter((w) => w.day === day).length
            return (
              <div key={day} className={`tt-dayhead${day === activeDay ? ' active' : ''}`}>
                <button type="button" className="tt-daybtn" onClick={() => setActiveDay(day)} aria-pressed={day === activeDay}>
                  <span className="tt-weekday">{weekdayName(day)}</span>
                  <span className="tt-date">{shortDate(day)}</span>
                  {count > 0 && (
                    <span className="tt-warncount" title={`${count} thing${count > 1 ? 's' : ''} to check`}>
                      {count}
                    </span>
                  )}
                </button>
                <select
                  className="tt-swap"
                  value=""
                  aria-label={`Swap ${shortDate(day)} with another day`}
                  onChange={(e) => {
                    const other = e.target.value
                    if (other && window.confirm(`Swap everything on ${shortDate(day)} and ${shortDate(other)}? Fixed blocks move too.`)) {
                      dispatch({ type: 'swapDays', a: day, b: other })
                    }
                  }}
                >
                  <option value="">Swap day</option>
                  {days
                    .filter((d) => d !== day)
                    .map((d) => (
                      <option key={d} value={d}>
                        with {weekdayName(d)} {shortDate(d)}
                      </option>
                    ))}
                </select>
              </div>
            )
          })}

          <div className="tt-hours" style={{ height }}>
            {HOURS.slice(1).map((h) => (
              <span key={h} style={{ top: top(h * 60) }}>
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const blocks = dayBlocks(trip, day).filter((b) => b.id !== draft?.id)
            const ghost = draft?.day === day ? trip.blocks.find((b) => b.id === draft.id) : undefined
            return (
              <div
                key={day}
                ref={(el) => {
                  if (el) colRefs.current.set(day, el)
                  else colRefs.current.delete(day)
                }}
                className={`tt-col${day === activeDay ? ' active' : ''}${dropDay === day ? ' drop' : ''}`}
                style={{ height }}
                onClick={() => {
                  setActiveDay(day)
                  select(null)
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('text/place-id')) {
                    e.preventDefault()
                    setDropDay(day)
                  }
                }}
                onDragLeave={() => setDropDay('')}
                onDrop={(e) => onDrop(e, day)}
              >
                {!draft &&
                  dayLegs(trip, day).map((leg) => (
                    <button
                      key={leg.key}
                      type="button"
                      className={`tt-leg${leg.tight ? ' tight' : ''}${selection?.type === 'leg' && selection.key === leg.key ? ' selected' : ''}`}
                      style={{ top: top(leg.from.end), height: Math.max(leg.gap * PX_PER_MIN, 18) }}
                      onClick={(e) => {
                        e.stopPropagation()
                        select({ type: 'leg', key: leg.key })
                        setActiveDay(day)
                      }}
                      title={leg.verified ? 'Checked travel time' : 'Estimated travel time. Click to check and edit.'}
                    >
                      {MODE_LABEL[leg.mode]} {leg.minutes} min{leg.verified ? '' : ' est.'}
                    </button>
                  ))}

                {blocks.map((b) => (
                  <BlockView key={b.id} block={b} selected={selection?.type === 'block' && selection.id === b.id} flagged={flagged.has(b.id)} onPointerDown={startDrag} onNudge={nudge} />
                ))}
                {ghost && draft && <BlockView block={{ ...ghost, ...draft }} selected dragging />}
              </div>
            )
          })}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="tt-warnings" role="status">
          <strong>
            {warnings.length} to check
          </strong>
          <ul>
            {warnings.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDay(w.day)
                    select(w.blockId ? { type: 'block', id: w.blockId } : w.legKey ? { type: 'leg', key: w.legKey } : null)
                  }}
                >
                  {shortDate(w.day)}: {w.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

interface BlockViewProps {
  block: Block
  selected?: boolean
  flagged?: boolean
  dragging?: boolean
  onPointerDown?: (e: ReactPointerEvent, block: Block, mode: 'move' | 'resize') => void
  onNudge?: (block: Block, minutes: number) => void
}

function BlockView({ block, selected, flagged, dragging, onPointerDown, onNudge }: BlockViewProps) {
  const h = (block.end - block.start) * PX_PER_MIN
  const cls = ['tt-block', `cat-${block.category}`, selected && 'selected', block.locked && 'locked', block.tentative && 'tentative', flagged && 'flagged', dragging && 'dragging', h < 40 && 'short'].filter(Boolean).join(' ')
  return (
    <div
      className={cls}
      style={{ top: top(block.start), height: h }}
      role="button"
      tabIndex={0}
      aria-label={`${block.title}, ${fmtTime(block.start)} to ${fmtTime(block.end)}${block.locked ? ', fixed' : ''}`}
      onPointerDown={(e) => onPointerDown?.(e, block, 'move')}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          onNudge?.(block, e.key === 'ArrowUp' ? -SNAP : SNAP)
        }
      }}
    >
      <span className="tt-time">
        {fmtTime(block.start)} to {fmtTime(block.end)}
      </span>
      <span className="tt-title">{block.title}</span>
      {block.locked && <span className="tt-fixed">Fixed</span>}
      {!block.locked && !dragging && <span className="tt-resize" onPointerDown={(e) => onPointerDown?.(e, block, 'resize')} aria-hidden="true" />}
    </div>
  )
}

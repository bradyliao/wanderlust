import { useRef, type ReactNode } from 'react'
import { CollapsedBar, Divider, Pane, SepLine } from '../components/Panes'
import type { PaneId, Prefs } from '../prefs'
import type { PlanDay, Trip } from '../types'

interface Props {
  trip: Trip
  days: PlanDay[] | null
  prefs: Prefs
  onPrefs: (update: (p: Prefs) => Prefs) => void
}

const MIN_PANE = 200
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

/** The Plan page in either layout (items 1–4). Pane contents come in phases 3–5. */
export function PlanPage({ trip, days, prefs, onPrefs }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const right = useRef<HTMLDivElement>(null)
  const start = useRef(0)
  const c = prefs.collapsed

  const setCollapsed = (id: PaneId, value: boolean) =>
    onPrefs((p) => ({ ...p, collapsed: { ...p.collapsed, [id]: value } }))

  const total = () => root.current?.clientWidth ?? window.innerWidth

  // ----- Place List width (both layouts)
  const placesStart = () => (start.current = prefs.placesWidth)
  const placesMove = (d: number) => {
    const others = prefs.layout === 'columns' ? (c.timetable ? 28 : 0) + (c.map ? 28 : 0) : 0
    onPrefs((p) => ({ ...p, placesWidth: clamp(start.current + d, 180, total() - MIN_PANE - others) }))
  }

  // ----- Timetable width (Three columns)
  const ttStart = () => (start.current = prefs.timetableWidth)
  const ttMove = (d: number) => {
    const left = c.places ? 28 : prefs.placesWidth
    onPrefs((p) => ({ ...p, timetableWidth: clamp(start.current + d, 240, total() - left - MIN_PANE) }))
  }

  // ----- Timetable share of height (Stacked)
  const shareStart = () => (start.current = prefs.timetableShare)
  const shareMove = (d: number) => {
    const h = right.current?.clientHeight || window.innerHeight
    onPrefs((p) => ({ ...p, timetableShare: clamp(start.current + d / h, 0.1, 0.9) }))
  }

  const places = (fill: boolean) =>
    c.places ? (
      <CollapsedBar title="Places" orientation="vertical" fold="left" fill={fill} onExpand={() => setCollapsed('places', false)} />
    ) : (
      <Pane
        title="Places"
        info={trip.places.length}
        fold="left"
        fill={fill}
        style={fill ? undefined : { width: prefs.placesWidth, flex: 'none' }}
        onCollapse={() => setCollapsed('places', true)}
      >
        <PlacesPlaceholder count={trip.places.length} />
      </Pane>
    )

  const timetableBody = <TimetablePlaceholder days={days} />
  const timetableInfo = days ? `${days.length} ${days.length === 1 ? 'day' : 'days'}` : undefined

  if (prefs.layout === 'columns') {
    const placesFill = c.timetable && c.map
    return (
      <div className="plan" ref={root}>
        {places(placesFill)}
        {!c.places && !placesFill ? (
          <Divider orientation="vertical" label="Resize Places" onStart={placesStart} onMove={placesMove} />
        ) : (
          <SepLine orientation="vertical" />
        )}
        {c.timetable ? (
          <CollapsedBar title="Timetable" orientation="vertical" fold="left" onExpand={() => setCollapsed('timetable', false)} />
        ) : (
          <Pane
            title="Timetable"
            info={timetableInfo}
            fold="left"
            fill={c.map}
            style={c.map ? undefined : { width: prefs.timetableWidth, flex: 'none' }}
            onCollapse={() => setCollapsed('timetable', true)}
          >
            {timetableBody}
          </Pane>
        )}
        {!c.timetable && !c.map ? (
          <Divider orientation="vertical" label="Resize Timetable" onStart={ttStart} onMove={ttMove} />
        ) : (
          <SepLine orientation="vertical" />
        )}
        {c.map ? (
          <CollapsedBar title="Map" orientation="vertical" fold="right" onExpand={() => setCollapsed('map', false)} />
        ) : (
          <Pane title="Map" fold="right" fill onCollapse={() => setCollapsed('map', true)}>
            <MapPlaceholder />
          </Pane>
        )}
      </div>
    )
  }

  // Stacked: Place List left; Timetable above Map on the right.
  const rightCollapsed = c.timetable && c.map
  const barOrientation = rightCollapsed ? 'vertical' : 'horizontal'
  return (
    <div className="plan" ref={root}>
      {places(rightCollapsed)}
      {!c.places && !rightCollapsed ? (
        <Divider orientation="vertical" label="Resize Places" onStart={placesStart} onMove={placesMove} />
      ) : (
        <SepLine orientation="vertical" />
      )}
      <div className="plan-col" ref={right} style={rightCollapsed ? { width: 28, flex: 'none' } : { flex: 1 }}>
        {c.timetable ? (
          <CollapsedBar
            title="Timetable"
            orientation={barOrientation}
            fold="up"
            fill={rightCollapsed}
            onExpand={() => setCollapsed('timetable', false)}
          />
        ) : (
          <Pane
            title="Timetable"
            info={timetableInfo}
            fold="up"
            fill={c.map}
            style={c.map ? undefined : { flex: `0 0 ${prefs.timetableShare * 100}%` }}
            onCollapse={() => setCollapsed('timetable', true)}
          >
            {timetableBody}
          </Pane>
        )}
        {!c.timetable && !c.map ? (
          <Divider orientation="horizontal" label="Resize Timetable and Map" onStart={shareStart} onMove={shareMove} />
        ) : (
          <SepLine orientation="horizontal" />
        )}
        {c.map ? (
          <CollapsedBar
            title="Map"
            orientation={barOrientation}
            fold="down"
            fill={rightCollapsed}
            onExpand={() => setCollapsed('map', false)}
          />
        ) : (
          <Pane title="Map" fold="down" fill onCollapse={() => setCollapsed('map', true)}>
            <MapPlaceholder />
          </Pane>
        )}
      </div>
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="placeholder">{children}</p>
}

function PlacesPlaceholder({ count }: { count: number }) {
  return (
    <Note>
      {count === 0 ? 'No places yet.' : `${count} places.`} The Place List and place import come in phase 3.
    </Note>
  )
}

/** Trip days from the core's plan view, so the wiring is visible (phase 4 replaces this). */
function TimetablePlaceholder({ days }: { days: PlanDay[] | null }) {
  if (!days) return <Note>The days could not be read.</Note>
  return (
    <>
      <ul className="day-list">
        {days.map((d) => (
          <li key={d.date} className="day-chip">
            <span className="date">{d.label}</span>
            <span className="weekday">{d.weekday.toUpperCase()}</span>
            <div className="city">{d.city ?? 'No city yet'}</div>
          </li>
        ))}
      </ul>
      <Note>The timetable comes in phase 4.</Note>
    </>
  )
}

function MapPlaceholder() {
  return <Note>The map comes in phase 5.</Note>
}

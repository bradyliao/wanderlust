import { useRef, useState, type ReactNode } from 'react'
import { CollapsedBar, Divider, Pane, SepLine } from '../components/Panes'
import { AddPlaceDialog, PlaceList, PlaceListTools } from '../components/PlaceList'
import { Timetable, TimetableTools } from '../components/Timetable'
import type { PaneId, Prefs } from '../prefs'
import { useSelection } from '../selection'
import type { Command, PlanDay, Trip } from '../types'

interface Props {
  trip: Trip
  days: PlanDay[] | null
  prefs: Prefs
  onPrefs: (update: (p: Prefs) => Prefs) => void
  apply: (commands: Command[], label: string) => boolean
  onImportPlaces: () => void
}

const MIN_PANE = 200
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

/** The Plan page in either layout (items 1–4). The map comes in phase 5. */
export function PlanPage({ trip, days, prefs, onPrefs, apply, onImportPlaces }: Props) {
  const [adding, setAdding] = useState(false)
  const sel = useSelection()
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
        tools={
          <PlaceListTools
            groupBy={prefs.placesGroup}
            onGroupBy={(placesGroup) => onPrefs((p) => ({ ...p, placesGroup }))}
            onAdd={() => setAdding(true)}
            onImport={onImportPlaces}
          />
        }
        onCollapse={() => setCollapsed('places', true)}
      >
        <PlaceList trip={trip} groupBy={prefs.placesGroup} apply={apply} />
      </Pane>
    )

  const addDialog = adding && (
    <AddPlaceDialog
      apply={apply}
      onClose={(id) => {
        setAdding(false)
        if (id) sel.select(id, 'list')
      }}
    />
  )

  const timetableBody = days ? (
    <Timetable trip={trip} days={days} prefs={prefs} onPrefs={onPrefs} apply={apply} />
  ) : (
    <Note>The days could not be read.</Note>
  )
  const timetableInfo = days && prefs.timetableView === 'days' ? `${days.length} ${days.length === 1 ? 'day' : 'days'}` : undefined
  const timetableTools = <TimetableTools view={prefs.timetableView} onView={(timetableView) => onPrefs((p) => ({ ...p, timetableView }))} />

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
            tools={timetableTools}
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
        {addDialog}
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
            tools={timetableTools}
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
      {addDialog}
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="placeholder">{children}</p>
}

function MapPlaceholder() {
  return <Note>The map comes in phase 5.</Note>
}

import { useRef, useState } from 'react'
import { Inspector } from './components/Inspector'
import { MapPane } from './components/MapPane'
import { PlacePool } from './components/PlacePool'
import { Timetable } from './components/Timetable'
import { BudgetView, ChecklistView, GuideView, SettingsDialog } from './components/Views'
import { downloadFile } from './lib/guide'
import { shortDate } from './lib/time'
import { sampleTrip } from './sample'
import { isTrip, useApp } from './store'

type View = 'plan' | 'budget' | 'checklist' | 'guide'
type Pane = 'places' | 'timetable' | 'map'

const VIEWS: { id: View; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'budget', label: 'Budget' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'guide', label: 'Trip guide' },
]

export default function App() {
  const { trip, days, dispatch, canUndo, select } = useApp()
  const [view, setView] = useState<View>('plan')
  const [pane, setPane] = useState<Pane>('timetable')
  const [settings, setSettings] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function importFile(file: File | undefined) {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isTrip(parsed)) throw new Error('not a trip')
      if (!window.confirm(`Replace the current trip with "${parsed.name}"? You can undo this.`)) return
      select(null)
      dispatch({ type: 'load', trip: parsed })
    } catch {
      window.alert('That file is not a trip saved from this app.')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="trip-title" onClick={() => setSettings(true)} title="Trip settings">
          <span className="trip-name">{trip.name}</span>
          <span className="trip-meta">
            {days.length ? `${shortDate(days[0])} to ${shortDate(days.at(-1)!)}, ` : ''}
            {trip.travelers.map((t) => t.name).join(' and ')}, {trip.pace} pace
          </span>
        </button>
        <nav className="views" aria-label="Sections">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className={view === v.id ? 'on' : ''} aria-current={view === v.id ? 'page' : undefined} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </nav>
        <div className="tools">
          <button type="button" className="btn small" disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })}>
            Undo
          </button>
          <details className="menu">
            <summary className="btn small">File</summary>
            <div className="menu-list">
              <button type="button" onClick={() => downloadFile(`${trip.name}.trip.json`, JSON.stringify(trip, null, 2), 'application/json')}>
                Save trip to a file
              </button>
              <button type="button" onClick={() => fileInput.current?.click()}>
                Open a trip file
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Replace the current trip with the sample trip? You can undo this.')) {
                    select(null)
                    dispatch({ type: 'load', trip: sampleTrip() })
                  }
                }}
              >
                Load the sample trip
              </button>
            </div>
          </details>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </header>

      {view === 'plan' && (
        <>
          <div className="pane-tabs" role="tablist" aria-label="Planner panes">
            {(['places', 'timetable', 'map'] as Pane[]).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={pane === p} onClick={() => setPane(p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <main className={`planner show-${pane}`}>
            <PlacePool />
            <Timetable />
            <div className="right">
              <MapPane />
              <Inspector />
            </div>
          </main>
        </>
      )}
      {view === 'budget' && <BudgetView />}
      {view === 'checklist' && <ChecklistView />}
      {view === 'guide' && <GuideView />}

      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
    </div>
  )
}

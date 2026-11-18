import { budgetLine, dateRange, MODES, modeLabel } from '../format'
import type { Layout } from '../prefs'
import type { BudgetSummary, LogGroup, Mode, Trip } from '../types'
import { HistoryMenu } from './HistoryMenu'
import { ColumnsIcon, StackedIcon, UndoIcon } from './icons'
import { Menu, MenuItem } from './Menu'

export type Page = 'plan' | 'bookings' | 'budget'

const PAGES: { id: Page; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'budget', label: 'Budget' },
]

/** Close the menu, then act. */
const pick = (close: () => void, act: () => unknown) => () => {
  close()
  act()
}

const PEOPLE = Array.from({ length: 12 }, (_, i) => i + 1)

interface Props {
  trip: Trip
  budget: BudgetSummary | null
  page: Page
  onPage: (page: Page) => void
  layout: Layout
  onLayout: (layout: Layout) => void
  onPeople: (people: number) => void
  onMode: (mode: Mode) => void
  onUndo: () => void
  onUndoTo: (group: LogGroup) => void
  onTrips: () => void
  onNewTrip: () => void
  onOpenFile: () => void
  onExport: () => void
  onChangeFile: () => void
}

/** Brand, pages, trip, People, Transport, budget total, history, layout (items 45–48, 65). */
export function TopBar(p: Props) {
  const { trip, budget } = p
  const people = trip.settings.people
  const peopleChoices = PEOPLE.includes(people) ? PEOPLE : [...PEOPLE, people]

  return (
    <header className="topbar">
      <span className="brand">Wanderlust</span>

      <nav className="tabs" role="tablist" aria-label="Pages">
        {PAGES.map((pg) => (
          <button
            key={pg.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={p.page === pg.id}
            onClick={() => p.onPage(pg.id)}
          >
            {pg.label}
          </button>
        ))}
      </nav>

      <Menu
        buttonClass="btn ghost trip-title"
        title="Trip"
        label={
          <>
            {trip.name}
            <span className="dates">{dateRange(trip.startDate, trip.endDate)}</span>
          </>
        }
      >
        {(close) => (
          <>
            <MenuItem onSelect={pick(close, p.onTrips)}>Switch trip…</MenuItem>
            <MenuItem onSelect={pick(close, p.onNewTrip)}>New trip…</MenuItem>
            <div className="menu-sep" />
            <MenuItem onSelect={pick(close, p.onOpenFile)}>Open trip file…</MenuItem>
            <MenuItem onSelect={pick(close, p.onExport)}>Export trip file</MenuItem>
            <div className="menu-sep" />
            <MenuItem onSelect={pick(close, p.onChangeFile)}>Import AI change file…</MenuItem>
          </>
        )}
      </Menu>

      <span className="spacer" />

      <div className="bar-field">
        <span className="label">People</span>
        <Menu label={people} title={`People: ${people}`}>
          {(close) =>
            peopleChoices.map((n) => (
              <MenuItem key={n} checked={n === people} onSelect={pick(close, () => n !== people && p.onPeople(n))}>
                {n}
              </MenuItem>
            ))
          }
        </Menu>
      </div>

      <div className="bar-field">
        <span className="label">Transport</span>
        <Menu label={modeLabel(trip.settings.defaultMode)} title="Trip default transport">
          {(close) =>
            MODES.map((m) => (
              <MenuItem
                key={m.id}
                checked={m.id === trip.settings.defaultMode}
                onSelect={pick(close, () => m.id !== trip.settings.defaultMode && p.onMode(m.id))}
              >
                {m.label}
              </MenuItem>
            ))
          }
        </Menu>
      </div>

      <div className="bar-field">
        <span className="label">Budget</span>
        <button type="button" className="btn ghost budget-total" onClick={() => p.onPage('budget')}>
          {budget ? budgetLine(budget.planned, budget.budget, budget.homeCurrency) : '–'}
        </button>
      </div>

      <div className="bar-field">
        <button
          type="button"
          className="icon-btn"
          title="Undo (⌘Z / Ctrl+Z)"
          aria-label="Undo"
          disabled={trip.log.length === 0}
          onClick={p.onUndo}
        >
          <UndoIcon />
        </button>
        <HistoryMenu log={trip.log} onUndo={p.onUndo} onUndoTo={p.onUndoTo} />
      </div>

      <div className="layout-switch" role="group" aria-label="Layout">
        <button
          type="button"
          className="icon-btn"
          title="Stacked: timetable above map"
          aria-label="Stacked layout"
          aria-pressed={p.layout === 'stacked'}
          onClick={() => p.onLayout('stacked')}
        >
          <StackedIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Three columns"
          aria-label="Three columns layout"
          aria-pressed={p.layout === 'columns'}
          onClick={() => p.onLayout('columns')}
        >
          <ColumnsIcon />
        </button>
      </div>
    </header>
  )
}

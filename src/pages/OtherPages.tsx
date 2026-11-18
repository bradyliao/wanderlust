import { groupLabel, money } from '../format'
import type { BudgetSummary } from '../types'

/** Placeholder until phase 6 (items 49–51). */
export function BookingsPage() {
  return (
    <main className="page">
      <h1>Bookings</h1>
      <p className="muted">Hotels, flights, trains, tickets and reservations will be listed here by date (phase 6).</p>
    </main>
  )
}

/** Group totals from the core's budget summary; the full page comes in phase 6 (items 52–57). */
export function BudgetPage({ summary }: { summary: BudgetSummary | null }) {
  if (!summary) {
    return (
      <main className="page">
        <h1>Budget</h1>
        <p className="muted">The budget could not be worked out.</p>
      </main>
    )
  }
  const cur = summary.homeCurrency
  return (
    <main className="page">
      <h1>Budget</h1>
      <p className="muted">Planned costs in {cur}. The full Budget page comes in phase 6.</p>

      <div className="budget-head">
        <div>
          <div className="muted">Planned</div>
          <div className="figure">{money(summary.planned, cur)}</div>
        </div>
        <div>
          <div className="muted">Budget</div>
          <div className="figure">{summary.budget == null ? 'Not set' : money(summary.budget, cur)}</div>
        </div>
        <div>
          <div className="muted">Left</div>
          <div className="figure">{summary.left == null ? '–' : money(summary.left, cur)}</div>
        </div>
        <div>
          <div className="muted">Per person ({summary.people})</div>
          <div className="figure">{money(summary.perPerson, cur)}</div>
        </div>
      </div>

      <ul className="group-list">
        {summary.groups.map((g) => (
          <li key={g.group} className="group-row">
            <span className={`swatch ${g.group}`} aria-hidden />
            <span className="name">{groupLabel(g.group)}</span>
            <span className="limit">{g.limit == null ? '' : `limit ${money(g.limit, cur)}`}</span>
            <span className="amount">{money(g.home, cur)}</span>
          </li>
        ))}
      </ul>

      {summary.missingRates.length > 0 && (
        <p className="muted">No exchange rate yet for {summary.missingRates.join(', ')}; those costs are left out of the totals.</p>
      )}
    </main>
  )
}

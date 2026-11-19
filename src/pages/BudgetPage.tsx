import { Fragment, useMemo, useState, type FormEvent } from 'react'
import { addDays, dayText, nightDates, tripCurrencies } from '../bookings'
import { amountIn, budgetSegments, currenciesInUse, dayColumns, estimateCommand, groupBar, sourceLabel, today, type EstimateFields } from '../budget'
import { CommitInput } from '../components/CommitInput'
import { Caret, KindIcon, PlusIcon, WarnIcon } from '../components/icons'
import * as core from '../core'
import { groupLabel, monthDay } from '../format'
import { amountText, currencyHeading, currencySymbol, money, parseAmount, percentOf, rateText } from '../money'
import { KINDS, kindLabel } from '../places'
import type { BudgetSummary, Command, CostRow, Group, Trip } from '../types'

const HOME_CURRENCIES = ['TWD', 'USD']

interface Props {
  trip: Trip
  summary: BudgetSummary | null
  apply: (commands: Command[], label: string) => boolean
}

/** Budget page (items 52–57, 62, 81–83). Every sum comes from the core's `budgetSummary`. */
export function BudgetPage({ trip, summary, apply }: Props) {
  const [adding, setAdding] = useState(false)
  if (!summary) {
    return (
      <main className="page">
        <h1>Budget</h1>
        <p className="muted">The budget could not be worked out.</p>
      </main>
    )
  }
  const cur = summary.homeCurrency
  const m = (n: number) => money(n, cur)
  const columns = summary.currencies.filter((c) => summary.currencyTotals.some((t) => t.currency === c && t.amount > 0))
  const segments = budgetSegments(summary)

  return (
    <main className="bu-page">
      <div className="bu-left">
        <section className="bu-top" aria-label="Totals">
          <div className="bu-figures">
            <div className="bu-figure">
              <div className="label">Planned</div>
              <div className="big">{m(summary.planned)}</div>
              <div className="muted">
                {m(summary.perPerson)} per person ({summary.people})
              </div>
              <div className="bu-split">
                <span className="tag booked">Booked {m(summary.booked)}</span>
                <span className="tag estimated">Estimated {m(summary.estimated)}</span>
              </div>
            </div>
            <div className="bu-figure">
              <label className="label" htmlFor="trip-budget">
                Trip budget
              </label>
              <span className="money-input">
                <span className="big symbol">{currencySymbol(cur)}</span>
                <CommitInput
                  id="trip-budget"
                  className="field big-input"
                  inputMode="decimal"
                  placeholder="Not set"
                  value={summary.budget == null ? '' : amountText(summary.budget, cur)}
                  onCommit={(text) => {
                    if (!text.trim()) return apply([{ op: 'setBudget', total: null }], 'Trip budget cleared')
                    const n = parseAmount(text)
                    if (n == null) return false
                    return apply([{ op: 'setBudget', total: n }], `Trip budget: ${money(n, cur)}`)
                  }}
                />
              </span>
              <div className="muted">in {cur}, set by you</div>
            </div>
            <div className="bu-figure">
              <div className="label">Left</div>
              <div className={`big ${summary.left != null && summary.left < 0 ? 'over' : 'accent'}`}>{summary.left == null ? '–' : m(summary.left)}</div>
              <div className="muted">{summary.left == null ? 'No budget set' : `${percentOf(summary.left, summary.budget) ?? ''} of budget`}</div>
            </div>
          </div>
          <RatesBox trip={trip} summary={summary} apply={apply} />
        </section>

        {segments.length > 0 && (
          <div className="bu-bar" role="img" aria-label={`Planned ${m(summary.planned)} of ${summary.budget == null ? 'no budget' : m(summary.budget)}`}>
            {segments.map((s) => (
              <span key={s.group} className={`seg-fill g-${s.group}`} style={{ width: `${s.fraction * 100}%` }} title={groupLabel(s.group)} />
            ))}
          </div>
        )}

        {summary.missingRates.length > 0 && (
          <div className="bk-warn" role="alert">
            <WarnIcon />
            <span>
              No exchange rate yet for <strong>{summary.missingRates.join(', ')}</strong>; those costs are left out of the totals. Add the rate above.
            </span>
          </div>
        )}

        <GroupTable summary={summary} columns={columns} apply={apply} />
        <DayChart summary={summary} />
      </div>

      <section className="bu-costs" aria-label="Costs">
        <header className="bu-costs-head">
          <h2>Costs</h2>
          <span className="muted">largest first · {summary.rows.length}</span>
          <span className="spacer" />
          <button type="button" className="btn small" onClick={() => setAdding(true)}>
            <PlusIcon /> Add estimated cost
          </button>
        </header>
        <CostTable summary={summary} columns={columns} />
        <p className="hint muted">
          Estimated costs are for things not booked yet; when an item is booked, its booked price replaces the estimate (the old estimate stays faint). Each cost stays in
          the currency it is paid in. Totals use your rates; nothing is fetched from the internet.
        </p>
      </section>

      {adding && <EstimateForm trip={trip} apply={apply} onDone={() => setAdding(false)} />}
    </main>
  )
}

// ---------- home currency and rates (items 55, 56, 56a) ----------

function RatesBox({ trip, summary, apply }: Props & { summary: BudgetSummary }) {
  const home = trip.settings.homeCurrency
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const inUse = useMemo(() => currenciesInUse(trip), [trip])

  // The core's own message, in place, when a switch or rate is refused.
  const run = (commands: Command[], label: string): boolean => {
    try {
      core.applyCommands(trip, commands, core.userStamp(label))
    } catch (e) {
      setError(core.messageOf(e))
      return false
    }
    setError(null)
    return apply(commands, label)
  }

  return (
    <div className="bu-rates">
      <label className="rates-line">
        Home currency
        <select className="field" value={home} onChange={(e) => run([{ op: 'setHomeCurrency', code: e.target.value }], `Home currency: ${e.target.value}`)}>
          {(HOME_CURRENCIES.includes(home) ? HOME_CURRENCIES : [home, ...HOME_CURRENCIES]).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="muted small">Rates (typed in by you)</div>
      {trip.settings.currencies.map((c) => {
        const used = inUse.has(c.code)
        return (
          <div key={c.code} className="rates-line">
            <span>1 {c.code} =</span>
            <CommitInput
              className="field rate"
              aria-label={`Rate: 1 ${c.code} in ${home}`}
              inputMode="decimal"
              value={rateText(c.rateToHome)}
              onCommit={(text) => {
                const n = Number(text.trim())
                if (!text.trim() || !Number.isFinite(n)) return false
                return run([{ op: 'setCurrency', code: c.code, rateToHome: n, setOn: today() }], `Rate: 1 ${c.code} = ${text.trim()} ${home}`)
              }}
            />
            <span>{home}</span>
            {c.setOn && <span className="muted small">{monthDay(c.setOn)}</span>}
            <button
              type="button"
              className="icon-btn small"
              aria-label={`Remove ${c.code}`}
              title={used ? `Some costs are in ${c.code}` : `Remove ${c.code}`}
              disabled={used}
              onClick={() => run([{ op: 'removeCurrency', code: c.code }], `Removed ${c.code}`)}
            >
              ×
            </button>
          </div>
        )
      })}
      {summary.missingRates
        .filter((code) => !trip.settings.currencies.some((c) => c.code === code))
        .map((code) => (
          <AddCurrency key={code} fixedCode={code} home={home} run={run} />
        ))}
      {adding ? (
        <AddCurrency home={home} run={run} onClose={() => setAdding(false)} />
      ) : (
        <button type="button" className="btn small" onClick={() => setAdding(true)}>
          <PlusIcon /> Add currency
        </button>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function AddCurrency({ home, run, onClose, fixedCode }: { home: string; run: (c: Command[], l: string) => boolean; onClose?: () => void; fixedCode?: string }) {
  const [code, setCode] = useState(fixedCode ?? '')
  const [rate, setRate] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    const n = Number(rate.trim())
    if (run([{ op: 'setCurrency', code: c, rateToHome: rate.trim() && Number.isFinite(n) ? n : 0, setOn: today() }], `Added ${c}`)) onClose?.()
  }
  return (
    <form className="rates-line add" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onClose?.()}>
      <span>1</span>
      <input
        className="field code"
        aria-label="Currency code"
        placeholder="KRW"
        maxLength={3}
        value={code}
        readOnly={!!fixedCode}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        autoFocus={!fixedCode}
      />
      <span>=</span>
      <input className="field rate" aria-label={`Rate in ${home}`} inputMode="decimal" placeholder="0.023" value={rate} onChange={(e) => setRate(e.target.value)} />
      <span>{home}</span>
      <button type="submit" className="btn small primary">
        Add
      </button>
      {onClose && (
        <button type="button" className="btn small ghost" onClick={onClose}>
          Cancel
        </button>
      )}
    </form>
  )
}

// ---------- by category (items 52, 54, 81–83) ----------

function GroupTable({ summary, columns, apply }: { summary: BudgetSummary; columns: string[]; apply: Props['apply'] }) {
  const [open, setOpen] = useState<Set<Group>>(new Set())
  const cur = summary.homeCurrency
  const largest = Math.max(0, ...summary.groups.map((g) => g.home))
  const toggle = (g: Group) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(g)) n.delete(g)
      else n.add(g)
      return n
    })
  const cell = (amount: number, c: string) => (amount > 0 ? money(amount, c) : '—')
  const limitsTotal = summary.groups.reduce((a, g) => a + (g.limit ?? 0), 0)

  return (
    <section className="bu-section">
      <h2 className="bu-h">By category</h2>
      <table className="bu-table groups">
        <thead>
          <tr>
            <th scope="col">Category</th>
            {columns.map((c) => (
              <th key={c} scope="col" className="num">
                {currencyHeading(c)}
              </th>
            ))}
            <th scope="col" className="num">
              Total ({cur})
            </th>
            <th scope="col" className="bar-col">
              <span className="sr-only">Bar</span>
            </th>
            <th scope="col" className="num">
              Limit ({cur})
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.groups.map((g) => {
            const bar = groupBar(g.home, g.limit, largest)
            const isOpen = open.has(g.group)
            return (
              <Fragment key={g.group}>
                <tr className="group-line">
                  <th scope="row">
                    <button type="button" className="open-btn" aria-expanded={isOpen} onClick={() => toggle(g.group)}>
                      <Caret open={isOpen} />
                      <span className={`swatch ${g.group}`} aria-hidden />
                      {groupLabel(g.group)}
                    </button>
                  </th>
                  {columns.map((c) => (
                    <td key={c} className="num">
                      {cell(g.amounts.find((a) => a.currency === c)?.amount ?? 0, c)}
                    </td>
                  ))}
                  <td className="num strong">{g.home > 0 ? money(g.home, cur) : '—'}</td>
                  <td className="bar-col">
                    <span className="bar-track">
                      <span className={`bar-fill g-${g.group}${bar.over ? ' over' : ''}`} style={{ width: `${bar.fill * 100}%` }} />
                    </span>
                  </td>
                  <td className="num">
                    <span className="limit">
                      <CommitInput
                        className="field limit-input"
                        aria-label={`Limit for ${groupLabel(g.group)} in ${cur}`}
                        inputMode="decimal"
                        placeholder="No limit"
                        value={g.limit == null ? '' : amountText(g.limit, cur)}
                        onCommit={(text) => {
                          const n = text.trim() ? parseAmount(text) : 0
                          if (n == null) return false
                          return apply([{ op: 'setBudget', limits: { [g.group]: n } }], n > 0 ? `${groupLabel(g.group)} limit: ${money(n, cur)}` : `${groupLabel(g.group)} limit removed`)
                        }}
                      />
                      <span className={`pct${bar.over ? ' over' : ''}`}>{percentOf(g.home, g.limit) ?? ''}</span>
                    </span>
                  </td>
                </tr>
                {isOpen &&
                  g.kinds.map((k) => (
                    <tr key={k.kind} className="kind-line">
                      <th scope="row">
                        <span className="kind-name">
                          <span className={`kind-icon g-${g.group}`} aria-hidden>
                            <KindIcon kind={k.kind} />
                          </span>
                          {kindLabel(k.kind)}
                        </span>
                      </th>
                      {columns.map((c) => (
                        <td key={c} className="num">
                          {cell(k.amounts.find((a) => a.currency === c)?.amount ?? 0, c)}
                        </td>
                      ))}
                      <td className="num">{k.home > 0 ? money(k.home, cur) : '—'}</td>
                      <td className="bar-col" />
                      <td />
                    </tr>
                  ))}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">All</th>
            {columns.map((c) => (
              <td key={c} className="num">
                {cell(summary.currencyTotals.find((t) => t.currency === c)?.amount ?? 0, c)}
              </td>
            ))}
            <td className="num strong">{money(summary.planned, cur)}</td>
            <td className="bar-col" />
            <td className="num muted">{limitsTotal > 0 ? `${money(limitsTotal, cur)} in limits` : ''}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}

// ---------- by day (shown in the mock, still to confirm) ----------

function DayChart({ summary }: { summary: BudgetSummary }) {
  const cols = dayColumns(summary)
  const cur = summary.homeCurrency
  if (cols.every((c) => c.home === 0)) return null
  return (
    <section className="bu-section">
      <h2 className="bu-h">
        By day <span className="muted">in {cur}</span>
      </h2>
      <div className="day-chart">
        {cols.map((c) => (
          <div key={c.key} className={`day-col${c.inTrip ? '' : ' outside'}`} aria-label={`${c.label} ${c.weekday}: ${money(c.home, cur)}`} role="img">
            <span className="day-total">{c.home > 0 ? money(c.home, cur) : ''}</span>
            <span className="day-stack">
              {c.segments.map((s) => (
                <span key={s.group} className={`seg-fill g-${s.group}`} style={{ height: `${s.fraction * 100}%` }} title={`${groupLabel(s.group)}: ${money(s.home, cur)}`} />
              ))}
            </span>
            <span className="day-label">
              <strong>{c.label}</strong> {c.weekday.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
      <div className="legend">
        {summary.groups
          .filter((g) => g.home > 0)
          .map((g) => (
            <span key={g.group}>
              <span className={`swatch ${g.group}`} aria-hidden /> {groupLabel(g.group)}
            </span>
          ))}
      </div>
    </section>
  )
}

// ---------- cost list (shown in the mock, still to confirm) ----------

function CostTable({ summary, columns }: { summary: BudgetSummary; columns: string[] }) {
  const cur = summary.homeCurrency
  if (summary.rows.length === 0) return <p className="muted">No costs yet. Add a price to a booking, or an estimated cost here.</p>
  return (
    <table className="bu-table costs">
      <thead>
        <tr>
          <th scope="col">Item</th>
          {columns.map((c) => (
            <th key={c} scope="col" className="num">
              {currencyHeading(c)}
            </th>
          ))}
          <th scope="col" className="num">
            {cur}
          </th>
          <th scope="col" className="num later">
            Actual <span>(later)</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {summary.rows.map((r) => (
          <CostLine key={r.itemId} row={r} columns={columns} home={cur} />
        ))}
      </tbody>
    </table>
  )
}

function CostLine({ row: r, columns, home }: { row: CostRow; columns: string[]; home: string }) {
  return (
    <tr>
      <th scope="row">
        <div className="cost-title">
          <span className={`kind-icon g-${r.group}`} aria-hidden>
            <KindIcon kind={r.kind} />
          </span>
          <span>{r.title}</span> <span className={`tag ${r.status}`}>{r.status === 'booked' ? 'Booked' : 'Estimated'}</span>
        </div>
        <div className="cost-meta">
          {sourceLabel(r.source)} · {r.dateLabel} · {groupLabel(r.group)} → {kindLabel(r.kind)}
        </div>
      </th>
      {columns.map((c) => {
        const a = amountIn(r, c)
        const replaced = r.replacedEstimate?.currency === c ? r.replacedEstimate : null
        return (
          <td key={c} className="num">
            {a == null ? <span className="muted">—</span> : <strong>{money(a, c)}</strong>}
            {replaced && <div className="faint strike">est. {money(replaced.amount, replaced.currency)}</div>}
          </td>
        )
      })}
      <td className="num">
        {r.home == null ? (
          <span className="muted">no rate</span>
        ) : (
          <>
            {money(r.home, home)}
            {r.perPersonHome != null && r.forms.people > 1 && <div className="muted small">{money(r.perPersonHome, home)} pp</div>}
          </>
        )}
      </td>
      <td className="num later">—</td>
    </tr>
  )
}

// ---------- + Add estimated cost (item 62) ----------

function EstimateForm({ trip, apply, onDone }: { trip: Trip; apply: Props['apply']; onDone: () => void }) {
  const currencies = tripCurrencies(trip)
  const [f, setF] = useState<EstimateFields>({ title: '', kind: 'other', amount: '', currency: currencies.find((c) => c !== trip.settings.homeCurrency) ?? currencies[0], date: '' })
  const [error, setError] = useState<string | null>(null)
  const dates = nightDates({ checkInDate: trip.startDate, checkOutDate: addDays(trip.endDate, 1) })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = estimateCommand(f, `e-${core.shortId()}`)
    if ('error' in r) return setError(r.error)
    if (apply([r.command], `Estimated cost: ${f.title.trim()}`)) onDone()
    else setError('The cost was not added; see the message at the top.')
  }
  return (
    <div className="backdrop" onKeyDown={(e) => e.key === 'Escape' && onDone()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="estimate-title">
        <h2 id="estimate-title">Add an estimated cost</h2>
        <form onSubmit={submit}>
          <label>
            What
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Souvenirs" autoFocus />
          </label>
          <label>
            Category
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as EstimateFields['kind'] })}>
              {(['food', 'activity', 'transport', 'lodging', 'shopping', 'other'] as Group[]).map((g) => (
                <optgroup key={g} label={groupLabel(g)}>
                  {KINDS.filter((k) => k.group === g).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="row">
            <label>
              Amount
              <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} inputMode="decimal" placeholder="9,000" />
            </label>
            <label>
              Currency
              <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Date (optional)
              <select value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })}>
                <option value="">No date</option>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {dayText(d)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <span className="hint muted">It counts as Estimated until it is booked.</span>
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button type="button" className="btn" onClick={onDone}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Add cost
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

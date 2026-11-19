import { useMemo, useState } from 'react'
import {
  bookingGroup,
  bookingSections,
  deadlineText,
  deadlinesSoon,
  groupCounts,
  nightDates,
  rowMeta,
  staySpan,
  timetableSpot,
  whenText,
  type GroupFilter,
} from '../bookings'
import { today } from '../budget'
import { BookingDetails } from '../components/BookingDetails'
import { BookingForm } from '../components/BookingForm'
import { KindIcon, PlusIcon, WarnIcon } from '../components/icons'
import * as core from '../core'
import { GROUPS, monthDay } from '../format'
import { money } from '../money'
import type { Command, CostForms, Item, Trip } from '../types'

interface Props {
  trip: Trip
  apply: (commands: Command[], label: string) => boolean
  /** Go to the Plan page with that day in focus and the place selected. */
  onShowOnTimetable: (date: string, placeId: string | null) => void
}

/** Bookings page (items 50–51, 61–64, 81): bookings by date, group chips, details on the right. */
export function BookingsPage({ trip, apply, onShowOnTimetable }: Props) {
  const [filter, setFilter] = useState<GroupFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<{ item?: Item } | null>(null)

  const sections = useMemo(() => bookingSections(trip, filter), [trip, filter])
  const counts = useMemo(() => groupCounts(trip), [trip])
  const soon = useMemo(() => deadlinesSoon(trip, today()), [trip])
  const forms = useMemo(() => {
    const out = new Map<string, CostForms>()
    for (const i of trip.items) {
      if (!i.booking || !i.cost) continue
      try {
        const f = core.costForms(trip, i.id)
        if (f) out.set(i.id, f)
      } catch {
        // The row shows the typed amount instead.
      }
    }
    return out
  }, [trip])
  const selected = trip.items.find((i) => i.id === selectedId && i.booking) ?? null

  return (
    <main className="bk-page">
      <section className="bk-main" aria-label="Bookings">
        <header className="bk-head">
          <h1>Bookings</h1>
          <span className="muted count">{counts.all}</span>
          <div className="chips" role="group" aria-label="Filter by group">
            <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </button>
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`chip g-${g.id}`}
                aria-pressed={filter === g.id}
                disabled={counts[g.id] === 0 && filter !== g.id}
                onClick={() => setFilter(filter === g.id ? 'all' : g.id)}
              >
                <span className="dot" aria-hidden />
                {g.label}
                {counts[g.id] > 0 && <span className="n">{counts[g.id]}</span>}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <button type="button" className="btn primary" onClick={() => setForm({})}>
            <PlusIcon /> Add booking
          </button>
        </header>

        {/* Shown in the mock, still to confirm: the deadline strip. */}
        {soon.length > 0 && (
          <div className="bk-warn" role="status">
            <WarnIcon />
            <span>
              <strong>
                {soon.length} cancellation {soon.length === 1 ? 'deadline' : 'deadlines'}
              </strong>{' '}
              in the next 10 days: {soon.map((s) => `${s.item.title} (${deadlineText(s.deadline)})`).join(', ')}.
            </span>
          </div>
        )}

        {sections.length === 0 ? (
          <div className="bk-empty">
            <p>{counts.all === 0 ? 'No bookings yet.' : 'No bookings in this group.'}</p>
            <p className="muted">Hotels, flights, trains, tickets and reservations go here, by date. Use “Add booking”.</p>
          </div>
        ) : (
          sections.map((s) => (
            <section key={s.date ?? 'none'} className="bk-section">
              <h2 className="bk-date">
                {s.heading ? (
                  <>
                    <span className="date">{s.heading.date}</span> <span className="weekday">{s.heading.weekday}</span>
                    {s.heading.city && <span className="city"> · {s.heading.city}</span>}
                  </>
                ) : (
                  <span className="date">No date</span>
                )}
              </h2>
              <ul className="bk-rows">
                {s.items.map((item) => (
                  <BookingRow
                    key={item.id}
                    trip={trip}
                    item={item}
                    forms={forms.get(item.id) ?? null}
                    selected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id === selectedId ? null : item.id)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </section>

      {selected ? (
        <BookingDetails
          key={selected.id}
          trip={trip}
          item={selected}
          apply={apply}
          onEdit={() => setForm({ item: selected })}
          onRemoved={() => setSelectedId(null)}
          onShowOnTimetable={onShowOnTimetable}
        />
      ) : (
        <aside className="bk-details empty" aria-label="Booking details">
          <p className="muted">Click a booking to see its details.</p>
        </aside>
      )}

      {form && (
        <BookingForm
          trip={trip}
          item={form.item}
          apply={apply}
          onDone={(id) => {
            setForm(null)
            if (id) setSelectedId(id)
          }}
        />
      )}
    </main>
  )
}

function BookingRow({ trip, item, forms, selected, onSelect }: { trip: Trip; item: Item; forms: CostForms | null; selected: boolean; onSelect: () => void }) {
  const group = bookingGroup(item)
  const meta = rowMeta(item)
  const spot = timetableSpot(item)
  const span = item.stay ? staySpan(item.stay, trip) : null
  const nights = item.stay ? nightDates(item.stay) : []
  const b = item.booking!
  const counted = b.countInBudget ?? true
  return (
    <li className={`bk-row${selected ? ' selected' : ''}`}>
      <button type="button" className="bk-row-main" aria-expanded={selected} onClick={onSelect}>
        <span className={`kind-badge g-${group}`} aria-hidden>
          <KindIcon kind={b.kind} />
        </span>
        <span className="bk-row-text">
          <span className="bk-row-title">{item.title}</span>
          {meta && <span className="bk-row-meta">{meta}</span>}
          {span && (
            <span className="stay-span" aria-hidden>
              <span className={`stay-fill g-${group}`} style={{ left: `${span.from * 100}%`, width: `${(span.to - span.from) * 100}%` }} />
            </span>
          )}
        </span>
        <span className="bk-row-when">{whenText(item)}</span>
        <span className="bk-row-tags">
          {nights.length > 0 && (
            <span className="tag">Base {nights.length === 1 ? monthDay(nights[0]) : `${monthDay(nights[0])}–${monthDay(nights[nights.length - 1])}`}</span>
          )}
          {b.cancelDeadline && <span className="tag warn">Free cancel until {monthDay(b.cancelDeadline.slice(0, 10))}</span>}
          {/* Shown in the mock, still to confirm: the on-timetable and budget tags. */}
          <span className={`tag${spot ? '' : ' quiet'}`}>{spot ? 'On timetable' : b.date ? 'In Place List' : 'Not on timetable'}</span>
          {!counted && <span className="tag quiet">Not in budget</span>}
        </span>
        <span className="bk-row-price">
          {item.cost ? (
            <>
              <span className="total">{money(forms?.total ?? item.cost.amount, item.cost.currency)}</span>
              <span className="sub">
                {priceSub(forms)}
                {item.cost.status === 'estimated' && ' · estimated'}
              </span>
            </>
          ) : (
            <>
              <span className="total">—</span>
              <span className="sub">no price</span>
            </>
          )}
        </span>
      </button>
    </li>
  )
}

/** The small line under a row's price: what was typed, when it wasn't the total. */
function priceSub(f: CostForms | null): string {
  if (!f) return ''
  const m = (n: number) => money(n, f.currency)
  switch (f.basis) {
    case 'perNight':
      return `${m(f.entered)} / night`
    case 'perPerson':
      return `${m(f.entered)} each`
    case 'perPersonPerNight':
      return `${m(f.entered)} per person / night`
    case 'total':
      return f.nightsFromStay && f.perNight != null && f.nights > 1 ? `${m(f.perNight)} / night` : ''
  }
}

import { useState, type ReactNode } from 'react'
import { basisHint, bookingGroup, calculated, dayText, deadlineText, mapsLink, maskConfirmation, nightDates, timetableSpot, tripCurrencies } from '../bookings'
import * as core from '../core'
import { groupLabel, monthDay } from '../format'
import { approx, money, parseAmount } from '../money'
import { clock, kindLabel } from '../places'
import type { Command, Cost, CostForms, Item, Trip } from '../types'
import { CommitInput } from './CommitInput'
import { ExternalIcon, KindIcon } from './icons'

interface Props {
  trip: Trip
  item: Item
  apply: (commands: Command[], label: string) => boolean
  onEdit: () => void
  onRemoved: () => void
  onShowOnTimetable: (date: string, placeId: string | null) => void
}

/** The booking's details on the right of the Bookings page (item 51), with the price box (items 58–60). */
export function BookingDetails({ trip, item, apply, onEdit, onRemoved, onShowOnTimetable }: Props) {
  const [shown, setShown] = useState<string | null>(null)
  const showCode = shown === item.id
  const b = item.booking!
  const place = item.placeId ? trip.places.find((p) => p.id === item.placeId) : undefined
  const group = bookingGroup(item)
  const link = mapsLink(item, place)
  const spot = timetableSpot(item)
  const where = [kindLabel(b.kind), place?.area, place?.city].filter(Boolean).join(' · ')

  const remove = () => {
    const extra = spot ? ' It also leaves the timetable and the budget.' : item.cost ? ' Its price leaves the budget.' : ''
    if (!window.confirm(`Remove “${item.title}”?${extra} Undo brings it back.`)) return
    if (apply([{ op: 'removeItem', id: item.id }], `Removed booking ${item.title}`)) onRemoved()
  }

  return (
    <aside className="bk-details" aria-label="Booking details">
      <header className="bk-details-head">
        <span className={`kind-badge large g-${group}`} aria-hidden>
          <KindIcon kind={b.kind} />
        </span>
        <div className="bk-details-title">
          <h2>{item.title}</h2>
          <div className="muted">{where}</div>
        </div>
        <button type="button" className="btn small" onClick={onEdit}>
          Edit
        </button>
      </header>

      <dl className="detail-list bk-facts">
        {item.stay ? (
          <>
            <Fact label="Check-in">
              {dayText(item.stay.checkInDate)}
              {item.stay.checkInFrom != null && ` · from ${clock(item.stay.checkInFrom)}`}
              {item.stay.checkIn && <span className="muted"> · block {clock(item.stay.checkIn.start)}</span>}
            </Fact>
            <Fact label="Check-out">
              {dayText(item.stay.checkOutDate)}
              {item.stay.checkOutBy != null && ` · by ${clock(item.stay.checkOutBy)}`}
              {item.stay.checkOut && <span className="muted"> · block {clock(item.stay.checkOut.start)}</span>}
            </Fact>
          </>
        ) : (
          <Fact label="When">
            {item.slot
              ? `${dayText(item.slot.date)} · ${clock(item.slot.start)}–${clock(item.slot.end)}`
              : b.date
                ? `${dayText(b.date)} · no time yet`
                : 'No date yet'}
          </Fact>
        )}
        <Fact label="Timetable">
          {spot ? (
            <button type="button" className="link-btn" onClick={() => onShowOnTimetable(spot.date, item.placeId ?? null)}>
              Show on timetable ({monthDay(spot.date)})
            </button>
          ) : (
            <span className="muted">{b.date ? 'Waiting in the Place List for a time' : 'Not on the timetable'}</span>
          )}
        </Fact>
        {b.confirmation && (
          <Fact label="Confirmation">
            <span className="mono">{showCode ? b.confirmation : maskConfirmation(b.confirmation)}</span>{' '}
            <button type="button" className="link-btn" onClick={() => setShown(showCode ? null : item.id)}>
              {showCode ? 'Hide' : 'Show'}
            </button>
          </Fact>
        )}
        {(b.address || link) && (
          <Fact label="Address">
            {b.address ?? place?.address ?? ''}
            {link && (
              <>
                {(b.address ?? place?.address) && ' · '}
                <a className="maps-link" href={link} target="_blank" rel="noreferrer">
                  Open in Google Maps <ExternalIcon />
                </a>
              </>
            )}
          </Fact>
        )}
        {b.cancelDeadline && (
          <Fact label="Cancellation">
            <span className="tag warn">Free until {deadlineText(b.cancelDeadline)}</span>
            {b.cancelNote && <> then {b.cancelNote}</>}
          </Fact>
        )}
        {(b.provider || b.url) && (
          <Fact label="Booked on">
            {b.provider}
            {b.url && (
              <>
                {b.provider && ' · '}
                <a className="maps-link" href={b.url} target="_blank" rel="noreferrer">
                  Open booking <ExternalIcon />
                </a>
              </>
            )}
          </Fact>
        )}
      </dl>

      <PriceBox trip={trip} item={item} apply={apply} />

      {item.stay && <BaseNights item={item} />}

      <section className="bk-box">
        <h3>Files</h3>
        {b.files?.length ? (
          <ul className="bk-files">
            {b.files.map((f) => (
              <li key={f.id}>{f.name}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No files attached. Attaching files comes later.</p>
        )}
      </section>

      <section className="bk-box">
        <h3>Budget</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={b.countInBudget ?? true}
            onChange={(e) =>
              apply(
                [{ op: 'setBooking', id: item.id, booking: { ...b, countInBudget: e.target.checked } }],
                `${e.target.checked ? 'Counted' : 'Left out of the budget:'} ${item.title}`,
              )
            }
          />
          Count in trip budget · {groupLabel(group)}
        </label>
      </section>

      {item.notes && (
        <section className="bk-box">
          <h3>Notes</h3>
          <p className="bk-notes">{item.notes}</p>
        </section>
      )}

      <div className="detail-actions">
        <button type="button" className="btn small danger" onClick={remove}>
          Remove booking
        </button>
      </div>
    </aside>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Price as known (items 58–60): amount, currency, the two toggles, people; the total and the calculated forms in grey. */
function PriceBox({ trip, item, apply }: { trip: Trip; item: Item; apply: Props['apply'] }) {
  const cost = item.cost
  const currencies = tripCurrencies(trip)
  const forms: CostForms | null = cost ? safeForms(trip, item.id) : null
  const home = trip.settings.homeCurrency
  const rate = cost ? (cost.currency === home ? 1 : trip.settings.currencies.find((c) => c.code === cost.currency)?.rateToHome) : undefined

  const base: Cost = cost ?? { amount: 0, currency: currencies[0], perNight: false, perPerson: false, people: null, status: 'booked', replacedEstimate: null, date: null }
  const setCost = (next: Cost | null, label: string) => apply([{ op: 'setCost', id: item.id, cost: next }], `${label}: ${item.title}`)

  return (
    <section className="bk-box price-box">
      <h3>Price</h3>
      <div className="price-row">
        <CommitInput
          className="field amount"
          aria-label="Price amount"
          inputMode="decimal"
          placeholder="Amount"
          value={cost ? String(cost.amount) : ''}
          onCommit={(text) => {
            if (!text.trim()) return cost ? setCost(null, 'Price removed') : true
            const amount = parseAmount(text)
            if (amount == null) return false
            return setCost({ ...base, amount }, 'Price')
          }}
        />
        <select
          className="field"
          aria-label="Currency"
          value={base.currency}
          disabled={!cost}
          onChange={(e) => setCost({ ...base, currency: e.target.value }, 'Currency')}
        >
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button type="button" className="toggle" aria-pressed={!!base.perNight} disabled={!cost} onClick={() => setCost({ ...base, perNight: !base.perNight }, 'Per night')}>
          Per night
        </button>
        <button type="button" className="toggle" aria-pressed={!!base.perPerson} disabled={!cost} onClick={() => setCost({ ...base, perPerson: !base.perPerson }, 'Per person')}>
          Per person
        </button>
      </div>
      {cost && forms ? (
        <>
          <p className="hint muted">{basisHint(!!cost.perNight, !!cost.perPerson)}</p>
          <dl className="detail-list">
            {item.stay && (
              <Fact label="Nights">
                {forms.nights} <span className="muted">from check-in / check-out</span>
              </Fact>
            )}
            <Fact label="People">
              <CommitInput
                className="field people"
                aria-label="People this price covers"
                inputMode="numeric"
                value={String(forms.people)}
                onCommit={(text) => {
                  const n = Number(text.trim())
                  if (!text.trim()) return setCost({ ...cost, people: null }, 'People')
                  if (!Number.isInteger(n) || n < 1) return false
                  return setCost({ ...cost, people: n === trip.settings.people && cost.people == null ? null : n }, 'People')
                }}
              />{' '}
              <span className="muted">
                of {trip.settings.people} on the trip{forms.peopleFollowTrip ? ' (follows the trip)' : ''}
              </span>
            </Fact>
            <Fact label="Status">
              <span className="seg" role="group" aria-label="Price status">
                <button type="button" aria-pressed={cost.status === 'booked'} onClick={() => setCost({ ...cost, status: 'booked' }, 'Booked')}>
                  Booked
                </button>
                <button type="button" aria-pressed={cost.status === 'estimated'} onClick={() => setCost({ ...cost, status: 'estimated' }, 'Estimated')}>
                  Estimated
                </button>
              </span>
              {cost.replacedEstimate && <span className="faint"> est. {money(cost.replacedEstimate.amount, cost.replacedEstimate.currency)}</span>}
            </Fact>
            <Fact label="Total">
              <strong>{money(forms.total, forms.currency)}</strong>
              {cost.currency !== home && (
                <span className="muted"> {rate != null ? approx(forms.total * rate, home) : `· no rate for ${cost.currency} yet`}</span>
              )}
            </Fact>
            <Fact label="Calculated">
              <span className="calc">{calculated(forms).join(' · ')}</span>
            </Fact>
          </dl>
        </>
      ) : (
        <p className="hint muted">No price yet. Type an amount; it counts as the whole booking unless you switch on Per night or Per person.</p>
      )}
    </section>
  )
}

function safeForms(trip: Trip, id: string): CostForms | null {
  try {
    return core.costForms(trip, id)
  } catch {
    return null
  }
}

/** The nights this stay sets as the base (item 49). */
function BaseNights({ item }: { item: Item }) {
  const nights = nightDates(item.stay!)
  const name = item.title
  return (
    <section className="bk-box">
      <h3>Base for these nights</h3>
      <div className="night-chips">
        {nights.map((d) => (
          <span key={d} className="night-chip">
            {monthDay(d)}
          </span>
        ))}
      </div>
      <p className="hint muted">These days use {name} for daylight and weather.</p>
    </section>
  )
}

import { useState, type FormEvent, type ReactNode } from 'react'
import { basisHint, bookingCommands, emptyFields, fieldsFromItem, isStayKind, tripCurrencies, type BookingFields } from '../bookings'
import { shortId } from '../core'
import { GROUPS } from '../format'
import { PLACE_KINDS } from '../places'
import type { Command, Item, Kind, Trip } from '../types'

interface Props {
  trip: Trip
  /** The booking being edited; absent when adding. */
  item?: Item
  /** Apply the commands as one step; false when the core refused (the app shows why). */
  apply: (commands: Command[], label: string) => boolean
  /** Closed after a save, with the item's id. */
  onDone: (itemId: string | null) => void
}

/** Add a booking (item 50), or edit one: kind, title, place, when, booking details, price (items 58–60). */
export function BookingForm({ trip, item, apply, onDone }: Props) {
  const [f, setF] = useState<BookingFields>(() => (item ? fieldsFromItem(item, trip) : emptyFields(trip)))
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof BookingFields>(key: K, value: BookingFields[K]) => setF((x) => ({ ...x, [key]: value }))
  const stay = isStayKind(f.kind)
  const currencies = tripCurrencies(trip)
  const places = [...trip.places].sort((a, b) => a.name.localeCompare(b.name))

  const pickPlace = (id: string) => {
    const p = trip.places.find((x) => x.id === id)
    setF((x) => ({
      ...x,
      placeId: id,
      title: x.title.trim() || !p ? x.title : p.name,
      kind: p && !x.title.trim() ? p.kind : x.kind,
      address: x.address.trim() || !p?.address ? x.address : p.address,
    }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const id = item?.id ?? `b-${shortId()}`
    const r = bookingCommands(f, id, item)
    if ('error' in r) return setError(r.error)
    if (r.commands.length === 0) return onDone(id)
    if (apply(r.commands, item ? `Edited booking ${f.title.trim()}` : `Added booking ${f.title.trim()}`)) onDone(id)
    else setError('The booking was not saved; see the message at the top.')
  }

  return (
    <div className="backdrop" onKeyDown={(e) => e.key === 'Escape' && onDone(null)}>
      <div className="dialog wide scroll" role="dialog" aria-modal="true" aria-labelledby="booking-form-title">
        <h2 id="booking-form-title">{item ? `Edit ${item.title}` : 'Add a booking'}</h2>
        <form onSubmit={submit}>
          <div className="row">
            <label>
              Type
              <select value={f.kind} onChange={(e) => set('kind', e.target.value as Kind)} autoFocus>
                {GROUPS.map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {PLACE_KINDS.filter((k) => k.group === g.id).map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              Place (optional)
              <select value={f.placeId} onChange={(e) => pickPlace(e.target.value)}>
                <option value="">No place</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Title
            <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={stay ? 'Hotel in Asakusa' : 'Sushi dinner'} />
          </label>

          {stay ? (
            <>
              <div className="row">
                <Field label="Check-in date">
                  <input type="date" value={f.checkInDate} onChange={(e) => set('checkInDate', e.target.value)} />
                </Field>
                <Field label="Check-out date">
                  <input type="date" value={f.checkOutDate} min={f.checkInDate || undefined} onChange={(e) => set('checkOutDate', e.target.value)} />
                </Field>
              </div>
              <div className="row">
                <Field label="Check-in from (hotel)">
                  <input type="time" value={f.checkInFrom} onChange={(e) => set('checkInFrom', e.target.value)} />
                </Field>
                <Field label="Check-out by (hotel)">
                  <input type="time" value={f.checkOutBy} onChange={(e) => set('checkOutBy', e.target.value)} />
                </Field>
              </div>
              <div className="row">
                <Field label="Check-in block on the timetable">
                  <input type="time" value={f.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} />
                </Field>
                <Field label="Check-out block on the timetable">
                  <input type="time" value={f.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value)} />
                </Field>
              </div>
            </>
          ) : (
            <>
              <div className="row">
                <Field label="Date">
                  <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
                </Field>
                <Field label="Start (optional)">
                  <input type="time" value={f.start} onChange={(e) => set('start', e.target.value)} />
                </Field>
                <Field label="End">
                  <input type="time" value={f.end} disabled={!f.start} onChange={(e) => set('end', e.target.value)} />
                </Field>
              </div>
              <span className="hint muted">
                {f.start
                  ? 'With a time it goes on the timetable.'
                  : 'With a date and no time it waits in the Place List until you drag it onto the timetable.'}
              </span>
              {f.start && (
                <label className="check">
                  <input type="checkbox" checked={f.fixed} onChange={(e) => set('fixed', e.target.checked)} />
                  Fixed on the timetable (“Ticket booked”)
                </label>
              )}
            </>
          )}

          <div className="row">
            <Field label="Confirmation number">
              <input value={f.confirmation} onChange={(e) => set('confirmation', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Booked on">
              <input value={f.provider} onChange={(e) => set('provider', e.target.value)} placeholder="Booking site" />
            </Field>
          </div>
          <Field label="Booking link">
            <input value={f.url} onChange={(e) => set('url', e.target.value)} inputMode="url" placeholder="https://…" />
          </Field>
          <Field label="Address">
            <input value={f.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <div className="row">
            <Field label="Free cancellation until">
              <input type="datetime-local" value={f.cancelDeadline} onChange={(e) => set('cancelDeadline', e.target.value)} />
            </Field>
            <Field label="After that">
              <input value={f.cancelNote} onChange={(e) => set('cancelNote', e.target.value)} placeholder="100% charged" />
            </Field>
          </div>

          <fieldset className="price-fields">
            <legend>Price</legend>
            <div className="row">
              <Field label="Amount">
                <input value={f.amount} onChange={(e) => set('amount', e.target.value)} inputMode="decimal" placeholder="54,000" />
              </Field>
              <Field label="Currency">
                <select value={f.currency} onChange={(e) => set('currency', e.target.value)}>
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={`People (trip: ${trip.settings.people})`}>
                <input value={f.people} onChange={(e) => set('people', e.target.value)} inputMode="numeric" placeholder={String(trip.settings.people)} />
              </Field>
            </div>
            <div className="toggles">
              <button type="button" className="toggle" aria-pressed={f.perNight} onClick={() => set('perNight', !f.perNight)}>
                Per night
              </button>
              <button type="button" className="toggle" aria-pressed={f.perPerson} onClick={() => set('perPerson', !f.perPerson)}>
                Per person
              </button>
              <span className="seg" role="group" aria-label="Price status">
                <button type="button" aria-pressed={f.status === 'booked'} onClick={() => set('status', 'booked')}>
                  Booked
                </button>
                <button type="button" aria-pressed={f.status === 'estimated'} onClick={() => set('status', 'estimated')}>
                  Estimated
                </button>
              </span>
            </div>
            <span className="hint muted">{basisHint(f.perNight, f.perPerson)}</span>
            <label className="check">
              <input type="checkbox" checked={f.countInBudget} onChange={(e) => set('countInBudget', e.target.checked)} />
              Count in trip budget
            </label>
          </fieldset>

          <label>
            Notes
            <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </label>
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button type="button" className="btn" onClick={() => onDone(null)}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {item ? 'Save' : 'Add booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  )
}

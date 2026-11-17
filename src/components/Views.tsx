import { useMemo, useState, type FormEvent } from 'react'
import { buildGuideHtml, downloadFile } from '../lib/guide'
import { budget, PACE } from '../lib/schedule'
import { shortDate, weekdayName } from '../lib/time'
import { newId, useApp } from '../store'
import { CATEGORIES, type Pace } from '../types'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trip'

export function BudgetView() {
  const { trip } = useApp()
  const totals = useMemo(() => budget(trip), [trip])
  const party = trip.travelers.length
  const money = (n: number) => `${trip.currency} ${Math.round(n).toLocaleString('en')}`
  const home = (n: number) => `${trip.homeCurrency} ${Math.round(n * trip.rate).toLocaleString('en')}`
  const label = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id

  return (
    <div className="page">
      <h2>Budget</h2>
      <p className="lede">
        Costs come from the timetable: each block's cost per person and each checked fare. {party} travelling, 1 {trip.currency} = {trip.rate} {trip.homeCurrency} (rate entered {trip.rateDate}).
      </p>
      <div className="totals">
        <div>
          <span>Per person</span>
          <strong>{money(totals.perPerson)}</strong>
          <em>{home(totals.perPerson)}</em>
        </div>
        <div>
          <span>Whole party</span>
          <strong>{money(totals.perPerson * party)}</strong>
          <em>{home(totals.perPerson * party)}</em>
        </div>
      </div>
      {totals.perPerson === 0 ? (
        <p className="empty">No costs yet. Select a block on the timetable and enter its cost per person.</p>
      ) : (
        <div className="tables">
          <table>
            <caption>By type</caption>
            <thead>
              <tr>
                <th>Type</th>
                <th className="num">Per person</th>
                <th className="num">Party</th>
                <th className="num">{trip.homeCurrency}</th>
              </tr>
            </thead>
            <tbody>
              {totals.byCategory.map((r) => (
                <tr key={r.label}>
                  <td>
                    <span className={`dot cat-${r.label}`} />
                    {label(r.label)}
                  </td>
                  <td className="num">{money(r.perPerson)}</td>
                  <td className="num">{money(r.perPerson * party)}</td>
                  <td className="num">{home(r.perPerson * party)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <caption>By day</caption>
            <thead>
              <tr>
                <th>Day</th>
                <th className="num">Per person</th>
                <th className="num">Party</th>
                <th className="num">{trip.homeCurrency}</th>
              </tr>
            </thead>
            <tbody>
              {totals.byDay.map((r) => (
                <tr key={r.label}>
                  <td>
                    {weekdayName(r.label)} {shortDate(r.label)}
                  </td>
                  <td className="num">{money(r.perPerson)}</td>
                  <td className="num">{money(r.perPerson * party)}</td>
                  <td className="num">{home(r.perPerson * party)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ChecklistView() {
  const { trip, dispatch } = useApp()
  const [text, setText] = useState('')
  const open = trip.checklist.filter((c) => !c.done).length

  function add(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    dispatch({ type: 'addCheck', item: { id: newId('c'), text: text.trim(), done: false } })
    setText('')
  }

  return (
    <div className="page narrow">
      <h2>Before you go</h2>
      <p className="lede">Things to ask, book and decide. {open ? `${open} still open.` : 'Everything is done.'}</p>
      <form className="add-check" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add something to ask, book or decide" aria-label="New checklist item" />
        <button type="submit" className="btn primary" disabled={!text.trim()}>
          Add item
        </button>
      </form>
      <ul className="checklist">
        {trip.checklist.map((c) => (
          <li key={c.id} className={c.done ? 'done' : ''}>
            <input type="checkbox" checked={c.done} onChange={(e) => dispatch({ type: 'updateCheck', id: c.id, patch: { done: e.target.checked } })} aria-label={c.text} />
            <div>
              <input className="plain" value={c.text} onChange={(e) => dispatch({ type: 'updateCheck', id: c.id, patch: { text: e.target.value } })} aria-label="Item" />
              <input className="plain sub" value={c.note ?? ''} placeholder="Add a note" onChange={(e) => dispatch({ type: 'updateCheck', id: c.id, patch: { note: e.target.value || undefined } })} aria-label="Note" />
            </div>
            <button type="button" className="btn tiny" onClick={() => dispatch({ type: 'removeCheck', id: c.id })} aria-label={`Delete ${c.text}`}>
              Delete
            </button>
          </li>
        ))}
        {trip.checklist.length === 0 && <li className="empty">Nothing here yet.</li>}
      </ul>
    </div>
  )
}

export function GuideView() {
  const { trip } = useApp()
  const html = useMemo(() => buildGuideHtml(trip), [trip])
  return (
    <div className="page guide">
      <div className="guide-text">
        <h2>Trip guide</h2>
        <p className="lede">
          This is what you carry on the trip: one file with each day as a line of stops, travel between them, map links, your checklist and the budget. On the day itself it opens on today and marks where you are in the schedule.
        </p>
        <button type="button" className="btn primary" onClick={() => downloadFile(`${slug(trip.name)}-guide.html`, html, 'text/html')}>
          Download trip guide
        </button>
        <ul className="notes">
          <li>The file works offline. Only the map and directions links need a connection.</li>
          <li>Nothing is uploaded. Send the file to the people travelling with you directly.</li>
          <li>Travel times marked as estimates have not been checked against a real route.</li>
          <li>Download it again after you change the plan.</li>
        </ul>
      </div>
      <div className="phone">
        <iframe title="Trip guide preview" srcDoc={html} sandbox="allow-scripts allow-popups" />
      </div>
    </div>
  )
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { trip, dispatch } = useApp()
  const [names, setNames] = useState(trip.travelers.map((t) => t.name).join(', '))

  function saveTravelers(value: string) {
    setNames(value)
    const list = value.split(',').map((n) => n.trim()).filter(Boolean)
    if (list.length === 0) return
    // Keep the id of anyone whose name is unchanged so their wishes survive.
    const travelers = list.map((name, i) => trip.travelers.find((t) => t.name === name) ?? { id: `${slug(name)}-${i}`, name })
    dispatch({ type: 'updateTrip', patch: { travelers } })
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Trip settings" onClick={(e) => e.stopPropagation()}>
        <div className="insp-head">
          <h3>Trip settings</h3>
          <button type="button" className="btn small" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="form">
          <label className="wide">
            Trip name
            <input value={trip.name} onChange={(e) => dispatch({ type: 'updateTrip', patch: { name: e.target.value } })} />
          </label>
          <label className="wide">
            Destination
            <input value={trip.destination} onChange={(e) => dispatch({ type: 'updateTrip', patch: { destination: e.target.value } })} />
          </label>
          <label>
            First day
            <input type="date" value={trip.startDate} max={trip.endDate} onChange={(e) => e.target.value && dispatch({ type: 'updateTrip', patch: { startDate: e.target.value } })} />
          </label>
          <label>
            Last day
            <input type="date" value={trip.endDate} min={trip.startDate} onChange={(e) => e.target.value && dispatch({ type: 'updateTrip', patch: { endDate: e.target.value } })} />
          </label>
          <label className="wide">
            Who is travelling (comma separated; a group such as Parents counts as one)
            <input value={names} onChange={(e) => saveTravelers(e.target.value)} />
          </label>
          <label className="wide">
            Pace
            <select value={trip.pace} onChange={(e) => dispatch({ type: 'updateTrip', patch: { pace: e.target.value as Pace } })}>
              {Object.entries(PACE).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="hint">{PACE[trip.pace].hint} Changes the estimated travel times.</span>
          </label>
          <label>
            Prices in
            <input value={trip.currency} onChange={(e) => dispatch({ type: 'updateTrip', patch: { currency: e.target.value.toUpperCase() } })} />
          </label>
          <label>
            Home currency
            <input value={trip.homeCurrency} onChange={(e) => dispatch({ type: 'updateTrip', patch: { homeCurrency: e.target.value.toUpperCase() } })} />
          </label>
          <label>
            Rate (1 {trip.currency} in {trip.homeCurrency})
            <input type="number" step="0.0001" min={0} value={trip.rate} onChange={(e) => dispatch({ type: 'updateTrip', patch: { rate: Number(e.target.value) || 0 } })} />
          </label>
          <label>
            Rate date
            <input type="date" value={trip.rateDate} onChange={(e) => dispatch({ type: 'updateTrip', patch: { rateDate: e.target.value } })} />
          </label>
        </div>
      </div>
    </div>
  )
}

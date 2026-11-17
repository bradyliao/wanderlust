import { dayLegs, estimateLeg, mapsDirectionsUrl, mapsPlaceUrl, placeOf } from '../lib/schedule'
import { fmtTime, parseTime, shortDate, weekdayName } from '../lib/time'
import { useApp } from '../store'
import { CATEGORIES, type Category, type LegMode } from '../types'

const numberOrUndefined = (v: string) => (v === '' ? undefined : Number(v))

export function Inspector() {
  const { selection } = useApp()
  if (!selection) return null
  return (
    <aside className="inspector" aria-label="Details">
      {selection.type === 'block' && <BlockForm id={selection.id} />}
      {selection.type === 'place' && <PlaceForm id={selection.id} />}
      {selection.type === 'leg' && <LegForm legKey={selection.key} />}
    </aside>
  )
}

function Head({ title, kind }: { title: string; kind: string }) {
  const { select } = useApp()
  return (
    <div className="insp-head">
      <div>
        <span className="insp-kind">{kind}</span>
        <h3>{title}</h3>
      </div>
      <button type="button" className="btn small" onClick={() => select(null)}>
        Close
      </button>
    </div>
  )
}

function BlockForm({ id }: { id: string }) {
  const { trip, days, dispatch, select } = useApp()
  const block = trip.blocks.find((b) => b.id === id)
  if (!block) return null
  const place = placeOf(trip, block)
  const patch = (p: Partial<typeof block>) => dispatch({ type: 'updateBlock', id, patch: p })

  return (
    <>
      <Head title={block.title} kind="Timetable block" />
      <div className="form">
        <label className="wide">
          Title
          <input value={block.title} onChange={(e) => patch({ title: e.target.value })} />
        </label>
        <label>
          Day
          <select value={block.day} onChange={(e) => patch({ day: e.target.value })} disabled={block.locked}>
            {days.map((d) => (
              <option key={d} value={d}>
                {weekdayName(d)} {shortDate(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={block.category} onChange={(e) => patch({ category: e.target.value as Category })}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start
          <input
            type="time"
            step={300}
            value={fmtTime(block.start)}
            disabled={block.locked}
            onChange={(e) => {
              const start = parseTime(e.target.value)
              if (start !== undefined && start < block.end) patch({ start })
            }}
          />
        </label>
        <label>
          End
          <input
            type="time"
            step={300}
            value={fmtTime(Math.min(block.end, 23 * 60 + 59))}
            disabled={block.locked}
            onChange={(e) => {
              const end = parseTime(e.target.value)
              if (end !== undefined && end > block.start) patch({ end })
            }}
          />
        </label>
        <label>
          Cost per person ({trip.currency})
          <input type="number" min={0} value={block.cost ?? ''} onChange={(e) => patch({ cost: numberOrUndefined(e.target.value) })} />
        </label>
        <div className="checks">
          <label className="check-inline">
            <input type="checkbox" checked={!!block.locked} onChange={(e) => patch({ locked: e.target.checked })} />
            Fixed time
          </label>
          <label className="check-inline">
            <input type="checkbox" checked={!!block.tentative} onChange={(e) => patch({ tentative: e.target.checked })} />
            Not decided yet
          </label>
        </div>
        <label className="wide">
          Notes
          <textarea rows={2} value={block.note ?? ''} onChange={(e) => patch({ note: e.target.value })} />
        </label>
      </div>
      <div className="insp-actions">
        {place && (
          <a className="btn small" href={mapsPlaceUrl(place)} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        )}
        <button
          type="button"
          className="btn small danger"
          onClick={() => {
            dispatch({ type: 'removeBlock', id })
            select(null)
          }}
        >
          Remove from timetable
        </button>
      </div>
    </>
  )
}

function PlaceForm({ id }: { id: string }) {
  const { trip, dispatch, select } = useApp()
  const place = trip.places.find((p) => p.id === id)
  if (!place) return null
  const patch = (p: Partial<typeof place>) => dispatch({ type: 'updatePlace', id, patch: p })
  const used = trip.blocks.filter((b) => b.placeId === id).length

  return (
    <>
      <Head title={place.name} kind="Place" />
      <div className="form">
        <label className="wide">
          Name
          <input value={place.name} onChange={(e) => patch({ name: e.target.value })} />
        </label>
        <label>
          Area
          <input value={place.area} onChange={(e) => patch({ area: e.target.value })} />
        </label>
        <label>
          Type
          <select value={place.category} onChange={(e) => patch({ category: e.target.value as Category })}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Opens
          <input type="time" value={place.open !== undefined ? fmtTime(place.open) : ''} onChange={(e) => patch({ open: parseTime(e.target.value) })} />
        </label>
        <label>
          Closes
          <input type="time" value={place.close !== undefined ? fmtTime(Math.min(place.close, 1439)) : ''} onChange={(e) => patch({ close: parseTime(e.target.value) })} />
        </label>
        <label>
          Usual stay (min)
          <input type="number" min={15} step={15} value={place.stayMin} onChange={(e) => patch({ stayMin: Number(e.target.value) || 60 })} />
        </label>
        <label>
          Seasonal
          <input value={place.seasonal ?? ''} onChange={(e) => patch({ seasonal: e.target.value || undefined })} placeholder="e.g. Autumn leaves" />
        </label>
        <label className="wide">
          Source link
          <input value={place.source ?? ''} onChange={(e) => patch({ source: e.target.value || undefined })} placeholder="Post or page this came from" />
        </label>
        <label className="wide">
          Notes
          <textarea rows={2} value={place.note ?? ''} onChange={(e) => patch({ note: e.target.value })} />
        </label>
      </div>
      <div className="insp-actions">
        <a className="btn small" href={mapsPlaceUrl(place)} target="_blank" rel="noreferrer">
          Open in Google Maps
        </a>
        <button
          type="button"
          className="btn small danger"
          onClick={() => {
            if (used && !window.confirm(`${place.name} is on the timetable ${used} time${used > 1 ? 's' : ''}. Those blocks stay but lose their map position. Delete the place?`)) return
            dispatch({ type: 'removePlace', id })
            select(null)
          }}
        >
          Delete place
        </button>
      </div>
    </>
  )
}

function LegForm({ legKey }: { legKey: string }) {
  const { trip, days, dispatch } = useApp()
  const leg = days.flatMap((d) => dayLegs(trip, d)).find((l) => l.key === legKey)
  if (!leg) return null
  const a = placeOf(trip, leg.from)
  const b = placeOf(trip, leg.to)
  if (!a || !b) return null
  const current = { mode: leg.mode, minutes: leg.minutes, cost: leg.cost, note: leg.note, verified: leg.verified }
  const save = (p: Partial<typeof current>) => dispatch({ type: 'setLeg', key: legKey, leg: { ...current, verified: true, ...p } })
  const estimate = estimateLeg(a, b, trip.pace)

  return (
    <>
      <Head title={`${leg.from.title} to ${leg.to.title}`} kind="Travel" />
      <p className={`insp-note${leg.tight ? ' warn' : ''}`}>
        {leg.verified
          ? 'You entered these numbers.'
          : `Rough estimate from straight-line distance at ${trip.pace} pace. Check the real route, then enter it here.`}{' '}
        The timetable leaves {leg.gap} min.
      </p>
      <div className="form">
        <label>
          How
          <select value={leg.mode} onChange={(e) => save({ mode: e.target.value as LegMode })}>
            <option value="walk">Walk</option>
            <option value="transit">Transit</option>
            <option value="drive">Drive</option>
          </select>
        </label>
        <label>
          Minutes
          <input type="number" min={1} value={leg.minutes} onChange={(e) => save({ minutes: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
        <label>
          Fare per person ({trip.currency})
          <input type="number" min={0} value={leg.cost ?? ''} onChange={(e) => save({ cost: numberOrUndefined(e.target.value) })} />
        </label>
        <label className="wide">
          Route notes
          <input value={leg.note ?? ''} onChange={(e) => save({ note: e.target.value || undefined })} placeholder="Line, platform, exit" />
        </label>
      </div>
      <div className="insp-actions">
        <a className="btn small" href={mapsDirectionsUrl(a, b, leg.mode)} target="_blank" rel="noreferrer">
          Check route in Google Maps
        </a>
        {leg.verified && (
          <button type="button" className="btn small" onClick={() => dispatch({ type: 'setLeg', key: legKey, leg: undefined })}>
            Back to estimate ({estimate.minutes} min)
          </button>
        )}
      </div>
    </>
  )
}

import { useMemo, useState, type FormEvent } from 'react'
import { dayBlocks, parseLatLng } from '../lib/schedule'
import { fmtDuration, shortDate } from '../lib/time'
import { newId, useApp } from '../store'
import { CATEGORIES, type Category, type Place, type Wish } from '../types'

const WISH_ORDER: (Wish | undefined)[] = [undefined, 'want', 'maybe', 'skip']
const WISH_LABEL: Record<Wish, string> = { want: 'wants to go', maybe: 'could go either way', skip: 'would skip' }

export function PlacePool() {
  const { trip, dispatch, selection, select, activeDay } = useApp()
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('')
  const [category, setCategory] = useState('')
  const [unscheduledOnly, setUnscheduledOnly] = useState(false)
  const [adding, setAdding] = useState(false)

  const areas = useMemo(() => [...new Set(trip.places.map((p) => p.area))].sort(), [trip.places])
  const scheduledOn = useMemo(() => {
    const map = new Map<string, string>()
    for (const b of trip.blocks) if (b.placeId && !map.has(b.placeId)) map.set(b.placeId, b.day)
    return map
  }, [trip.blocks])

  const shown = trip.places.filter(
    (p) =>
      (!query || p.name.toLowerCase().includes(query.toLowerCase())) &&
      (!area || p.area === area) &&
      (!category || p.category === category) &&
      (!unscheduledOnly || !scheduledOn.has(p.id)),
  )

  function addToDay(place: Place) {
    if (!activeDay) return
    const last = dayBlocks(trip, activeDay).at(-1)
    const start = Math.min(last ? last.end + 30 : 9 * 60, 23 * 60)
    const id = newId('b')
    dispatch({
      type: 'addBlock',
      block: { id, day: activeDay, start, end: Math.min(start + place.stayMin, 24 * 60), placeId: place.id, title: place.name, category: place.category },
    })
    select({ type: 'block', id })
  }

  function cycleWish(place: Place, travelerId: string) {
    const next = WISH_ORDER[(WISH_ORDER.indexOf(place.wishes[travelerId]) + 1) % WISH_ORDER.length]
    dispatch({ type: 'setWish', placeId: place.id, travelerId, wish: next })
  }

  return (
    <section className="pool" aria-label="Places">
      <div className="pane-head">
        <h2>Places</h2>
        <button type="button" className="btn small" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          {adding ? 'Close' : 'Add place'}
        </button>
      </div>

      {adding && <AddPlace onDone={() => setAdding(false)} />}

      <div className="filters">
        <input type="search" placeholder="Search places" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search places" />
        <div className="filter-row">
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Type">
            <option value="">All types</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={unscheduledOnly} onChange={(e) => setUnscheduledOnly(e.target.checked)} />
          Not on the timetable yet
        </label>
      </div>

      <ul className="place-list">
        {shown.map((p) => {
          const day = scheduledOn.get(p.id)
          const selected = selection?.type === 'place' && selection.id === p.id
          return (
            <li
              key={p.id}
              className={`place cat-${p.category}${selected ? ' selected' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/place-id', p.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
            >
              <button type="button" className="place-main" onClick={() => select({ type: 'place', id: p.id })}>
                <span className="place-name">{p.name}</span>
                <span className="place-meta">
                  {p.area}, {fmtDuration(p.stayMin)}
                </span>
                {p.seasonal && <span className="chip seasonal">{p.seasonal}</span>}
                {day && <span className="chip scheduled">On {shortDate(day)}</span>}
              </button>
              <div className="place-side">
                <div className="wishes">
                  {trip.travelers.map((t) => {
                    const w = p.wishes[t.id]
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`wish ${w ?? 'none'}`}
                        onClick={() => cycleWish(p, t.id)}
                        title={`${t.name}: ${w ? WISH_LABEL[w] : 'no opinion yet'}. Click to change.`}
                        aria-label={`${t.name} ${w ? WISH_LABEL[w] : 'has no opinion yet'} on ${p.name}. Change.`}
                      >
                        {t.name.slice(0, 1).toUpperCase()}
                      </button>
                    )
                  })}
                </div>
                <button type="button" className="btn tiny" onClick={() => addToDay(p)} disabled={!activeDay} title={activeDay ? `Add to ${shortDate(activeDay)}` : ''}>
                  Add to day
                </button>
              </div>
            </li>
          )
        })}
        {shown.length === 0 && <li className="empty">{trip.places.length ? 'No places match these filters.' : 'No places yet. Add the first one above.'}</li>}
      </ul>
      <p className="pane-foot">Drag a place onto a day, or use Add to day. Letters show who wants to go: filled is yes, outlined is maybe, struck is skip.</p>
    </section>
  )
}

function AddPlace({ onDone }: { onDone: () => void }) {
  const { dispatch, select } = useApp()
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [category, setCategory] = useState<Category>('sight')
  const [location, setLocation] = useState('')
  const [stay, setStay] = useState(60)
  const coords = parseLatLng(location)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !coords) return
    const id = newId('p')
    dispatch({
      type: 'addPlace',
      place: { id, name: name.trim(), area: area.trim() || 'Unsorted', category, ...coords, stayMin: stay, wishes: {}, source: location.startsWith('http') ? location : undefined },
    })
    select({ type: 'place', id })
    onDone()
  }

  return (
    <form className="add-place" onSubmit={submit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <label>
        Google Maps link or coordinates
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="35.7148, 139.7967" required />
        {location && !coords && <span className="field-error">No coordinates found. Paste the full link from the browser address bar, or type latitude, longitude.</span>}
      </label>
      <div className="filter-row">
        <label>
          Area
          <input value={area} onChange={(e) => setArea(e.target.value)} />
        </label>
        <label>
          Type
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stay (min)
          <input type="number" min={15} step={15} value={stay} onChange={(e) => setStay(Number(e.target.value) || 60)} />
        </label>
      </div>
      <button type="submit" className="btn primary" disabled={!name.trim() || !coords}>
        Add place
      </button>
    </form>
  )
}

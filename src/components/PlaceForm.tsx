import { useMemo, useState, type FormEvent } from 'react'
import * as core from '../core'
import { GROUPS } from '../format'
import { PLACE_KINDS, type PlaceFields } from '../places'
import type { Kind, Place } from '../types'

interface Props {
  /** The place being edited; absent when adding. */
  place?: Place
  /** Apply the change. Returns false when it failed (the app shows why). */
  onSave: (fields: PlaceFields) => boolean
  onCancel: () => void
}

function readCoords(url: string): [number, number] | null {
  if (!url.trim()) return null
  try {
    return core.coordsFromMapsUrl(url.trim())
  } catch {
    return null
  }
}

/** Add a place by hand, or edit one (phase 3). */
export function PlaceForm({ place, onSave, onCancel }: Props) {
  const [name, setName] = useState(place?.name ?? '')
  const [kind, setKind] = useState<Kind>(place?.kind ?? 'sight')
  const [area, setArea] = useState(place?.area ?? '')
  const [city, setCity] = useState(place?.city ?? '')
  const [url, setUrl] = useState(place?.googleMapsUrl ?? '')
  const [stay, setStay] = useState(place?.usualStayMinutes ? String(place.usualStayMinutes) : '')
  const [notes, setNotes] = useState(place?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const coords = useMemo(() => readCoords(url), [url])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Give the place a name.')
    let minutes: number | null = null
    if (stay.trim()) {
      minutes = Math.round(Number(stay))
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) return setError('Usual stay is a number of minutes, 1 to 1440.')
    }
    const ok = onSave({
      name: name.trim(),
      kind,
      area: area.trim(),
      city: city.trim(),
      googleMapsUrl: url.trim(),
      usualStayMinutes: minutes,
      notes: notes.trim(),
      coords,
    })
    if (!ok) setError('The place was not saved; see the message at the top.')
  }

  const title = place ? `Edit ${place.name}` : 'Add a place'
  return (
    <div className="backdrop" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="place-form-title">
        <h2 id="place-form-title">{title}</h2>
        <form onSubmit={submit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Senso-ji" autoFocus />
          </label>
          <label>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
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
          <div className="row">
            <label>
              Area
              <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Asakusa" />
            </label>
            <label>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Tokyo" />
            </label>
          </div>
          <label>
            Google Maps link
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" inputMode="url" />
            {url.trim() && (
              <span className="hint">
                {coords ? `Position read from the link: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}` : 'No position in this link; the map will not show the place yet.'}
              </span>
            )}
          </label>
          <label>
            Usual stay (minutes)
            <input
              type="number"
              min={1}
              max={1440}
              step="any"
              value={stay}
              onChange={(e) => setStay(e.target.value)}
              placeholder="60"
            />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {place ? 'Save' : 'Add place'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

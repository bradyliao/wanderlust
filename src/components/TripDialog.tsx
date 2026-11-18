import { useState, type FormEvent } from 'react'
import { dateRange } from '../format'
import type { TripSummary } from '../storage'

interface Props {
  trips: TripSummary[]
  /** Throws (or rejects) with a plain-words message when the trip can't be made. */
  onCreate: (name: string, start: string, end: string) => void | Promise<void>
  onPick: (id: string) => void
  onOpenFile: () => void
  /** Absent when there is no trip to go back to. */
  onCancel?: () => void
}

/** Pick a saved trip or start a new one. */
export function TripDialog({ trips, onCreate, onPick, onOpenFile, onCancel }: Props) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Give the trip a name.')
    if (!start || !end) return setError('Pick the first and last day.')
    if (end < start) return setError('The last day is before the first day.')
    try {
      await onCreate(name.trim(), start, end)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="backdrop" onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="trip-dialog-title">
        <h2 id="trip-dialog-title">{trips.length ? 'Trips' : 'Start a trip'}</h2>

        {trips.length > 0 && (
          <>
            <ul className="trip-pick">
              {trips.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => onPick(t.id)}>
                    <span>{t.name}</span>
                    <span className="muted">{dateRange(t.startDate, t.endDate)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h3>New trip</h3>
          </>
        )}

        <form onSubmit={submit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tokyo & Kyoto" autoFocus />
          </label>
          <div className="row">
            <label>
              First day
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              Last day
              <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button type="button" className="btn ghost" onClick={onOpenFile}>
              Open a trip file…
            </button>
            <span className="spacer" />
            {onCancel && (
              <button type="button" className="btn" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn primary">
              Create trip
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

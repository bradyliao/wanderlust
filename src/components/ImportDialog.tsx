import type { ReactNode } from 'react'
import { fieldList } from '../places'
import type { ImportPreview, PreviewPlace } from '../types'
import { KindBadge, RatingChip } from './PlaceList'

interface Props {
  fileName: string
  preview: ImportPreview
  onConfirm: () => void
  onCancel: () => void
}

/** What a places file would do, before anything changes (items 66–71). */
export function ImportDialog({ fileName, preview: pv, onConfirm, onCancel }: Props) {
  const fills = pv.duplicates.filter((d) => d.existingPlaceId && d.fills.length > 0).length
  const adds = pv.newPlaces.length + pv.linkOnly.length
  const nothing = adds === 0 && fills === 0
  const summary = [
    adds ? `${adds} new ${adds === 1 ? 'place' : 'places'}` : null,
    fills ? `details for ${fills} ${fills === 1 ? 'place' : 'places'} already in the list` : null,
  ]
    .filter(Boolean)
    .join(' and ')

  return (
    <div className="backdrop" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <h2 id="import-title">Import places</h2>
        <p className="muted">
          From {fileName}. {nothing ? 'Nothing new to add.' : `This adds ${summary}. Imported details are marked unverified until you check them.`}
        </p>

        <div className="import-body">
          {pv.newPlaces.length > 0 && (
            <ImportSection title="New places" count={pv.newPlaces.length}>
              {pv.newPlaces.map((p) => (
                <PreviewRow key={p.number} place={p} />
              ))}
            </ImportSection>
          )}

          {pv.linkOnly.length > 0 && (
            <ImportSection title="Details missing" count={pv.linkOnly.length} note="Only a name and a Google Maps link. They come in so you can fill in the rest.">
              {pv.linkOnly.map((p) => (
                <PreviewRow key={p.number} place={p} />
              ))}
            </ImportSection>
          )}

          {pv.duplicates.length > 0 && (
            <ImportSection title="Possible duplicates" count={pv.duplicates.length} note="Not added again. They only fill in what the place is missing.">
              {pv.duplicates.map((d) => (
                <li key={d.number} className="import-row">
                  <span className="import-text">
                    <span className="name">{d.name}</span>
                    <span className="muted">
                      {d.sameAsNumber != null ? `Same as place ${d.sameAsNumber} in this file` : `Already in the list as “${d.existingName}”`}
                      {d.matchedBy === 'link' ? ' (same Google Maps link)' : ' (same name and area)'}
                    </span>
                    <span className={d.fills.length ? '' : 'muted'}>{d.fills.length ? `Fills in: ${fieldList(d.fills)}` : 'Nothing new to fill in'}</span>
                  </span>
                </li>
              ))}
            </ImportSection>
          )}

          {pv.problems.length > 0 && (
            <ImportSection title="Problems" count={pv.problems.length} note="The places still come in; the bad fields are left out." tone="problem">
              {pv.problems.map((text, i) => (
                <li key={i} className="import-row problem">
                  {text}
                </li>
              ))}
            </ImportSection>
          )}
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={onConfirm} disabled={nothing} autoFocus={!nothing}>
            Import
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportSection({
  title,
  count,
  note,
  tone,
  children,
}: {
  title: string
  count: number
  note?: string
  tone?: 'problem'
  children: ReactNode
}) {
  return (
    <section className={`import-section ${tone ?? ''}`}>
      <h3>
        {title} <span className="muted">{count}</span>
      </h3>
      {note && <p className="muted note">{note}</p>}
      <ul>{children}</ul>
    </section>
  )
}

function PreviewRow({ place: p }: { place: PreviewPlace }) {
  return (
    <li className="import-row">
      <KindBadge kind={p.kind ?? 'other'} />
      <span className="import-text">
        <span className="name">{p.name}</span>
        <span className="muted">{[p.area, p.kind ? null : 'no type yet'].filter(Boolean).join(' · ') || ' '}</span>
      </span>
      <RatingChip rating={p.rating} />
    </li>
  )
}

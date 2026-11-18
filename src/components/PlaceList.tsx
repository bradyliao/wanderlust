import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { money, monthDay } from '../format'
import {
  changedFields,
  detailsMissing,
  fieldList,
  GROUP_BYS,
  groupRows,
  hoursShort,
  kindGroup,
  kindLabel,
  newPlace,
  RATINGS,
  ratingLabel,
  scheduleLabel,
  schedules,
  stayShort,
  weekRuns,
  type GroupBy,
  type PlaceFields,
  type Schedule,
  type Section,
} from '../places'
import { shortId } from '../core'
import { useSelection } from '../selection'
import type { Command, Item, Kind, Place, Rating, Trip } from '../types'
import { BookmarkIcon, Caret, ExternalIcon, ImportIcon, KindIcon, PlusIcon } from './icons'
import { Menu, MenuItem } from './Menu'
import { PlaceForm } from './PlaceForm'

/** Drag payloads for phase 4 (the timetable accepts them). */
export const PLACE_DRAG_TYPE = 'application/x-wanderlust-place'
export const ITEM_DRAG_TYPE = 'application/x-wanderlust-item'

interface Props {
  trip: Trip
  groupBy: GroupBy
  /** Apply commands as one undo step; false when the core refused (the app shows why). */
  apply: (commands: Command[], label: string) => boolean
}

/** Group-by menu and the add and import buttons, for the pane header. */
export function PlaceListTools({
  groupBy,
  onGroupBy,
  onAdd,
  onImport,
}: {
  groupBy: GroupBy
  onGroupBy: (g: GroupBy) => void
  onAdd: () => void
  onImport: () => void
}) {
  const current = GROUP_BYS.find((g) => g.id === groupBy)?.label ?? 'Area'
  return (
    <>
      <Menu buttonClass="btn small" title={`Group by: ${current}`} label={<>Group: {groupBy === 'scheduled' ? 'Scheduled' : current}</>}>
        {(close) =>
          GROUP_BYS.map((g) => (
            <MenuItem
              key={g.id}
              checked={g.id === groupBy}
              onSelect={() => {
                close()
                onGroupBy(g.id)
              }}
            >
              {g.label}
            </MenuItem>
          ))
        }
      </Menu>
      <span className="spacer" />
      <button type="button" className="icon-btn" title="Add a place" aria-label="Add a place" onClick={onAdd}>
        <PlusIcon />
      </button>
      <button type="button" className="icon-btn" title="Import places file…" aria-label="Import places file" onClick={onImport}>
        <ImportIcon />
      </button>
    </>
  )
}

/** The Place List (items 15–18, 64): grouped, collapsible sections of rows. */
export function PlaceList({ trip, groupBy, apply }: Props) {
  const sel = useSelection()
  const sections = useMemo(() => groupRows(trip, groupBy), [trip, groupBy])
  const sched = useMemo(() => schedules(trip), [trip])
  // Sections the user opened or closed, and the selection they did it under.
  // A new selection opens the sections that hold it (items 6, 7).
  const [open, setOpen] = useState<{ mark: string; map: Record<string, boolean> }>({ mark: '', map: {} })
  const [editing, setEditing] = useState<Place | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedId = sel.selectedPlaceId && trip.places.some((p) => p.id === sel.selectedPlaceId) ? sel.selectedPlaceId : null
  const mark = `${selectedId ?? ''}|${groupBy}`
  const holdsSelected = (s: Section) => !!selectedId && s.rows.some((r) => r.type === 'place' && r.place.id === selectedId)
  const forced = (s: Section) => open.mark !== mark && holdsSelected(s)
  const isOpen = (s: Section) => forced(s) || (open.map[s.key] ?? !s.collapsed)
  const toggle = (s: Section) =>
    setOpen((o) => {
      const map = { ...o.map }
      for (const f of sections) if (forced(f)) map[f.key] = true
      map[s.key] = !isOpen(s)
      return { mark, map }
    })

  useEffect(() => {
    if (!selectedId) return
    const el = listRef.current?.querySelector(`[data-place-id="${CSS.escape(selectedId)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, groupBy])

  if (trip.places.length === 0 && sections.length === 0) {
    return (
      <div className="place-empty">
        <p>No places yet.</p>
        <p className="muted">Add one with +, or import a places file made by AI from your saved posts.</p>
      </div>
    )
  }

  const rate = (p: Place, rating: Rating) => {
    if (p.rating !== rating) apply([{ op: 'ratePlace', id: p.id, rating }], `Rated ${p.name}: ${ratingLabel(rating)}`)
  }
  const markChecked = (p: Place) => apply([{ op: 'updatePlace', id: p.id, set: { unverified: [] } }], `Checked ${p.name}`)
  const remove = (p: Place) => {
    const blocks = trip.items.filter((i) => i.placeId === p.id).length
    const more =
      blocks === 0
        ? ''
        : blocks === 1
          ? ' One timetable block or booking uses it; that stays, without the link to the place.'
          : ` ${blocks} timetable blocks or bookings use it; they stay, without the link to the place.`
    if (!window.confirm(`Remove “${p.name}” from the Place List?${more} Undo brings it back.`)) return
    if (apply([{ op: 'removePlace', id: p.id }], `Removed ${p.name}`)) sel.select(null, 'list')
  }
  const saveEdit = (p: Place, f: PlaceFields) => {
    const set = changedFields(p, f)
    if (Object.keys(set).length === 0) return true
    return apply([{ op: 'updatePlace', id: p.id, set }], `Edited ${f.name}`)
  }

  return (
    <>
    <div
      className="place-list"
      ref={listRef}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !selectedId) return
        // Keep focus on the row when its details close.
        listRef.current?.querySelector<HTMLElement>(`[data-place-id="${CSS.escape(selectedId)}"] .row-main`)?.focus()
        sel.select(null, 'list')
      }}
    >
      {sections.map((s) => {
        const shown = isOpen(s)
        return (
          <section key={s.key} className="place-section">
            <button
              type="button"
              className="section-head"
              aria-expanded={shown}
              onClick={() => toggle(s)}
            >
              <Caret open={shown} />
              {s.group && <span className={`swatch ${s.group}`} aria-hidden />}
              <span className="title">{s.title}</span>
              {s.sub && <span className="sub">{s.sub}</span>}
              <span className="count">{s.rows.length}</span>
            </button>
            {shown && (
              <ul className="place-rows">
                {s.rows.map((r) =>
                  r.type === 'place' ? (
                    <PlaceRow
                      key={r.place.id}
                      place={r.place}
                      schedule={sched.get(r.place.id)}
                      showArea={groupBy !== 'area'}
                      selected={r.place.id === selectedId}
                      hovered={r.place.id === sel.hoveredPlaceId}
                      onSelect={() => sel.select(r.place.id === selectedId ? null : r.place.id, 'list')}
                      onHover={sel.hover}
                    >
                      {r.place.id === selectedId && (
                        <PlaceDetails
                          place={r.place}
                          trip={trip}
                          onRate={(rating) => rate(r.place, rating)}
                          onChecked={() => markChecked(r.place)}
                          onEdit={() => setEditing(r.place)}
                          onRemove={() => remove(r.place)}
                        />
                      )}
                    </PlaceRow>
                  ) : (
                    <ItemRow key={r.item.id} item={r.item} />
                  ),
                )}
              </ul>
            )}
          </section>
        )
      })}
    </div>

      {editing && (
        <PlaceForm
          place={editing}
          onCancel={() => setEditing(null)}
          onSave={(f) => {
            const ok = saveEdit(editing, f)
            if (ok) setEditing(null)
            return ok
          }}
        />
      )}
    </>
  )
}

/** Add a place by hand: the form, then `addPlace`. */
export function AddPlaceDialog({ apply, onClose }: { apply: Props['apply']; onClose: (id?: string) => void }) {
  return (
    <PlaceForm
      onCancel={() => onClose()}
      onSave={(f) => {
        const place = newPlace(`p-${shortId()}`, f)
        const ok = apply([{ op: 'addPlace', place }], `Added ${place.name}`)
        if (ok) onClose(place.id)
        return ok
      }}
    />
  )
}

// ---------- rows ----------

export function KindBadge({ kind }: { kind: Kind }) {
  return (
    <span className={`kind-badge g-${kindGroup(kind)}`} title={kindLabel(kind)}>
      <KindIcon kind={kind} />
    </span>
  )
}

export function RatingChip({ rating }: { rating: Rating }) {
  return <span className={`rating-chip r-${rating}`}>{ratingLabel(rating)}</span>
}

function WhenChip({ schedule }: { schedule: Schedule | undefined }) {
  const s = scheduleLabel(schedule)
  return (
    <span className={`when-chip w-${s.kind}`} title={s.kind === 'waiting' ? 'Booked, no time yet' : undefined}>
      {s.kind === 'waiting' && <BookmarkIcon />}
      {s.text}
    </span>
  )
}

function dragStart(e: DragEvent, type: string, id: string, name: string) {
  e.dataTransfer.setData(type, id)
  e.dataTransfer.setData('text/plain', name)
  e.dataTransfer.effectAllowed = 'copyMove'
}

interface RowProps {
  place: Place
  schedule: Schedule | undefined
  showArea: boolean
  selected: boolean
  hovered: boolean
  onSelect: () => void
  onHover: (id: string | null) => void
  children: ReactNode
}

function PlaceRow({ place: p, schedule, showArea, selected, hovered, onSelect, onHover, children }: RowProps) {
  const meta = [
    showArea ? p.area : null,
    stayShort(p.usualStayMinutes),
    detailsMissing(p) ? 'Details missing' : hoursShort(p.openingHours),
  ].filter(Boolean)
  const cls = ['place-row', selected && 'selected', hovered && 'hovered', p.rating === 'forget' && 'forget'].filter(Boolean).join(' ')
  return (
    <li
      className={cls}
      data-place-id={p.id}
      draggable
      onDragStart={(e) => dragStart(e, PLACE_DRAG_TYPE, p.id, p.name)}
      onMouseEnter={() => onHover(p.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button type="button" className="row-main" aria-expanded={selected} onClick={onSelect}>
        <KindBadge kind={p.kind} />
        <span className="row-text">
          <span className="row-title">
            <span className="name" title={p.name}>
              {p.name}
            </span>
            <RatingChip rating={p.rating} />
          </span>
          {meta.length > 0 && <span className="row-meta">{meta.join(' · ')}</span>}
        </span>
        <WhenChip schedule={schedule} />
      </button>
      {children}
    </li>
  )
}

/** A booking with a date but no time and no place (item 64). Drag it onto the timetable in phase 4. */
function ItemRow({ item }: { item: Item }) {
  return (
    <li className="place-row item-row" data-item-id={item.id} draggable onDragStart={(e) => dragStart(e, ITEM_DRAG_TYPE, item.id, item.title)}>
      <div className="row-main">
        <KindBadge kind={item.kind} />
        <span className="row-text">
          <span className="row-title">
            <span className="name" title={item.title}>
              {item.title}
            </span>
          </span>
          <span className="row-meta">Booking · {kindLabel(item.kind)}</span>
        </span>
        <WhenChip schedule={{ dates: [], waiting: item.booking?.date ? [item.booking.date] : [] }} />
      </div>
    </li>
  )
}

// ---------- details (item 18) ----------

interface DetailsProps {
  place: Place
  trip: Trip
  onRate: (rating: Rating) => void
  onChecked: () => void
  onEdit: () => void
  onRemove: () => void
}

function mapsLink(p: Place): string | null {
  if (p.googleMapsUrl) return p.googleMapsUrl
  if (p.lat != null && p.lng != null) return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
  return null
}

function PlaceDetails({ place: p, trip, onRate, onChecked, onEdit, onRemove }: DetailsProps) {
  const unverified = new Set(p.unverified ?? [])
  /** Marks a value that came from an import and is not checked yet (item 69). */
  const v = (field: string | string[], children: ReactNode) => {
    const fields = Array.isArray(field) ? field : [field]
    return fields.some((f) => unverified.has(f)) ? (
      <span className="unverified" title="Unverified: from an import, not checked yet">
        {children}
      </span>
    ) : (
      children
    )
  }
  const link = mapsLink(p)
  const waiting = trip.items.filter((i) => i.placeId === p.id && i.booking?.date && !i.slot && !i.stay)
  const where = [p.area, p.city].filter(Boolean).join(', ')
  const hours = p.openingHours

  return (
    <div className="row-details">
      <div className="rating-control" role="radiogroup" aria-label={`Rating for ${p.name}`}>
        {RATINGS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={p.rating === r.id}
            className={`rating-option r-${r.id}`}
            onClick={() => onRate(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {detailsMissing(p) && (
        <p className="detail-note">Details missing: only a Google Maps link came in. Edit the place to fill in its type, area and hours.</p>
      )}

      {unverified.size > 0 && (
        <p className="detail-note">
          <span className="unverified">Unverified</span>: {fieldList([...unverified])}. These came from an import.{' '}
          <button type="button" className="link-btn" onClick={onChecked}>
            Mark as checked
          </button>
        </p>
      )}

      <dl className="detail-list">
        {p.nameLocal && <Detail term="Local name">{v('nameLocal', p.nameLocal)}</Detail>}
        <Detail term="Type">{v('kind', kindLabel(p.kind))}</Detail>
        {where && <Detail term="Area">{v(['area', 'city'], where)}</Detail>}
        {p.address && <Detail term="Address">{v('address', p.address)}</Detail>}
        {p.usualStayMinutes ? <Detail term="Stay">{v('usualStayMinutes', stayShort(p.usualStayMinutes))}</Detail> : null}
        {hours && (
          <Detail term="Hours">
            {v(
              'openingHours',
              <span className="week">
                {weekRuns(hours).map((w) => (
                  <span key={w.days} className="week-day">
                    <span className="day">{w.days}</span>
                    <span className={!w.known ? 'muted' : w.closed ? 'closed' : ''}>{w.text}</span>
                  </span>
                ))}
              </span>,
            )}
          </Detail>
        )}
        {p.hoursNote && <Detail term={hours ? '' : 'Hours'}>{v('hoursNote', p.hoursNote)}</Detail>}
        {p.estimatedCost && (
          <Detail term="Cost">
            {v('estimatedCost', `${money(p.estimatedCost.amount, p.estimatedCost.currency)}${p.estimatedCost.perPerson ? ' per person' : ''} (estimate)`)}
          </Detail>
        )}
        {waiting.map((i) => (
          <Detail key={i.id} term="Booked">
            <span className="booked">
              <BookmarkIcon /> {monthDay(i.booking!.date!)}, no time yet
            </span>
          </Detail>
        ))}
        {p.tags && p.tags.length > 0 && <Detail term="Tags">{v('tags', p.tags.join(', '))}</Detail>}
        {p.notes && <Detail term="Notes">{v('notes', p.notes)}</Detail>}
        {p.aiNotes && <Detail term="AI notes">{p.aiNotes}</Detail>}
      </dl>

      <div className="detail-actions">
        {link ? (
          <a className="maps-link" href={link} target="_blank" rel="noopener noreferrer">
            {v('googleMapsUrl', 'Open in Google Maps')} <ExternalIcon />
          </a>
        ) : (
          <span className="muted">No Google Maps link</span>
        )}
        <span className="spacer" />
        <button type="button" className="btn small" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="btn small danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  )
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="detail">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

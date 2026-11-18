// Pieces shared by multi-day and list view: the travel label in a gap
// (items 19, 34–37), its mode picker, the lock form (items 31–32), the day
// header (day label rule, items 24, 34) and the block's look (items 77–81).

import { useState, type CSSProperties, type ReactNode } from 'react'
import { MODES, modeLabel } from '../format'
import { blockKind, blockName, minutesText } from '../timetable'
import type { Block, Item, LegView, Mode, PlanDay } from '../types'
import { ExternalIcon, KindIcon, LockIcon, ModeIcon, WarnIcon } from './icons'
import { Popover } from './Popover'

export function WarnMark({ messages }: { messages: string[] }) {
  const text = messages.join('\n')
  return (
    <span className="warn-mark" title={text} aria-label={`Warning: ${text}`} role="img">
      <WarnIcon />
    </span>
  )
}

export function BlockIcon({ block, items }: { block: Block; items: Map<string, Item> }) {
  return (
    <span className="block-icon">
      <KindIcon kind={blockKind(block, items)} />
    </span>
  )
}

/** The lock on a block: click a fixed block's lock to unlock it; an open lock fixes it (items 31, 32). */
export function LockButton({ block, onToggle }: { block: Block; onToggle: (b: Block, anchor: DOMRect) => void }) {
  const what = blockName(block)
  return (
    <button
      type="button"
      className={`lock-btn ${block.fixed ? 'locked' : ''}`}
      title={block.fixed ? `Fixed${block.reason ? `: ${block.reason}` : ''}. Click to unlock` : 'Fix this block'}
      aria-label={block.fixed ? `Unlock ${what}` : `Fix ${what}`}
      aria-pressed={block.fixed}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle(block, e.currentTarget.getBoundingClientRect())
      }}
    >
      <LockIcon open={!block.fixed} />
    </button>
  )
}

/** Lock with an optional reason (item 31). */
export function LockForm({ block, anchor, onLock, onClose }: { block: Block; anchor: DOMRect; onLock: (reason: string | null) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <Popover anchor={anchor} label={`Fix ${blockName(block)}`} onClose={onClose}>
      <form
        className="lock-form"
        onSubmit={(e) => {
          e.preventDefault()
          onLock(reason.trim() || null)
        }}
      >
        <div className="pop-title">Fix {blockName(block)}</div>
        <p className="pop-note">A fixed block can't be dragged, and nothing can be dropped over it.</p>
        <label className="field">
          <span>Reason (optional)</span>
          {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the form opens from a click on the lock */}
          <input autoFocus value={reason} placeholder="Ticket booked" onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="pop-actions">
          <button type="button" className="btn small ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn small primary">
            Fix
          </button>
        </div>
      </form>
    </Popover>
  )
}

/** "🚆 25 min · walk 5 min?" in the gap between two blocks (items 19, 35, 37). */
export function TravelLabel({
  leg,
  onOpen,
  onWalk,
  style,
}: {
  leg: LegView
  onOpen: (leg: LegView, anchor: DOMRect) => void
  onWalk: (leg: LegView) => void
  style?: CSSProperties
}) {
  const t = leg.travel
  const minutes = t.minutes == null ? '? min' : minutesText(t.minutes)
  const est = t.source === 'estimate' ? ' (estimate)' : t.source === 'routed' ? ' (routed)' : ' (confirmed)'
  const title = leg.tight && t.minutes != null ? `${modeLabel(t.mode)}: needs ${t.minutes} min, has ${Math.max(0, leg.gapMinutes)}` : `${modeLabel(t.mode)} ${minutes}${est}. Click to change`
  return (
    <span className={`travel-label ${leg.tight ? 'tight' : ''}`} style={style} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="travel-main" title={title} aria-label={title} onClick={(e) => onOpen(leg, e.currentTarget.getBoundingClientRect())}>
        <ModeIcon mode={t.mode} size={12} />
        <span>{minutes}</span>
      </button>
      {t.walkHint != null && (
        <button type="button" className="walk-hint" title="Switch this leg to Walk" onClick={() => onWalk(leg)}>
          · walk {minutesText(t.walkHint)}?
        </button>
      )}
    </span>
  )
}

const SOURCE_TEXT = { estimate: 'est.', routed: 'routed', confirmed: 'confirmed' } as const

/** Every mode with its minutes; picking one sets this leg's mode (item 36). */
export function ModePicker({
  leg,
  toTitle,
  explicit,
  dayMode,
  anchor,
  onPick,
  onClose,
}: {
  leg: LegView
  toTitle: string
  /** The leg has its own mode (not the day's). */
  explicit: boolean
  dayMode: Mode
  anchor: DOMRect
  onPick: (mode: Mode | null) => void
  onClose: () => void
}) {
  const t = leg.travel
  return (
    <Popover anchor={anchor} label="Travel mode" onClose={onClose}>
      <div className="mode-picker">
        <div className="pop-title">How to get to {toTitle}</div>
        <div className="mode-options" role="radiogroup" aria-label="Travel mode">
          {MODES.map((m) => {
            const o = t.options.find((x) => x.mode === m.id)
            const current = t.mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={current}
                className={`mode-option ${current ? 'current' : ''}`}
                onClick={() => onPick(m.id)}
              >
                <ModeIcon mode={m.id} />
                <span className="mode-name">{m.label}</span>
                <span className="mode-min">{o?.minutes != null ? minutesText(o.minutes) : '–'}</span>
                <span className="mode-src">{o ? SOURCE_TEXT[o.source] : ''}</span>
              </button>
            )
          })}
        </div>
        {t.source === 'confirmed' && <p className="pop-note">This leg has a confirmed time of {minutesText(t.minutes ?? 0)}.</p>}
        <div className="pop-actions">
          {explicit && (
            <button type="button" className="btn small ghost" onClick={() => onPick(null)}>
              Use the day's mode ({modeLabel(dayMode)})
            </button>
          )}
          <span className="spacer" />
          {t.mapsUrl && (
            <a className="maps-link" href={t.mapsUrl} target="_blank" rel="noopener noreferrer">
              Check in Google Maps <ExternalIcon />
            </a>
          )}
        </div>
      </div>
    </Popover>
  )
}

/** Day label (`12/02` bold, `WED` small), city, the day's mode when it differs, and the weather slot (items 24, 34). */
export function DayLabel({ day, children }: { day: PlanDay; children?: ReactNode }) {
  return (
    <>
      <span className="day-label">
        <span className="date">{day.label}</span>
        <span className="weekday">{day.weekday.toUpperCase()}</span>
        {day.city && <span className="city">{day.city}</span>}
        {day.modeIsOverride && (
          <span className="day-mode" title={`This day's transport: ${modeLabel(day.mode)}`}>
            <ModeIcon mode={day.mode} size={11} />
            {modeLabel(day.mode)}
          </span>
        )}
      </span>
      {/* Weather comes with the online extras (phase 7); until then the slot stays empty. */}
      <span className="weather-slot" title="Weather is not connected yet" aria-hidden />
      {children}
    </>
  )
}

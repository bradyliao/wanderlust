import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Fold } from './icons'

type Dir = 'left' | 'right' | 'up' | 'down'

interface PaneProps {
  title: string
  /** Shown after the title in the pane header. */
  info?: ReactNode
  /** Which way the pane folds when collapsed. */
  fold: Dir
  onCollapse: () => void
  fill?: boolean
  style?: CSSProperties
  children: ReactNode
}

const opposite: Record<Dir, Dir> = { left: 'right', right: 'left', up: 'down', down: 'up' }

/** A pane with a header and a collapse button (item 2). */
export function Pane({ title, info, fold, onCollapse, fill, style, children }: PaneProps) {
  return (
    <section className={`pane ${fill ? 'fill' : ''}`} style={style} aria-label={title}>
      <header className="pane-head">
        <h2>{title}</h2>
        {info && <span className="muted">{info}</span>}
        <span className="spacer" />
        <button type="button" className="icon-btn" title={`Hide ${title}`} aria-label={`Hide ${title}`} onClick={onCollapse}>
          <Fold dir={fold} />
        </button>
      </header>
      <div className="pane-body">{children}</div>
    </section>
  )
}

interface BarProps {
  title: string
  /** `vertical`: a thin column (text runs downwards); `horizontal`: a thin row. */
  orientation: 'vertical' | 'horizontal'
  /** The way the pane folded; the bar's arrow points back out. */
  fold: Dir
  onExpand: () => void
  fill?: boolean
}

/** A collapsed pane: a thin bar that opens it again. */
export function CollapsedBar({ title, orientation, fold, onExpand, fill }: BarProps) {
  return (
    <button
      type="button"
      className={`pane-collapsed ${orientation}`}
      style={fill ? { flex: 1 } : undefined}
      title={`Show ${title}`}
      aria-label={`Show ${title}`}
      onClick={onExpand}
    >
      <Fold dir={opposite[fold]} />
      <span className="name">{title}</span>
    </button>
  )
}

interface DividerProps {
  /** `vertical`: a line between columns, dragged sideways. */
  orientation: 'vertical' | 'horizontal'
  label: string
  /** Called once when a drag (or a key press) starts. */
  onStart: () => void
  /** Distance in px from where the drag started. */
  onMove: (delta: number) => void
}

const KEY_STEP = 16

/** A draggable pane divider (item 2). Arrow keys move it too. */
export function Divider({ orientation, label, onStart, onMove }: DividerProps) {
  const origin = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const pos = (e: PointerEvent) => (orientation === 'vertical' ? e.clientX : e.clientY)

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = pos(e)
    setDragging(true)
    document.body.classList.add('resizing')
    onStart()
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (origin.current != null) onMove(pos(e) - origin.current)
  }
  const up = () => {
    origin.current = null
    setDragging(false)
    document.body.classList.remove('resizing')
  }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const back = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp'
    const forward = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown'
    if (e.key !== back && e.key !== forward) return
    e.preventDefault()
    onStart()
    onMove(e.key === forward ? KEY_STEP : -KEY_STEP)
  }

  return (
    <div
      className={`divider ${orientation} ${dragging ? 'dragging' : ''}`}
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    />
  )
}

/** A plain 1px line where a divider can't be dragged (next to a collapsed pane). */
export function SepLine({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  return <div className={`sep-line ${orientation}`} />
}

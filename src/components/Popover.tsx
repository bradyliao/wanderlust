import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  /** The element it opens from; the popover sits below it (or above when there is no room). */
  anchor: DOMRect
  label: string
  onClose: () => void
  children: ReactNode
}

const GAP = 4
const EDGE = 8

/** A small floating panel. Closes on an outside click and on Escape. */
export function Popover({ anchor, label, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const left = Math.min(Math.max(EDGE, anchor.left + anchor.width / 2 - w / 2), window.innerWidth - w - EDGE)
    const below = anchor.bottom + GAP
    const top = below + h > window.innerHeight - EDGE ? Math.max(EDGE, anchor.top - GAP - h) : below
    setPos({ left, top })
  }, [anchor])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="popover"
      role="dialog"
      aria-label={label}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      {children}
    </div>
  )
}

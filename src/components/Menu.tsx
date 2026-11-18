import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from './icons'

interface MenuProps {
  /** Button content. */
  label: ReactNode
  /** Accessible name when the label alone is not clear. */
  title?: string
  align?: 'left' | 'right'
  buttonClass?: string
  /** Menu content; `close` shuts the menu. */
  children: (close: () => void) => ReactNode
  popClass?: string
}

/** A button with a dropdown. Closes on outside click and Escape. */
export function Menu({ label, title, align = 'left', buttonClass = 'btn', children, popClass = '' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className={buttonClass}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <ChevronDown />
      </button>
      {open && (
        <div className={`menu-pop ${align === 'right' ? 'right' : ''} ${popClass}`} role="menu">
          {children(close)}
        </div>
      )}
    </div>
  )
}

interface ItemProps {
  onSelect: () => void
  checked?: boolean
  disabled?: boolean
  children: ReactNode
}

export function MenuItem({ onSelect, checked, disabled, children }: ItemProps) {
  return (
    <button
      type="button"
      className="menu-item"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
    >
      {checked !== undefined && <span className="check">{checked ? '✓' : ''}</span>}
      {children}
    </button>
  )
}

// Small line icons, drawn in currentColor.

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  'aria-hidden': true,
} as const

/** Place List left, Timetable over Map right. */
export function StackedIcon() {
  return (
    <svg {...base}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M6 2.5v11M6 8h8.5" />
    </svg>
  )
}

/** Place List, Timetable, Map side by side. */
export function ColumnsIcon() {
  return (
    <svg {...base}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M5.5 2.5v11M10.5 2.5v11" />
    </svg>
  )
}

export function ChevronDown() {
  return (
    <svg {...base} width={10} height={10}>
      <path d="M4 6l4 4 4-4" strokeWidth={1.8} />
    </svg>
  )
}

/** Points the way a pane folds: left, right, up or down. */
export function Fold({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const d = { left: 'M10 4L6 8l4 4', right: 'M6 4l4 4-4 4', up: 'M4 10l4-4 4 4', down: 'M4 6l4 4 4-4' }[dir]
  return (
    <svg {...base}>
      <path d={d} />
    </svg>
  )
}

export function UndoIcon() {
  return (
    <svg {...base}>
      <path d="M5 4L2 7l3 3" />
      <path d="M2.5 7H10a3.5 3.5 0 010 7H7" />
    </svg>
  )
}

export function HistoryIcon() {
  return (
    <svg {...base}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  )
}

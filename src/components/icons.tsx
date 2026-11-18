// Small line icons, drawn in currentColor.

import type { Kind } from '../types'

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

/** Sub-category icons (item 81): one line drawing each, 16×16. */
const KIND_PATHS: Record<Kind, string> = {
  // bowl with steam
  food: 'M2.5 8h11a5.5 5.5 0 01-11 0zM6 2.5c-.6.8.6 1.7 0 2.5M9.5 2.5c-.6.8.6 1.7 0 2.5',
  // cup with handle
  cafe: 'M3 5.5h8v4a3.5 3.5 0 01-7 0zM11 6.5h1.2a1.6 1.6 0 010 3.2H11M3 14h8',
  // ice cream cone
  dessert: 'M4.5 7a3.5 3.5 0 017 0zM4.5 7L8 14.5 11.5 7',
  // torii gate
  sight: 'M1.5 3c4.3 1 8.7 1 13 0M3 6.5h10M5 4v10M11 4v10M8 4v2.5',
  // columns
  museum: 'M2 5.5L8 2.5l6 3zM3.5 7v5.5M6.5 7v5.5M9.5 7v5.5M12.5 7v5.5M2 13.5h12',
  // tree
  nature: 'M8 2l4.5 7h-9zM8 6l5 6H3zM8 12v2.5',
  // moon
  nightlife: 'M12.5 10A5.5 5.5 0 016 3.5a5.5 5.5 0 106.5 6.5z',
  // plane
  flight: 'M2 9.5l12-5-3 9-3-3.5zM8 10l-1 3.5',
  // train front
  train: 'M4 2.5h8v8.5H4zM4 7.5h8M6 13.5L5 15M10 13.5l1 1.5M6 9.5h.01M10 9.5h.01',
  // bus
  bus: 'M3 2.5h10v10H3zM3 8h10M5 12.5v2M11 12.5v2M5.5 10.3h.01M10.5 10.3h.01',
  // car
  car: 'M2 10V8l1.5-4h9L14 8v2zM2 10v2.5h2V10M12 10v2.5h2V10M4.5 8h.01M11.5 8h.01',
  // two arrows
  localTravel: 'M2.5 5.5h10l-2-2M13.5 10.5h-10l2 2',
  // house
  lodging: 'M2 7.5L8 2.5l6 5M3.5 6.5v7h9v-7M6.5 13.5V10h3v3.5',
  // shopping bag
  shopping: 'M3 5.5h10l-.7 8.5H3.7zM5.5 5.5V5a2.5 2.5 0 015 0v.5',
  // map pin
  other: 'M8 14.5S3 9.6 3 6.5a5 5 0 0110 0c0 3.1-5 8-5 8zM8 8.2a1.7 1.7 0 100-3.4 1.7 1.7 0 000 3.4z',
}

export function KindIcon({ kind }: { kind: Kind }) {
  return (
    <svg {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d={KIND_PATHS[kind] ?? KIND_PATHS.other} />
    </svg>
  )
}

/** Booking mark (item 64). */
export function BookmarkIcon() {
  return (
    <svg {...base} width={12} height={12} fill="currentColor" stroke="none">
      <path d="M4 1.5h8v13l-4-3-4 3z" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg {...base}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

export function ExternalIcon() {
  return (
    <svg {...base} width={11} height={11}>
      <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" />
    </svg>
  )
}

/** Section toggle: points right when closed, down when open. */
export function Caret({ open }: { open: boolean }) {
  return (
    <svg {...base} width={10} height={10} fill="currentColor" stroke="none">
      <path d={open ? 'M3 5h10L8 11z' : 'M5 3v10l6-5z'} />
    </svg>
  )
}

/** Import a file: an arrow into a tray. */
export function ImportIcon() {
  return (
    <svg {...base}>
      <path d="M8 2v8M5 7l3 3 3-3M2.5 10.5v3h11v-3" />
    </svg>
  )
}

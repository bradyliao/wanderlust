// Small line icons, drawn in currentColor.

import type { Kind, Mode } from '../types'

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

/** Travel mode icons (items 33, 37), in the gap labels and the mode picker. */
const MODE_PATHS: Record<Mode, string> = {
  drive: KIND_PATHS.car,
  transit: KIND_PATHS.train,
  // walking figure
  walk: 'M8.6 2.6a1.1 1.1 0 11-.01 0zM8 5.5L6.8 9.5l2 2V15M7.3 5.8L5 7.5V9.5M8.3 5.8l1.5 2 2 .7M6.8 9.5L5.5 15',
  // scooter
  twoWheeler: 'M2 12a1.7 1.7 0 103.4 0 1.7 1.7 0 10-3.4 0zM10.6 12a1.7 1.7 0 103.4 0 1.7 1.7 0 10-3.4 0zM5.4 12h5.2L9.5 4.5H11.5M3.7 10.3L5 8h4',
  // bicycle
  cycle: 'M1.5 11a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0zM9.5 11a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0zM4 11l2.5-5h4L12 11M6.5 6L8 11h.5M5.5 4h2M10.5 6l-.6-2h1.6',
  // taxi: car with a roof sign
  ride: 'M2 11V9l1.5-3.5h9L14 9v2zM2 11v2h2v-2M12 11v2h2v-2M6.5 3h3v2.5M4.5 9h.01M11.5 9h.01',
}

export function ModeIcon({ mode, size = 14 }: { mode: Mode; size?: number }) {
  return (
    <svg {...base} width={size} height={size} strokeLinecap="round" strokeLinejoin="round">
      <path d={MODE_PATHS[mode] ?? MODE_PATHS.transit} />
    </svg>
  )
}

/** Fixed block (item 31). Open when unlocked. */
export function LockIcon({ open = false }: { open?: boolean }) {
  return (
    <svg {...base} width={12} height={12} strokeLinecap="round">
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" />
      <path d={open ? 'M5.5 7V4.8a2.5 2.5 0 014.9-.7' : 'M5.5 7V4.8a2.5 2.5 0 015 0V7'} />
    </svg>
  )
}

/** Warning mark on a block (item 28). */
export function WarnIcon() {
  return (
    <svg {...base} width={12} height={12} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l6.5 11.5h-13zM8 6.5v3.2M8 11.8h.01" />
    </svg>
  )
}

export function ChevronSide({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg {...base} width={12} height={12} strokeWidth={1.6}>
      <path d={dir === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
    </svg>
  )
}

// What is being dragged out of the Place List right now. The browser hides a
// drag's data until the drop, but the timetable needs the place while the
// pointer moves (items 27, 29), so the list notes it here as well.

export type ListDrag = { type: 'place'; id: string } | { type: 'item'; id: string }

let current: ListDrag | null = null

export function startListDrag(drag: ListDrag): void {
  current = drag
}

export function endListDrag(): void {
  current = null
}

export function listDrag(): ListDrag | null {
  return current
}

// The selected and hovered place, shared by the Place List, the timetable and
// the map (items 5–8). Click selects (panes scroll or pan to it); hover is a
// light highlight only. App holds the state and provides it.

import { createContext, useContext } from 'react'

/** Which pane the selection came from, so that pane need not scroll to itself. */
export type SelectFrom = 'list' | 'timetable' | 'map'

export interface Selection {
  selectedPlaceId: string | null
  /** Where the latest selection came from. */
  selectedFrom: SelectFrom | null
  hoveredPlaceId: string | null
  select: (id: string | null, from: SelectFrom) => void
  hover: (id: string | null) => void
}

export const NO_SELECTION: Selection = {
  selectedPlaceId: null,
  selectedFrom: null,
  hoveredPlaceId: null,
  select: () => {},
  hover: () => {},
}

export const SelectionContext = createContext<Selection>(NO_SELECTION)

export const useSelection = () => useContext(SelectionContext)

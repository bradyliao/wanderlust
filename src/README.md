# Web app (`src/`)

React + TypeScript + Vite. All trip logic lives in the Rust core (`core/`, loaded as Wasm); this app shows it and sends commands. Every change to a trip is a command through `core.applyCommands` (or an AI change file), so it is logged and can be undone (items 72–76).

| File | What it does |
| --- | --- |
| `main.tsx` | Mounts the app, loads the styles |
| `App.tsx` | Loads the core and the last trip, holds the open trip, applies commands, undo (⌘Z / Ctrl+Z), trip files, AI change files, place import (preview, then one step), the selected and hovered place, notices |
| `core.ts` | Typed wrapper around `core/pkg`: JSON in and out, `CoreError` with the core's plain-words message; `dragPreview` / `movePreview`; the trip's JSON text is cached per trip object, since a drag calls the core many times |
| `types.ts` | The JSON shapes the app reads (trip, settings, place, item, log group, plan day with blocks, legs, night, warnings, sun and daylight stops, drag preview, budget summary, import preview) |
| `storage.ts` | Trips in IndexedDB (one store, keyed by trip id) |
| `prefs.ts` | Layout, pane sizes, the Place List grouping, the timetable view (multi-day or list), day column width and hour height (item 44) in localStorage, safe when storage is blocked |
| `places.ts` | Place List logic as pure functions: sub-categories and groups, ratings, stay and hours in short form, scheduled dates and bookings waiting for a time, the four groupings, the add and edit fields |
| `selection.ts` | Shared selected and hovered place (items 5–8) and the day in focus (item 10, `focusDate`: the last day clicked in multi-day view, the day shown in list view; the map reads it in phase 5): `SelectionContext`, `useSelection()` |
| `dragging.ts` | What is being dragged out of the Place List, so the timetable knows the place while the pointer moves (the browser hides drag data until the drop) |
| `timetable.ts` | Timetable maths as pure functions: minutes ↔ pixels, 15-minute snapping, drop / move / resize slots, side-by-side lanes for overlaps, the daylight gradient from the core's stops (CSS variables per stage), sunrise and sunset marks, closed-hours bands with a 30-minute fade and their tags, travel bands while dragging, block names and colours |
| `files.ts` | Download a file, read a picked file |
| `format.ts` | Dates as numbers (`12/02`), money, mode and group labels, export file names |
| `theme.css` | Colour tokens (items 77–81), including the daylight stages, hatching and travel band colours; light only, a dark set redefines the same names |
| `app.css` | Shell styles, using only theme tokens |
| `components/TopBar.tsx` | Brand, Plan · Bookings · Budget tabs, trip menu, People, Transport, budget total, undo, history, layout switch |
| `components/HistoryMenu.tsx` | Change log newest first, Undo, "Go back to here" |
| `components/TripDialog.tsx` | Pick a saved trip or start a new one |
| `components/Menu.tsx` | Dropdown button and menu items |
| `components/Panes.tsx` | Pane with collapse button and optional header tools, collapsed bar, draggable divider |
| `components/Timetable.tsx` | The Timetable pane (phase 4). Multi-day view: day headers, time gutter (24 hours, opens at 6:00), daylight background with grain, sunrise and sunset marks, blocks by time in their group colour, warning marks, locks, travel labels in the gaps, night band; drop from the Place List (`schedulePlace`, or `moveItem` for a waiting booking on that date), move and resize with pointer events (`moveItem`), drag onto the Place List to unschedule, Escape cancels; live preview from the core only when the snapped slot changes; resizable column width and hour height. List view: one day with ‹ ›, cards with times, travel rows, a daylight strip beside the times |
| `components/TimetableParts.tsx` | Day label, travel label with the walk hint, mode picker (six modes with minutes and source), lock button and lock form, warning mark |
| `components/Popover.tsx` | Small floating panel anchored to a button; closes on an outside click and Escape |
| `components/PlaceList.tsx` | The Place List (items 15–18, 64): group-by menu, add and import buttons, collapsible sections, rows (draggable with `application/x-wanderlust-place` = place id; bookings without a place use `application/x-wanderlust-item`), the open row's details with rating, hours per weekday, unverified marks, Edit and Remove |
| `components/PlaceForm.tsx` | Add or edit a place by hand (reads the position from a Google Maps link) |
| `components/ImportDialog.tsx` | Import preview: new places, details missing, possible duplicates, problems (items 66–71) |
| `components/icons.tsx` | Small line icons, including one per sub-category (item 81) |
| `pages/PlanPage.tsx` | Stacked and Three-column layouts (items 1–4) with the Place List and the Timetable (view toggle in its header); the map is a placeholder until phase 5 |
| `pages/OtherPages.tsx` | Bookings placeholder; Budget group totals from `budgetSummary` |
| `*.test.ts` | Vitest: the core wrapper (loads the real Wasm with `initSync`, imports `docs/samples/sample-places.json`), format, prefs, storage, the Place List logic (`places.test.ts`) and the timetable maths (`timetable.test.ts`) |

## Trying the Place List

1. Trip menu → **Import AI change file…** → `docs/samples/sample-trip.changes.json` (an invented trip).
2. Trip menu (or the import button in the Place List header) → **Import places file…** → `docs/samples/sample-places.json`. The preview shows four new places, one with details missing, two possible duplicates (one already in the trip, one twice in the file) and four problems (an unknown field, a bad time, an unknown rating, an unknown type).

## Trying the Timetable

With the sample trip loaded (above):

- **Select** a place in the list: its blocks are outlined and its closed hours are hatched on every day. Click a block to select its place; hover lights both.
- **Drag a place** from the list onto a day: the block snaps to 15 minutes and lasts the usual stay; blue bands show travel that fits, red bands "needs X min, has Y"; closed hours are hatched. A drop over a fixed block is refused.
- **Move** a block by dragging it (same or another day); drag its top or bottom edge to resize; drag it onto the Place List to unschedule. Escape cancels.
- **Lock**: Shibuya Sky is fixed (lock and reason); click the lock to unlock. Hover any block and click its open lock to fix it, with an optional reason.
- **Travel**: click a gap label for the mode picker; "· walk N min?" switches that leg to Walk.
- **Sizes**: drag the right edge of a day header for the column width, the bottom edge of an hour in the time column for the hour height.
- **List** in the Timetable header shows one day; ‹ › change the day in focus.

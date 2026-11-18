# Web app (`src/`)

React + TypeScript + Vite. All trip logic lives in the Rust core (`core/`, loaded as Wasm); this app shows it and sends commands. Every change to a trip is a command through `core.applyCommands` (or an AI change file), so it is logged and can be undone (items 72–76).

| File | What it does |
| --- | --- |
| `main.tsx` | Mounts the app, loads the styles |
| `App.tsx` | Loads the core and the last trip, holds the open trip, applies commands, undo (⌘Z / Ctrl+Z), trip files, AI change files, place import (preview, then one step), the selected and hovered place, notices |
| `core.ts` | Typed wrapper around `core/pkg`: JSON in and out, `CoreError` with the core's plain-words message |
| `types.ts` | The JSON shapes the app reads (trip, settings, place, item, log group, plan day, budget summary, import preview) |
| `storage.ts` | Trips in IndexedDB (one store, keyed by trip id) |
| `prefs.ts` | Layout, pane sizes and the Place List grouping in localStorage, safe when storage is blocked |
| `places.ts` | Place List logic as pure functions: sub-categories and groups, ratings, stay and hours in short form, scheduled dates and bookings waiting for a time, the four groupings, the add and edit fields |
| `selection.ts` | Shared selected and hovered place (items 5–8): `SelectionContext`, `useSelection()`; the timetable and map read it in phases 4–5 |
| `files.ts` | Download a file, read a picked file |
| `format.ts` | Dates as numbers (`12/02`), money, mode and group labels, export file names |
| `theme.css` | Colour tokens (items 77–81); light only, a dark set redefines the same names |
| `app.css` | Shell styles, using only theme tokens |
| `components/TopBar.tsx` | Brand, Plan · Bookings · Budget tabs, trip menu, People, Transport, budget total, undo, history, layout switch |
| `components/HistoryMenu.tsx` | Change log newest first, Undo, "Go back to here" |
| `components/TripDialog.tsx` | Pick a saved trip or start a new one |
| `components/Menu.tsx` | Dropdown button and menu items |
| `components/Panes.tsx` | Pane with collapse button and optional header tools, collapsed bar, draggable divider |
| `components/PlaceList.tsx` | The Place List (items 15–18, 64): group-by menu, add and import buttons, collapsible sections, rows (draggable with `application/x-wanderlust-place` = place id; bookings without a place use `application/x-wanderlust-item`), the open row's details with rating, hours per weekday, unverified marks, Edit and Remove |
| `components/PlaceForm.tsx` | Add or edit a place by hand (reads the position from a Google Maps link) |
| `components/ImportDialog.tsx` | Import preview: new places, details missing, possible duplicates, problems (items 66–71) |
| `components/icons.tsx` | Small line icons, including one per sub-category (item 81) |
| `pages/PlanPage.tsx` | Stacked and Three-column layouts (items 1–4) with the Place List; timetable and map are placeholders until phases 4–5 |
| `pages/OtherPages.tsx` | Bookings placeholder; Budget group totals from `budgetSummary` |
| `*.test.ts` | Vitest: the core wrapper (loads the real Wasm with `initSync`, imports `docs/samples/sample-places.json`), format, prefs, storage, and the Place List logic (`places.test.ts`) |

## Trying the Place List

1. Trip menu → **Import AI change file…** → `docs/samples/sample-trip.changes.json` (an invented trip).
2. Trip menu (or the import button in the Place List header) → **Import places file…** → `docs/samples/sample-places.json`. The preview shows four new places, one with details missing, two possible duplicates (one already in the trip, one twice in the file) and four problems (an unknown field, a bad time, an unknown rating, an unknown type).

# Web app (`src/`)

React + TypeScript + Vite. All trip logic lives in the Rust core (`core/`, loaded as Wasm); this app shows it and sends commands. Every change to a trip is a command through `core.applyCommands` (or an AI change file), so it is logged and can be undone (items 72–76).

| File | What it does |
| --- | --- |
| `main.tsx` | Mounts the app, loads the styles |
| `App.tsx` | Loads the core and the last trip, holds the open trip, applies commands, undo (⌘Z / Ctrl+Z), trip files, AI change files, notices |
| `core.ts` | Typed wrapper around `core/pkg`: JSON in and out, `CoreError` with the core's plain-words message |
| `types.ts` | The JSON shapes the shell reads (trip, settings, log group, plan day, budget summary) |
| `storage.ts` | Trips in IndexedDB (one store, keyed by trip id) |
| `prefs.ts` | Layout and pane sizes in localStorage, safe when storage is blocked |
| `files.ts` | Download a file, read a picked file |
| `format.ts` | Dates as numbers (`12/02`), money, mode and group labels, export file names |
| `theme.css` | Colour tokens (items 77–81); light only, a dark set redefines the same names |
| `app.css` | Shell styles, using only theme tokens |
| `components/TopBar.tsx` | Brand, Plan · Bookings · Budget tabs, trip menu, People, Transport, budget total, undo, history, layout switch |
| `components/HistoryMenu.tsx` | Change log newest first, Undo, "Go back to here" |
| `components/TripDialog.tsx` | Pick a saved trip or start a new one |
| `components/Menu.tsx` | Dropdown button and menu items |
| `components/Panes.tsx` | Pane with collapse button, collapsed bar, draggable divider |
| `components/icons.tsx` | Small line icons |
| `pages/PlanPage.tsx` | Stacked and Three-column layouts (items 1–4); pane contents are placeholders until phases 3–5 |
| `pages/OtherPages.tsx` | Bookings placeholder; Budget group totals from `budgetSummary` |
| `*.test.ts` | Vitest: the core wrapper (loads the real Wasm with `initSync`), format, prefs and storage helpers |

# Build plan

How Wanderlust is being built, phase by phase, and how to pick up the work in a new session. Started 2026-11-19, after the layout and behavior were agreed.

## Where the decisions are

| What | File |
| --- | --- |
| Every UI and behavior decision, numbered (items 1–76) | [layout-and-behavior.md](layout-and-behavior.md) |
| Platform, map, backend and data-model decisions | [decisions.md](decisions.md) |
| Place import file and its AI prompt | [import-format.md](import-format.md) |
| AI change file and its AI prompt | [change-file-format.md](change-file-format.md) |
| Static mocks (colours are placeholders) | [mock/layouts.html](mock/layouts.html), [mock/pages.html](mock/pages.html) |
| Rust core: module map and rules | [../core/README.md](../core/README.md) |

The v0 prototype in `src/` is **not** a reference for anything (Brady, 2026-11-19).

## Stack

- **Core:** Rust crate `core/` (`wanderlust-core`), compiled to WebAssembly with `wasm-pack` for the browser; natively inside Tauri later.
- **UI:** React + TypeScript + Vite, MapLibre GL JS for the map.
- **Data:** local-first, the trip lives in the browser (IndexedDB) with export to a JSON file; no server, no accounts.
- **Online pieces later:** routing (hosted Valhalla), weather (Open-Meteo or similar), with keys typed into settings and kept on the device.

## Phases

Each phase ends with something that can be tried.

| # | Phase | Status |
| --- | --- | --- |
| 1 | **Rust core**: data model, commands and change log, hours, travel estimates, sun times, schedule checks, budget, place import, Wasm API | Done 2026-11-19 |
| 2 | Core updated to items 81–83 (done, see below). **App shell**: top bar (tabs, People, Transport, budget total, layout icons), both layouts with resizable and collapsible panes, IndexedDB storage, trip export and import, change file import, undo from the change log | Shell done 2026-11-19 (see below) |
| 3 | **Place List and import**: grouping by area / rating / type / scheduled, rows, expand for details, import preview | Not started |
| 4 | **Timetable**: multi-day view with daylight background and weather slot, drag from the list, move and resize, closed-hours hatching, travel gaps, fixed blocks, hotel blocks and night band; then list view | Not started |
| 5 | **Map**: MapLibre with our own grey style, type pins, highlight chips, routes (straight lines first) | Not started |
| 6 | **Bookings page, then Budget page** | Not started |
| 7 | **Online extras**: routing, weather, sun times per city (needs the user's keys) | Not started |
| Later | MCP server for Claude (route C), Tauri desktop app, cloud sync, sharing, trip guide export | Parked |

## Phase 1 status (2026-11-19)

- **Done.** `core/` builds natively and as Wasm; 81 tests at the time (87 after items 81–83); `cargo clippy --all-targets` clean.
- A review sub-agent checked the core against the decisions and found 10 bugs with failing inputs; all fixed with regression tests (see `core/README.md`).
- The main session wrote `model.rs`, `time.rs`, `commands.rs`, `api.rs`, `wasm.rs` and the contracts. Four sub-agents in their own worktrees wrote `hours` + `schedule`, `travel` + `sun`, `budget` and `import`; the main session merged them and fixed the gaps they reported.
- Checked from JavaScript: a Node script loaded `core/pkg`, built a trip with commands, and read back the plan view (blocks, a too-tight travel warning, Tokyo sun times), a drag preview in closed hours, the budget, undo, and a failing command's message.
- Known gaps are listed at the end of `core/README.md`.
- Lesson for sub-agents: worktrees are cut from `main`, so **commit (and merge to main, or tell the agent the branch) before starting them**, or they start without the newest files.

Update this table and the status above when a phase or module is finished.

## Phase 2 status (2026-11-19)

- **Shell done** by a sub-agent, checked by the main session in the browser: top bar (tabs, trip menu, People, Transport, budget total, undo, history, layout icons), both layouts with resizable and collapsible panes, trips saved in IndexedDB, export and open trip files, AI change file import, change log with Undo and "Go back to here". `npm test` 13 tests, `npm run build` and `npm run lint` clean, no console errors.
- The old v0 prototype in `src/` is replaced (still in git history).
- Pane contents (Place List, timetable, map) are placeholders until phases 3–5. Bookings and Budget are placeholder pages.
- Choices to confirm with Brady: "Go back to here" undoes that change and everything after it (asks first when more than one); opening a trip file with an id already saved asks before replacing; the trip menu sits on the trip name; People offers 1–12; both layouts share collapsed panes; system font until fonts are chosen.

## Core changes for items 81–83 (done 2026-11-19)

- [x] `model.rs`: `Kind` (15 sub-categories) and `Group` (6 groups) replace `PlaceType`, `BookingKind` and `Category`; `Place.kind`, `Booking.kind`, `Item.kind`; `Settings.limits` keyed by group.
- [x] `commands.rs`: `category_for` removed; `SchedulePlace` copies the place's kind; Local travel refused on places and bookings.
- [x] `budget.rs`: six group lines in order, each with its sub-category lines; rows show kind and group; Local travel costs are Transport → Local travel (legs have no cost yet).
- [x] `import.rs`: the 14 place ids, `shop` read as `shopping`, `localTravel` refused; no type now means Other (was Sight), unverified.
- [x] Docs: `change-file-format.md` and `import-format.md` no longer mention the older lists; the mocks still do.
- `TRIP_VERSION` stays 1 (no real trips saved before the change). 87 tests, clippy clean.

## Working rules

- **Read before changing.** A session starts with `CLAUDE.md`, this file, and the decision docs above.
- **Show before building UI.** Any screen that isn't in the mocks gets a mock and Brady's reaction first.
- **Decisions are numbered.** A new or changed decision goes into `layout-and-behavior.md` (or `decisions.md`) in the same commit as the code.
- **Commands only.** Every change to a trip goes through a `Command` (items 72–76), so it is logged and can be undone, and AI can do it too.
- **Real trip data stays out of the repository.** `*.trip.json` is git-ignored.
- **Commits:** on a branch, `cargo test` and `cargo clippy --all-targets` clean in `core/`; for the web app, `npm test` and `npm run build`.

## Starting a sub-session

A sub-session (or sub-agent) gets one module or one screen. Give it:

1. **The goal and its files**, for example "implement `core/src/budget.rs`" or "build the Bookings page in `web/src/pages/Bookings.tsx`".
2. **What to read first:** `core/README.md` (or the web app README once it exists), the decision items by number, the mock if it is a screen.
3. **What it must not touch:** other modules' public signatures, the docs, `src/` v0.
4. **Its own worktree** when several run at once, so half-finished code never breaks another's build. Independent files only.
5. **What to report back:** the public API it added, tests and their count, anything it needed but couldn't change, and its commit hash.

The main session merges the work, runs all tests, reviews the code against the decisions, and updates this file.

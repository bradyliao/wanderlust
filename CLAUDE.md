# Wanderlust: notes for the next session

Read this first, then [`docs/build-plan.md`](docs/build-plan.md). Started 2026-11-17 in a cloud session; restarted 2026-11-18 at layout and behavior; building since 2026-11-19.

## What this is

A travel planner used on a computer: a Place List of collected places, a timetable like a class schedule, and a large map, all linked, plus Bookings and Budget pages. It replaces the owner's method of a Google Sheet, a Claude chat and Google Maps side by side. The first real case is a Tokyo trip. A phone trip guide is parked for later (an export format question).

## Where things are

| What | Where |
| --- | --- |
| **Build plan, phases, status, how to start sub-sessions** | `docs/build-plan.md` |
| **Every UI and behavior decision, numbered (items 1–83)** | `docs/layout-and-behavior.md` |
| Platform, map, backend, data model decisions | `docs/decisions.md` (the roadmap section at its end is old background) |
| Place import file format and AI prompt | `docs/import-format.md` |
| AI change file format and AI prompt | `docs/change-file-format.md` |
| Static mocks (older colours; theme is items 77–80) | `docs/mock/layouts.html`, `docs/mock/pages.html`, rendered as `.png` next to them |
| Brady's layout sketch | `docs/img/layout-sketch.png` |
| **Rust core** (data model, commands, all logic) | `core/`, see `core/README.md` |
| Web app (React + TypeScript + Vite), file map in `src/README.md` | `src/` |
| Older background docs (went too far ahead; not decisions) | `docs/ux-workflow.md`, `docs/requirements.md`, `docs/design/` |
| Original planning brief (Chinese, private claude.ai doc) | https://claude.ai/artifact/7gFeupjz9FgGkb2tfBN5zR |

## Current state

- **Phase 1 (Rust core) is done; phases 2–5 (app shell, Place List and import, timetable, map) are done; phase 6 (Bookings and Budget pages) is next.** See `docs/build-plan.md`. Run it with `npm install` then `npm run dev` (needs Rust, the wasm32 target and wasm-pack).
- Stack: Rust core compiled to Wasm (`wasm-pack`), React + TypeScript + Vite UI, MapLibre, data local in the browser. Browser first, Tauri later. No server, no accounts.
- Every change to a trip is a `Command` in `core/src/commands.rs`, logged with its author (user or AI) and undoable. AI changes the trip with change files now, through MCP later.

## Decisions the owner made (summary; details in the docs)

- Interface in **English**. Dates as numbers, `12/02`.
- Two default layouts (Stacked; Three columns), Place List grouped by area by default.
- Ratings: Must Go / So-So / Forget, plus Unrated for imported places the user didn't rate.
- People on the trip is a trip-wide setting that can change. No named travellers.
- Costs in local currencies, home currency TWD or USD, rates typed in by the user. Flights count in the budget.
- Offline for now. Not hosted on bradyliao.com for now.

## Facts established

- **Google Maps API has no transit routes in Japan**, and its two-wheeler mode doesn't cover Japan; Routes API results must be shown on a Google map. Sources in `docs/requirements.md` and `docs/layout-and-behavior.md` (travel notes).
- Stadia Maps free plan (Valhalla routing): 200,000 credits a month, no commercial use, temporary storage only (checked 2026-11-19).
- Japanese transit APIs: NAVITIME (business pricing, not public) and Ekispert (free trial, timetable-based); not chosen yet.

## Working with the owner

- Show a mock and get a reaction before building any screen not already mocked.
- Ask before deciding things that are the owner's; record every decision by number in the docs, in the same commit.
- Keep real trip data out of the repository (`*.trip.json` is git-ignored).
- The owner's memory vault is at `~/Projects/Obsidian/Memory` on this Mac.

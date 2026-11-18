# Wanderlust

A travel planner in two halves:

1. **Plan** on a big screen: a list of places you have collected, a timetable that works like a class schedule, and a map, all linked.
2. **Travel** with a phone trip guide that opens on today and shows now and next (later).

Start with [CLAUDE.md](CLAUDE.md), then [docs/build-plan.md](docs/build-plan.md) (phases) and [docs/layout-and-behavior.md](docs/layout-and-behavior.md) (every agreed decision, numbered).

## Run it

Prerequisites:

- Node.js 24 or newer
- Rust (stable) with the Wasm target: `rustup target add wasm32-unknown-unknown`
- [wasm-pack](https://rustwasm.github.io/wasm-pack/): `cargo install wasm-pack`

```bash
npm install
npm run dev
```

`npm run dev`, `npm run build` and `npm test` first build the Rust core into `core/pkg/` (`npm run core`, git-ignored), then run Vite or Vitest. Other commands: `npm run lint` (oxlint), `npm run preview` (serve `dist/`). For the core itself: `cargo test` and `cargo clippy --all-targets` in `core/`.

## What is in it

| Part | Where | Status |
| --- | --- | --- |
| Rust core: data model, commands and change log, hours, travel estimates, sun times, schedule checks, budget, place import | [core/](core/README.md) | Done (phase 1) |
| App shell: top bar, both layouts with resizable and collapsible panes, trips in the browser, export and open, AI change files, history and undo | [src/](src/README.md) | Done (phase 2) |
| Place List, Timetable, Map, Bookings and Budget pages | `src/` | Placeholders; phases 3–6 |

Trips live in this browser (IndexedDB) and are saved after every change. Export a trip to a `.trip.json` file to keep a copy or give it to an AI; real trip files stay out of the repository (`*.trip.json` is git-ignored).

The build uses relative paths, so it can be wrapped in a desktop shell (Tauri or Electron) later.

# wanderlust-core

The trip data model and all planning logic, in Rust. The web app calls it as WebAssembly (`--features wasm`); a Tauri app can call it natively later. It has no UI and no network access: routing and weather results are fetched by the app and stored through commands.

Decisions it implements: [`docs/layout-and-behavior.md`](../docs/layout-and-behavior.md) (items are cited by number in the code), [`docs/import-format.md`](../docs/import-format.md), [`docs/decisions.md`](../docs/decisions.md). The v0 TypeScript prototype in `src/` is **not** a reference.

## Commands

```bash
cargo test                       # all tests, native
cargo clippy --all-targets       # lints
wasm-pack build --target web --features wasm   # JS + .wasm into core/pkg/
```

Tools: Rust stable, the `wasm32-unknown-unknown` target, `wasm-pack` (installed 2026-11-19).

## Module map

| Module | What it owns | Status |
| --- | --- | --- |
| `model.rs` | Every stored record: `Trip`, `Settings`, `Day`, `Place`, `Item` (slot, stay, booking, cost), `Leg`, change log types, enums | Done |
| `time.rs` | `Date` (no time zone database), `HH:MM` parsing, snapping | Done |
| `commands.rs` | `Command` (the only way a trip changes), `apply` as one undo step, `undo_last`, `undo_to`, AI `ChangeFile` | Done |
| `hours.rs` | Opening hours on a date: open and closed ranges | Phase 1 |
| `travel.rs` | Leg estimates per mode, the leg's mode and minutes, walk hint, picker options, Maps links, coordinates from links | Phase 1 |
| `sun.rs` | Sunrise, sunset, civil dawn and dusk; daylight stages for the gradient | Phase 1 |
| `schedule.rs` | Blocks per day, legs between them, night band, warnings, drag preview, day location | Phase 1 |
| `budget.rs` | Price totals (whole booking / per night / per person), currencies, Budget page summary | Phase 1 |
| `import.rs` | Place import (`wanderlust-places` v1): read, check, preview, merge into commands | Phase 1 |
| `wasm.rs` | The JavaScript API: a few large calls with JSON in and out | Phase 1 |

## Rules every module follows

1. **Only `commands.rs` changes a `Trip`.** Other modules take `&Trip` and return plain data. Importers return `Vec<Command>`.
2. **Plain data out.** Results are structs with `Serialize` and `#[serde(rename_all = "camelCase")]`, so the Wasm layer can hand them to JavaScript as JSON.
3. **Messages in plain words,** the way the user would say it: `"Senso-ji opens at 6:00."`, not codes. Times as `9:30`, dates as `12/02` (`Date::month_day`).
4. **Nothing guessed is presented as fact.** Estimates carry a source (`TravelSource`), imported details are listed in `Place::unverified`.
5. **No network, no clock, no randomness.** Timestamps and ids are passed in by the caller.
6. **Tests next to the code** (`#[cfg(test)] mod tests`), using small hand-made trips. `cargo test` and `cargo clippy --all-targets` stay clean.
7. **Do not change another module's public signatures** without the orchestrating session agreeing; add what you need inside your own module.

## What each phase-1 module must provide

### hours.rs
Signatures are fixed in the file. Weekdays: 0 = Monday. Overnight ranges (`close <= open`) spill into the next date. `(0, 1440)` = open all day. `None` (unknown) must stay distinct from closed.

### travel.rs
Signatures are fixed in the file.
- Estimates from straight-line distance with a detour factor and a per-mode speed and overhead (walk, cycle, two-wheeler, drive, ride, transit). Round up to 5 minutes, minimum 5. Document the numbers as rough.
- `leg_travel`: minutes from confirmed, else the stored routing result for the mode, else the estimate. Mode from the leg, else the day, else the trip (`Trip::default_mode_on`). `walk_hint` when the leg is under `WALK_HINT_KM` and the mode isn't Walk. `options` lists all six modes.
- Maps links: `https://www.google.com/maps/dir/?api=1&origin=lat,lng&destination=lat,lng&travelmode=…`.

### sun.rs
Signatures are fixed in the file. NOAA solar position equations; check against a known value (Tokyo, 2026-12-02: sunrise about 6:35, sunset about 16:28, offset +540).

### schedule.rs
Defines its own types. Must provide:
- `blocks_on(trip, date) -> Vec<Block>`: every block on a date (item slots, stay check-in and check-out), sorted, with key (`BlockKey::encode`), item id, part, title, start, end, fixed, reason, place id.
- `night_on(trip, date) -> Option<Night>`: the stay covering that night (check-in date ≤ date < check-out date) for the night band (item 63).
- `legs_on(trip, date) -> Vec<LegView>`: between consecutive blocks whose places both have positions (skip same place); gap minutes, `travel::leg_travel`, `tight` when gap < minutes (item 30).
- `warnings(trip) -> Vec<Warning>`: overlap, closed that day, outside opening hours (item 28), too tight ("needs 25 min, has 10"), each with date, block key, kind and a plain message.
- `drag_preview(trip, place_id, date, start, end) -> DragPreview`: for every trip date the closed ranges of the place (hatching, item 27); on the target date the neighbouring blocks and whether travel fits before and after (needs / has), and whether the slot is in closed hours (items 29, 30).
- `day_location(trip, date) -> Option<(f64, f64)>`: where the day is, for daylight and weather (item 22): the night's stay place if it has a position, else the first block's place with one.

### budget.rs
Defines its own types. Must provide:
- `cost_total(trip, item) -> Option<f64>`: total in the cost's own currency: amount × nights (if `per_night`; nights from the stay, else 1) × people (if `per_person`; `cost.people` or `settings.people`).
- `cost_forms(trip, item)`: the total plus calculated per night, per person, per person per night (item 60).
- `summary(trip) -> BudgetSummary` for the Budget page: home currency; planned, booked and estimated totals in the home currency; budget and left; per person; currency columns in use; per category (amount per currency, home total, limit); per date (home total per category, lodging spread over its nights); cost rows (title, category, status, where it came from, date, amount and currency, home amount, per person, replaced estimate); and currencies missing a rate. Items with `booking.count_in_budget == false` are left out.
- Cost date: slot date, else booking date, else stay check-in, else `cost.date`, else none.

### import.rs
Defines its own types. Implements `docs/import-format.md`:
- Read a `wanderlust-places` v1 file; list problems per place in words; drop bad fields, keep the place.
- Preview against a trip: new places, possible duplicates (same Google Maps link, or same name and area, case-insensitive) with the fields they would fill, link-only places ("details missing").
- Turn it into commands: `AddPlace` for new places (rating from the file or Unrated; every filled field listed in `unverified`; coordinates read from the link when the file has none), `UpdatePlace` for duplicates filling only missing fields (rating kept). Ids made from a caller-given prefix.

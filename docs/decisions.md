# Decisions, open questions and roadmap

## Platform (decided by Brady, 2026-11-18)

| Decision | Why | Cost of reversing |
| --- | --- | --- |
| Browser first, Tauri later as the desktop shell | Fastest way to try the agreed layouts. Tauri wraps the same web UI, so nothing is rewritten. Tauri uses the system web view, so it needs much less memory than Electron | Low now |
| Not UniFFI + SwiftUI | Wanderlust is separate from the Plan B app. SwiftUI would mean a Mac-only UI rewrite and no web version | n/a |
| Core logic in Rust | Brady's choice. One Rust crate holds the data model and logic (schedule checks, travel estimates, budget, trip-guide export). It compiles to Wasm for the browser and runs natively inside Tauri later, so the same core serves both. The UI (React + TypeScript, MapLibre GL JS) calls it through a small API with plain data types and few, larger calls. The TypeScript logic in `src/lib/` and `src/types.ts` is the reference for porting | High once the UI is built on it |
| Map: MapLibre with our own muted grey style on free map data; routes from Valhalla (Brady, 2026-11-19) | Free and open, full control of a calm map, routes can be drawn on any map. Google's Routes API results must be shown on a Google map, and Google has no Japanese transit anyway | Medium once the map is styled and routing is wired up |

## Backend (decided by Brady, 2026-11-19)

| Decision | Why | Cost of reversing |
| --- | --- | --- |
| Local-first: trip data lives in the browser (IndexedDB) with export to a file; cloud sync added later | Private, free, works offline. Every record gets a stable id and a "last changed" time from the start, so sync can be added without reworking the data | Low: sync is designed for, not built |
| Just Brady for now, others later | Records are shaped so a trip can be shared later; no accounts are built yet | Medium when sharing is added |
| Routing from a hosted Valhalla-based service first; own server only if limits or terms don't fit | Nothing to run. Stadia Maps (checked 2026-11-19): free plan of 200,000 credits a month, **no commercial use**, "temp storage" only (so results can't be kept long-term on the free plan). The page does not say which routing endpoints the free plan includes; check before wiring it up. [Pricing](https://stadiamaps.com/pricing/) | Low: Valhalla requests look the same on our own server |
| No key server yet: API keys are entered in the app's settings and stored only on this device | Fine for a personal tool. Keys never go in the repository or in exported trip files. A key server (serverless functions or a Rust server) is needed before anyone else uses the app or before a Tauri build is shared | Low |

Exchange rates are typed in by the user, one per currency; no rate service is needed (Brady, 2026-11-19).

Defaults I'll use while building (not user decisions): each day stores its local date and the city's time zone (IANA name, for example `Asia/Tokyo`); undo history is kept per session; attachments stay on the device.

Order of work: review the UI decisions in [layout-and-behavior.md](layout-and-behavior.md), then build a clickable mock, then the real code.

## Decisions made so far

These were defaults chosen to get a prototype moving. Any of them can be reversed.

| Decision | Why | Cost of reversing |
| --- | --- | --- |
| Web first, React + TypeScript + Vite | Runs as a website now and inside a desktop shell later without a rewrite | High once the UI grows |
| Interface in English | Stated in the brief | Low; no translation layer yet |
| Wide-screen three-pane planner; tabs on narrow screens | Planning is a desk activity; the brief describes three linked panes | Low |
| Travel between stops is derived, with stored overrides | Removes the stale travel rows of the spreadsheet | Medium |
| Local-only storage, trip as one JSON file | Privacy rule in the brief; no backend to build or pay for | Medium: sync needs a different store |
| Trip guide is a standalone HTML file | Works offline, private by default, nothing to host | Low |
| MapLibre with OpenFreeMap tiles | Free, no API key, grey style with railways | Low: the style URL is one constant |
| Pace (relaxed, standard, packed) instead of a fixed "elders first" rule | The brief says elder-friendly is one mode, not the default | Low |
| One rating per place (1 Forget, 2 So-So, 3 Must Go), no named travellers | Brady, 2026-11-17: leave parents and family out for now | Low: old files are upgraded on open |
| Estimates are always labelled | The brief requires checked data and marked estimates | n/a |

## Questions for Brady

From the brief's open list, with a recommendation for each.

1. **Web, iPhone app, or both?** Recommend web plus desktop shell for planning, and the trip guide (later a PWA) for the phone. A native SwiftUI app would be a second codebase; decide after the guide has been used on a real trip.
2. **Where does data live?** Recommend the app owns the data and exports to CSV for spreadsheets, rather than using a spreadsheet as the database.
3. **Should other people edit and rate places?** Parked by Brady on 2026-11-17. It would require accounts or sharing.
4. **Is a paid maps API acceptable?** This decides how automatic travel times can be. See the options in [requirements.md](requirements.md#travel-and-fares). A small monthly budget figure would settle it.
5. **Lodging and car-hire comparison in the app?** Recommend lodging candidates first (they affect the map and every day's start and end), car hire later.
6. **Repository visibility.** Nothing private is in the repository. Public is fine as long as real trip files stay out.

## Roadmap

Ordered by what most improves the workflow per unit of work.

1. **Use it for one real trip.** Rebuild an existing itinerary in the prototype and note every point of friction. This should reorder everything below.
2. **Faster place entry.** Search by name with auto-filled position and hours.
3. **Walking times from an open router**, then a decision on transit data.
4. **Lodging candidates**: model, comparison table, map layer.
5. **Day helpers**: suggested order, "what is near this block", CSV export.
6. **Budget targets and per-group costs.**
7. **Multiple trips**, then desktop packaging with Tauri.
8. **Hosted private trip guide link and PWA install**, which brings in a backend.
9. **Sharing and per-person ratings** (parked).
10. **Pass calculator** (needs fares per leg and pass coverage rules, so it comes after transit data).

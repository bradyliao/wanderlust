# Decisions, open questions and roadmap

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
| One rating per place (1 Forget, 2 50-50, 3 Must Go), no named travellers | Brady, 2026-11-17: leave parents and family out for now | Low: old files are upgraded on open |
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

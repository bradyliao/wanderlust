# Wanderlust: notes for the next session

Read this first. It is the handoff from the cloud session that started the project (2026-11-17 to 18).

## What this is

A travel planner in two halves:

1. **Plan** on a big screen: a pool of collected places, a timetable like a class schedule, and a large map, all linked.
2. **Travel** with a phone trip guide that opens on today and shows now and next.

It replaces the owner's current method: a Google Sheet (place list and daily schedule), a Claude chat and Google Maps used side by side. The first real case was a Tokyo trip.

## Where things are

| What | Where |
| --- | --- |
| Original planning brief (Chinese) | Claude doc "旅遊規劃 App：Brady 的規劃流程與需求": https://claude.ai/artifact/7gFeupjz9FgGkb2tfBN5zR |
| Layout mock-ups (three planner options and the phone guide) | Claude Design canvas "Wanderlust layout options": https://claude.ai/artifact/YEiYwpuVFzWtBs6vMr9HLy |
| Copies of those mock-ups | `docs/design/*.dc.html` and `docs/design/canvas.json`. These are source only and need the canvas runtime to render; open the canvas link to view them |
| User workflow and screens | `docs/ux-workflow.md` |
| Requirements worked backward from the screens | `docs/requirements.md` |
| Decisions, open questions, roadmap | `docs/decisions.md` |
| Working prototype v0 | `src/` (React, TypeScript, Vite). See `README.md` |

The artifacts are private to the owner's claude.ai account.

## Current state

- **Restarted on 2026-11-18 at layout and behavior.** Read `docs/layout-and-behavior.md` first. Brady sketched two default layouts (Stacked: places left, timetable over map; Three columns: places, timetable, map). Canvas options A, B, C are kept as alternatives only.
- All 20 behavior questions in that doc were answered on 2026-11-18. **Next: a clickable mock of the two layouts for Brady to react to, before any real build.** Earlier docs (`ux-workflow.md`, `requirements.md`, roadmap in `decisions.md`) went too far ahead and are background, not decisions.
- Prototype v0 in `src/` was rejected as UI. The logic in `src/lib/` and `src/types.ts` may still be reused once behavior is agreed.
- `npm test` passes (12 tests). `npm run build` passes.

## Decisions the owner made

- Interface in **English**.
- **No named travellers or family / elder mode for now.** The trip has only a head count (`partySize`) for budget totals.
- **One rating per place**: 1 Forget (greyed out, not deleted), 2 50-50, 3 Must Go.
- Website first, desktop app later (the build uses relative paths so it can be wrapped in Tauri or Electron).
- After planning, the output is a convenient trip guide for use during the trip.

## Facts established (checked 2026-11-17 / 18)

- **Google Maps API has no transit routes in Japan.** Google's FAQ says the Routes API supports all transit partners "except ... those in Japan". Walking and driving work. Pricing: Routes Essentials 10,000 free a month, then about USD 5 per 1,000; Places Text Search Pro 5,000 free, then about USD 32 per 1,000. The Google Maps website and app do show Japanese trains, so a "check route in Google Maps" link works. Details and sources: `docs/requirements.md`, section "Travel and fares".
- **Travel times in v0 are a rough formula** (straight-line distance, a walk/transit cutoff at 1.2 km, pace-based speeds), calculated live and labelled "est.". Only connections the user confirmed are stored.
- **Existing apps**: Wanderlog (itinerary plus map, Pro about USD 40 a year), Funliday (Taiwanese, Chinese interface, imports ChatGPT itineraries to a map), Stippl, Tripsy, TripIt, AI planners (Mindtrip and others). None clearly offers a week-grid timetable with fixed blocks, opening-hours and clash warnings, Japanese train routes, or a transport-pass calculator. The owner was advised to try Wanderlog and Funliday on a real trip before more building; it is not known whether they did.

## Open questions for the owner

Layout and behavior questions now live in `docs/layout-and-behavior.md`. Older ones:

1. ~~Which layout~~: answered, see above.
2. Travel as its own row or block, or a label in the gap?
3. Plan only on a computer, or on the phone too?
4. What next after the layout: lodging comparison, or faster place entry (search with auto-filled details)?

## Working with the owner

- Show a layout or mock-up and get a reaction before building UI.
- Keep real trip data (itineraries, bookings) out of this repository. `*.trip.json` and `*-guide.html` are git-ignored.
- The owner keeps a shared memory vault (`bradyliao/obsidian`, `Memory/`). This cloud session could not open it; a local session may be able to.

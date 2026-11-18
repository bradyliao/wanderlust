# Layout mock-ups

Source of the four screens on the Claude Design canvas "Wanderlust layout options" (link in [CLAUDE.md](../../CLAUDE.md)), copied on 2026-11-18.

| File | Screen |
| --- | --- |
| `Main.dc.html` | A. Week timetable with a half-width map |
| `DayPlan.dc.html` | B. One day at a time, as a list like the spreadsheet |
| `MapFirst.dc.html` | C. Map first, with the days as a timeline along the bottom |
| `TripGuide.dc.html` | The trip guide on a phone |
| `canvas.json` | How the canvas lays them out |

These files need the canvas runtime (`support.js`) and do not render on their own. The canvas is the source of truth: if it changes, copy the files again.

All four use the sample Tokyo trip from `src/sample.ts`, which is invented data.

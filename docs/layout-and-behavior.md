# Layout and behavior (restart, 2026-11-18)

This is the starting point now. Earlier work (prototype v0, `ux-workflow.md`, `requirements.md`, the roadmap in `decisions.md`) went ahead before layout and behavior were agreed. Treat those as background, not as decisions. Nothing new gets built until the questions below are answered.

Brady's sketch: [img/layout-sketch.png](img/layout-sketch.png)

## Default layouts

Both have a top bar across the full width (trip name, dates, layout switch) and the Place List on the left.

### Layout 1: Stacked (default)

```
+------------------------------------------------------+
| Top bar                                              |
+-------------+----------------------------------------+
|             | Timetable (multi-day view)             |
| Place List  |                                        |
|             +----------------------------------------+
|             | Map                                    |
|             |                                        |
+-------------+----------------------------------------+
```

Timetable on top, map below, both full width of the right side. Gives the timetable room for many day columns.

### Layout 2: Three columns

```
+------------------------------------------------------+
| Top bar                                              |
+-------------+------------------+---------------------+
|             | Timetable        |                     |
| Place List  | (multi-day view  | Map                 |
|             |  or list view)   |                     |
|             |                  |                     |
+-------------+------------------+---------------------+
```

Timetable in the middle, switchable between multi-day view and list view. Gives the timetable and map full height.

### Other options (kept, not default)

From the Design canvas: A (week grid with half-width map), B (one day as a list), C (map first with a timeline along the bottom). They stay available as alternatives to look at later.

## Behavior questions

All 20 were agreed with Brady on 2026-11-18.

### Layout

1. **[Agreed 2026-11-18] Switching layouts.** A switch in the top bar flips between Layout 1 and 2, and the app remembers the choice.
2. **[Agreed 2026-11-18] Resizing panes.** Drag the dividers to resize; each pane can collapse (for example hide the Place List while arranging days).
3. **[Agreed 2026-11-18] Timetable views.** Multi-day view (columns are days, rows are hours) and list view (one day, stops in order like the spreadsheet). Available in both layouts, toggled on the timetable header.
4. **[Agreed 2026-11-18] How many days show at once** in multi-day view: as many as fit at a readable column width; scroll sideways for the rest.

### Selection and linking

5. **[Agreed 2026-11-18] Click a place in the list** → it is highlighted in all panes; the map pans to it and, if it is scheduled, the timetable scrolls to its block.
6. **[Agreed 2026-11-18] Click a block in the timetable** → the place is highlighted in the list (which scrolls to it) and on the map (which pans to it).
7. **[Agreed 2026-11-18] Click a pin on the map** → the place is highlighted in the list (which scrolls to it) and, if scheduled, in the timetable (which scrolls to it). No zooming.
8. **[Agreed 2026-11-18] Hover vs click.** Hover gives a light highlight in all panes; nothing scrolls or pans. Click selects.
9. **[Agreed 2026-11-18] What the map shows by default.** The day in focus as numbered stops joined in order; every other place in the pool as a small grey dot.
10. **[Agreed 2026-11-18] Which day is "in focus"** in multi-day view: the one you last clicked in (a block or the day header). In list view it is the day shown.

### Moving things

11. **[Agreed 2026-11-18] List → timetable.** Drag a place onto a day and time to schedule it. It snaps to 15 minutes; its length is the place's usual stay (1 hour if unknown).
12. **[Agreed 2026-11-18] List → map.** Dropping on the map does nothing. The map is for seeing and selecting, not scheduling.
13. **[Agreed 2026-11-18] Within the timetable.** Drag a block to move it (same day or another day). Drag the top edge to change the start (end stays), the bottom edge to change the end. Snaps to 15 minutes.
14. **[Agreed 2026-11-18] Timetable → list.** Drag a block back to the list to unschedule; the place stays in the pool. That is the only way (no Delete key, no × button).
15. **[Agreed 2026-11-18] Same place twice.** Allowed. The list shows it is scheduled twice; selecting it highlights both blocks.

### Place List

16. **[Agreed 2026-11-18] What one row shows.** Type icon, name, rating (Forget / 50-50 / Must Go), area, usual stay, and which day(s) it is scheduled on.
17. **[Agreed 2026-11-18] Narrowing the list.** Grouped into collapsible sections rather than search and filter chips. Grouped by rating by default (Must Go, 50-50, Forget); a small menu switches the grouping to area or type.
18. **[Agreed 2026-11-18] Details.** The selected row expands in the list to show hours, notes and link. No extra panel.

### Travel between stops

19. **[Agreed 2026-11-18] How travel shows in the timetable.** A small label in the gap between blocks (for example "walk 12 min"). It takes no time slot of its own and is never dragged.

### Screen size

20. **[Agreed 2026-11-18] Narrow screens.** The planner is for a computer only, for now. On a phone you use the trip guide.

## Not discussed yet (parked)

Budget, checklist, lodging, place search with auto-fill, trip guide export. These come after layout and behavior are agreed.

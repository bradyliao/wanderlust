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

All of them were agreed with Brady on 2026-11-18 (items 1–80 plus the day-label and date-format rules).

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

16. **[Agreed 2026-11-18] What one row shows.** Type icon, name, a rating chip (Must Go / So-So / Forget, shown on every row so it stays visible in any grouping), area, usual stay, opening hours and closed days in short form (for example "9:30–17:00 · closed Fri"), and the date(s) it is scheduled on as numbers ("12/02"), or "Not scheduled".
17. **[Agreed 2026-11-18] Narrowing the list.** Grouped into collapsible sections rather than search and filter chips. A small menu offers four groupings: **Area** (the default; Forget places stay in their area, greyed out), **Rating** (Must Go, So-So, Forget, with Forget collapsed), **Type**, and **Scheduled or not** (not scheduled first, then one section per date).
17a. **[Agreed 2026-11-18] Rating names.** Must Go / So-So / Forget (So-So replaces "50-50"). Imported places the user didn't rate start Unrated (item 68).
17b. **[Agreed 2026-11-18] Place types.** Seven separate types, each with its own icon and colour: Sight (temples, landmarks), Food, Café, Shop (including markets), Museum (including galleries), Nature (parks, gardens), Nightlife (bars, night spots).
18. **[Agreed 2026-11-18] Details.** The selected row expands in the list to show hours, notes and link. No extra panel.

### Travel between stops

19. **[Agreed 2026-11-18] How travel shows in the timetable.** A small label in the gap between blocks (for example "walk 12 min"). It takes no time slot of its own and is never dragged.

### Screen size

20. **[Agreed 2026-11-18] Narrow screens.** The planner is for a computer only, for now. On a phone you use the trip guide.

### Timetable look: daylight and weather

- **[Agreed 2026-11-18] Day labels.** Day headers (multi-day and list view) show the date first, then the weekday, in a different style so the two are easy to tell apart: the date in bold, the weekday small, uppercase and muted ("**12/02** WED").
- **[Agreed 2026-11-18] Date format.** Dates are written as numbers, month/day ("12/02"), everywhere in the app.

21. **[Agreed 2026-11-18] Daylight background.** Each day column's background follows the real daylight for that date, as a smooth vertical gradient. Matte and muted, never eye-catching: it sits behind the blocks and must not compete with them.
22. **[Agreed 2026-11-18] Whose daylight.** Sunrise and sunset come from that day's own location (its first stop or lodging), so a multi-city trip shows each city's real daylight.
23. **[Agreed 2026-11-18] Stages in the gradient.** Night (muted dark blue-grey), twilight (soft dawn and dusk tones), golden hour (a faint warm band in the hour after sunrise and before sunset), and day (light neutral), blended smoothly.
24. **[Agreed 2026-11-18] Weather in the day header.** An icon, high and low temperature, and chance of rain in each day's header. No hourly weather in the grid.
25. **[Agreed 2026-11-18] Dates too far ahead to forecast.** Show the typical weather for that place and time of year from past years, labelled "typical". It is replaced by the real forecast once the date is close enough.
26. **[Agreed 2026-11-18] Daylight in list view.** List view shows the same daylight gradient as a thin strip beside the times, not behind the whole list.

Notes for building (not yet checked against current docs):

- Sun times can be calculated in the app from date and coordinates, with no service and no network. This fits the Rust core.
- Open-Meteo looks like a candidate for weather: free with no API key for non-commercial use, a forecast of about 16 days, and a historical archive for "typical" values. Check its terms and limits before relying on it.


### Opening hours, travel time and fixed blocks

27. **[Agreed 2026-11-18] Closed hours.** While you drag a place, or when one is selected, every day column hatches out the hours it is closed. A day it is closed all day is hatched top to bottom. Otherwise the grid stays calm. The hatching is drawn on top of blocks already in the timetable, so you can see which of them fall in closed hours. Its edge is not a hard stop: it fades out over about 30 minutes into the open hours, and a small tag marks the exact opening or closing time.
28. **[Agreed 2026-11-18] Blocks outside opening hours.** A block placed when the place is closed always shows a small warning mark.
29. **[Agreed 2026-11-18] Travel time while dragging.** While dragging, the app shows the travel time needed from the stop before and to the stop after, using a fast estimate it calculates itself (instant, offline). On drop, it asks a routing service once for a better number and stores it.
30. **[Agreed 2026-11-18] Not enough time to travel.** The drop is allowed. The gap turns red with a message such as "needs 25 min, has 10". Estimates can be wrong, so the user stays in control.
31. **[Agreed 2026-11-18] Fixed blocks.** One fixed state, shown with a lock, with an optional reason (for example "Ticket booked" or "Must be there"). All fixed blocks behave the same: they cannot be dragged, and other blocks cannot be dropped over them.
32. **[Agreed 2026-11-18] Moving a fixed block.** Click the lock to unlock it, then drag it like any block. This prevents accidental moves.

### Travel modes

33. **[Agreed 2026-11-18] Mode list follows Google Maps.** Drive, Transit, Walk, Two-wheeler, Cycle, Ride / taxi. "Scooter" is Two-wheeler (motor scooter or moped) or Cycle (shared e-scooter or bike-share).
34. **[Agreed 2026-11-18] Defaults.** The trip has a default mode (for example Transit). Each day can override it (for example Drive on a road-trip day). The day header shows the mode only when it differs from the trip default.
35. **[Agreed 2026-11-18] Walk suggestion.** For a short leg (under about 1 km) the leg keeps its mode, and its label adds a hint such as "· walk 5 min?". One click switches it to Walk.
36. **[Agreed 2026-11-18] Changing one leg.** Click its travel label to open a small picker with every mode and its estimated time; pick one. Any leg can be changed.
37. **[Agreed 2026-11-18] How modes show.** The gap label shows the mode icon and minutes. On the map each leg's line has its own style (for example solid for Transit, dotted for Walk, dashed for Drive).

Notes for building (checked 2026-11-18 unless marked):

- **Live while dragging** means the app's own instant estimate during the drag, then one routing request on drop (item 29). Drive routes from Google or Mapbox can include live traffic.
- **Google Routes API** modes: `DRIVE`, `WALK`, `BICYCLE`, `TWO_WHEELER`, `TRANSIT`. Transit does not cover Japan (see `requirements.md`). `TWO_WHEELER` covers about 40 countries, including Taiwan, but **not Japan**, and is billed higher than other modes. Google requires a warning to be shown on walking, cycling and two-wheeler routes. [Coverage list](https://developers.google.com/maps/documentation/routes/coverage-two-wheeled), [two-wheeler guide](https://developers.google.com/maps/documentation/routes/route_two_wheel).
- **Open routers (free, self-hostable):** Valhalla has `auto`, `pedestrian`, `bicycle` and a beta `motor_scooter` costing, plus multimodal transit from GTFS feeds (pedestrian and transit only). OSRM covers car, foot and bike. [Transitland on Valhalla costing](https://www.transit.land/documentation/concepts/routing-graph-and-costing).
- **Japanese transit:** NAVITIME offers a route API (transit plus walking, with fares) on RapidAPI as "NAVITIME Route (totalnavi)"; its train times are NAVITIME's own estimates, not the actual timetable; the main product is for business, with no public price found. [RapidAPI listing](https://rapidapi.com/navitimejapan-navitimejapan/api/navitime-route-totalnavi). Ekispert (駅すぱあと) API has timetable-based route search and fares, a free trial, and partly translated English docs; price not checked. [Ekispert docs](https://docs.ekispert.com/v1/en/).
- **Ride / taxi** can reuse the Drive time; prices need a separate source (not checked).
- **Decided 2026-11-19:** routes come from Valhalla (walk, drive, cycle, scooter). Japanese trains: a paid Japanese API is still undecided; until then train legs are drawn as straight lines with a "check in Google Maps" link.
- Train times in Japan are the gap. Google's API has no Japanese transit (see `requirements.md`). Japanese providers such as NAVITIME offer it but are paid; terms and price not checked. Until then, train times stay estimates that the user confirms, with a "check in Google Maps" link.

### Map (agreed 2026-11-19)

38. **All places on the map.** Every place in the pool shows as a small matte grey pin with its type icon. Forget places are not shown. Highlighted places get colour; nothing else does.
39. **Real routes.** Each leg is drawn along the actual route returned by the routing service. While dragging, a straight dashed line shows until the route arrives. Train legs in Japan stay straight lines until a Japanese transit source is chosen.
40. **Highlight toggles.** Chips on the map choose which days and which types are highlighted. The default is the day selected in the timetable; more days can be switched on to compare.
41. **A calm map.** Not colourful: our own muted, matte grey map style. Colour is kept for the highlighted day's stops and routes.
42. **Map and routing stack.** MapLibre with our own grey style on free map data (OpenFreeMap or Protomaps), and Valhalla for routes. Not Google: Google's policy says Routes API results shown on a map must be on a Google map ([Routes API policies](https://developers.google.cn/maps/documentation/routes/policies)).

### Timetable size and scrolling (agreed 2026-11-19)

43. **Scrolling.** The timetable scrolls up and down through the hours and sideways through the days.
44. **Resizing by dragging.** Drag the edge of a day header to change the column width; drag the edge of an hour in the time column to change the hour height. The app remembers the sizes.

### Top bar and pages (agreed 2026-11-19)

45. **Trip transport default** is picked from a small mode menu in the top bar.
46. **Layout switch** in the top right uses two icons (Stacked, Three columns) instead of words.
47. **Pages.** Tabs in the top bar: Plan · Bookings · Budget. The planning screen stays as it is.
48. **Budget.** Its own page. Costs are entered on blocks and bookings; the top bar shows a small running total.
49. **Bookings.** Their own records on the Bookings page: type (hotel, flight, train, ticket, restaurant, car), times, address, confirmation number, price, cancellation deadline, and an attached file or link. A timed booking can create a fixed block ("Ticket booked"). A hotel sets each night's base, so the next morning's first route and the day's location (for daylight and weather) start there.

### People on the trip (agreed 2026-11-19)

65. **Number of people is a trip-wide setting** in the top bar, changed from a menu like Transport ("3 people ▾"). People may join while the trip is being planned, so it can change at any time. Per-person amounts and bookings set to "everyone on the trip" follow it; a booking with its own head count (for example one room for 2) keeps its number.

### Importing places (agreed 2026-11-19)

The format and the AI prompt are in [import-format.md](import-format.md).

66. **Import from an AI-made file.** Saved social posts are turned by an AI into one JSON file in the Wanderlust format, which the app imports into the Place List. A ready-made prompt comes with the format. Places can still be added by hand at any time.
67. **A Google Maps link alone is allowed but not enough.** Offline, the app cannot look up the details, so a link-only place is imported as "details missing" until the user fills them in.
68. **Rating before import.** The AI lists the places it found and asks the user to rate each one (Must Go, So-So, Forget) before it writes the file; those ratings come in with the import. A place the user skipped comes in **Unrated**, a fourth state next to the three ratings. Any rating can be changed or added in the app later.
69. **Unverified details.** Every detail that came from the file is marked unverified until the user checks it.
70. **Preview, then merge.** Import first shows new places and possible duplicates (same Google Maps link, or same name and area). A duplicate only fills in details the existing place is missing.
71. **Source kept, not shown.** The source post (platform, link, account, date saved) is stored with the place but not shown in the app.

### AI control (agreed 2026-11-19)

72. **One set of commands.** Every change in the app (add place, rate, schedule, move, resize, set cost, set people, add currency, …) is a command in the Rust core. The UI and AI use the same commands, and every command can be undone.
73. **Now: change files (route A).** The AI writes a list of commands into a change file (the format is defined with the core). Importing it applies the changes **live**, with no approval step; the change log (item 76) is the safety net. The AI reads the trip from an export the user gives it.
74. **Later: MCP (route C).** Claude Desktop or Claude Code runs the same commands directly through MCP, reading the trip itself. This needs a small local helper, or comes with the Tauri desktop app. An in-app chat panel (route B, with an Anthropic API key) is not planned for now.
75. **What the AI may change:** everything the user can: places and ratings, the timetable, bookings, costs and currencies, including deleting things.
76. **Change log.** Every change, by the user or by AI, is logged with who made it and when (for example "AI (dinner-ideas.json): scheduled Koffee Mameya 12/03 15:00"). A change file is one group in the log. Undo goes back step by step, or back to any point in the log (which also undoes everything after it). The log is saved with the trip, so undo works after reopening. Undoing one old change while keeping later ones is left for later.

### Bookings page (agreed 2026-11-19)

50. **Layout.** Bookings in date order, grouped under each date, with type filter chips on top (Hotel, Flight, Train, Ticket, Restaurant, Car) and an "Add booking" button. A hotel stay shows as a span across its nights. Clicking a booking opens its details on the right.
51. **Details panel.** Check-in and check-out (or time), confirmation number (hidden until "Show"), address with a Google Maps link, price, cancellation deadline, where it was booked, the nights it sets as the base (hotels), attached files, notes.

Shown in the mock, still to confirm:

- A warning strip for cancellation deadlines coming up soon.
- Each row says whether the booking is on the timetable, and whether it counts in the budget.
- A "Count in trip budget" checkbox per booking (on by default).
- Bookings page rows say "On timetable" or "Not on timetable" (follows from item 61).

### Booking prices (agreed 2026-11-19, revised the same day)

58. **Price as known.** A price is an amount and a currency. By default it is the **whole booking (total)**. Two toggle buttons change that: **Per night** and **Per person**. Both on means per person per night. There is no "Not sure" option.
59. **Nights and people per booking.** Nights come from check-in and check-out. Each booking has its own head count, defaulting to the trip's (for example one room for 2 of 3 people).
60. **Derived figures.** The app works out the total from the price, nights and people, and the budget always uses that total. The other forms (per night, per person) show in small grey text in the booking's details only, marked as calculated; the Budget page shows totals and its per-person column.

### One item, three views (agreed 2026-11-19)

61. **Plan, Bookings and Budget show the same items.** An item (a meal, a hotel stay, shopping, a ticket, a train, anything) can have a **time** (a block in the timetable), a **booking** (confirmation, file, cancellation deadline; shown on the Bookings page) and a **cost** (shown on the Budget page). Nothing is copied between pages: editing it in one place changes it everywhere.
62. **Estimated costs.** A cost can be **Estimated** (not booked yet, for planning the budget) or **Booked**. Estimated costs can be added on any item, or directly on the Budget page. When the item is booked, the booked price replaces the estimate; the old estimate stays in faint text for comparison.
63. **Hotels in the timetable.** A hotel stay adds a check-in block and a check-out block (fixed when the hotel sets the times). Each night shows a thin band at the end of the day saying where you sleep.
64. **Booked but no time yet** (for example a reservation with only a date): the item also appears in the Place List with a booking mark, so it can be dragged into the timetable like any place.

### Budget page (agreed 2026-11-19)

52. **Plan.** One trip budget, in the home currency, split into categories, each with its own limit: Flights, Lodging, Transport, Food, Tickets, Shopping, Other. Planned, budget and left at the top, then a bar per category.
53. **Planned now, actual later.** The page shows planned costs. An "Actual" column is kept as a placeholder for spending logged during the trip, added later.
54. **Currencies.** Each cost is entered in the local currency it is paid in. A trip can use several currencies; each one gets its own column in the category table and the cost list (for example ¥ JPY, and $ USD for flights), added the first time a cost uses it. Totals and the budget are in the home currency.
55. **Home currency.** Chosen from a menu: TWD or USD for now. The top bar's running total uses it.
56. **Exchange rates are typed in by the user**, one per currency (for example "1 JPY = 0.21 TWD"). Nothing is fetched from the internet.
56a. **Adding currencies.** An "Add currency" button lets the user add any currency to the trip (for example KRW on a Japan-and-Korea trip), with its own rate. Each added currency gets its own column, and a cost's currency is picked from the trip's list.
57. **Flights count in the budget**, under their own Flights category.

Shown in the mock, still to confirm:

- A per-day chart of planned spending, stacked by category.
- A cost list, largest first, saying where each cost comes from (booking, timetable block, or travel legs) and the amount per person.

### Backend questions this raises (answered 2026-11-19, see [decisions.md](decisions.md#backend-decided-by-brady-2026-11-19))

- **Where trip data lives:** decided: local-first, sync later.
- **A small server for API keys:** decided: none yet; keys are entered in settings and kept on the device.
- **Time zones:** each day stores its local date and the city's time zone; flights cross zones.
- **Attachments** (ticket PDFs) need file storage; confirmation numbers are private and need encryption if stored in the cloud.
- **Data-source terms** limit what may be cached or where it may be shown.
- **Opening hours and special closures:** which source (Google Places or OpenStreetMap).
- **Currency rates** for the budget: source and refresh.
- **Offline during the trip:** the guide needs routes, the map area and bookings stored on the phone.
- **Undo history, several trips, sharing** later.

Still open:

- **Long place names** get cut short once the rating chip is on the row (for example "Ueno museum …"). To be solved later.

### Visual theme (agreed 2026-11-19)

The colour card is [mock/theme-options.html](mock/theme-options.html) (rendered as `.png`); its bottom row shows the chosen palette.

77. **Mood: Warm paper.** Off-white, slightly warm surfaces, soft ink text, thin warm-grey lines (paper `#FBFAF7`, panel `#F6F5F1`, line `#E2E0DA`, ink `#2B2F36`, muted `#8B9099`).
78. **Accent: Slate blue `#3F6B86`** for buttons, selection and the highlighted day on the map.
79. **One pastel palette for place types and budget categories**, so a colour means the same thing everywhere. Each colour has a pastel fill and a deeper shade of itself for lines, icons and text (pastels alone are too light for those).
    - Types: Sight sage `#CFE3D8` / `#4F7A63`, Food peach `#F3D3C2` / `#A5674A`, Café latte `#E8DCCF` / `#87684C`, Shop butter `#F1E2B8` / `#8F7430`, Museum lilac `#DCD7EC` / `#675D92`, Nature leaf `#D6E8C8` / `#56803F`, Nightlife periwinkle `#D3D6EC` / `#565C94`.
    - Budget: Food, Shopping and Tickets share the Food, Shop and Sight colours; Flights sky `#CFE0EE` / `#46708F`, Lodging rose `#ECD3DC` / `#93566B`, Transport mist `#D9DEE5` / `#5B6675`, Other stone `#E6E3DD` / `#6E6A62`.
80. **Light mode now, dark later.** All colours are named tokens (CSS variables) so a dark set can be added without rework.

## Mock

A static mock of both layouts is in [mock/layouts.html](mock/layouts.html), rendered as [mock/layouts.png](mock/layouts.png). It uses invented sample data. The Bookings and Budget pages are in [mock/pages.html](mock/pages.html), rendered as [mock/pages.png](mock/pages.png).

**The mocks' colours are older placeholders; the chosen theme is items 77–80.** Fonts and the map style are still placeholders. Only the direction for the daylight background is agreed (item 21: muted, matte, never eye-catching); its exact shades are still open. The visual theme is a separate step, after layout and behavior feel right.

## Not discussed yet (parked)

Checklist, lodging comparison, place search with auto-fill. **Trip guide: parked (2026-11-19)**; it is a question of export format, to decide later. The Bookings and Budget pages are designed in outline (items 50–57).

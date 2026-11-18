# AI change file format (draft, 2026-11-19)

How an AI changes a trip today (route A, items 72–76 in [layout-and-behavior.md](layout-and-behavior.md)). The user exports the trip, gives it to an AI (for example Claude) with a request, and the AI returns a change file. Importing it applies the changes **live**. Every change goes into the change log as one group, so the whole file can be undone in one step.

The same commands will later be offered to Claude Desktop or Claude Code through MCP (route C), so nothing here changes then.

The commands are defined in [`core/src/commands.rs`](../core/src/commands.rs); that file is the source of truth if this page and the code disagree.

## File

```json
{
  "format": "wanderlust-changes",
  "version": 1,
  "label": "Dinner ideas for 12/03",
  "commands": [
    { "op": "ratePlace", "id": "p-12", "rating": "mustGo" },
    { "op": "schedulePlace", "placeId": "p-12", "itemId": "ai-1", "date": "2026-12-03", "start": 1080 },
    { "op": "setLegMode", "from": "i-7", "to": "ai-1", "mode": "walk" },
    { "op": "setPeople", "people": 4 }
  ]
}
```

- `label` is what the change log shows for the group.
- Commands run in order. If any command fails (for example it names a place that doesn't exist), **nothing** in the file is applied and the app says which command failed and why.
- Times are minutes from midnight (`1080` = 18:00). Dates are `YYYY-MM-DD`.
- New records need new ids. Use a prefix that can't clash, for example `ai-1`, `ai-2`.

## Commands

| `op` | Fields | What it does |
| --- | --- | --- |
| `setTrip` | `name`, `startDate`, `endDate` (each optional) | Rename the trip or change its dates |
| `setPeople` | `people` | Number of people on the trip |
| `setDefaultMode` | `mode` | Trip default travel mode |
| `setHomeCurrency` | `code` | `TWD` or `USD` for now |
| `setCurrency` | `code`, `rateToHome`, `setOn` | Add a currency or change its rate |
| `removeCurrency` | `code` | Fails while costs still use it |
| `setBudget` | `total`, `limits` (category → amount) | Trip budget and category limits, home currency |
| `setDay` | `day` (`date`, `city`, `timeZone`, `utcOffsetMinutes`, `mode`) | A day's city, time zone or travel mode |
| `addPlace` | `place` | A new place in the Place List |
| `updatePlace` | `id`, `set` (fields to change; `null` clears one) | Change some fields of a place |
| `ratePlace` | `id`, `rating` | `unrated`, `forget`, `soSo`, `mustGo` |
| `removePlace` | `id` | Items that used it keep their title |
| `addItem` | `item` | Anything for the timetable, bookings or budget |
| `updateItem` | `id`, `set` | Change some fields of an item |
| `removeItem` | `id` | |
| `schedulePlace` | `placeId`, `itemId`, `date`, `start`, `end` (optional) | Put a place on the timetable (length defaults to its usual stay) |
| `moveItem` | `id`, `part` (`main`, `checkIn`, `checkOut`), `date`, `start`, `end` | Move or resize a block; fails on fixed blocks |
| `unschedule` | `id` | Take it off the timetable |
| `setFixed` | `id`, `part`, `fixed`, `reason` | Lock or unlock a block |
| `setCost` | `id`, `cost` (or `null`) | Amount, currency, `perNight`, `perPerson`, `people`, `status` (`estimated` / `booked`) |
| `setBooking` | `id`, `booking` (or `null`) | Confirmation, provider, link, date, cancellation deadline… |
| `setStay` | `id`, `stay` (or `null`) | Hotel check-in and check-out |
| `setLegMode` | `from`, `to`, `mode` (or `null`) | Travel mode for one leg |
| `confirmLegMinutes` | `from`, `to`, `minutes` | Minutes the user checked |

Modes: `drive`, `transit`, `walk`, `twoWheeler`, `cycle`, `ride`. Categories: `flights`, `lodging`, `transport`, `food`, `tickets`, `shopping`, `other`. Place types: `sight`, `food`, `cafe`, `shop`, `museum`, `nature`, `nightlife`.

Block keys in `from` / `to`: an item id, or `<item id>#checkIn` / `<item id>#checkOut` for a hotel's check-in and check-out blocks.

## Prompt to give the AI

Paste the exported trip after this prompt, then say what you want.

```text
You are editing my Wanderlust trip. The trip file (JSON) is below.

Answer with only a JSON change file in this shape, no other text:
{ "format": "wanderlust-changes", "version": 1, "label": "<short summary>", "commands": [ ... ] }

Use only these commands, with camelCase fields: setTrip, setPeople, setDefaultMode,
setHomeCurrency, setCurrency, removeCurrency, setBudget, setDay, addPlace, updatePlace,
ratePlace, removePlace, addItem, updateItem, removeItem, schedulePlace, moveItem,
unschedule, setFixed, setCost, setBooking, setStay, setLegMode, confirmLegMinutes.
Times are minutes from midnight; dates are YYYY-MM-DD. New ids start with "ai-".

Rules:
- Only refer to ids that exist in the trip or that you create earlier in the same file.
- Don't move fixed blocks (slot.fixed is true) unless I ask; unlock them first with setFixed.
- Never invent opening hours, prices or links. Leave them out if unknown.
- Keep the label short; it shows in my change log.
```

# Place import format (draft, 2026-11-19)

Before planning a trip, places come from saved social posts (Instagram and others). An AI (for example Claude) turns those posts into one JSON file in this format, and the app imports it into the trip's Place List. Places can still be added by hand at any time.

The type list follows item 81; until the core is updated (build-plan.md, start of phase 2) the importer accepts only the older seven types.

Decisions behind this (see items 66–71 in [layout-and-behavior.md](layout-and-behavior.md)):

- JSON only, with the ready-made AI prompt at the end of this page.
- **The AI asks you for each place's rating** (Must Go, So-So or Forget) before it writes the file. A place you don't rate comes in **Unrated**. Ratings can be changed or added in the app later.
- Every detail that came from the file is marked **unverified** until the user checks it.
- Import shows a **preview** first: new places, and possible duplicates (same Google Maps link, or same name and area). A duplicate only fills in details the existing place is missing.
- The source post is **kept but not shown** in the app.

## A Google Maps link alone

Allowed, but not enough on its own. A link identifies the place, and some links contain coordinates, but the name, type, area and hours need a lookup (Google's Places API: a key, network, and paid beyond its free tier). The app is offline for now, so a link-only place is imported as "details missing" until the user fills them in.

## File

```json
{
  "format": "wanderlust-places",
  "version": 1,
  "created": "2026-11-19",
  "trip_hint": "Tokyo and Kyoto, December 2026",
  "places": [
    {
      "name": "Senso-ji",
      "name_local": "浅草寺",
      "type": "sight",
      "area": "Asakusa",
      "city": "Tokyo",
      "country": "JP",
      "google_maps_url": "https://maps.app.goo.gl/example",
      "lat": 35.7148,
      "lng": 139.7967,
      "address": "2-3-1 Asakusa, Taito City, Tokyo",
      "usual_stay_minutes": 90,
      "opening_hours": {
        "mon": [["06:00", "17:00"]], "tue": [["06:00", "17:00"]], "wed": [["06:00", "17:00"]],
        "thu": [["06:00", "17:00"]], "fri": [["06:00", "17:00"]], "sat": [["06:00", "17:00"]],
        "sun": [["06:00", "17:00"]]
      },
      "hours_note": "Main hall hours; the grounds are open 24 hours.",
      "estimated_cost": { "amount": 0, "currency": "JPY", "per_person": true },
      "rating": "must",
      "tags": ["early-morning"],
      "notes": "Go early before the crowds. Nakamise street for snacks.",
      "ai_notes": "Hours taken from the post caption, not checked.",
      "source": {
        "platform": "instagram",
        "url": "https://www.instagram.com/p/example/",
        "account": "@example",
        "saved": "2026-11-02"
      }
    }
  ]
}
```

The values above are an example only; they are not checked facts.

## Fields

Only `name` is required. Anything unknown is **left out**, never guessed.

| Field | Type | Meaning |
| --- | --- | --- |
| `format`, `version` | text, number | Always `"wanderlust-places"` and `1` for this version |
| `created` | date `YYYY-MM-DD` | When the file was made |
| `trip_hint` | text | Optional: what trip the posts were collected for |
| `name` | text | **Required.** Name in English (or as commonly written in English) |
| `name_local` | text | Name in the local language, if known |
| `type` | one of `food`, `cafe`, `dessert`, `sight`, `museum`, `nature`, `nightlife`, `flight`, `train`, `bus`, `car`, `lodging`, `shopping`, `other` | The sub-category (item 81). Not `localTravel` |
| `area` | text | Neighbourhood, for example `Asakusa`. Used for grouping the Place List |
| `city` | text | City, for example `Tokyo` |
| `country` | two-letter code | ISO 3166-1, for example `JP`, `TW`, `KR` |
| `google_maps_url` | URL | Link to the place on Google Maps. The best single field for finding duplicates |
| `lat`, `lng` | numbers | Coordinates, only if known (for example read from the link) |
| `address` | text | Street address, if known |
| `usual_stay_minutes` | number | Typical visit length. The timetable uses it as the block length (item 11) |
| `opening_hours` | object | Keys `mon`…`sun`. Each is a list of `[open, close]` pairs in 24-hour `HH:MM`. `[]` means closed that day. A missing key means unknown. `[["00:00", "24:00"]]` means open all day. A close time earlier than the open time runs past midnight (`["17:00", "02:00"]`) |
| `hours_note` | text | Anything the hours can't say (holiday closures, last entry, seasonal hours) |
| `estimated_cost` | object | `amount`, `currency` (ISO 4217, for example `JPY`), `per_person` (true or false). Goes into the budget as an Estimated cost if the place is scheduled |
| `rating` | `must`, `soso` or `forget` | **Your** rating, which the AI asks you for before writing the file. Leave out for Unrated |
| `tags` | list of text | Free tags, for example `sunset`, `seasonal`, `reservation-needed`, `rainy-day` |
| `notes` | text | Tips from the post, in English |
| `ai_notes` | text | The AI's own doubts, for example "hours may be out of date" |
| `source` | object | `platform` (`instagram`, `threads`, `facebook`, `xiaohongshu`, `youtube`, `web`, `other`), `url`, `account`, `saved` (date). Kept, not shown |

One post that mentions several places becomes several entries, each with the same `source`.

## What the importer does

1. Reads the file and lists problems in words (missing name, unknown `type`, bad time format). Places with problems can still be imported; the bad field is dropped.
2. Shows the preview: new places, possible duplicates, and link-only places marked "details missing".
3. On confirm, adds new places with the rating from the file (Unrated if there is none), with every imported detail marked **unverified**, and fills only the missing details of duplicates. A duplicate keeps its existing rating, unless that place is still Unrated: then it takes the file's rating.

## Prompt to give the AI

Paste the posts (captions, screenshots or links) after this prompt.

```text
Turn the travel posts below into a JSON file for my trip planner.

Step 1. First, list the places you found (name, area, one line about each) and ask me to rate each one:
must (Must Go), soso (So-So) or forget (Forget). I may skip some. Wait for my answer.

Step 2. Then output only JSON, no other text, in this exact shape:
{ "format": "wanderlust-places", "version": 1, "created": "<today, YYYY-MM-DD>", "trip_hint": "<optional>", "places": [ ... ] }

For each place mentioned in a post, add one entry to "places" with these fields:
name (required, English), name_local, type (one of: food, cafe, dessert, sight, museum, nature, nightlife, flight, train, bus, car, lodging, shopping, other),
area (neighbourhood), city, country (two-letter code), google_maps_url, lat, lng, address,
usual_stay_minutes, opening_hours (keys mon..sun, each a list of ["HH:MM","HH:MM"] pairs, [] if closed),
hours_note, estimated_cost {amount, currency (three-letter code), per_person true/false},
rating (my rating from step 1; leave out if I skipped it), tags (list), notes (tips from the post, in English),
ai_notes (your doubts), source {platform, url, account, saved (YYYY-MM-DD)}.

Rules:
- Leave out any field you don't know. Never guess coordinates, hours, prices or links.
- Only use a Google Maps link or coordinates if they appear in the post or I gave them.
- If a post mentions several places, make one entry per place, each with the same source.
- If two posts are about the same place, make one entry and mention the second post in ai_notes.
- Put anything uncertain in ai_notes.
```

//! The app's API: a few large calls, JSON text in and out.
//!
//! `wasm.rs` exposes these to JavaScript unchanged; keeping them here, in plain
//! Rust, lets them be tested natively. Every call takes the whole trip as JSON
//! and returns JSON. Calls that change the trip return the new trip; the app
//! saves it. Errors come back as `{ "ok": false, "error": "..." }` in plain
//! words, never as a panic.

use crate::commands::{self, ChangeFile, Command, Stamp};
use crate::model::*;
use crate::time::{dates_between, Date};
use crate::{budget, import, schedule, sun, travel};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn ok(value: impl Serialize) -> String {
    let mut v = serde_json::to_value(value).unwrap_or(Value::Null);
    if let Value::Object(map) = &mut v {
        map.insert("ok".into(), Value::Bool(true));
        return v.to_string();
    }
    json!({ "ok": true, "value": v }).to_string()
}

fn fail(message: impl Into<String>) -> String {
    json!({ "ok": false, "error": message.into() }).to_string()
}

fn read_trip(text: &str) -> Result<Trip, String> {
    Trip::from_json(text)
}

/// Who made a change and when (the caller makes ids and timestamps).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StampIn {
    pub group_id: Id,
    pub at: String,
    pub label: String,
    /// Absent = the user. Present = an AI change file with this source name.
    pub ai_source: Option<String>,
    #[serde(default)]
    pub ai: bool,
}

impl StampIn {
    fn into_stamp(self) -> Stamp {
        let author = if self.ai || self.ai_source.is_some() { Author::Ai { source: self.ai_source } } else { Author::User };
        Stamp { group_id: self.group_id, author, at: self.at, label: self.label }
    }
}

// ---------- trips ----------

/// A new, empty trip.
pub fn new_trip(id: &str, name: &str, start_date: &str, end_date: &str) -> String {
    if dates_between(start_date, end_date).is_empty() {
        return fail(format!("{start_date} to {end_date} is not a valid date range."));
    }
    ok(json!({ "trip": Trip::new(id, name, start_date, end_date) }))
}

/// Check a trip file (for opening an exported trip).
pub fn open_trip(text: &str) -> String {
    match read_trip(text) {
        Ok(trip) => ok(json!({ "trip": trip })),
        Err(e) => fail(e),
    }
}

// ---------- changes and the change log ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Changed {
    trip: Trip,
}

/// Apply a list of commands as one undo step (items 72, 76).
/// On failure: `{ ok: false, error, index }` and the trip is unchanged.
pub fn apply_commands(trip_json: &str, commands_json: &str, stamp_json: &str) -> String {
    let mut trip = match read_trip(trip_json) {
        Ok(t) => t,
        Err(e) => return fail(e),
    };
    let commands: Vec<Command> = match serde_json::from_str(commands_json) {
        Ok(c) => c,
        Err(e) => return fail(format!("Those commands could not be read: {e}")),
    };
    let stamp: StampIn = match serde_json::from_str(stamp_json) {
        Ok(s) => s,
        Err(e) => return fail(format!("Missing change details: {e}")),
    };
    match commands::apply(&mut trip, &commands, stamp.into_stamp()) {
        Ok(()) => ok(Changed { trip }),
        Err(e) => json!({ "ok": false, "error": e.message, "index": e.index }).to_string(),
    }
}

/// Import an AI change file: applied live, one group in the log (item 73).
/// `source` is shown in the log, for example the file name.
pub fn apply_change_file(trip_json: &str, file_text: &str, group_id: &str, at: &str, source: &str) -> String {
    let mut trip = match read_trip(trip_json) {
        Ok(t) => t,
        Err(e) => return fail(e),
    };
    let file = match ChangeFile::from_json(file_text) {
        Ok(f) => f,
        Err(e) => return fail(e),
    };
    let label = file.label.clone().unwrap_or_else(|| format!("Changes from {source}"));
    let stamp = Stamp { group_id: group_id.into(), author: Author::Ai { source: Some(source.into()) }, at: at.into(), label };
    match commands::apply(&mut trip, &file.commands, stamp) {
        Ok(()) => ok(json!({ "trip": trip, "count": file.commands.len() })),
        Err(e) => json!({
            "ok": false,
            "error": format!("Command {} of {}: {}", e.index + 1, file.commands.len(), e.message),
            "index": e.index,
        })
        .to_string(),
    }
}

/// Undo the newest step.
pub fn undo_last(trip_json: &str) -> String {
    let mut trip = match read_trip(trip_json) {
        Ok(t) => t,
        Err(e) => return fail(e),
    };
    let undone = commands::undo_last(&mut trip).map(|g| g.label);
    ok(json!({ "trip": trip, "undone": undone }))
}

/// Undo `group_id` and everything after it (item 76).
pub fn undo_to(trip_json: &str, group_id: &str) -> String {
    let mut trip = match read_trip(trip_json) {
        Ok(t) => t,
        Err(e) => return fail(e),
    };
    let steps = commands::undo_to(&mut trip, group_id);
    if steps == 0 {
        return fail("That change is not in the log any more.");
    }
    ok(json!({ "trip": trip, "steps": steps }))
}

// ---------- Plan page ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DayView {
    date: String,
    /// `12/02`
    label: String,
    /// `Wed`
    weekday: String,
    city: Option<String>,
    /// The mode legs use on this day unless a leg says otherwise.
    mode: Mode,
    /// The day's mode differs from the trip default: show it in the header (item 34).
    mode_is_override: bool,
    blocks: Vec<schedule::Block>,
    legs: Vec<schedule::LegView>,
    night: Option<schedule::Night>,
    warnings: Vec<schedule::Warning>,
    /// Where the day is, for daylight and weather (item 22).
    location: Option<[f64; 2]>,
    sun: Option<sun::SunTimes>,
    /// Gradient stops (items 21–23). Needs a location and the day's UTC offset.
    daylight: Vec<sun::Stop>,
}

/// Everything the timetable and map need for the whole trip, in one call.
pub fn plan_view(trip_json: &str) -> String {
    let trip = match read_trip(trip_json) {
        Ok(t) => t,
        Err(e) => return fail(e),
    };
    let days: Vec<DayView> = dates_between(&trip.start_date, &trip.end_date)
        .into_iter()
        .map(|d| {
            let date = d.to_string();
            let info = trip.day(&date);
            let mode = trip.default_mode_on(&date);
            let location = schedule::day_location(&trip, &date);
            let offset = info.and_then(|i| i.utc_offset_minutes);
            let (sun_times, daylight) = match (location, offset) {
                (Some((lat, lng)), Some(off)) => (Some(sun::sun_times(lat, lng, d, off)), sun::daylight_stops_at(lat, lng, d, off)),
                _ => (None, Vec::new()),
            };
            DayView {
                label: d.month_day(),
                weekday: d.weekday_short().into(),
                city: info.and_then(|i| i.city.clone()),
                mode,
                mode_is_override: mode != trip.settings.default_mode,
                blocks: schedule::blocks_on(&trip, &date),
                legs: schedule::legs_on(&trip, &date),
                night: schedule::night_on(&trip, &date),
                warnings: schedule::warnings_on(&trip, &date),
                location: location.map(|(a, b)| [a, b]),
                sun: sun_times,
                daylight,
                date,
            }
        })
        .collect();
    ok(json!({ "days": days }))
}

/// Dragging a place from the Place List (items 27, 29, 30).
pub fn drag_preview(trip_json: &str, place_id: &str, date: &str, start: u32, end: u32) -> String {
    match read_trip(trip_json) {
        Ok(trip) if trip.place(place_id).is_some() => ok(schedule::drag_preview(&trip, place_id, date, start, end)),
        Ok(_) => fail(format!("There is no place \"{place_id}\".")),
        Err(e) => fail(e),
    }
}

/// Moving or resizing a block already on the timetable.
pub fn move_preview(trip_json: &str, block_key: &str, date: &str, start: u32, end: u32) -> String {
    match read_trip(trip_json) {
        Ok(trip) => ok(schedule::move_preview(&trip, block_key, date, start, end)),
        Err(e) => fail(e),
    }
}

// ---------- Budget and Bookings ----------

pub fn budget_summary(trip_json: &str) -> String {
    match read_trip(trip_json) {
        Ok(trip) => ok(budget::summary(&trip)),
        Err(e) => fail(e),
    }
}

/// A booking's price: total and calculated forms (item 60).
pub fn cost_forms(trip_json: &str, item_id: &str) -> String {
    let trip = match read_trip(trip_json) {
        Ok(t) => t,
        Err(e) => return fail(e),
    };
    let Some(item) = trip.item(item_id) else { return fail(format!("There is no item \"{item_id}\".")) };
    ok(json!({ "forms": budget::cost_forms(&trip, item) }))
}

// ---------- place import ----------

/// What a place import would do (item 70). Nothing changes.
pub fn import_preview(trip_json: &str, file_text: &str) -> String {
    let trip = match read_trip(trip_json) {
        Ok(t) => t,
        Err(e) => return fail(e),
    };
    match import::read(file_text) {
        Ok(file) => ok(import::preview(&trip, &file)),
        Err(e) => fail(e),
    }
}

/// Import places: applied as one step in the change log.
pub fn import_places(trip_json: &str, file_text: &str, id_prefix: &str, stamp_json: &str) -> String {
    let mut trip = match read_trip(trip_json) {
        Ok(t) => t,
        Err(e) => return fail(e),
    };
    let file = match import::read(file_text) {
        Ok(f) => f,
        Err(e) => return fail(e),
    };
    let stamp: StampIn = match serde_json::from_str(stamp_json) {
        Ok(s) => s,
        Err(e) => return fail(format!("Missing change details: {e}")),
    };
    let commands = import::to_commands(&trip, &file, id_prefix);
    match commands::apply(&mut trip, &commands, stamp.into_stamp()) {
        Ok(()) => ok(json!({ "trip": trip, "count": commands.len() })),
        Err(e) => fail(e.message),
    }
}

// ---------- small helpers for the UI ----------

/// Sun times and gradient stops for any place and date.
pub fn daylight(lat: f64, lng: f64, date: &str, utc_offset_minutes: i32) -> String {
    let Some(d) = Date::parse(date) else { return fail(format!("\"{date}\" is not a date (YYYY-MM-DD).")) };
    ok(json!({
        "sun": sun::sun_times(lat, lng, d, utc_offset_minutes),
        "stops": sun::daylight_stops_at(lat, lng, d, utc_offset_minutes),
    }))
}

/// Coordinates from a Google Maps link, if it has any.
pub fn coords_from_maps_url(text: &str) -> String {
    ok(json!({ "coords": travel::coords_from_maps_url(text).map(|(a, b)| [a, b]) }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn value(s: &str) -> Value {
        serde_json::from_str(s).unwrap()
    }

    fn trip_text() -> String {
        value(&new_trip("t1", "Tokyo", "2026-12-02", "2026-12-04"))["trip"].to_string()
    }

    #[test]
    fn applies_commands_and_undoes_them() {
        let stamp = r#"{ "groupId": "g1", "at": "2026-11-19T10:00:00Z", "label": "Add Senso-ji" }"#;
        let cmds = r#"[ { "op": "addPlace", "place": { "id": "p1", "name": "Senso-ji", "kind": "sight", "lat": 35.7148, "lng": 139.7967 } },
                       { "op": "schedulePlace", "placeId": "p1", "itemId": "i1", "date": "2026-12-02", "start": 540 } ]"#;
        let out = value(&apply_commands(&trip_text(), cmds, stamp));
        assert_eq!(out["ok"], true, "{out}");
        let trip = out["trip"].to_string();
        let plan = value(&plan_view(&trip));
        assert_eq!(plan["days"][0]["blocks"][0]["title"], "Senso-ji");
        assert_eq!(plan["days"][0]["label"], "12/02");
        let undone = value(&undo_last(&trip));
        assert_eq!(undone["undone"], "Add Senso-ji");
        assert_eq!(undone["trip"]["places"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn reports_a_bad_command_in_plain_words() {
        let stamp = r#"{ "groupId": "g1", "at": "x", "label": "x" }"#;
        let cmds = r#"[ { "op": "ratePlace", "id": "nope", "rating": "mustGo" } ]"#;
        let out = value(&apply_commands(&trip_text(), cmds, stamp));
        assert_eq!(out["ok"], false);
        assert_eq!(out["error"], "There is no place \"nope\".");
        assert_eq!(out["index"], 0);
    }

    #[test]
    fn change_files_are_logged_as_ai() {
        let file = r#"{ "format": "wanderlust-changes", "version": 1, "label": "More people", "commands": [ { "op": "setPeople", "people": 4 } ] }"#;
        let out = value(&apply_change_file(&trip_text(), file, "g1", "x", "people.json"));
        assert_eq!(out["trip"]["settings"]["people"], 4);
        assert_eq!(out["trip"]["log"][0]["author"]["type"], "ai");
        assert_eq!(out["trip"]["log"][0]["author"]["source"], "people.json");
    }

    #[test]
    fn daylight_needs_a_valid_date() {
        assert_eq!(value(&daylight(35.68, 139.76, "12/02", 540))["ok"], false);
        assert_eq!(value(&daylight(35.68, 139.76, "2026-12-02", 540))["ok"], true);
    }

    #[test]
    fn rejects_a_file_that_is_not_a_trip() {
        assert_eq!(value(&open_trip("{}"))["ok"], false);
        assert_eq!(value(&plan_view("not json"))["ok"], false);
    }
}

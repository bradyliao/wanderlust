//! Place import: `wanderlust-places` version 1 (docs/import-format.md,
//! items 17a, 17b, 66–71 in docs/layout-and-behavior.md).
//!
//! Three steps, all without touching the trip:
//! 1. [`read`] parses the file forgivingly. A bad field is dropped with a
//!    problem in plain words and the place is kept; a place without a name is
//!    skipped. Only an unreadable file or a wrong format or version fails.
//! 2. [`preview`] compares it with a trip: new places, link-only places
//!    ("details missing"), and possible duplicates (same Google Maps link, or
//!    same name and same area) with the fields each would fill.
//! 3. [`to_commands`] turns it into `AddPlace` and `UpdatePlace` commands for
//!    `commands::apply`, so the whole import is one undo step.
//!
//! Every detail that came from the file is listed in `Place::unverified`
//! (item 69). Duplicates only fill fields the existing place is missing and
//! never change its rating (item 70). The source post is kept (item 71).

use crate::commands::Command;
use crate::model::*;
use crate::time::{parse_hhmm, Date};
use crate::travel::coords_from_maps_url;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub const PLACES_FORMAT: &str = "wanderlust-places";
pub const PLACES_VERSION: u32 = 1;

/// Longest usual stay the importer accepts, in minutes (a whole day).
const MAX_STAY_MINUTES: u32 = 1440;

// ---------- the file, as written in docs/import-format.md ----------

/// One place entry, with the file's own (snake_case) field names. After
/// [`read`] every field present has been checked.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct FilePlace {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name_local: Option<String>,
    /// `sight`, `food`, `cafe`, `shop`, `museum`, `nature` or `nightlife`.
    #[serde(rename = "type", default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<PlaceType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub area: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    /// Two-letter code, upper case after reading.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub google_maps_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lat: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lng: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usual_stay_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opening_hours: Option<FileHours>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hours_note: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub estimated_cost: Option<FileCost>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rating: Option<FileRating>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<FileSource>,
}

/// `[open, close]` pairs in `HH:MM` per weekday. A missing day is unknown,
/// `[]` is closed.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct FileHours {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mon: Option<Vec<[String; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tue: Option<Vec<[String; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wed: Option<Vec<[String; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thu: Option<Vec<[String; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fri: Option<Vec<[String; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sat: Option<Vec<[String; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sun: Option<Vec<[String; 2]>>,
}

const WEEKDAYS: [&str; 7] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

impl FileHours {
    fn day_mut(&mut self, weekday: usize) -> &mut Option<Vec<[String; 2]>> {
        match weekday {
            0 => &mut self.mon,
            1 => &mut self.tue,
            2 => &mut self.wed,
            3 => &mut self.thu,
            4 => &mut self.fri,
            5 => &mut self.sat,
            _ => &mut self.sun,
        }
    }

    fn day(&self, weekday: usize) -> &Option<Vec<[String; 2]>> {
        match weekday {
            0 => &self.mon,
            1 => &self.tue,
            2 => &self.wed,
            3 => &self.thu,
            4 => &self.fri,
            5 => &self.sat,
            _ => &self.sun,
        }
    }

    /// The model's opening hours. Times were checked by [`read`]; any that
    /// still fail to parse leave that day unknown.
    pub fn to_model(&self) -> OpeningHours {
        let mut out = OpeningHours::default();
        for (i, _) in WEEKDAYS.iter().enumerate() {
            let ranges = self.day(i).as_ref().and_then(|pairs| {
                pairs
                    .iter()
                    .map(|[o, c]| Some(TimeRange { open: parse_hhmm(o)?, close: parse_hhmm(c)? }))
                    .collect::<Option<Vec<_>>>()
            });
            out.set_weekday(i as u8, ranges);
        }
        out
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FileCost {
    pub amount: f64,
    /// ISO 4217, upper case after reading.
    pub currency: String,
    /// `None` when the file leaves it out.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub per_person: Option<bool>,
}

/// The user's rating as the file writes it (item 68).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileRating {
    Must,
    Soso,
    Forget,
}

impl FileRating {
    pub fn to_model(self) -> Rating {
        match self {
            FileRating::Must => Rating::MustGo,
            FileRating::Soso => Rating::SoSo,
            FileRating::Forget => Rating::Forget,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct FileSource {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub saved: Option<String>,
}

// ---------- read ----------

/// A file after [`read`]: the places that can be imported and the problems found.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFile {
    pub created: Option<String>,
    pub trip_hint: Option<String>,
    pub entries: Vec<ImportEntry>,
    /// Plain-English messages, in file order.
    pub problems: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportEntry {
    /// Position in the file's `places` list, counting from 1 (as in problems).
    pub number: usize,
    pub place: FilePlace,
}

/// Read a `wanderlust-places` file. Fails only when the text is not JSON, is
/// not this format, or is a version this app can't read.
pub fn read(text: &str) -> Result<ImportFile, String> {
    let root: Value = serde_json::from_str(text).map_err(|e| format!("This file is not valid JSON ({e})."))?;
    let root = root.as_object().ok_or("This is not a Wanderlust places file: it should be one JSON object.")?;
    match root.get("format").and_then(Value::as_str) {
        Some(PLACES_FORMAT) => {}
        Some(other) => return Err(format!("This is not a Wanderlust places file: its format is \"{other}\", expected \"{PLACES_FORMAT}\".")),
        None => return Err(format!("This is not a Wanderlust places file: it has no \"format\": \"{PLACES_FORMAT}\".")),
    }
    match root.get("version").and_then(Value::as_u64) {
        Some(v) if v == u64::from(PLACES_VERSION) => {}
        Some(v) if v > u64::from(PLACES_VERSION) => {
            return Err(format!("This places file is version {v}; this app reads version {PLACES_VERSION}. It was made for a newer Wanderlust."))
        }
        Some(v) => return Err(format!("This places file is version {v}; this app reads version {PLACES_VERSION}.")),
        None => return Err("This places file has no version number.".into()),
    }

    let mut problems = Vec::new();
    let created = match root.get("created") {
        None | Some(Value::Null) => None,
        Some(Value::String(s)) if Date::parse(s).is_some() => Some(s.trim().to_string()),
        Some(_) => {
            problems.push("The file's created date is not YYYY-MM-DD.".to_string());
            None
        }
    };
    let trip_hint = root.get("trip_hint").and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty()).map(String::from);
    let places = root
        .get("places")
        .and_then(Value::as_array)
        .ok_or("This places file has no \"places\" list.")?;

    let mut entries = Vec::new();
    for (i, value) in places.iter().enumerate() {
        let number = i + 1;
        if let Some(place) = read_place(number, value, &mut problems) {
            entries.push(ImportEntry { number, place });
        }
    }
    Ok(ImportFile { created, trip_hint, entries, problems })
}

const PLACE_KEYS: [&str; 19] = [
    "name",
    "name_local",
    "type",
    "area",
    "city",
    "country",
    "google_maps_url",
    "lat",
    "lng",
    "address",
    "usual_stay_minutes",
    "opening_hours",
    "hours_note",
    "estimated_cost",
    "rating",
    "tags",
    "notes",
    "ai_notes",
    "source",
];

/// Problems for one place, prefixed with "Place 3 (Senso-ji): ".
struct Problems<'a> {
    label: String,
    out: &'a mut Vec<String>,
}

impl Problems<'_> {
    fn add(&mut self, msg: impl AsRef<str>) {
        self.out.push(format!("{}: {}", self.label, msg.as_ref()));
    }
}

fn read_place(number: usize, value: &Value, problems: &mut Vec<String>) -> Option<FilePlace> {
    let Some(obj) = value.as_object() else {
        problems.push(format!("Place {number} is not an object of fields, so it was skipped."));
        return None;
    };
    let name = match obj.get("name") {
        Some(Value::String(s)) if !s.trim().is_empty() => s.trim().to_string(),
        _ => {
            problems.push(format!("Place {number} has no name, so it was skipped."));
            return None;
        }
    };
    let mut p = Problems { label: format!("Place {number} ({name})"), out: problems };

    for key in obj.keys() {
        if !PLACE_KEYS.contains(&key.as_str()) {
            p.add(format!("the field \"{key}\" is not part of the format and was ignored."));
        }
    }

    let mut place = FilePlace { name, ..FilePlace::default() };
    place.name_local = text(obj, "name_local", "the local name", &mut p);
    place.area = text(obj, "area", "the area", &mut p);
    place.city = text(obj, "city", "the city", &mut p);
    place.address = text(obj, "address", "the address", &mut p);
    place.hours_note = text(obj, "hours_note", "the hours note", &mut p);
    place.notes = text(obj, "notes", "the notes", &mut p);
    place.ai_notes = text(obj, "ai_notes", "the AI notes", &mut p);

    if let Some(v) = present(obj, "type") {
        match typed::<PlaceType>(v) {
            Some(kind) => place.kind = Some(kind),
            None => p.add(format!(
                "the type {} is not one of sight, food, cafe, shop, museum, nature, nightlife.",
                shown(v)
            )),
        }
    }

    if let Some(v) = present(obj, "country") {
        match v.as_str().map(str::trim) {
            Some(c) if c.len() == 2 && c.chars().all(|ch| ch.is_ascii_alphabetic()) => {
                place.country = Some(c.to_ascii_uppercase())
            }
            _ => p.add(format!("the country {} is not a two-letter code such as JP.", shown(v))),
        }
    }

    if let Some(v) = present(obj, "google_maps_url") {
        match v.as_str().map(str::trim) {
            Some(u) if u.starts_with("https://") || u.starts_with("http://") => place.google_maps_url = Some(u.to_string()),
            _ => p.add("the Google Maps link is not a web address."),
        }
    }

    let lat = coordinate(obj, "lat", 90.0, &mut p);
    let lng = coordinate(obj, "lng", 180.0, &mut p);
    match (lat, lng) {
        (Some(a), Some(b)) => {
            place.lat = Some(a);
            place.lng = Some(b);
        }
        (Some(_), None) if present(obj, "lng").is_none() => p.add("it has lat but no lng, so the coordinates were left out."),
        (None, Some(_)) if present(obj, "lat").is_none() => p.add("it has lng but no lat, so the coordinates were left out."),
        (Some(_), None) | (None, Some(_)) => p.add("only one coordinate was usable, so the coordinates were left out."),
        (None, None) => {}
    }

    if let Some(v) = present(obj, "usual_stay_minutes") {
        match v.as_u64() {
            Some(m) if (1..=u64::from(MAX_STAY_MINUTES)).contains(&m) => place.usual_stay_minutes = Some(m as u32),
            _ => p.add(format!("the usual stay {} is not a number of minutes between 1 and {MAX_STAY_MINUTES}.", shown(v))),
        }
    }

    if let Some(v) = present(obj, "opening_hours") {
        place.opening_hours = hours(v, &mut p);
    }

    if let Some(v) = present(obj, "estimated_cost") {
        place.estimated_cost = cost(v, &mut p);
    }

    if let Some(v) = present(obj, "rating") {
        match typed::<FileRating>(v) {
            Some(r) => place.rating = Some(r),
            None => p.add(format!("the rating {} is not must, soso or forget, so the place comes in Unrated.", shown(v))),
        }
    }

    if let Some(v) = present(obj, "tags") {
        match v.as_array() {
            Some(list) => {
                let mut dropped = false;
                for t in list {
                    match t.as_str().map(str::trim) {
                        Some(s) if !s.is_empty() => {
                            if !place.tags.iter().any(|x| x == s) {
                                place.tags.push(s.to_string());
                            }
                        }
                        Some(_) => {}
                        None => dropped = true,
                    }
                }
                if dropped {
                    p.add("some tags are not text and were left out.");
                }
            }
            None => p.add("the tags are not a list of text."),
        }
    }

    if let Some(v) = present(obj, "source") {
        match v.as_object() {
            Some(s) => {
                let mut source = FileSource::default();
                let mut bad = false;
                for (key, slot) in [
                    ("platform", &mut source.platform),
                    ("url", &mut source.url),
                    ("account", &mut source.account),
                    ("saved", &mut source.saved),
                ] {
                    match s.get(key) {
                        None | Some(Value::Null) => {}
                        Some(Value::String(x)) if !x.trim().is_empty() => *slot = Some(x.trim().to_string()),
                        Some(Value::String(_)) => {}
                        Some(_) => bad = true,
                    }
                }
                if bad {
                    p.add("some source fields are not text and were left out.");
                }
                if source != FileSource::default() {
                    place.source = Some(source);
                }
            }
            None => p.add("the source is not an object with platform, url, account and saved."),
        }
    }

    Some(place)
}

/// A field that is there and not `null`.
fn present<'a>(obj: &'a Map<String, Value>, key: &str) -> Option<&'a Value> {
    obj.get(key).filter(|v| !v.is_null())
}

fn typed<T: DeserializeOwned>(v: &Value) -> Option<T> {
    serde_json::from_value(v.clone()).ok()
}

/// A value as it appears in a message: strings quoted, others as JSON.
fn shown(v: &Value) -> String {
    let s = v.to_string();
    if s.chars().count() > 40 {
        format!("{}…", s.chars().take(40).collect::<String>())
    } else {
        s
    }
}

/// An optional text field. Blank text counts as left out.
fn text(obj: &Map<String, Value>, key: &str, what: &str, p: &mut Problems) -> Option<String> {
    match present(obj, key)? {
        Value::String(s) => Some(s.trim().to_string()).filter(|s| !s.is_empty()),
        _ => {
            p.add(format!("{what} is not text."));
            None
        }
    }
}

fn coordinate(obj: &Map<String, Value>, key: &str, limit: f64, p: &mut Problems) -> Option<f64> {
    let v = present(obj, key)?;
    match v.as_f64() {
        Some(x) if x.is_finite() && x.abs() <= limit => Some(x),
        _ => {
            p.add(format!("{key} {} is not a number between -{limit} and {limit}.", shown(v)));
            None
        }
    }
}

fn hours(v: &Value, p: &mut Problems) -> Option<FileHours> {
    let Some(obj) = v.as_object() else {
        p.add("the opening hours are not an object with keys mon to sun.");
        return None;
    };
    let mut out = FileHours::default();
    for key in obj.keys() {
        if !WEEKDAYS.contains(&key.as_str()) {
            p.add(format!("opening hours have an unknown day \"{key}\" (use mon to sun)."));
        }
    }
    for (i, day) in WEEKDAYS.iter().enumerate() {
        let Some(v) = present(obj, day) else { continue };
        match day_ranges(v) {
            Some(ranges) => *out.day_mut(i) = Some(ranges),
            None => p.add(format!("opening hours for {day} are not HH:MM.")),
        }
    }
    let empty = WEEKDAYS.iter().enumerate().all(|(i, _)| out.day(i).is_none());
    (!empty).then_some(out)
}

/// `[["06:00", "17:00"], …]` with every time valid. An open time of 24:00
/// is not allowed; a close time of 24:00 is.
fn day_ranges(v: &Value) -> Option<Vec<[String; 2]>> {
    let pairs: Vec<[String; 2]> = typed(v)?;
    let mut out = Vec::with_capacity(pairs.len());
    for [o, c] in pairs {
        let open = parse_hhmm(&o)?;
        parse_hhmm(&c)?;
        if open >= 1440 {
            return None;
        }
        out.push([o.trim().to_string(), c.trim().to_string()]);
    }
    Some(out)
}

fn cost(v: &Value, p: &mut Problems) -> Option<FileCost> {
    let bad = |p: &mut Problems| {
        p.add("the estimated cost needs an amount of 0 or more and a three-letter currency such as JPY.");
        None
    };
    let Some(obj) = v.as_object() else { return bad(p) };
    let amount = match obj.get("amount").and_then(Value::as_f64) {
        Some(a) if a.is_finite() && a >= 0.0 => a,
        _ => return bad(p),
    };
    let currency = match obj.get("currency").and_then(Value::as_str).map(str::trim) {
        Some(c) if c.len() == 3 && c.chars().all(|ch| ch.is_ascii_alphabetic()) => c.to_ascii_uppercase(),
        _ => return bad(p),
    };
    let per_person = match present(obj, "per_person") {
        None => None,
        Some(Value::Bool(b)) => Some(*b),
        Some(_) => {
            p.add("per_person in the estimated cost is not true or false, so it was left out.");
            None
        }
    };
    Some(FileCost { amount, currency, per_person })
}

// ---------- preview ----------

/// What an import would do to a trip, for the confirm screen (item 70). The
/// three place lists don't overlap; `new_places` and `link_only` are added.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub new_places: Vec<PreviewPlace>,
    /// Added with "details missing": only a name and a Google Maps link (item 67).
    pub link_only: Vec<PreviewPlace>,
    pub duplicates: Vec<PreviewDuplicate>,
    pub problems: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewPlace {
    /// The place's number in the file.
    pub number: usize,
    pub name: String,
    pub area: Option<String>,
    /// `None` when the file gave no type.
    pub kind: Option<PlaceType>,
    pub rating: Rating,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewDuplicate {
    pub number: usize,
    pub name: String,
    pub matched_by: MatchedBy,
    /// The place already in the trip, or …
    pub existing_place_id: Option<Id>,
    /// … an earlier place in the same file, by its number.
    pub same_as_number: Option<usize>,
    pub existing_name: String,
    /// Fields it would fill (Place field names), in the order of `Place`.
    /// Empty: nothing new.
    pub fills: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MatchedBy {
    /// Same Google Maps link.
    Link,
    /// Same name and same area, ignoring case and outer spaces.
    NameAndArea,
}

pub fn preview(trip: &Trip, file: &ImportFile) -> Preview {
    let plan = plan(trip, file);
    let mut new_places = Vec::new();
    let mut link_only = Vec::new();
    for k in &plan.known {
        let Origin::Entry(number) = k.origin else { continue };
        let row = PreviewPlace {
            number,
            name: k.place.name.clone(),
            area: k.place.area.clone(),
            kind: k.kind_known.then_some(k.place.kind),
            rating: k.place.rating,
        };
        if k.link_only {
            link_only.push(row);
        } else {
            new_places.push(row);
        }
    }
    Preview { new_places, link_only, duplicates: plan.duplicates, problems: file.problems.clone() }
}

// ---------- commands ----------

/// Commands for the whole import, to run with `commands::apply` as one step:
/// `AddPlace` for new places (ids `"{id_prefix}-1"`, `-2`, … skipping ids the
/// trip already uses), then `UpdatePlace` for duplicates of trip places that
/// have something to fill. Duplicates within the file are merged into the
/// first entry's `AddPlace`.
pub fn to_commands(trip: &Trip, file: &ImportFile, id_prefix: &str) -> Vec<Command> {
    let plan = plan(trip, file);
    let mut commands = Vec::new();
    let mut n = 0;
    for k in plan.known {
        if let Origin::Entry(_) = k.origin {
            let id = loop {
                n += 1;
                let id = format!("{id_prefix}-{n}");
                if trip.place(&id).is_none() {
                    break id;
                }
            };
            let mut place = k.place;
            place.id = id;
            commands.push(Command::AddPlace { place });
        }
    }
    for (id, set) in plan.updates {
        commands.push(Command::UpdatePlace { id, set: Value::Object(set) });
    }
    commands
}

// ---------- planning (shared by preview and to_commands) ----------

enum Origin {
    Trip,
    Entry(usize),
}

struct Known {
    place: Place,
    origin: Origin,
    link_only: bool,
    /// The type came from the file (else `place.kind` is a stand-in).
    kind_known: bool,
}

struct Plan {
    /// Trip places, then the file's new places, as they will be after import.
    known: Vec<Known>,
    updates: Vec<(Id, Map<String, Value>)>,
    duplicates: Vec<PreviewDuplicate>,
}

fn plan(trip: &Trip, file: &ImportFile) -> Plan {
    let mut known: Vec<Known> = trip
        .places
        .iter()
        .map(|p| Known { place: p.clone(), origin: Origin::Trip, link_only: false, kind_known: true })
        .collect();
    let mut updates = Vec::new();
    let mut duplicates = Vec::new();

    for entry in &file.entries {
        let draft = draft_place(&entry.place);
        let link_only = is_link_only(&entry.place);
        let Some((i, matched_by)) = find_match(&known, &draft) else {
            known.push(Known { place: draft, origin: Origin::Entry(entry.number), link_only, kind_known: entry.place.kind.is_some() });
            continue;
        };
        let target = &mut known[i];
        let (mut fills, source_filled, rating_filled) = fill(&mut target.place, &draft);
        if rating_filled {
            fills.push("rating".into());
        }
        if !fills.is_empty() {
            target.link_only = target.link_only && link_only;
        }
        let (existing_place_id, same_as_number) = match target.origin {
            Origin::Trip => {
                if !fills.is_empty() || source_filled {
                    let doc = serde_json::to_value(&target.place).expect("a place always serialises");
                    let doc = doc.as_object().expect("a place is an object");
                    let mut set = Map::new();
                    let extra: &[&str] = if source_filled { &["unverified", "source"] } else { &["unverified"] };
                    for key in fills.iter().map(String::as_str).chain(extra.iter().copied()) {
                        set.insert(key.to_string(), doc.get(key).cloned().unwrap_or(Value::Null));
                    }
                    updates.push((target.place.id.clone(), set));
                }
                (Some(target.place.id.clone()), None)
            }
            Origin::Entry(n) => (None, Some(n)),
        };
        duplicates.push(PreviewDuplicate {
            number: entry.number,
            name: draft.name.clone(),
            matched_by,
            existing_place_id,
            same_as_number,
            existing_name: target.place.name.clone(),
            fills,
        });
    }
    Plan { known, updates, duplicates }
}

/// A new place from a file entry, with an empty id. `unverified` lists every
/// field that came from the file; coordinates read from the link count too.
/// With no type in the file the kind is Sight, listed as unverified.
fn draft_place(f: &FilePlace) -> Place {
    let (lat, lng) = match (f.lat, f.lng) {
        (Some(a), Some(b)) => (Some(a), Some(b)),
        _ => match f.google_maps_url.as_deref().and_then(coords_from_maps_url) {
            Some((a, b)) => (Some(a), Some(b)),
            None => (None, None),
        },
    };
    let notes = f.notes.clone();
    let mut place = Place {
        id: String::new(),
        name: f.name.clone(),
        name_local: f.name_local.clone(),
        kind: f.kind.unwrap_or(PlaceType::Sight),
        area: f.area.clone(),
        city: f.city.clone(),
        country: f.country.clone(),
        google_maps_url: f.google_maps_url.clone(),
        lat,
        lng,
        address: f.address.clone(),
        usual_stay_minutes: f.usual_stay_minutes,
        opening_hours: f.opening_hours.as_ref().map(FileHours::to_model),
        hours_note: f.hours_note.clone(),
        estimated_cost: f.estimated_cost.as_ref().map(|c| PlaceCost { amount: c.amount, currency: c.currency.clone(), per_person: c.per_person.unwrap_or(false) }),
        rating: f.rating.map(FileRating::to_model).unwrap_or_default(),
        tags: f.tags.clone(),
        notes,
        ai_notes: f.ai_notes.clone(),
        unverified: Vec::new(),
        source: f.source.as_ref().map(|s| Source {
            platform: s.platform.clone(),
            url: s.url.clone(),
            account: s.account.clone(),
            saved: s.saved.clone(),
        }),
        updated_at: None,
    };
    place.unverified = filled_fields(&place);
    place
}

/// Names of the fields a draft place has filled, in `Place` order. The
/// rating is the user's own and the source is not a detail, so neither is listed.
fn filled_fields(p: &Place) -> Vec<String> {
    let checks: [(&str, bool); 17] = [
        ("name", true),
        ("nameLocal", p.name_local.is_some()),
        ("kind", true),
        ("area", p.area.is_some()),
        ("city", p.city.is_some()),
        ("country", p.country.is_some()),
        ("googleMapsUrl", p.google_maps_url.is_some()),
        ("lat", p.lat.is_some()),
        ("lng", p.lng.is_some()),
        ("address", p.address.is_some()),
        ("usualStayMinutes", p.usual_stay_minutes.is_some()),
        ("openingHours", p.opening_hours.is_some()),
        ("hoursNote", p.hours_note.is_some()),
        ("estimatedCost", p.estimated_cost.is_some()),
        ("tags", !p.tags.is_empty()),
        ("notes", p.notes.is_some()),
        ("aiNotes", p.ai_notes.is_some()),
    ];
    checks.iter().filter(|(_, on)| *on).map(|(k, _)| k.to_string()).collect()
}

/// Only a name and a Google Maps link: nothing that says what or where the
/// place is (tags, notes, rating and source don't count).
fn is_link_only(f: &FilePlace) -> bool {
    f.google_maps_url.is_some()
        && f.name_local.is_none()
        && f.kind.is_none()
        && f.area.is_none()
        && f.city.is_none()
        && f.country.is_none()
        && f.lat.is_none()
        && f.address.is_none()
        && f.usual_stay_minutes.is_none()
        && f.opening_hours.is_none()
        && f.hours_note.is_none()
        && f.estimated_cost.is_none()
}

fn norm_link(s: &str) -> &str {
    s.trim().trim_end_matches('/')
}

fn norm_text(s: &str) -> String {
    s.trim().to_lowercase()
}

/// First by Google Maps link, then by name and area (both areas needed).
fn find_match(known: &[Known], draft: &Place) -> Option<(usize, MatchedBy)> {
    if let Some(link) = draft.google_maps_url.as_deref().map(norm_link) {
        if let Some(i) = known.iter().position(|k| k.place.google_maps_url.as_deref().map(norm_link) == Some(link)) {
            return Some((i, MatchedBy::Link));
        }
    }
    let area = norm_text(draft.area.as_deref()?);
    let name = norm_text(&draft.name);
    known
        .iter()
        .position(|k| norm_text(&k.place.name) == name && k.place.area.as_deref().map(norm_text) == Some(area.clone()))
        .map(|i| (i, MatchedBy::NameAndArea))
}

/// Fill the fields `existing` is missing from `new`. Returns the filled field
/// names (appended to `existing.unverified`) and whether the source was filled.
/// Name and type are never changed. The rating is taken only when the
/// existing place is still Unrated (it is the user's own, so it is not listed
/// as unverified); the caller adds it to the update.
fn fill(existing: &mut Place, new: &Place) -> (Vec<String>, bool, bool) {
    let mut filled: Vec<&str> = Vec::new();
    macro_rules! fill_opt {
        ($field:ident, $name:literal) => {
            if existing.$field.is_none() && new.$field.is_some() {
                existing.$field = new.$field.clone();
                filled.push($name);
            }
        };
    }
    fill_opt!(name_local, "nameLocal");
    fill_opt!(area, "area");
    fill_opt!(city, "city");
    fill_opt!(country, "country");
    fill_opt!(google_maps_url, "googleMapsUrl");
    if !existing.has_position() && new.has_position() {
        existing.lat = new.lat;
        existing.lng = new.lng;
        filled.extend(["lat", "lng"]);
    }
    fill_opt!(address, "address");
    fill_opt!(usual_stay_minutes, "usualStayMinutes");
    let hours_unknown = existing.opening_hours.as_ref().is_none_or(|h| *h == OpeningHours::default());
    if hours_unknown && new.opening_hours.is_some() {
        existing.opening_hours = new.opening_hours.clone();
        filled.push("openingHours");
    }
    fill_opt!(hours_note, "hoursNote");
    fill_opt!(estimated_cost, "estimatedCost");
    if existing.tags.is_empty() && !new.tags.is_empty() {
        existing.tags = new.tags.clone();
        filled.push("tags");
    }
    fill_opt!(notes, "notes");
    fill_opt!(ai_notes, "aiNotes");
    let rating_filled = existing.rating == Rating::Unrated && new.rating != Rating::Unrated;
    if rating_filled {
        existing.rating = new.rating;
    }
    let source_filled = existing.source.is_none() && new.source.is_some();
    if source_filled {
        existing.source = new.source.clone();
    }
    for f in &filled {
        if !existing.unverified.iter().any(|u| u == f) {
            existing.unverified.push(f.to_string());
        }
    }
    (filled.into_iter().map(String::from).collect(), source_filled, rating_filled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::{apply, Stamp};
    use serde_json::json;

    fn trip_with_places() -> Trip {
        let mut t = Trip::new("t1", "Tokyo & Kyoto", "2026-12-02", "2026-12-06");
        // Already in the list, with the same link as file place 2.
        t.places.push(
            serde_json::from_value(json!({
                "id": "p1", "name": "Shibuya Sky", "kind": "sight", "area": "Shibuya",
                "googleMapsUrl": "https://maps.app.goo.gl/shibuyasky", "rating": "soSo",
                "usualStayMinutes": 60
            }))
            .unwrap(),
        );
        // Same name and area as file place 3, but different case and spaces.
        t.places.push(
            serde_json::from_value(json!({
                "id": "p2", "name": "Koffee Mameya", "kind": "cafe", "area": "Omotesando",
                "rating": "mustGo", "notes": "Booked by Brady's friend."
            }))
            .unwrap(),
        );
        // Takes the first id the importer would make.
        t.places.push(serde_json::from_value(json!({ "id": "imp-1", "name": "Tokyo Tower", "kind": "sight" })).unwrap());
        t
    }

    fn sample_file() -> String {
        json!({
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
                    "country": "jp",
                    "google_maps_url": "https://maps.app.goo.gl/sensoji",
                    "lat": 35.7148,
                    "lng": 139.7967,
                    "usual_stay_minutes": 90,
                    "opening_hours": {
                        "mon": [["06:00", "17:00"]], "tue": [["6:00", "17:00"]], "wed": [],
                        "sun": [["00:00", "24:00"]]
                    },
                    "estimated_cost": { "amount": 0, "currency": "JPY", "per_person": true },
                    "rating": "must",
                    "tags": ["early-morning"],
                    "notes": "Go early before the crowds.",
                    "ai_notes": "Hours taken from the post caption, not checked.",
                    "source": { "platform": "instagram", "url": "https://www.instagram.com/p/a/", "account": "@a", "saved": "2026-11-02" }
                },
                {
                    "name": "Shibuya Sky",
                    "type": "sight",
                    "area": "Shibuya",
                    "google_maps_url": "https://maps.app.goo.gl/shibuyasky/",
                    "address": "2-24-12 Shibuya",
                    "usual_stay_minutes": 120,
                    "hours_note": "Book sunset slots early.",
                    "rating": "forget"
                },
                {
                    "name": "  koffee mameya ",
                    "type": "cafe",
                    "area": "omotesando",
                    "opening_hours": { "mon": [["10:00", "18:00"]] },
                    "notes": "Only takeaway.",
                    "source": { "platform": "threads", "url": "https://www.threads.net/@b/post/1" }
                },
                {
                    "name": "Golden Gai",
                    "type": "bar",
                    "area": "Shinjuku",
                    "country": "Japan",
                    "lat": 35.6938,
                    "usual_stay_minutes": -5,
                    "opening_hours": { "mon": [["7pm", "02:00"]], "tue": [["19:00", "02:00"]], "monday": [] },
                    "estimated_cost": { "amount": "cheap", "currency": "JPY" },
                    "rating": "maybe",
                    "tags": ["night", 3],
                    "mood": "fun"
                },
                { "type": "food", "area": "Tsukiji" },
                {
                    "name": "Ichiran Shibuya",
                    "google_maps_url": "https://www.google.com/maps/place/Ichiran/@35.6604,139.7017,17z",
                    "rating": "soso"
                },
                { "name": "Senso-ji", "google_maps_url": "https://maps.app.goo.gl/sensoji", "address": "2-3-1 Asakusa, Taito City" }
            ]
        })
        .to_string()
    }

    fn stamp() -> Stamp {
        Stamp { group_id: "g-import".into(), author: Author::User, at: "2026-11-19T10:00:00Z".into(), label: "Imported places".into() }
    }

    #[test]
    fn reads_a_file_and_lists_problems_in_words() {
        let file = read(&sample_file()).unwrap();
        assert_eq!(file.created.as_deref(), Some("2026-11-19"));
        assert_eq!(file.trip_hint.as_deref(), Some("Tokyo and Kyoto, December 2026"));
        assert_eq!(file.entries.iter().map(|e| e.number).collect::<Vec<_>>(), vec![1, 2, 3, 4, 6, 7]);

        let senso = &file.entries[0].place;
        assert_eq!(senso.country.as_deref(), Some("JP"));
        assert_eq!(senso.estimated_cost.as_ref().unwrap().per_person, Some(true));
        let hours = senso.opening_hours.as_ref().unwrap().to_model();
        assert_eq!(hours.mon, Some(vec![TimeRange { open: 360, close: 1020 }]));
        assert_eq!(hours.tue, Some(vec![TimeRange { open: 360, close: 1020 }]));
        assert_eq!(hours.wed, Some(vec![]));
        assert_eq!(hours.thu, None);
        assert_eq!(hours.sun, Some(vec![TimeRange { open: 0, close: 1440 }]));

        let gai = &file.entries[3].place;
        assert_eq!(gai.name, "Golden Gai");
        assert_eq!(gai.kind, None);
        assert_eq!(gai.country, None);
        assert_eq!((gai.lat, gai.lng), (None, None));
        assert_eq!(gai.usual_stay_minutes, None);
        assert_eq!(gai.rating, None);
        assert_eq!(gai.tags, vec!["night"]);
        assert_eq!(gai.estimated_cost, None);
        let gai_hours = gai.opening_hours.as_ref().unwrap();
        assert_eq!(gai_hours.mon, None);
        assert_eq!(gai_hours.tue, Some(vec![["19:00".to_string(), "02:00".to_string()]]));

        let expected = [
            "Place 4 (Golden Gai): the field \"mood\" is not part of the format and was ignored.",
            "Place 4 (Golden Gai): the type \"bar\" is not one of sight, food, cafe, shop, museum, nature, nightlife.",
            "Place 4 (Golden Gai): the country \"Japan\" is not a two-letter code such as JP.",
            "Place 4 (Golden Gai): it has lat but no lng, so the coordinates were left out.",
            "Place 4 (Golden Gai): the usual stay -5 is not a number of minutes between 1 and 1440.",
            "Place 4 (Golden Gai): opening hours have an unknown day \"monday\" (use mon to sun).",
            "Place 4 (Golden Gai): opening hours for mon are not HH:MM.",
            "Place 4 (Golden Gai): the estimated cost needs an amount of 0 or more and a three-letter currency such as JPY.",
            "Place 4 (Golden Gai): the rating \"maybe\" is not must, soso or forget, so the place comes in Unrated.",
            "Place 4 (Golden Gai): some tags are not text and were left out.",
            "Place 5 has no name, so it was skipped.",
        ];
        assert_eq!(file.problems, expected);
    }

    #[test]
    fn refuses_other_formats_and_versions() {
        assert!(read("not json").unwrap_err().contains("not valid JSON"));
        let e = read(r#"{"format":"wanderlust-changes","version":1,"places":[]}"#).unwrap_err();
        assert!(e.contains("\"wanderlust-changes\""), "{e}");
        let e = read(r#"{"version":1,"places":[]}"#).unwrap_err();
        assert!(e.contains("no \"format\""), "{e}");
        let e = read(r#"{"format":"wanderlust-places","version":2,"places":[]}"#).unwrap_err();
        assert!(e.contains("newer Wanderlust"), "{e}");
        let e = read(r#"{"format":"wanderlust-places","version":1}"#).unwrap_err();
        assert!(e.contains("no \"places\" list"), "{e}");
        let ok = read(r#"{"format":"wanderlust-places","version":1,"created":"19 Nov","places":[]}"#).unwrap();
        assert_eq!(ok.problems, vec!["The file's created date is not YYYY-MM-DD."]);
    }

    #[test]
    fn preview_sorts_places_into_new_link_only_and_duplicates() {
        let trip = trip_with_places();
        let file = read(&sample_file()).unwrap();
        let pv = preview(&trip, &file);

        let names = |rows: &[PreviewPlace]| rows.iter().map(|r| r.name.clone()).collect::<Vec<_>>();
        assert_eq!(names(&pv.new_places), vec!["Senso-ji", "Golden Gai"]);
        assert_eq!(pv.new_places[0].rating, Rating::MustGo);
        assert_eq!(pv.new_places[1].kind, None);
        assert_eq!(pv.new_places[1].rating, Rating::Unrated);
        assert_eq!(names(&pv.link_only), vec!["Ichiran Shibuya"]);
        assert_eq!(pv.problems.len(), 11);

        assert_eq!(pv.duplicates.len(), 3);
        let sky = &pv.duplicates[0];
        assert_eq!((sky.number, sky.matched_by), (2, MatchedBy::Link));
        assert_eq!(sky.existing_place_id.as_deref(), Some("p1"));
        assert_eq!(sky.fills, vec!["address", "hoursNote"]);

        let koffee = &pv.duplicates[1];
        assert_eq!((koffee.number, koffee.matched_by), (3, MatchedBy::NameAndArea));
        assert_eq!(koffee.existing_place_id.as_deref(), Some("p2"));
        assert_eq!(koffee.existing_name, "Koffee Mameya");
        assert_eq!(koffee.fills, vec!["openingHours"]);

        let again = &pv.duplicates[2];
        assert_eq!((again.number, again.matched_by), (7, MatchedBy::Link));
        assert_eq!((again.existing_place_id.clone(), again.same_as_number), (None, Some(1)));
        assert_eq!(again.fills, vec!["address"]);
    }

    #[test]
    fn commands_add_new_places_and_fill_duplicates() {
        let mut trip = trip_with_places();
        let file = read(&sample_file()).unwrap();
        let commands = to_commands(&trip, &file, "imp");
        let ops: Vec<&str> = commands
            .iter()
            .map(|c| match c {
                Command::AddPlace { place } => place.id.as_str(),
                Command::UpdatePlace { id, .. } => id.as_str(),
                _ => "other",
            })
            .collect();
        // imp-1 is taken by Tokyo Tower.
        assert_eq!(ops, vec!["imp-2", "imp-3", "imp-4", "p1", "p2"]);

        apply(&mut trip, &commands, stamp()).unwrap();
        assert_eq!(trip.places.len(), 6);
        assert_eq!(trip.log.len(), 1);

        let senso = trip.place("imp-2").unwrap();
        assert_eq!(senso.name, "Senso-ji");
        assert_eq!(senso.rating, Rating::MustGo);
        assert_eq!(senso.country.as_deref(), Some("JP"));
        assert_eq!(senso.address.as_deref(), Some("2-3-1 Asakusa, Taito City"), "merged from place 7");
        assert_eq!(senso.notes.as_deref(), Some("Go early before the crowds."));
        assert_eq!(senso.ai_notes.as_deref(), Some("Hours taken from the post caption, not checked."));
        assert_eq!(senso.estimated_cost, Some(PlaceCost { amount: 0.0, currency: "JPY".into(), per_person: true }));
        assert_eq!(senso.source.as_ref().unwrap().platform.as_deref(), Some("instagram"));
        assert_eq!(
            senso.unverified,
            [
                "name", "nameLocal", "kind", "area", "city", "country", "googleMapsUrl", "lat", "lng",
                "usualStayMinutes", "openingHours", "estimatedCost", "tags", "notes", "aiNotes", "address",
            ]
        );
        assert_eq!(senso.updated_at.as_deref(), Some("2026-11-19T10:00:00Z"));

        let gai = trip.place("imp-3").unwrap();
        assert_eq!(gai.rating, Rating::Unrated);
        assert_eq!(gai.kind, PlaceType::Sight);
        assert!(gai.unverified.contains(&"kind".to_string()));
        assert!(!gai.has_position());

        // Link-only place: coordinates read from the link, marked unverified.
        let ichiran = trip.place("imp-4").unwrap();
        assert_eq!(ichiran.rating, Rating::SoSo);
        assert_eq!((ichiran.lat, ichiran.lng), (Some(35.6604), Some(139.7017)));
        assert_eq!(ichiran.unverified, ["name", "kind", "googleMapsUrl", "lat", "lng"]);

        // Duplicate by link: fills only what was missing, keeps its rating and stay.
        let sky = trip.place("p1").unwrap();
        assert_eq!(sky.rating, Rating::SoSo);
        assert_eq!(sky.usual_stay_minutes, Some(60));
        assert_eq!(sky.address.as_deref(), Some("2-24-12 Shibuya"));
        assert_eq!(sky.hours_note.as_deref(), Some("Book sunset slots early."));
        assert_eq!(sky.unverified, ["address", "hoursNote"]);
        assert_eq!(sky.source, None);

        // Duplicate by name and area: notes kept, hours and source filled.
        let koffee = trip.place("p2").unwrap();
        assert_eq!(koffee.name, "Koffee Mameya");
        assert_eq!(koffee.rating, Rating::MustGo);
        assert_eq!(koffee.notes.as_deref(), Some("Booked by Brady's friend."));
        assert_eq!(koffee.opening_hours.as_ref().unwrap().mon, Some(vec![TimeRange { open: 600, close: 1080 }]));
        assert_eq!(koffee.unverified, ["openingHours"]);
        assert_eq!(koffee.source.as_ref().unwrap().platform.as_deref(), Some("threads"));

        // Untouched.
        assert_eq!(trip.place("imp-1").unwrap().name, "Tokyo Tower");

        // One undo step removes the whole import.
        crate::commands::undo_last(&mut trip);
        assert_eq!(trip, trip_with_places());
    }

    #[test]
    fn importing_the_same_file_twice_changes_nothing() {
        let mut trip = trip_with_places();
        let file = read(&sample_file()).unwrap();
        let commands = to_commands(&trip, &file, "imp");
        apply(&mut trip, &commands, stamp()).unwrap();
        let pv = preview(&trip, &file);
        // Golden Gai has no link but matches by name and area now.
        assert!(pv.new_places.is_empty() && pv.link_only.is_empty());
        assert!(pv.duplicates.iter().all(|d| d.fills.is_empty()), "{:?}", pv.duplicates);
        assert!(to_commands(&trip, &file, "imp").is_empty());
    }

    #[test]
    fn existing_extra_unverified_entries_are_kept_once() {
        let mut existing: Place = serde_json::from_value(json!({
            "id": "p9", "name": "Meiji Jingu", "kind": "nature", "unverified": ["area"], "area": "Harajuku"
        }))
        .unwrap();
        let new = draft_place(&FilePlace {
            name: "Meiji Jingu".into(),
            area: Some("Harajuku".into()),
            city: Some("Tokyo".into()),
            ..FilePlace::default()
        });
        let (fills, source, _) = fill(&mut existing, &new);
        assert_eq!(fills, ["city"]);
        assert!(!source);
        assert_eq!(existing.unverified, ["area", "city"]);
    }
}

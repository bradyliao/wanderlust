//! Commands: the only way a trip changes (items 72–76).
//!
//! The UI and AI change files both send `Command`s. `apply` runs a list of
//! commands as one step: all of them or none. Each step is written to the
//! trip's change log as a `LogGroup` holding the before and after of every
//! record it touched, so `undo_last` and `undo_to` can restore them.
//!
//! A command that names something missing, or would break a rule (moving a
//! fixed block, a slot outside the trip), fails with a message in plain words.

use crate::model::*;
use crate::time::{dates_between, Date};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

/// Change files written by AI (item 73).
pub const CHANGES_FORMAT: &str = "wanderlust-changes";
pub const CHANGES_VERSION: u32 = 1;

/// Default block length when a place has no usual stay (item 11).
pub const DEFAULT_BLOCK_MINUTES: u32 = 60;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "op")]
pub enum Command {
    // ----- trip and settings -----
    SetTrip { name: Option<String>, start_date: Option<String>, end_date: Option<String> },
    SetPeople { people: u32 },
    SetDefaultMode { mode: Mode },
    SetHomeCurrency { code: String },
    /// Add a currency or change its rate (items 56, 56a).
    SetCurrency { code: String, rate_to_home: f64, set_on: Option<String> },
    RemoveCurrency { code: String },
    /// `None` clears the budget. Limits are merged; a limit of 0 removes it.
    SetBudget { total: Option<f64>, #[serde(default)] limits: BTreeMap<Category, f64> },
    /// Add or replace a day's overrides (city, time zone, mode).
    SetDay { day: Day },

    // ----- places -----
    AddPlace { place: Place },
    /// Change some fields: `set` is a JSON object of place fields (camelCase).
    /// `null` clears a field.
    UpdatePlace { id: Id, set: Value },
    RatePlace { id: Id, rating: Rating },
    /// Items that pointed at the place keep their title and lose the link.
    RemovePlace { id: Id },

    // ----- items (timetable, bookings, budget) -----
    AddItem { item: Item },
    UpdateItem { id: Id, set: Value },
    RemoveItem { id: Id },
    /// Drag a place from the list onto the timetable (item 11): makes a new
    /// item. `end` defaults to the place's usual stay, else 60 minutes.
    SchedulePlace { place_id: Id, item_id: Id, date: String, start: u32, end: Option<u32> },
    /// Move or resize an item's block (items 13, 44). Fails on a fixed block.
    MoveItem { id: Id, #[serde(default = "main_part")] part: BlockPart, date: String, start: u32, end: u32 },
    /// Drag back to the list (item 14). A plain visit (from a place, with no
    /// booking) is removed; anything else stays, without a time.
    Unschedule { id: Id },
    /// Lock or unlock a block (items 31, 32).
    SetFixed { id: Id, #[serde(default = "main_part")] part: BlockPart, fixed: bool, reason: Option<String> },
    SetCost { id: Id, cost: Option<Cost> },
    SetBooking { id: Id, booking: Option<Booking> },
    SetStay { id: Id, stay: Option<Stay> },

    // ----- travel legs -----
    /// `None` goes back to the day or trip default (item 36).
    SetLegMode { from: String, to: String, mode: Option<Mode> },
    /// Store a routing result (item 29).
    SetLegRouted { from: String, to: String, routed: RoutedTime },
    ConfirmLegMinutes { from: String, to: String, minutes: Option<u32> },
}

fn main_part() -> BlockPart {
    BlockPart::Main
}

/// An AI change file (item 73).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeFile {
    pub format: String,
    pub version: u32,
    /// Shown in the change log, for example "Dinner ideas for 12/03".
    pub label: Option<String>,
    pub commands: Vec<Command>,
}

impl ChangeFile {
    pub fn from_json(text: &str) -> Result<ChangeFile, String> {
        let file: ChangeFile = serde_json::from_str(text).map_err(|e| format!("Not a Wanderlust change file: {e}"))?;
        if file.format != CHANGES_FORMAT {
            return Err(format!("Expected format \"{CHANGES_FORMAT}\", found \"{}\".", file.format));
        }
        if file.version > CHANGES_VERSION {
            return Err(format!("This change file needs a newer Wanderlust (version {}).", file.version));
        }
        Ok(file)
    }
}

/// Who and when, for the log.
#[derive(Debug, Clone)]
pub struct Stamp {
    pub group_id: Id,
    pub author: Author,
    pub at: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    /// Position of the failing command in the list.
    pub index: usize,
    pub message: String,
}

/// Run `commands` as one undo step. On success the trip is changed and a log
/// group is added (unless nothing changed). On failure the trip is untouched.
pub fn apply(trip: &mut Trip, commands: &[Command], stamp: Stamp) -> Result<(), CommandError> {
    let mut work = trip.clone();
    let mut changes: Vec<RecordChange> = Vec::new();
    for (index, cmd) in commands.iter().enumerate() {
        let mut tx = Tx { trip: &mut work, changes: &mut changes, at: &stamp.at };
        run(&mut tx, cmd).map_err(|message| CommandError { index, message })?;
    }
    let changes: Vec<RecordChange> = changes.into_iter().filter(|c| c.before != c.after).collect();
    if !changes.is_empty() {
        work.log.push(LogGroup { id: stamp.group_id, author: stamp.author, at: stamp.at, label: stamp.label, changes });
    }
    *trip = work;
    Ok(())
}

/// Undo the newest step. Returns it, or `None` if the log is empty.
pub fn undo_last(trip: &mut Trip) -> Option<LogGroup> {
    let group = trip.log.pop()?;
    for change in group.changes.iter().rev() {
        restore(trip, change.after.as_ref().or(change.before.as_ref()).map(key_of), change.before.clone());
    }
    Some(group)
}

/// Undo the step `group_id` and every step after it (item 76).
/// Returns how many steps were undone (0 if the id is not in the log).
pub fn undo_to(trip: &mut Trip, group_id: &str) -> usize {
    let Some(pos) = trip.log.iter().position(|g| g.id == group_id) else { return 0 };
    let n = trip.log.len() - pos;
    for _ in 0..n {
        undo_last(trip);
    }
    n
}

// ---------- internals ----------

struct Tx<'a> {
    trip: &'a mut Trip,
    changes: &'a mut Vec<RecordChange>,
    at: &'a str,
}

#[derive(Debug, Clone, PartialEq)]
enum Key {
    Settings,
    Header,
    Day(String),
    Place(Id),
    Item(Id),
    Leg(String, String),
}

fn key_of(r: &Record) -> Key {
    match r {
        Record::Settings(_) => Key::Settings,
        Record::Header { .. } => Key::Header,
        Record::Day(d) => Key::Day(d.date.clone()),
        Record::Place(p) => Key::Place(p.id.clone()),
        Record::Item(i) => Key::Item(i.id.clone()),
        Record::Leg(l) => Key::Leg(l.from.clone(), l.to.clone()),
    }
}

fn get(trip: &Trip, key: &Key) -> Option<Record> {
    match key {
        Key::Settings => Some(Record::Settings(trip.settings.clone())),
        Key::Header => Some(Record::Header { name: trip.name.clone(), start_date: trip.start_date.clone(), end_date: trip.end_date.clone() }),
        Key::Day(d) => trip.day(d).cloned().map(Record::Day),
        Key::Place(id) => trip.place(id).cloned().map(Record::Place),
        Key::Item(id) => trip.item(id).cloned().map(Record::Item),
        Key::Leg(a, b) => trip.leg(a, b).cloned().map(Record::Leg),
    }
}

/// Put a record back (or remove it when `value` is `None`).
fn restore(trip: &mut Trip, key: Option<Key>, value: Option<Record>) {
    let Some(key) = key else { return };
    fn upsert<T: Clone>(list: &mut Vec<T>, matches: impl Fn(&T) -> bool, value: Option<T>) {
        match (list.iter().position(matches), value) {
            (Some(i), Some(v)) => list[i] = v,
            (Some(i), None) => {
                list.remove(i);
            }
            (None, Some(v)) => list.push(v),
            (None, None) => {}
        }
    }
    match (key, value) {
        (Key::Settings, Some(Record::Settings(s))) => trip.settings = s,
        (Key::Header, Some(Record::Header { name, start_date, end_date })) => {
            trip.name = name;
            trip.start_date = start_date;
            trip.end_date = end_date;
        }
        (Key::Day(d), v) => upsert(&mut trip.days, |x| x.date == d, v.and_then(|r| if let Record::Day(x) = r { Some(x) } else { None })),
        (Key::Place(id), v) => upsert(&mut trip.places, |x| x.id == id, v.and_then(|r| if let Record::Place(x) = r { Some(x) } else { None })),
        (Key::Item(id), v) => upsert(&mut trip.items, |x| x.id == id, v.and_then(|r| if let Record::Item(x) = r { Some(x) } else { None })),
        (Key::Leg(a, b), v) => upsert(&mut trip.legs, |x| x.from == a && x.to == b, v.and_then(|r| if let Record::Leg(x) = r { Some(x) } else { None })),
        _ => {}
    }
}

impl Tx<'_> {
    /// Replace one record and remember its before and after.
    fn put(&mut self, key: Key, value: Option<Record>) {
        let before = get(self.trip, &key);
        restore(self.trip, Some(key.clone()), value);
        let after = get(self.trip, &key);
        self.changes.push(RecordChange { before, after });
    }

    fn settings(&mut self, f: impl FnOnce(&mut Settings) -> Result<(), String>) -> Result<(), String> {
        let mut s = self.trip.settings.clone();
        f(&mut s)?;
        self.put(Key::Settings, Some(Record::Settings(s)));
        Ok(())
    }

    fn item(&self, id: &str) -> Result<Item, String> {
        self.trip.item(id).cloned().ok_or_else(|| format!("There is no item \"{id}\"."))
    }

    fn put_item(&mut self, mut item: Item) {
        item.updated_at = Some(self.at.to_string());
        self.put(Key::Item(item.id.clone()), Some(Record::Item(item)));
    }

    fn put_place(&mut self, mut place: Place) {
        place.updated_at = Some(self.at.to_string());
        self.put(Key::Place(place.id.clone()), Some(Record::Place(place)));
    }

    fn leg(&mut self, from: &str, to: &str, f: impl FnOnce(&mut Leg)) {
        let mut leg = self.trip.leg(from, to).cloned().unwrap_or(Leg {
            from: from.into(),
            to: to.into(),
            mode: None,
            routed: Vec::new(),
            confirmed_minutes: None,
            updated_at: None,
        });
        f(&mut leg);
        leg.updated_at = Some(self.at.to_string());
        self.put(Key::Leg(from.into(), to.into()), Some(Record::Leg(leg)));
    }
}

fn run(tx: &mut Tx, cmd: &Command) -> Result<(), String> {
    match cmd {
        Command::SetTrip { name, start_date, end_date } => {
            let name = name.clone().unwrap_or_else(|| tx.trip.name.clone());
            let start_date = start_date.clone().unwrap_or_else(|| tx.trip.start_date.clone());
            let end_date = end_date.clone().unwrap_or_else(|| tx.trip.end_date.clone());
            if dates_between(&start_date, &end_date).is_empty() {
                return Err(format!("{start_date} to {end_date} is not a valid date range."));
            }
            tx.put(Key::Header, Some(Record::Header { name, start_date, end_date }));
        }
        Command::SetPeople { people } => {
            if *people == 0 {
                return Err("A trip needs at least one person.".into());
            }
            tx.settings(|s| {
                s.people = *people;
                Ok(())
            })?;
        }
        Command::SetDefaultMode { mode } => tx.settings(|s| {
            s.default_mode = *mode;
            Ok(())
        })?,
        Command::SetHomeCurrency { code } => {
            let code = currency_code(code)?;
            tx.settings(|s| {
                s.home_currency = code;
                Ok(())
            })?;
        }
        Command::SetCurrency { code, rate_to_home, set_on } => {
            let code = currency_code(code)?;
            if !(rate_to_home.is_finite() && *rate_to_home > 0.0) {
                return Err(format!("The rate for {code} must be a number above 0."));
            }
            tx.settings(|s| {
                let entry = CurrencyRate { code: code.clone(), rate_to_home: *rate_to_home, set_on: set_on.clone() };
                match s.currencies.iter_mut().find(|c| c.code == code) {
                    Some(c) => *c = entry,
                    None => s.currencies.push(entry),
                }
                Ok(())
            })?;
        }
        Command::RemoveCurrency { code } => {
            let code = code.trim().to_uppercase();
            if tx.trip.items.iter().any(|i| i.cost.as_ref().is_some_and(|c| c.currency == code)) {
                return Err(format!("Some costs are still in {code}. Change them first."));
            }
            tx.settings(|s| {
                s.currencies.retain(|c| c.code != code);
                Ok(())
            })?;
        }
        Command::SetBudget { total, limits } => tx.settings(|s| {
            s.budget = *total;
            for (cat, v) in limits {
                if *v <= 0.0 {
                    s.limits.remove(cat);
                } else {
                    s.limits.insert(*cat, *v);
                }
            }
            Ok(())
        })?,
        Command::SetDay { day } => {
            in_trip(tx.trip, &day.date)?;
            let mut day = day.clone();
            day.updated_at = Some(tx.at.to_string());
            tx.put(Key::Day(day.date.clone()), Some(Record::Day(day)));
        }

        Command::AddPlace { place } => {
            if tx.trip.place(&place.id).is_some() {
                return Err(format!("A place with id \"{}\" already exists.", place.id));
            }
            if place.name.trim().is_empty() {
                return Err("A place needs a name.".into());
            }
            tx.put_place(place.clone());
        }
        Command::UpdatePlace { id, set } => {
            let place = tx.trip.place(id).cloned().ok_or_else(|| format!("There is no place \"{id}\"."))?;
            let mut place: Place = merge(&place, set)?;
            place.id = id.clone();
            tx.put_place(place);
        }
        Command::RatePlace { id, rating } => {
            let mut place = tx.trip.place(id).cloned().ok_or_else(|| format!("There is no place \"{id}\"."))?;
            place.rating = *rating;
            tx.put_place(place);
        }
        Command::RemovePlace { id } => {
            tx.trip.place(id).ok_or_else(|| format!("There is no place \"{id}\"."))?;
            let linked: Vec<Item> = tx.trip.items.iter().filter(|i| i.place_id.as_deref() == Some(id)).cloned().collect();
            for mut item in linked {
                item.place_id = None;
                tx.put_item(item);
            }
            tx.put(Key::Place(id.clone()), None);
        }

        Command::AddItem { item } => {
            if tx.trip.item(&item.id).is_some() {
                return Err(format!("An item with id \"{}\" already exists.", item.id));
            }
            check_item(tx.trip, item)?;
            tx.put_item(item.clone());
        }
        Command::UpdateItem { id, set } => {
            let item = tx.item(id)?;
            let mut item: Item = merge(&item, set)?;
            item.id = id.clone();
            check_item(tx.trip, &item)?;
            tx.put_item(item);
        }
        Command::RemoveItem { id } => {
            tx.item(id)?;
            remove_legs_of(tx, id);
            tx.put(Key::Item(id.clone()), None);
        }
        Command::SchedulePlace { place_id, item_id, date, start, end } => {
            let place = tx.trip.place(place_id).cloned().ok_or_else(|| format!("There is no place \"{place_id}\"."))?;
            if tx.trip.item(item_id).is_some() {
                return Err(format!("An item with id \"{item_id}\" already exists."));
            }
            let end = end.unwrap_or_else(|| start + place.usual_stay_minutes.unwrap_or(DEFAULT_BLOCK_MINUTES));
            let slot = Slot { date: date.clone(), start: *start, end: end.min(1440), fixed: false, fixed_reason: None };
            check_slot(tx.trip, &slot)?;
            let cost = place.estimated_cost.as_ref().map(|m| Cost {
                amount: m.amount,
                currency: m.currency.clone(),
                per_night: false,
                per_person: false,
                people: None,
                status: CostStatus::Estimated,
                replaced_estimate: None,
                date: None,
            });
            tx.put_item(Item {
                id: item_id.clone(),
                title: place.name.clone(),
                place_id: Some(place.id.clone()),
                category: category_for(place.kind),
                slot: Some(slot),
                stay: None,
                booking: None,
                cost,
                notes: None,
                updated_at: None,
            });
        }
        Command::MoveItem { id, part, date, start, end } => {
            let mut item = tx.item(id)?;
            let slot = Slot { date: date.clone(), start: *start, end: *end, fixed: false, fixed_reason: None };
            check_slot(tx.trip, &slot)?;
            let target = block_mut(&mut item, *part).ok_or_else(|| format!("\"{}\" has no such block.", item_title(tx.trip, id)))?;
            if let Some(old) = target.as_ref() {
                if old.fixed {
                    return Err(format!("\"{}\" is fixed. Unlock it first.", item_title(tx.trip, id)));
                }
            }
            *target = Some(slot);
            tx.put_item(item);
        }
        Command::Unschedule { id } => {
            let mut item = tx.item(id)?;
            if item.slot.as_ref().is_some_and(|s| s.fixed) {
                return Err(format!("\"{}\" is fixed. Unlock it first.", item.title));
            }
            remove_legs_of(tx, id);
            let plain_visit = item.place_id.is_some() && item.booking.is_none() && item.stay.is_none();
            if plain_visit {
                tx.put(Key::Item(id.clone()), None);
            } else {
                item.slot = None;
                tx.put_item(item);
            }
        }
        Command::SetFixed { id, part, fixed, reason } => {
            let mut item = tx.item(id)?;
            let title = item.title.clone();
            let target = block_mut(&mut item, *part).ok_or_else(|| format!("\"{title}\" has no such block."))?;
            let slot = target.as_mut().ok_or_else(|| format!("\"{title}\" is not on the timetable."))?;
            slot.fixed = *fixed;
            slot.fixed_reason = if *fixed { reason.clone() } else { None };
            tx.put_item(item);
        }
        Command::SetCost { id, cost } => {
            let mut item = tx.item(id)?;
            if let Some(c) = cost {
                check_cost(tx.trip, c)?;
            }
            item.cost = cost.clone();
            tx.put_item(item);
        }
        Command::SetBooking { id, booking } => {
            let mut item = tx.item(id)?;
            item.booking = booking.clone();
            tx.put_item(item);
        }
        Command::SetStay { id, stay } => {
            let mut item = tx.item(id)?;
            if let Some(s) = stay {
                check_stay(tx.trip, s)?;
            }
            item.stay = stay.clone();
            tx.put_item(item);
        }

        Command::SetLegMode { from, to, mode } => tx.leg(from, to, |l| l.mode = *mode),
        Command::SetLegRouted { from, to, routed } => tx.leg(from, to, |l| {
            l.routed.retain(|r| r.mode != routed.mode);
            l.routed.push(routed.clone());
        }),
        Command::ConfirmLegMinutes { from, to, minutes } => tx.leg(from, to, |l| l.confirmed_minutes = *minutes),
    }
    Ok(())
}

/// Default budget category for a place type.
pub fn category_for(kind: PlaceType) -> Category {
    match kind {
        PlaceType::Food | PlaceType::Cafe | PlaceType::Nightlife => Category::Food,
        PlaceType::Shop => Category::Shopping,
        PlaceType::Museum | PlaceType::Sight => Category::Tickets,
        PlaceType::Nature => Category::Other,
    }
}

fn item_title(trip: &Trip, id: &str) -> String {
    trip.item(id).map(|i| i.title.clone()).unwrap_or_else(|| id.to_string())
}

fn block_mut(item: &mut Item, part: BlockPart) -> Option<&mut Option<Slot>> {
    match part {
        BlockPart::Main => Some(&mut item.slot),
        BlockPart::CheckIn => item.stay.as_mut().map(|s| &mut s.check_in),
        BlockPart::CheckOut => item.stay.as_mut().map(|s| &mut s.check_out),
    }
}

/// Legs that start or end at any block of the item.
fn remove_legs_of(tx: &mut Tx, item_id: &str) {
    let keys: Vec<(String, String)> = tx
        .trip
        .legs
        .iter()
        .filter(|l| BlockKey::decode(&l.from).item_id == item_id || BlockKey::decode(&l.to).item_id == item_id)
        .map(|l| (l.from.clone(), l.to.clone()))
        .collect();
    for (a, b) in keys {
        tx.put(Key::Leg(a, b), None);
    }
}

fn currency_code(code: &str) -> Result<String, String> {
    let code = code.trim().to_uppercase();
    if code.len() == 3 && code.chars().all(|c| c.is_ascii_alphabetic()) {
        Ok(code)
    } else {
        Err(format!("\"{code}\" is not a three-letter currency code."))
    }
}

fn in_trip(trip: &Trip, date: &str) -> Result<(), String> {
    let d = Date::parse(date).ok_or_else(|| format!("\"{date}\" is not a date (YYYY-MM-DD)."))?;
    if dates_between(&trip.start_date, &trip.end_date).contains(&d) {
        Ok(())
    } else {
        Err(format!("{date} is outside the trip ({} to {}).", trip.start_date, trip.end_date))
    }
}

fn check_slot(trip: &Trip, slot: &Slot) -> Result<(), String> {
    in_trip(trip, &slot.date)?;
    if slot.end > 1440 || slot.start >= slot.end {
        return Err("A block must start before it ends, on the same day.".into());
    }
    Ok(())
}

fn check_cost(trip: &Trip, cost: &Cost) -> Result<(), String> {
    if !(cost.amount.is_finite() && cost.amount >= 0.0) {
        return Err("A cost must be 0 or more.".into());
    }
    if trip.rate_to_home(&cost.currency).is_none() {
        return Err(format!("{} is not one of the trip's currencies yet. Add it with its rate first.", cost.currency));
    }
    if cost.people == Some(0) {
        return Err("A cost must cover at least one person.".into());
    }
    Ok(())
}

fn check_stay(trip: &Trip, stay: &Stay) -> Result<(), String> {
    let (Some(a), Some(b)) = (Date::parse(&stay.check_in_date), Date::parse(&stay.check_out_date)) else {
        return Err("Check-in and check-out need dates (YYYY-MM-DD).".into());
    };
    if b <= a {
        return Err("Check-out must be after check-in.".into());
    }
    for slot in [&stay.check_in, &stay.check_out].into_iter().flatten() {
        check_slot(trip, slot)?;
    }
    Ok(())
}

fn check_item(trip: &Trip, item: &Item) -> Result<(), String> {
    if item.title.trim().is_empty() {
        return Err("An item needs a title.".into());
    }
    if let Some(pid) = &item.place_id {
        trip.place(pid).ok_or_else(|| format!("There is no place \"{pid}\"."))?;
    }
    if let Some(slot) = &item.slot {
        check_slot(trip, slot)?;
    }
    if let Some(cost) = &item.cost {
        check_cost(trip, cost)?;
    }
    if let Some(stay) = &item.stay {
        check_stay(trip, stay)?;
    }
    Ok(())
}

/// Merge a JSON object of fields into a record (JSON merge patch, RFC 7386).
fn merge<T: Serialize + for<'de> Deserialize<'de>>(current: &T, set: &Value) -> Result<T, String> {
    if !set.is_object() {
        return Err("\"set\" must be an object of fields.".into());
    }
    let mut doc = serde_json::to_value(current).map_err(|e| e.to_string())?;
    merge_patch(&mut doc, set);
    serde_json::from_value(doc).map_err(|e| format!("Those fields don't fit: {e}"))
}

fn merge_patch(target: &mut Value, patch: &Value) {
    if let Value::Object(p) = patch {
        if !target.is_object() {
            *target = Value::Object(Default::default());
        }
        let t = target.as_object_mut().expect("just made an object");
        for (k, v) in p {
            if v.is_null() {
                t.remove(k);
            } else {
                merge_patch(t.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
    } else {
        *target = patch.clone();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    pub(crate) fn sample() -> Trip {
        let mut t = Trip::new("t1", "Tokyo & Kyoto", "2026-12-02", "2026-12-06");
        t.settings.people = 3;
        t.settings.currencies.push(CurrencyRate { code: "JPY".into(), rate_to_home: 0.21, set_on: None });
        t
    }

    fn place(id: &str, name: &str) -> Place {
        serde_json::from_value(json!({ "id": id, "name": name, "kind": "sight", "usualStayMinutes": 90 })).unwrap()
    }

    fn stamp(id: &str) -> Stamp {
        Stamp { group_id: id.into(), author: Author::User, at: "2026-11-19T10:00:00Z".into(), label: id.into() }
    }

    #[test]
    fn schedules_a_place_and_undoes_it() {
        let mut t = sample();
        apply(&mut t, &[Command::AddPlace { place: place("p1", "Senso-ji") }], stamp("g1")).unwrap();
        let cmd = Command::SchedulePlace { place_id: "p1".into(), item_id: "i1".into(), date: "2026-12-02".into(), start: 540, end: None };
        apply(&mut t, &[cmd], stamp("g2")).unwrap();
        let slot = t.item("i1").unwrap().slot.clone().unwrap();
        assert_eq!((slot.start, slot.end), (540, 630));
        assert_eq!(t.log.len(), 2);
        undo_last(&mut t);
        assert!(t.item("i1").is_none());
        assert!(t.place("p1").is_some());
        assert_eq!(undo_to(&mut t, "g1"), 1);
        assert!(t.places.is_empty() && t.log.is_empty());
    }

    #[test]
    fn a_failing_command_changes_nothing() {
        let mut t = sample();
        let cmds = [
            Command::AddPlace { place: place("p1", "Senso-ji") },
            Command::SchedulePlace { place_id: "p1".into(), item_id: "i1".into(), date: "2027-01-01".into(), start: 540, end: None },
        ];
        let err = apply(&mut t, &cmds, stamp("g1")).unwrap_err();
        assert_eq!(err.index, 1);
        assert!(err.message.contains("outside the trip"));
        assert!(t.places.is_empty() && t.log.is_empty());
    }

    #[test]
    fn fixed_blocks_must_be_unlocked_before_moving() {
        let mut t = sample();
        apply(&mut t, &[Command::AddPlace { place: place("p1", "Shibuya Sky") }], stamp("g1")).unwrap();
        let cmds = [
            Command::SchedulePlace { place_id: "p1".into(), item_id: "i1".into(), date: "2026-12-03".into(), start: 945, end: Some(1005) },
            Command::SetFixed { id: "i1".into(), part: BlockPart::Main, fixed: true, reason: Some("Ticket booked".into()) },
        ];
        apply(&mut t, &cmds, stamp("g2")).unwrap();
        let mv = Command::MoveItem { id: "i1".into(), part: BlockPart::Main, date: "2026-12-03".into(), start: 960, end: 1020 };
        assert!(apply(&mut t, std::slice::from_ref(&mv), stamp("g3")).unwrap_err().message.contains("Unlock"));
        let unlock = Command::SetFixed { id: "i1".into(), part: BlockPart::Main, fixed: false, reason: None };
        apply(&mut t, &[unlock, mv], stamp("g4")).unwrap();
        assert_eq!(t.item("i1").unwrap().slot.as_ref().unwrap().start, 960);
    }

    #[test]
    fn update_place_merges_fields_and_logs_the_author() {
        let mut t = sample();
        apply(&mut t, &[Command::AddPlace { place: place("p1", "Senso-ji") }], stamp("g1")).unwrap();
        let ai = Stamp { group_id: "g2".into(), author: Author::Ai { source: Some("ideas.json".into()) }, at: "x".into(), label: "AI".into() };
        apply(&mut t, &[Command::UpdatePlace { id: "p1".into(), set: json!({ "area": "Asakusa", "usualStayMinutes": null }) }], ai).unwrap();
        let p = t.place("p1").unwrap();
        assert_eq!(p.area.as_deref(), Some("Asakusa"));
        assert_eq!(p.usual_stay_minutes, None);
        assert_eq!(t.log[1].author, Author::Ai { source: Some("ideas.json".into()) });
    }

    #[test]
    fn costs_need_a_known_currency() {
        let mut t = sample();
        let item: Item = serde_json::from_value(json!({ "id": "i1", "title": "Flights", "category": "flights" })).unwrap();
        apply(&mut t, &[Command::AddItem { item }], stamp("g1")).unwrap();
        let cost: Cost = serde_json::from_value(json!({ "amount": 1260, "currency": "USD", "status": "booked" })).unwrap();
        let set = Command::SetCost { id: "i1".into(), cost: Some(cost) };
        assert!(apply(&mut t, std::slice::from_ref(&set), stamp("g2")).is_err());
        let add_usd = Command::SetCurrency { code: "usd".into(), rate_to_home: 32.0, set_on: None };
        apply(&mut t, &[add_usd, set], stamp("g3")).unwrap();
        assert_eq!(t.rate_to_home("USD"), Some(32.0));
    }

    #[test]
    fn reads_a_change_file() {
        let text = r#"{ "format": "wanderlust-changes", "version": 1, "label": "Ratings",
            "commands": [ { "op": "ratePlace", "id": "p1", "rating": "mustGo" }, { "op": "setPeople", "people": 4 } ] }"#;
        let file = ChangeFile::from_json(text).unwrap();
        assert_eq!(file.commands.len(), 2);
        assert_eq!(file.commands[1], Command::SetPeople { people: 4 });
    }
}

//! The timetable read side: blocks per day, the legs between them, the night
//! band, warnings, drag preview and where each day is.
//!
//! Items 11–15 (blocks), 19 and 29–30 (travel in the gaps), 22 (day
//! location), 27–28 (opening hours), 31–32 (fixed blocks), 63 (hotels) in
//! `docs/layout-and-behavior.md`. Everything here reads a `&Trip` and returns
//! plain data; nothing changes the trip.

use crate::hours;
use crate::model::*;
use crate::time::{dates_between, fmt_hhmm, Date};
use crate::travel::{self, LegTravel};
use serde::Serialize;

/// Stand-in block key for a place being dragged from the list, which has no
/// item yet. No stored leg uses it, so its travel is always the estimate
/// (item 29).
pub const DRAG_KEY: &str = "#drag";

/// One block on the timetable: an item's own slot, or a stay's check-in or
/// check-out.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Block {
    /// `BlockKey::encode`: `"<item id>"`, `"<item id>#checkIn"`, `"<item id>#checkOut"`.
    pub key: String,
    pub item_id: Id,
    pub part: BlockPart,
    /// The item's title. The UI adds "Check-in" / "Check-out" from `part`.
    pub title: String,
    pub date: String,
    pub start: u32,
    pub end: u32,
    pub fixed: bool,
    /// Why it is fixed, for example "Ticket booked".
    pub reason: Option<String>,
    pub place_id: Option<Id>,
}

/// The stay that covers a night, for the thin band at the end of the day (item 63).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Night {
    pub item_id: Id,
    pub title: String,
    pub place_id: Option<Id>,
    pub check_in_date: String,
    pub check_out_date: String,
    /// Which night of the stay this is, from 1.
    pub night: u32,
    /// How many nights the stay has.
    pub nights: u32,
}

/// Travel in the gap between two consecutive blocks (items 19, 30).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegView {
    pub date: String,
    pub from_key: String,
    pub to_key: String,
    pub from_place_id: Id,
    pub to_place_id: Id,
    /// End of the block before.
    pub from_end: u32,
    /// Start of the block after.
    pub to_start: u32,
    /// Minutes between the two blocks; negative when they overlap.
    pub gap_minutes: i32,
    pub travel: LegTravel,
    /// The gap is shorter than the travel time: the gap turns red (item 30).
    pub tight: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WarningKind {
    /// Two blocks on the same date share some time.
    Overlap,
    /// The place is closed all day on that date.
    Closed,
    /// The place is open that day, but not for the whole block (item 28).
    OutsideHours,
    /// Not enough time to travel from the block before (item 30).
    TooTight,
}

/// A warning mark on a block.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Warning {
    pub date: String,
    /// The block the mark goes on.
    pub block_key: String,
    pub kind: WarningKind,
    /// Plain words, for example "Omoide Yokocho opens at 17:00.".
    pub message: String,
    /// The other block involved: the one it overlaps, or the one before a
    /// tight gap.
    pub other_key: Option<String>,
}

/// What the timetable shows while a place or block is dragged (items 27, 29–31).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DragPreview {
    pub date: String,
    pub start: u32,
    pub end: u32,
    /// Closed hours of the place on every trip date, for the hatching (item 27).
    pub closed: Vec<DayClosed>,
    /// The block before the drop on the target date.
    pub before: Option<Neighbour>,
    /// The block after the drop on the target date.
    pub after: Option<Neighbour>,
    /// Whether any of the slot falls in closed hours. `None` = hours unknown.
    pub in_closed_hours: Option<bool>,
    /// Why, in plain words: "Omoide Yokocho opens at 17:00.".
    pub hours_message: Option<String>,
    /// Fixed blocks the slot would cover; they cannot be dropped over (item 31).
    pub over_fixed: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayClosed {
    pub date: String,
    /// Closed ranges in minutes, `[start, end]`. `None` = hours unknown.
    pub ranges: Option<Vec<(u32, u32)>>,
    /// Closed all day: hatched top to bottom.
    pub all_day: bool,
}

/// A block next to the drop, and whether travel to or from it fits.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Neighbour {
    pub key: String,
    pub title: String,
    pub place_id: Option<Id>,
    pub start: u32,
    pub end: u32,
    /// `None` when a place or position is missing, or it is the same place.
    pub travel: Option<LegTravel>,
    /// Travel minutes needed: 0 for the same place, `None` when unknown.
    pub needs: Option<u32>,
    /// Minutes free between the neighbour and the drop; negative on overlap.
    pub has: i32,
    /// `None` when `needs` is unknown.
    pub fits: Option<bool>,
    /// "needs 25 min, has 10" when it does not fit.
    pub message: Option<String>,
}

// ---------- blocks ----------

/// Every block on `date` (`YYYY-MM-DD`), sorted by start, then end, then key.
pub fn blocks_on(trip: &Trip, date: &str) -> Vec<Block> {
    let mut out: Vec<Block> = trip.items.iter().flat_map(item_blocks).filter(|b| b.date == date).collect();
    sort_blocks(&mut out);
    out
}

/// Every block of the trip, sorted by date, then start.
pub fn all_blocks(trip: &Trip) -> Vec<Block> {
    let mut out: Vec<Block> = trip.items.iter().flat_map(item_blocks).collect();
    out.sort_by(|a, b| a.date.cmp(&b.date).then(a.start.cmp(&b.start)).then(a.end.cmp(&b.end)).then(a.key.cmp(&b.key)));
    out
}

fn sort_blocks(blocks: &mut [Block]) {
    blocks.sort_by(|a, b| a.start.cmp(&b.start).then(a.end.cmp(&b.end)).then(a.key.cmp(&b.key)));
}

fn item_blocks(item: &Item) -> Vec<Block> {
    let stay = item.stay.as_ref();
    let parts = [
        (BlockPart::Main, item.slot.as_ref()),
        (BlockPart::CheckIn, stay.and_then(|s| s.check_in.as_ref())),
        (BlockPart::CheckOut, stay.and_then(|s| s.check_out.as_ref())),
    ];
    parts
        .into_iter()
        .filter_map(|(part, slot)| {
            let slot = slot?;
            Some(Block {
                key: BlockKey { item_id: item.id.clone(), part }.encode(),
                item_id: item.id.clone(),
                part,
                title: item.title.clone(),
                date: slot.date.clone(),
                start: slot.start,
                end: slot.end,
                fixed: slot.fixed,
                reason: slot.fixed_reason.clone(),
                place_id: item.place_id.clone(),
            })
        })
        .collect()
}

/// How a block is named in messages.
fn block_name(b: &Block) -> String {
    match b.part {
        BlockPart::Main => b.title.clone(),
        BlockPart::CheckIn => format!("Check-in at {}", b.title),
        BlockPart::CheckOut => format!("Check-out at {}", b.title),
    }
}

fn find_block(trip: &Trip, key: &str) -> Option<Block> {
    let item = trip.item(&BlockKey::decode(key).item_id)?;
    item_blocks(item).into_iter().find(|b| b.key == key)
}

// ---------- nights ----------

/// The stay covering the night of `date` (check-in date ≤ date < check-out
/// date). If stays overlap, the first in the trip's item order.
pub fn night_on(trip: &Trip, date: &str) -> Option<Night> {
    let d = Date::parse(date)?;
    trip.items.iter().find_map(|item| {
        let stay = item.stay.as_ref()?;
        let (ci, co) = (Date::parse(&stay.check_in_date)?, Date::parse(&stay.check_out_date)?);
        if !(ci <= d && d < co) {
            return None;
        }
        Some(Night {
            item_id: item.id.clone(),
            title: item.title.clone(),
            place_id: item.place_id.clone(),
            check_in_date: stay.check_in_date.clone(),
            check_out_date: stay.check_out_date.clone(),
            night: ci.days_until(d) as u32 + 1,
            nights: ci.days_until(co) as u32,
        })
    })
}

// ---------- legs ----------

/// Travel between each pair of consecutive blocks on `date` whose places both
/// have positions. Pairs at the same place, or where a block has no place,
/// get no leg.
pub fn legs_on(trip: &Trip, date: &str) -> Vec<LegView> {
    blocks_on(trip, date).windows(2).filter_map(|w| leg_between(trip, &w[0], &w[1], date)).collect()
}

fn leg_between(trip: &Trip, a: &Block, b: &Block, date: &str) -> Option<LegView> {
    let (from, to) = (trip.place(a.place_id.as_deref()?)?, trip.place(b.place_id.as_deref()?)?);
    if from.id == to.id || !from.has_position() || !to.has_position() {
        return None;
    }
    let travel = travel::leg_travel(trip, &a.key, &b.key, from, to, date);
    let gap = b.start as i32 - a.end as i32;
    let tight = travel.minutes.is_some_and(|m| gap < m as i32);
    Some(LegView {
        date: date.to_string(),
        from_key: a.key.clone(),
        to_key: b.key.clone(),
        from_place_id: from.id.clone(),
        to_place_id: to.id.clone(),
        from_end: a.end,
        to_start: b.start,
        gap_minutes: gap,
        travel,
        tight,
    })
}

fn needs_has(needs: u32, has: i32) -> String {
    format!("needs {needs} min, has {}", has.max(0))
}

// ---------- warnings ----------

/// Every warning on the trip, by date and then block order: overlaps, closed
/// days, blocks outside opening hours (item 28) and tight gaps (item 30).
/// Unknown opening hours give no warning.
pub fn warnings(trip: &Trip) -> Vec<Warning> {
    let mut dates: Vec<String> = trip.items.iter().flat_map(item_blocks).map(|b| b.date).collect();
    dates.sort();
    dates.dedup();
    dates.iter().flat_map(|d| warnings_on(trip, d)).collect()
}

/// The warnings for one date, in block order.
pub fn warnings_on(trip: &Trip, date: &str) -> Vec<Warning> {
    let blocks = blocks_on(trip, date);
    let mut out: Vec<(usize, Warning)> = Vec::new();
    let warn = |kind, key: &str, message: String, other: Option<&str>| Warning {
        date: date.to_string(),
        block_key: key.to_string(),
        kind,
        message,
        other_key: other.map(str::to_string),
    };

    for (i, a) in blocks.iter().enumerate() {
        for b in blocks.iter().filter(|b| b.key != a.key) {
            if a.start < b.end && b.start < a.end {
                let msg = format!("{} overlaps {} ({}–{}).", block_name(a), block_name(b), fmt_hhmm(b.start), fmt_hhmm(b.end));
                out.push((i, warn(WarningKind::Overlap, &a.key, msg, Some(&b.key))));
            }
        }
        let place = a.place_id.as_deref().and_then(|id| trip.place(id));
        if let (Some(place), Some(d)) = (place, Date::parse(date)) {
            if let Some((kind, msg)) = hours_problem(place, d, a.start, a.end) {
                out.push((i, warn(kind, &a.key, msg, None)));
            }
        }
    }

    for leg in blocks.windows(2).filter_map(|w| leg_between(trip, &w[0], &w[1], date)) {
        let (Some(needs), true) = (leg.travel.minutes, leg.tight) else { continue };
        let (Some(i), Some(from)) = (blocks.iter().position(|b| b.key == leg.to_key), blocks.iter().find(|b| b.key == leg.from_key)) else { continue };
        let to = &blocks[i];
        let msg = format!("Travel from {} to {} {}.", block_name(from), block_name(to), needs_has(needs, leg.gap_minutes));
        out.push((i, warn(WarningKind::TooTight, &leg.to_key, msg, Some(&leg.from_key))));
    }

    out.sort_by_key(|(i, _)| *i);
    out.into_iter().map(|(_, w)| w).collect()
}

/// Closed that day, or open but not for all of `start..end`. `None` when
/// fine or unknown.
fn hours_problem(place: &Place, date: Date, start: u32, end: u32) -> Option<(WarningKind, String)> {
    let h = place.opening_hours.as_ref()?;
    let open = hours::open_ranges(h, date)?;
    let name = &place.name;
    if open.is_empty() {
        let msg = format!("{name} is closed on {} {}.", date.weekday_short(), date.month_day());
        return Some((WarningKind::Closed, msg));
    }
    if hours::open_throughout(h, date, start, end)? {
        return None;
    }
    let msg = if let Some(&(_, close)) = open.iter().find(|&&(a, b)| a <= start && start < b) {
        format!("{name} closes at {}.", fmt_hhmm(close))
    } else if let Some(&(opens, _)) = open.iter().find(|&&(a, _)| a > start) {
        format!("{name} opens at {}.", fmt_hhmm(opens))
    } else {
        let close = open.last().map_or(0, |r| r.1);
        format!("{name} closes at {}.", fmt_hhmm(close))
    };
    Some((WarningKind::OutsideHours, msg))
}

// ---------- drag preview ----------

/// Preview for dragging place `place_id` from the list onto `date`
/// `start..end` (items 27, 29–31). Travel to the neighbours is the instant
/// estimate. An unknown place gives a preview with unknown hours.
pub fn drag_preview(trip: &Trip, place_id: &str, date: &str, start: u32, end: u32) -> DragPreview {
    preview(trip, trip.place(place_id), DRAG_KEY, date, start, end)
}

/// Preview for moving or resizing an existing block (`BlockKey::encode`) to
/// `date` `start..end`. The block itself is left out of the neighbours, and
/// stored legs to the same neighbours are reused.
pub fn move_preview(trip: &Trip, block_key: &str, date: &str, start: u32, end: u32) -> DragPreview {
    let place = find_block(trip, block_key).and_then(|b| b.place_id).and_then(|id| trip.place(&id));
    preview(trip, place, block_key, date, start, end)
}

fn preview(trip: &Trip, place: Option<&Place>, self_key: &str, date: &str, start: u32, end: u32) -> DragPreview {
    let hours = place.and_then(|p| p.opening_hours.as_ref());
    let closed = dates_between(&trip.start_date, &trip.end_date)
        .into_iter()
        .map(|d| {
            let ranges = hours.and_then(|h| hours::closed_ranges(h, d));
            let all_day = ranges.as_ref().is_some_and(|r| r.as_slice() == [(0, 1440)]);
            DayClosed { date: d.to_string(), ranges, all_day }
        })
        .collect();

    let target = Date::parse(date);
    let in_closed_hours = match (hours, target) {
        (Some(h), Some(d)) => hours::open_throughout(h, d, start, end).map(|open| !open),
        _ => None,
    };
    let hours_message = match (place, target) {
        (Some(p), Some(d)) => hours_problem(p, d, start, end).map(|(_, m)| m),
        _ => None,
    };

    let others: Vec<Block> = blocks_on(trip, date).into_iter().filter(|b| b.key != self_key).collect();
    let over_fixed = others.iter().filter(|b| b.fixed && b.start < end && start < b.end).map(|b| b.key.clone()).collect();
    let before = others.iter().rfind(|b| b.start < start).map(|b| {
        let has = start as i32 - b.end as i32;
        neighbour(trip, b, place, (&b.key, self_key), has, date, false)
    });
    let after = others.iter().find(|b| b.start >= start).map(|b| {
        let has = b.start as i32 - end as i32;
        neighbour(trip, b, place, (self_key, &b.key), has, date, true)
    });

    DragPreview { date: date.to_string(), start, end, closed, before, after, in_closed_hours, hours_message, over_fixed }
}

fn neighbour(trip: &Trip, b: &Block, dragged: Option<&Place>, keys: (&str, &str), has: i32, date: &str, after: bool) -> Neighbour {
    let other = b.place_id.as_deref().and_then(|id| trip.place(id));
    let (travel, needs) = match (other, dragged) {
        (Some(o), Some(d)) if o.id == d.id => (None, Some(0)),
        (Some(o), Some(d)) if o.has_position() && d.has_position() => {
            let (from, to) = if after { (d, o) } else { (o, d) };
            let t = travel::leg_travel(trip, keys.0, keys.1, from, to, date);
            let m = t.minutes;
            (Some(t), m)
        }
        _ => (None, None),
    };
    let fits = needs.map(|n| has >= n as i32);
    let message = match (needs, fits) {
        (Some(n), Some(false)) => Some(needs_has(n, has)),
        _ => None,
    };
    Neighbour {
        key: b.key.clone(),
        title: b.title.clone(),
        place_id: b.place_id.clone(),
        start: b.start,
        end: b.end,
        travel,
        needs,
        has,
        fits,
        message,
    }
}

// ---------- day location ----------

/// Where the day is, as `(lat, lng)`, for daylight and weather (item 22):
/// the night's stay if its place has a position, else the first block's
/// place that has one.
pub fn day_location(trip: &Trip, date: &str) -> Option<(f64, f64)> {
    let position = |id: Option<&str>| {
        let p = trip.place(id?)?;
        Some((p.lat?, p.lng?))
    };
    // The night before sets the day's base (item 49); on the first day, or a
    // day after no stay, the first block with a place decides; failing that,
    // tonight's stay.
    let yesterday = Date::parse(date).map(|d| d.add_days(-1).to_string());
    yesterday
        .and_then(|y| night_on(trip, &y))
        .and_then(|n| position(n.place_id.as_deref()))
        .or_else(|| blocks_on(trip, date).iter().find_map(|b| position(b.place_id.as_deref())))
        .or_else(|| night_on(trip, date).and_then(|n| position(n.place_id.as_deref())))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::{apply, Command, Stamp};
    use serde_json::json;

    // 2026-12-07 is a Monday; the trip runs Mon 12/07 to Fri 12/11.
    const MON: &str = "2026-12-07";
    const TUE: &str = "2026-12-08";
    const WED: &str = "2026-12-09";

    fn stamp() -> Stamp {
        Stamp { group_id: "g".into(), author: Author::User, at: "2026-11-19T10:00:00Z".into(), label: "test".into() }
    }

    fn run(trip: &mut Trip, cmds: Vec<Command>) {
        apply(trip, &cmds, stamp()).unwrap();
    }

    fn place(id: &str, name: &str, pos: Option<(f64, f64)>, hours: serde_json::Value) -> Command {
        let mut v = json!({ "id": id, "name": name, "kind": "sight", "usualStayMinutes": 60 });
        if let Some((lat, lng)) = pos {
            v["lat"] = json!(lat);
            v["lng"] = json!(lng);
        }
        if !hours.is_null() {
            v["openingHours"] = hours;
        }
        Command::AddPlace { place: serde_json::from_value(v).unwrap() }
    }

    fn visit(place_id: &str, item_id: &str, date: &str, start: u32, end: u32) -> Command {
        Command::SchedulePlace { place_id: place_id.into(), item_id: item_id.into(), date: date.into(), start, end: Some(end) }
    }

    fn confirm(from: &str, to: &str, minutes: u32) -> Command {
        Command::ConfirmLegMinutes { from: from.into(), to: to.into(), minutes: Some(minutes) }
    }

    fn hotel(item_id: &str, place_id: &str, check_in: &str, check_out: &str) -> Command {
        let item = json!({
            "id": item_id, "title": "Hotel Gracery", "placeId": place_id, "category": "lodging",
            "stay": {
                "checkInDate": check_in, "checkOutDate": check_out,
                "checkIn": { "date": check_in, "start": 900, "end": 930, "fixed": true, "fixedReason": "Hotel time" },
                "checkOut": { "date": check_out, "start": 600, "end": 630 }
            }
        });
        Command::AddItem { item: serde_json::from_value(item).unwrap() }
    }

    fn every_day(open: u32, close: u32) -> serde_json::Value {
        let r = json!([{ "open": open, "close": close }]);
        json!({ "mon": r, "tue": r, "wed": r, "thu": r, "fri": r, "sat": r, "sun": r })
    }

    /// Places: Senso-ji (6:00–17:00), Skytree (no hours), Ueno Park (no
    /// position), Omoide Yokocho (17:00–24:00, closed Tuesday), Gracery hotel.
    fn trip() -> Trip {
        let mut t = Trip::new("t", "Tokyo", MON, "2026-12-11");
        let mut omoide = every_day(1020, 1440);
        omoide["tue"] = json!([]);
        run(
            &mut t,
            vec![
                place("senso", "Senso-ji", Some((35.7148, 139.7967)), every_day(360, 1020)),
                place("sky", "Tokyo Skytree", Some((35.7101, 139.8107)), json!(null)),
                place("ueno", "Ueno Park", None, json!(null)),
                place("omoide", "Omoide Yokocho", Some((35.6930, 139.6995)), omoide),
                place("gracery", "Hotel Gracery", Some((35.6950, 139.7020)), json!(null)),
            ],
        );
        t
    }

    #[test]
    fn blocks_include_stay_parts_sorted() {
        let mut t = trip();
        run(&mut t, vec![visit("sky", "i2", MON, 780, 840), visit("senso", "i1", MON, 540, 600), hotel("h", "gracery", MON, WED)]);
        let b = blocks_on(&t, MON);
        let keys: Vec<&str> = b.iter().map(|b| b.key.as_str()).collect();
        assert_eq!(keys, ["i1", "i2", "h#checkIn"]);
        assert_eq!(b[2].part, BlockPart::CheckIn);
        assert!(b[2].fixed);
        assert_eq!(b[2].reason.as_deref(), Some("Hotel time"));
        assert_eq!(b[2].place_id.as_deref(), Some("gracery"));
        assert_eq!(b[0].title, "Senso-ji");
        assert_eq!((b[0].start, b[0].end), (540, 600));
        let out = blocks_on(&t, WED);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].key, "h#checkOut");
        assert!(blocks_on(&t, TUE).is_empty());
        assert_eq!(all_blocks(&t).len(), 4);
    }

    #[test]
    fn night_band_covers_check_in_up_to_check_out() {
        let mut t = trip();
        run(&mut t, vec![hotel("h", "gracery", MON, WED)]);
        let n = night_on(&t, MON).unwrap();
        assert_eq!((n.night, n.nights), (1, 2));
        assert_eq!(n.title, "Hotel Gracery");
        assert_eq!(night_on(&t, TUE).unwrap().night, 2);
        assert!(night_on(&t, WED).is_none());
        assert!(night_on(&t, "2026-12-06").is_none());
    }

    #[test]
    fn legs_between_positioned_places_only() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                visit("senso", "a", MON, 540, 600),
                visit("senso", "b", MON, 600, 630),  // same place: no leg
                visit("sky", "c", MON, 640, 700),    // gap 10
                visit("ueno", "d", MON, 720, 780),   // no position: no legs either side
                visit("senso", "e", MON, 800, 840),
                visit("sky", "f", MON, 900, 960),    // gap 60
                confirm("b", "c", 25),
                confirm("e", "f", 25),
            ],
        );
        let legs = legs_on(&t, MON);
        assert_eq!(legs.len(), 2);
        assert_eq!((legs[0].from_key.as_str(), legs[0].to_key.as_str()), ("b", "c"));
        assert_eq!(legs[0].gap_minutes, 10);
        assert_eq!(legs[0].travel.minutes, Some(25));
        assert_eq!(legs[0].travel.source, travel::TravelSource::Confirmed);
        assert!(legs[0].tight);
        assert_eq!(legs[1].gap_minutes, 60);
        assert!(!legs[1].tight);
        assert_eq!((legs[1].from_place_id.as_str(), legs[1].to_place_id.as_str()), ("senso", "sky"));
    }

    #[test]
    fn warns_about_overlap_on_both_blocks() {
        let mut t = trip();
        run(&mut t, vec![visit("ueno", "a", MON, 540, 660), visit("ueno", "b", MON, 600, 690)]);
        let w = warnings(&t);
        assert_eq!(w.len(), 2);
        assert!(w.iter().all(|w| w.kind == WarningKind::Overlap && w.date == MON));
        assert_eq!(w[0].block_key, "a");
        assert_eq!(w[0].other_key.as_deref(), Some("b"));
        assert_eq!(w[0].message, "Ueno Park overlaps Ueno Park (10:00–11:30).");
        assert_eq!(w[1].block_key, "b");
    }

    #[test]
    fn touching_blocks_do_not_overlap() {
        let mut t = trip();
        run(&mut t, vec![visit("ueno", "a", MON, 540, 600), visit("ueno", "b", MON, 600, 660)]);
        assert!(warnings(&t).is_empty());
    }

    #[test]
    fn warns_about_closed_day_and_outside_hours() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                visit("omoide", "early", MON, 960, 1080),  // opens at 17:00
                visit("omoide", "tue", TUE, 1140, 1200),   // closed on Tuesday
                visit("senso", "late", WED, 990, 1050),    // closes at 17:00
                visit("senso", "fine", "2026-12-10", 600, 660),
                visit("sky", "unknown", "2026-12-10", 1400, 1440), // no hours: no warning
            ],
        );
        let w = warnings(&t);
        let got: Vec<(&str, WarningKind, &str)> = w.iter().map(|w| (w.block_key.as_str(), w.kind, w.message.as_str())).collect();
        assert_eq!(
            got,
            [
                ("early", WarningKind::OutsideHours, "Omoide Yokocho opens at 17:00."),
                ("tue", WarningKind::Closed, "Omoide Yokocho is closed on Tue 12/08."),
                ("late", WarningKind::OutsideHours, "Senso-ji closes at 17:00."),
            ]
        );
    }

    #[test]
    fn warns_when_travel_is_too_tight() {
        let mut t = trip();
        run(&mut t, vec![visit("senso", "a", MON, 540, 600), visit("sky", "b", MON, 610, 660), confirm("a", "b", 25)]);
        let w = warnings(&t);
        assert_eq!(w.len(), 1);
        assert_eq!(w[0].kind, WarningKind::TooTight);
        assert_eq!(w[0].block_key, "b");
        assert_eq!(w[0].other_key.as_deref(), Some("a"));
        assert_eq!(w[0].message, "Travel from Senso-ji to Tokyo Skytree needs 25 min, has 10.");
        run(&mut t, vec![confirm("a", "b", 10)]);
        assert!(warnings(&t).is_empty());
    }

    #[test]
    fn warnings_come_in_date_then_block_order() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                visit("omoide", "w2", TUE, 1140, 1200),
                visit("omoide", "w1", MON, 960, 1080),
                visit("senso", "w0", MON, 600, 660),
                visit("sky", "w3", MON, 670, 700),
                confirm("w0", "w3", 30),
            ],
        );
        let w = warnings(&t);
        let keys: Vec<(&str, &str)> = w.iter().map(|w| (w.date.as_str(), w.block_key.as_str())).collect();
        assert_eq!(keys, [(MON, "w3"), (MON, "w1"), (TUE, "w2")]);
    }

    #[test]
    fn drag_preview_hatches_closed_hours_on_every_date() {
        let t = trip();
        let p = drag_preview(&t, "omoide", TUE, 1140, 1200);
        assert_eq!(p.closed.len(), 5);
        assert_eq!(p.closed[0].date, MON);
        assert_eq!(p.closed[0].ranges, Some(vec![(0, 1020)]));
        assert!(!p.closed[0].all_day);
        assert!(p.closed[1].all_day);
        assert_eq!(p.in_closed_hours, Some(true));
        assert_eq!(p.hours_message.as_deref(), Some("Omoide Yokocho is closed on Tue 12/08."));
        assert!(p.before.is_none() && p.after.is_none());

        let ok = drag_preview(&t, "omoide", MON, 1080, 1140);
        assert_eq!(ok.in_closed_hours, Some(false));
        assert!(ok.hours_message.is_none());

        let unknown = drag_preview(&t, "sky", MON, 600, 660);
        assert!(unknown.closed.iter().all(|c| c.ranges.is_none() && !c.all_day));
        assert_eq!(unknown.in_closed_hours, None);
        let missing = drag_preview(&t, "nope", MON, 600, 660);
        assert_eq!(missing.in_closed_hours, None);
    }

    #[test]
    fn drag_preview_finds_neighbours_and_fixed_blocks() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                visit("senso", "a", MON, 540, 600),
                visit("ueno", "b", MON, 780, 840),
                Command::SetFixed { id: "b".into(), part: BlockPart::Main, fixed: true, reason: Some("Must be there".into()) },
            ],
        );
        // Skytree 10:30–13:30: Senso-ji before (estimate), Ueno Park after (no position), over the fixed block.
        let p = drag_preview(&t, "sky", MON, 630, 810);
        let before = p.before.unwrap();
        assert_eq!(before.key, "a");
        assert_eq!(before.has, 30);
        assert!(before.needs.is_some());
        assert_eq!(before.travel.as_ref().map(|t| t.source), Some(travel::TravelSource::Estimate));
        assert_eq!(before.fits, before.needs.map(|n| 30 >= n as i32));
        let after = p.after.unwrap();
        assert_eq!(after.key, "b");
        assert_eq!(after.has, -30);
        assert_eq!((after.needs, after.fits, after.travel), (None, None, None));
        assert_eq!(p.over_fixed, ["b"]);

        // Same place next door needs no travel.
        let same = drag_preview(&t, "senso", MON, 600, 660);
        let before = same.before.unwrap();
        assert_eq!((before.needs, before.fits, before.has), (Some(0), Some(true), 0));
        assert!(same.over_fixed.is_empty());
    }

    #[test]
    fn move_preview_uses_stored_legs_and_skips_itself() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                visit("senso", "a", MON, 540, 600),
                visit("sky", "b", MON, 660, 720),
                visit("omoide", "c", MON, 1080, 1140),
                confirm("a", "b", 25),
                confirm("b", "c", 40),
            ],
        );
        let p = move_preview(&t, "b", MON, 610, 1060);
        let before = p.before.unwrap();
        assert_eq!((before.key.as_str(), before.needs, before.has, before.fits), ("a", Some(25), 10, Some(false)));
        assert_eq!(before.message.as_deref(), Some("needs 25 min, has 10"));
        let after = p.after.unwrap();
        assert_eq!((after.key.as_str(), after.needs, after.has, after.fits), ("c", Some(40), 20, Some(false)));
        assert_eq!(after.message.as_deref(), Some("needs 40 min, has 20"));
        assert_eq!(p.in_closed_hours, None);

        let p = move_preview(&t, "b", MON, 630, 690);
        assert_eq!(p.before.unwrap().fits, Some(true));
        assert!(p.after.unwrap().message.is_none());
    }

    #[test]
    fn day_location_follows_last_nights_stay() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                visit("senso", "m", MON, 540, 600),
                hotel("h", "gracery", MON, TUE),
                visit("ueno", "u", WED, 540, 600),
                visit("senso", "s", WED, 660, 720),
            ],
        );
        // Monday, the first day: no night before, so the first block (Senso-ji).
        assert_eq!(day_location(&t, MON), Some((35.7148, 139.7967)));
        // Tuesday: Monday night was at the hotel, so the day starts there (item 49).
        assert_eq!(day_location(&t, TUE), Some((35.6950, 139.7020)));
        // Wednesday: Ueno Park has no position, so Senso-ji.
        assert_eq!(day_location(&t, WED), Some((35.7148, 139.7967)));
        assert_eq!(day_location(&t, "2026-12-10"), None);
    }

    #[test]
    fn serialises_in_camel_case() {
        let mut t = trip();
        run(&mut t, vec![visit("senso", "a", MON, 540, 600), visit("sky", "b", MON, 610, 660), confirm("a", "b", 25)]);
        let w = serde_json::to_value(warnings(&t)).unwrap();
        assert_eq!(w[0]["blockKey"], "b");
        assert_eq!(w[0]["kind"], "tooTight");
        let l = serde_json::to_value(legs_on(&t, MON)).unwrap();
        assert_eq!(l[0]["gapMinutes"], 10);
        let b = serde_json::to_value(blocks_on(&t, MON)).unwrap();
        assert_eq!(b[0]["itemId"], "a");
        assert_eq!(b[0]["part"], "main");
        let p = serde_json::to_value(drag_preview(&t, "senso", MON, 700, 760)).unwrap();
        assert_eq!(p["closed"][0]["ranges"], json!([[0, 360], [1020, 1440]]));
        assert!(p.get("inClosedHours").is_some() && p.get("overFixed").is_some());
    }
}

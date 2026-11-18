//! Opening hours on a given date (items 27, 28).
//!
//! CONTRACT (schedule.rs and the Wasm API rely on these signatures; keep
//! them, fill in the bodies).

use crate::model::OpeningHours;
use crate::time::Date;

/// Open ranges within `date` (minutes, `0..=1440`, sorted, merged), including
/// the part of the previous day's overnight ranges that runs past midnight.
/// `None` = unknown for that date.
pub fn open_ranges(hours: &OpeningHours, date: Date) -> Option<Vec<(u32, u32)>> {
    let _ = (hours, date);
    todo!("phase 1: hours module")
}

/// The complement of `open_ranges` within the day: what the timetable hatches.
/// `None` = unknown. `Some(vec![(0, 1440)])` = closed all day.
pub fn closed_ranges(hours: &OpeningHours, date: Date) -> Option<Vec<(u32, u32)>> {
    let _ = (hours, date);
    todo!("phase 1: hours module")
}

/// Whether the place is open for the whole of `start..end` on `date`.
/// `None` = unknown.
pub fn open_throughout(hours: &OpeningHours, date: Date, start: u32, end: u32) -> Option<bool> {
    let _ = (hours, date, start, end);
    todo!("phase 1: hours module")
}

//! Opening hours on a given date (items 27, 28).
//!
//! CONTRACT (schedule.rs and the Wasm API rely on these signatures; keep
//! them, fill in the bodies).
//!
//! How a date's hours are worked out
//! - The weekday's own ranges (0 = Monday, `Date::weekday`). A range whose
//!   `close` is not after its `open` runs past midnight: on this date it
//!   covers `open..1440`, and `0..close` spills into the next date.
//! - Plus the spill from the previous date's overnight ranges.
//! - `None` (unknown) for the date's own weekday means the date is unknown,
//!   whatever the previous day says. If only the previous day is unknown,
//!   its spill is taken as nothing: the date's own hours are still known.
//! - Values above 1440 are clamped to 1440.

use crate::model::{OpeningHours, TimeRange};
use crate::time::Date;

const DAY: u32 = 1440;

/// Open ranges within `date` (minutes, `0..=1440`, sorted, merged), including
/// the part of the previous day's overnight ranges that runs past midnight.
/// `None` = unknown for that date.
pub fn open_ranges(hours: &OpeningHours, date: Date) -> Option<Vec<(u32, u32)>> {
    let today = hours.for_weekday(date.weekday())?;
    let mut ranges: Vec<(u32, u32)> = Vec::new();
    for r in today {
        let (open, close) = clamp(r);
        if close > open {
            ranges.push((open, close));
        } else {
            ranges.push((open, DAY));
        }
    }
    if let Some(yesterday) = hours.for_weekday(date.add_days(-1).weekday()) {
        for r in yesterday {
            let (open, close) = clamp(r);
            if close <= open {
                ranges.push((0, close));
            }
        }
    }
    Some(merge(ranges))
}

/// The complement of `open_ranges` within the day: what the timetable hatches.
/// `None` = unknown. `Some(vec![(0, 1440)])` = closed all day.
pub fn closed_ranges(hours: &OpeningHours, date: Date) -> Option<Vec<(u32, u32)>> {
    let open = open_ranges(hours, date)?;
    let mut closed = Vec::new();
    let mut at = 0;
    for (a, b) in open {
        if a > at {
            closed.push((at, a));
        }
        at = at.max(b);
    }
    if at < DAY {
        closed.push((at, DAY));
    }
    Some(closed)
}

/// Whether the place is open for the whole of `start..end` on `date`.
/// `None` = unknown. An empty span (`end <= start`) counts as open when the
/// place is open at `start`.
pub fn open_throughout(hours: &OpeningHours, date: Date, start: u32, end: u32) -> Option<bool> {
    let open = open_ranges(hours, date)?;
    let end = end.min(DAY);
    Some(if end <= start {
        open.iter().any(|&(a, b)| a <= start && start < b)
    } else {
        open.iter().any(|&(a, b)| a <= start && end <= b)
    })
}

fn clamp(r: &TimeRange) -> (u32, u32) {
    (r.open.min(DAY), r.close.min(DAY))
}

/// Sort, drop empty ranges, and join ranges that overlap or touch.
fn merge(mut ranges: Vec<(u32, u32)>) -> Vec<(u32, u32)> {
    ranges.retain(|&(a, b)| b > a);
    ranges.sort_unstable();
    let mut out: Vec<(u32, u32)> = Vec::with_capacity(ranges.len());
    for (a, b) in ranges {
        match out.last_mut() {
            Some(last) if a <= last.1 => last.1 = last.1.max(b),
            _ => out.push((a, b)),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn r(open: u32, close: u32) -> TimeRange {
        TimeRange { open, close }
    }

    fn every_day(ranges: Vec<TimeRange>) -> OpeningHours {
        let mut h = OpeningHours::default();
        for wd in 0..7 {
            h.set_weekday(wd, Some(ranges.clone()));
        }
        h
    }

    // 2026-12-07 is a Monday.
    fn date(s: &str) -> Date {
        Date::parse(s).unwrap()
    }
    const MON: &str = "2026-12-07";
    const TUE: &str = "2026-12-08";
    const WED: &str = "2026-12-09";

    #[test]
    fn weekday_zero_is_monday() {
        assert_eq!(date(MON).weekday(), 0);
        let h = OpeningHours { mon: Some(vec![r(600, 1020)]), ..Default::default() };
        assert_eq!(open_ranges(&h, date(MON)), Some(vec![(600, 1020)]));
        assert_eq!(open_ranges(&h, date(TUE)), None);
    }

    #[test]
    fn plain_day() {
        let h = every_day(vec![r(570, 1020)]);
        assert_eq!(open_ranges(&h, date(TUE)), Some(vec![(570, 1020)]));
        assert_eq!(closed_ranges(&h, date(TUE)), Some(vec![(0, 570), (1020, 1440)]));
        assert_eq!(open_throughout(&h, date(TUE), 600, 700), Some(true));
        assert_eq!(open_throughout(&h, date(TUE), 570, 1020), Some(true));
        assert_eq!(open_throughout(&h, date(TUE), 540, 600), Some(false));
        assert_eq!(open_throughout(&h, date(TUE), 1000, 1030), Some(false));
    }

    #[test]
    fn all_day() {
        let h = every_day(vec![r(0, 1440)]);
        assert_eq!(open_ranges(&h, date(WED)), Some(vec![(0, 1440)]));
        assert_eq!(closed_ranges(&h, date(WED)), Some(vec![]));
        assert_eq!(open_throughout(&h, date(WED), 0, 1440), Some(true));
    }

    #[test]
    fn closed_day_is_not_unknown() {
        let mut h = every_day(vec![r(600, 1080)]);
        h.tue = Some(vec![]);
        assert_eq!(open_ranges(&h, date(TUE)), Some(vec![]));
        assert_eq!(closed_ranges(&h, date(TUE)), Some(vec![(0, 1440)]));
        assert_eq!(open_throughout(&h, date(TUE), 700, 800), Some(false));
        h.tue = None;
        assert_eq!(open_ranges(&h, date(TUE)), None);
        assert_eq!(closed_ranges(&h, date(TUE)), None);
        assert_eq!(open_throughout(&h, date(TUE), 700, 800), None);
    }

    #[test]
    fn no_hours_at_all_is_unknown() {
        let h = OpeningHours::default();
        assert_eq!(open_ranges(&h, date(MON)), None);
        assert_eq!(closed_ranges(&h, date(MON)), None);
    }

    #[test]
    fn overnight_spills_into_next_date() {
        // A bar open 17:00–2:00 on Mondays only.
        let h = OpeningHours { mon: Some(vec![r(1020, 120)]), tue: Some(vec![]), ..Default::default() };
        assert_eq!(open_ranges(&h, date(MON)), Some(vec![(1020, 1440)]));
        // Tuesday is closed, but Monday night runs on until 2:00.
        assert_eq!(open_ranges(&h, date(TUE)), Some(vec![(0, 120)]));
        assert_eq!(closed_ranges(&h, date(TUE)), Some(vec![(120, 1440)]));
        assert_eq!(open_throughout(&h, date(TUE), 30, 90), Some(true));
        assert_eq!(open_throughout(&h, date(TUE), 90, 150), Some(false));
    }

    #[test]
    fn overnight_every_day_merges_with_own_hours() {
        let h = every_day(vec![r(1080, 180)]);
        assert_eq!(open_ranges(&h, date(WED)), Some(vec![(0, 180), (1080, 1440)]));
        assert_eq!(closed_ranges(&h, date(WED)), Some(vec![(180, 1080)]));
    }

    #[test]
    fn spill_from_unknown_previous_day_is_nothing() {
        let h = OpeningHours { tue: Some(vec![r(600, 1200)]), ..Default::default() };
        assert_eq!(open_ranges(&h, date(TUE)), Some(vec![(600, 1200)]));
    }

    #[test]
    fn spill_does_not_make_an_unknown_day_known() {
        let h = OpeningHours { mon: Some(vec![r(1200, 60)]), ..Default::default() };
        assert_eq!(open_ranges(&h, date(TUE)), None);
    }

    #[test]
    fn close_equal_to_open_is_a_full_turn() {
        // 10:00 to 10:00 the next day.
        let h = OpeningHours { mon: Some(vec![r(600, 600)]), tue: Some(vec![]), ..Default::default() };
        assert_eq!(open_ranges(&h, date(MON)), Some(vec![(600, 1440)]));
        assert_eq!(open_ranges(&h, date(TUE)), Some(vec![(0, 600)]));
    }

    #[test]
    fn sunday_spills_into_monday() {
        let mut h = every_day(vec![]);
        h.sun = Some(vec![r(1320, 240)]);
        assert_eq!(open_ranges(&h, date("2026-12-06")), Some(vec![(1320, 1440)]));
        assert_eq!(open_ranges(&h, date(MON)), Some(vec![(0, 240)]));
    }

    #[test]
    fn multiple_ranges_sorted_and_merged() {
        // Lunch and dinner, given out of order, plus an overlapping and a touching range.
        let h = every_day(vec![r(1020, 1320), r(690, 840), r(800, 900), r(900, 930)]);
        assert_eq!(open_ranges(&h, date(WED)), Some(vec![(690, 930), (1020, 1320)]));
        assert_eq!(closed_ranges(&h, date(WED)), Some(vec![(0, 690), (930, 1020), (1320, 1440)]));
        assert_eq!(open_throughout(&h, date(WED), 840, 930), Some(true));
        assert_eq!(open_throughout(&h, date(WED), 900, 1050), Some(false));
    }

    #[test]
    fn clamps_out_of_range_values() {
        let h = every_day(vec![r(600, 2000)]);
        assert_eq!(open_ranges(&h, date(WED)), Some(vec![(600, 1440)]));
        assert_eq!(open_throughout(&h, date(WED), 1400, 1500), Some(true));
    }

    #[test]
    fn empty_span_checks_the_start() {
        let h = every_day(vec![r(600, 1020)]);
        assert_eq!(open_throughout(&h, date(WED), 700, 700), Some(true));
        assert_eq!(open_throughout(&h, date(WED), 1020, 1020), Some(false));
    }
}

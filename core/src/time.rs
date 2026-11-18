//! Calendar dates and clock times, without a time zone database.
//!
//! A `Date` is a day in the local calendar of wherever the trip is. Clock
//! times are minutes from local midnight. Converting to UTC (for sun times)
//! uses an offset the UI passes in (`Day::utc_offset_minutes`).

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Date {
    pub year: i32,
    pub month: u32,
    pub day: u32,
}

impl Date {
    /// Parse `YYYY-MM-DD`. Returns `None` for anything else or an impossible date.
    pub fn parse(s: &str) -> Option<Date> {
        let mut parts = s.trim().split('-');
        let year: i32 = parts.next()?.parse().ok()?;
        let month: u32 = parts.next()?.parse().ok()?;
        let day: u32 = parts.next()?.parse().ok()?;
        if parts.next().is_some() || !(1..=12).contains(&month) {
            return None;
        }
        if day == 0 || day > days_in_month(year, month) {
            return None;
        }
        Some(Date { year, month, day })
    }

    /// Days since 1970-01-01 (negative before).
    pub fn to_days(self) -> i64 {
        // Howard Hinnant's days_from_civil.
        let y = if self.month <= 2 { self.year - 1 } else { self.year } as i64;
        let era = if y >= 0 { y } else { y - 399 } / 400;
        let yoe = y - era * 400;
        let m = self.month as i64;
        let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + self.day as i64 - 1;
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        era * 146097 + doe - 719468
    }

    pub fn from_days(z: i64) -> Date {
        // Howard Hinnant's civil_from_days.
        let z = z + 719468;
        let era = if z >= 0 { z } else { z - 146096 } / 146097;
        let doe = z - era * 146097;
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        let y = yoe + era * 400;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
        let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
        Date { year: (if m <= 2 { y + 1 } else { y }) as i32, month: m, day: d }
    }

    pub fn add_days(self, n: i64) -> Date {
        Date::from_days(self.to_days() + n)
    }

    /// Whole days from `self` to `other` (positive if `other` is later).
    pub fn days_until(self, other: Date) -> i64 {
        other.to_days() - self.to_days()
    }

    /// 0 = Monday … 6 = Sunday (matches `OpeningHours::for_weekday`).
    pub fn weekday(self) -> u8 {
        // 1970-01-01 was a Thursday (3).
        (self.to_days() + 3).rem_euclid(7) as u8
    }

    pub fn weekday_short(self) -> &'static str {
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][self.weekday() as usize]
    }

    /// Day of the year, 1-based.
    pub fn ordinal(self) -> u32 {
        (self.to_days() - Date { year: self.year, month: 1, day: 1 }.to_days()) as u32 + 1
    }

    /// The app's date label, month/day: `12/02` (item: date format).
    pub fn month_day(self) -> String {
        format!("{:02}/{:02}", self.month, self.day)
    }
}

impl fmt::Display for Date {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:04}-{:02}-{:02}", self.year, self.month, self.day)
    }
}

pub fn is_leap(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

pub fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap(year) => 29,
        2 => 28,
        _ => 0,
    }
}

/// Every date from start to end, inclusive. Empty if either is invalid or
/// end is before start. Capped at 366 days.
pub fn dates_between(start: &str, end: &str) -> Vec<Date> {
    let (Some(a), Some(b)) = (Date::parse(start), Date::parse(end)) else { return Vec::new() };
    let n = a.days_until(b);
    if !(0..366).contains(&n) {
        return Vec::new();
    }
    (0..=n).map(|i| a.add_days(i)).collect()
}

/// `"09:30"` → 570. Accepts `H:MM` and `HH:MM`, and `24:00` (= 1440).
pub fn parse_hhmm(s: &str) -> Option<u32> {
    let (h, m) = s.trim().split_once(':')?;
    if h.is_empty() || h.len() > 2 || m.len() != 2 {
        return None;
    }
    let h: u32 = h.parse().ok()?;
    let m: u32 = m.parse().ok()?;
    if m > 59 || h > 24 || (h == 24 && m != 0) {
        return None;
    }
    Some(h * 60 + m)
}

/// 570 → `"9:30"`, the style used on blocks. 1440 → `"24:00"`.
pub fn fmt_hhmm(min: u32) -> String {
    format!("{}:{:02}", min / 60, min % 60)
}

/// Round to the nearest step, for snapping drags (item 11: 15 minutes).
pub fn snap(min: u32, step: u32) -> u32 {
    if step == 0 {
        return min;
    }
    ((min + step / 2) / step) * step
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_formats_dates() {
        let d = Date::parse("2026-12-02").unwrap();
        assert_eq!(d.to_string(), "2026-12-02");
        assert_eq!(d.month_day(), "12/02");
        assert_eq!(d.weekday_short(), "Wed");
        assert!(Date::parse("2026-02-29").is_none());
        assert!(Date::parse("2028-02-29").is_some());
        assert!(Date::parse("2026-13-01").is_none());
        assert!(Date::parse("12/02").is_none());
    }

    #[test]
    fn round_trips_day_numbers() {
        for z in [-800_000i64, -1, 0, 1, 20_000, 800_000] {
            assert_eq!(Date::from_days(z).to_days(), z);
        }
        assert_eq!(Date::parse("1970-01-01").unwrap().to_days(), 0);
        assert_eq!(Date::parse("2026-12-31").unwrap().add_days(1).to_string(), "2027-01-01");
    }

    #[test]
    fn lists_trip_dates() {
        let d = dates_between("2026-12-02", "2026-12-06");
        assert_eq!(d.len(), 5);
        assert_eq!(d[4].to_string(), "2026-12-06");
        assert!(dates_between("2026-12-06", "2026-12-02").is_empty());
    }

    #[test]
    fn parses_clock_times() {
        assert_eq!(parse_hhmm("09:30"), Some(570));
        assert_eq!(parse_hhmm("9:30"), Some(570));
        assert_eq!(parse_hhmm("24:00"), Some(1440));
        assert_eq!(parse_hhmm("24:30"), None);
        assert_eq!(parse_hhmm("9:5"), None);
        assert_eq!(fmt_hhmm(570), "9:30");
        assert_eq!(snap(577, 15), 570);
        assert_eq!(snap(578, 15), 585);
    }
}

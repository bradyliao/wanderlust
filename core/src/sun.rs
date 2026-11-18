//! Sun times and daylight stages for the timetable background (items 21–23, 26).
//!
//! CONTRACT (the Wasm API relies on these signatures; keep them, fill in the
//! bodies). Calculated offline from date and position (NOAA solar equations).

use crate::time::Date;
use serde::Serialize;

/// Local clock minutes from midnight. `None` when the sun does not rise or
/// set that day (polar day or night).
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SunTimes {
    /// Civil dawn: sun 6° below the horizon.
    pub dawn: Option<u32>,
    pub sunrise: Option<u32>,
    pub sunset: Option<u32>,
    /// Civil dusk.
    pub dusk: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Stage {
    Night,
    Twilight,
    GoldenHour,
    Day,
}

/// A colour stop for the gradient: from `minute` on, the sky is `stage`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stop {
    pub minute: u32,
    pub stage: Stage,
}

/// Zenith angle at sunrise and sunset: 90° plus refraction and the sun's radius.
const ZENITH_SUN: f64 = 90.833;
/// Zenith angle at civil dawn and dusk: sun 6° below the horizon.
const ZENITH_CIVIL: f64 = 96.0;
/// Length of each golden hour after sunrise and before sunset (item 23).
const GOLDEN_MINUTES: u32 = 60;

/// Julian day of 1970-01-01 00:00 UTC.
const JD_UNIX_EPOCH: f64 = 2_440_587.5;
/// Julian day of J2000.0.
const JD_J2000: f64 = 2_451_545.0;

/// Equation of time (minutes) and solar declination (degrees) at Julian day
/// `jd`, from the NOAA solar calculator (after Meeus).
fn solar(jd: f64) -> (f64, f64) {
    let t = (jd - JD_J2000) / 36525.0;
    let l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)).rem_euclid(360.0);
    let m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    let e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    let mr = m.to_radians();
    let center = mr.sin() * (1.914602 - t * (0.004817 + 0.000014 * t))
        + (2.0 * mr).sin() * (0.019993 - 0.000101 * t)
        + (3.0 * mr).sin() * 0.000289;
    let true_long = l0 + center;
    let omega = (125.04 - 1934.136 * t).to_radians();
    let apparent_long = (true_long - 0.00569 - 0.00478 * omega.sin()).to_radians();
    let mean_obliquity = 23.0 + (26.0 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60.0) / 60.0;
    let obliquity = (mean_obliquity + 0.00256 * omega.cos()).to_radians();
    let declination = (obliquity.sin() * apparent_long.sin()).asin().to_degrees();

    let y = (obliquity / 2.0).tan().powi(2);
    let l0r = l0.to_radians();
    let eq = y * (2.0 * l0r).sin() - 2.0 * e * mr.sin() + 4.0 * e * y * mr.sin() * (2.0 * l0r).cos()
        - 0.5 * y * y * (4.0 * l0r).sin()
        - 1.25 * e * e * (2.0 * mr).sin();
    (4.0 * eq.to_degrees(), declination)
}

/// Hour angle (degrees) when the sun's centre is at `zenith`. `None` when it
/// never gets there that day.
fn hour_angle(lat: f64, declination: f64, zenith: f64) -> Option<f64> {
    let (lat, dec) = (lat.to_radians(), declination.to_radians());
    let cos_ha = zenith.to_radians().cos() / (lat.cos() * dec.cos()) - lat.tan() * dec.tan();
    (-1.0..=1.0).contains(&cos_ha).then(|| cos_ha.acos().to_degrees())
}

/// UTC minutes from `date` 00:00 UTC (may be negative or past 1440) when the
/// sun crosses `zenith`, rising or setting. Refined three times so the sun's
/// position is taken at the event itself.
fn event_utc(lat: f64, lng: f64, date: Date, zenith: f64, rising: bool) -> Option<f64> {
    let jd0 = date.to_days() as f64 + JD_UNIX_EPOCH;
    let mut minutes = 720.0 - 4.0 * lng;
    for _ in 0..3 {
        let (eq, dec) = solar(jd0 + minutes / 1440.0);
        let ha = hour_angle(lat, dec, zenith)?;
        let noon = 720.0 - 4.0 * lng - eq;
        minutes = if rising { noon - 4.0 * ha } else { noon + 4.0 * ha };
    }
    Some(minutes)
}

fn local(utc_minutes: Option<f64>, offset: i32) -> Option<u32> {
    utc_minutes.map(|m| ((m + offset as f64).round() as i64).rem_euclid(1440) as u32)
}

/// Sun times at `(lat, lng)` on `date`, in local time `utc_offset_minutes`
/// from UTC.
pub fn sun_times(lat: f64, lng: f64, date: Date, utc_offset_minutes: i32) -> SunTimes {
    let at = |zenith, rising| local(event_utc(lat, lng, date, zenith, rising), utc_offset_minutes);
    SunTimes {
        dawn: at(ZENITH_CIVIL, true),
        sunrise: at(ZENITH_SUN, true),
        sunset: at(ZENITH_SUN, false),
        dusk: at(ZENITH_CIVIL, false),
    }
}

/// Stages through the day, starting at minute 0: night, twilight (dawn to
/// sunrise), golden hour (sunrise + 60), day, golden hour (sunset − 60),
/// twilight (sunset to dusk), night. The UI blends colours between stops.
///
/// Missing times: no dawn and dusk (white nights) means twilight instead of
/// night; no sunrise and sunset means the sun stays down, with twilight
/// between dawn and dusk if those exist. When nothing at all is known this
/// gives night all day; use [`daylight_stops_at`] to tell polar day from
/// polar night.
pub fn daylight_stops(sun: &SunTimes) -> Vec<Stop> {
    let mut stops = Stops(Vec::new());
    match (sun.sunrise, sun.sunset) {
        (Some(rise), Some(set)) if rise < set => {
            stops.push(0, if sun.dawn.is_some() { Stage::Night } else { Stage::Twilight });
            if let Some(dawn) = sun.dawn.filter(|&d| d < rise) {
                stops.push(dawn, Stage::Twilight);
            }
            stops.push(rise, Stage::GoldenHour);
            // On short days the two golden hours meet in the middle.
            let mid = rise + (set - rise) / 2;
            let day_from = (rise + GOLDEN_MINUTES).min(mid);
            let day_to = set.saturating_sub(GOLDEN_MINUTES).max(mid);
            if day_from < day_to {
                stops.push(day_from, Stage::Day);
                stops.push(day_to, Stage::GoldenHour);
            }
            stops.push(set, Stage::Twilight);
            if let Some(dusk) = sun.dusk.filter(|&d| d > set) {
                stops.push(dusk, Stage::Night);
            }
        }
        _ => {
            stops.push(0, Stage::Night);
            if let (Some(dawn), Some(dusk)) = (sun.dawn, sun.dusk) {
                if dawn < dusk {
                    stops.push(dawn, Stage::Twilight);
                    stops.push(dusk, Stage::Night);
                }
            }
        }
    }
    stops.0
}

/// [`daylight_stops`] for a place and date, telling polar day (day all
/// through) from polar night, which `SunTimes` alone cannot.
pub fn daylight_stops_at(lat: f64, lng: f64, date: Date, utc_offset_minutes: i32) -> Vec<Stop> {
    let sun = sun_times(lat, lng, date, utc_offset_minutes);
    if sun.sunrise.is_none() && sun.dawn.is_none() && sun.dusk.is_none() {
        let jd_noon = date.to_days() as f64 + JD_UNIX_EPOCH + (720.0 - 4.0 * lng) / 1440.0;
        let (_, dec) = solar(jd_noon);
        let noon_elevation = 90.0 - (lat - dec).abs();
        if noon_elevation > 90.0 - ZENITH_SUN {
            return vec![Stop { minute: 0, stage: Stage::Day }];
        }
    }
    daylight_stops(&sun)
}

/// Stops kept in time order; a stop at the same minute replaces the last one.
struct Stops(Vec<Stop>);

impl Stops {
    fn push(&mut self, minute: u32, stage: Stage) {
        match self.0.last_mut() {
            Some(last) if last.minute == minute => last.stage = stage,
            Some(last) if last.minute > minute => {}
            _ => self.0.push(Stop { minute, stage }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(s: &str) -> Date {
        Date::parse(s).unwrap()
    }

    fn near(actual: Option<u32>, h: u32, m: u32) {
        let expected = h * 60 + m;
        let a = actual.expect("a time");
        assert!(a.abs_diff(expected) <= 3, "got {}:{:02}, expected {h}:{m:02}", a / 60, a % 60);
    }

    #[test]
    fn tokyo_in_december() {
        let s = sun_times(35.68, 139.76, date("2026-12-02"), 540);
        near(s.sunrise, 6, 35);
        near(s.sunset, 16, 28);
        // Civil twilight lasts about 27 minutes there in December.
        let (dawn, dusk) = (s.dawn.unwrap(), s.dusk.unwrap());
        assert!((20..=35).contains(&(s.sunrise.unwrap() - dawn)), "dawn {dawn}");
        assert!((20..=35).contains(&(dusk - s.sunset.unwrap())), "dusk {dusk}");
    }

    #[test]
    fn london_at_midsummer() {
        // 2026-06-21, British Summer Time (+60): sunrise 4:43, sunset 21:21.
        let s = sun_times(51.5074, -0.1278, date("2026-06-21"), 60);
        near(s.sunrise, 4, 43);
        near(s.sunset, 21, 21);
    }

    #[test]
    fn polar_night_and_day() {
        // Tromsø: no sunrise at midwinter, but civil twilight around noon.
        let s = sun_times(69.65, 18.96, date("2026-12-21"), 60);
        assert_eq!((s.sunrise, s.sunset), (None, None));
        assert!(s.dawn.is_some() && s.dusk.is_some());
        let stops = daylight_stops(&s);
        assert_eq!(stops.iter().map(|s| s.stage).collect::<Vec<_>>(), [Stage::Night, Stage::Twilight, Stage::Night]);

        // Tromsø midnight sun: nothing rises or sets.
        let s = sun_times(69.65, 18.96, date("2026-06-21"), 120);
        assert_eq!(s, SunTimes { dawn: None, sunrise: None, sunset: None, dusk: None });
        assert_eq!(daylight_stops_at(69.65, 18.96, date("2026-06-21"), 120), [Stop { minute: 0, stage: Stage::Day }]);

        // Svalbard at midwinter: not even civil twilight.
        let s = sun_times(78.22, 15.65, date("2026-12-21"), 60);
        assert_eq!(s, SunTimes { dawn: None, sunrise: None, sunset: None, dusk: None });
        assert_eq!(daylight_stops_at(78.22, 15.65, date("2026-12-21"), 60), [Stop { minute: 0, stage: Stage::Night }]);
    }

    #[test]
    fn stops_through_a_normal_day() {
        let s = SunTimes { dawn: Some(368), sunrise: Some(395), sunset: Some(988), dusk: Some(1015) };
        let stops = daylight_stops(&s);
        let expected = [
            (0, Stage::Night),
            (368, Stage::Twilight),
            (395, Stage::GoldenHour),
            (455, Stage::Day),
            (928, Stage::GoldenHour),
            (988, Stage::Twilight),
            (1015, Stage::Night),
        ];
        assert_eq!(stops, expected.map(|(minute, stage)| Stop { minute, stage }));
        assert_eq!(daylight_stops_at(35.68, 139.76, date("2026-12-02"), 540).len(), 7);
    }

    #[test]
    fn stops_on_short_days_and_white_nights() {
        // Under two hours of sun: the golden hours meet, no day stage.
        let s = SunTimes { dawn: Some(600), sunrise: Some(660), sunset: Some(740), dusk: Some(800) };
        let stages: Vec<_> = daylight_stops(&s).iter().map(|s| s.stage).collect();
        assert_eq!(stages, [Stage::Night, Stage::Twilight, Stage::GoldenHour, Stage::Twilight, Stage::Night]);

        // White nights: no civil dawn or dusk, so twilight instead of night.
        let s = SunTimes { dawn: None, sunrise: Some(220), sunset: Some(1360), dusk: None };
        let stops = daylight_stops(&s);
        assert_eq!(stops.first().unwrap().stage, Stage::Twilight);
        assert_eq!(stops.last().unwrap(), &Stop { minute: 1360, stage: Stage::Twilight });
        assert!(stops.windows(2).all(|w| w[0].minute < w[1].minute));
    }
}

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

/// Sun times at `(lat, lng)` on `date`, in local time `utc_offset_minutes`
/// from UTC.
pub fn sun_times(lat: f64, lng: f64, date: Date, utc_offset_minutes: i32) -> SunTimes {
    let _ = (lat, lng, date, utc_offset_minutes);
    todo!("phase 1: sun module")
}

/// Stages through the day, starting at minute 0: night, twilight (dawn to
/// sunrise), golden hour (sunrise + 60), day, golden hour (sunset − 60),
/// twilight (sunset to dusk), night. The UI blends colours between stops.
pub fn daylight_stops(sun: &SunTimes) -> Vec<Stop> {
    let _ = sun;
    todo!("phase 1: sun module")
}

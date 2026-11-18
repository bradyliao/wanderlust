//! Travel between blocks: estimates, mode choice, walk hints, Maps links.
//!
//! CONTRACT (other modules and the Wasm API rely on these signatures; keep
//! them, fill in the bodies). Items 29, 33–37 in docs/layout-and-behavior.md.

use crate::model::*;
use serde::Serialize;

/// Legs shorter than this get a walk hint (item 35).
pub const WALK_HINT_KM: f64 = 1.0;

/// Where a leg's minutes came from. The UI labels anything but `Confirmed`
/// as an estimate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TravelSource {
    /// The app's own instant estimate (used while dragging, item 29).
    Estimate,
    /// A stored routing result (`Leg::routed`).
    Routed,
    /// Minutes the user confirmed.
    Confirmed,
}

/// Everything the timetable and map need about one leg.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegTravel {
    pub mode: Mode,
    /// `None` when a position is missing and nothing is stored.
    pub minutes: Option<u32>,
    pub source: TravelSource,
    /// Straight-line distance, if both places have positions.
    pub distance_km: Option<f64>,
    /// Walking minutes, when the leg is short and its mode is not Walk (item 35).
    pub walk_hint: Option<u32>,
    /// Minutes for every mode, for the picker (item 36).
    pub options: Vec<ModeOption>,
    /// The stored route line for the chosen mode, `[lng, lat]` pairs, if any.
    pub line: Vec<[f64; 2]>,
    /// Google Maps directions link for the chosen mode.
    pub maps_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModeOption {
    pub mode: Mode,
    pub minutes: Option<u32>,
    pub source: TravelSource,
}

/// Great-circle distance in kilometres between `(lat, lng)` points.
pub fn distance_km(a: (f64, f64), b: (f64, f64)) -> f64 {
    let _ = (a, b);
    todo!("phase 1: travel module")
}

/// The app's own estimate for one mode, from straight-line distance.
/// `None` if either place has no position.
pub fn estimate_minutes(from: &Place, to: &Place, mode: Mode) -> Option<u32> {
    let _ = (from, to, mode);
    todo!("phase 1: travel module")
}

/// Travel for the leg `from_key` → `to_key` (encoded `BlockKey`s) on `date`,
/// between places `from` and `to`. Uses, in order: confirmed minutes, a
/// stored routing result, the estimate. Mode: the leg's own choice, else the
/// day's, else the trip default (item 34).
pub fn leg_travel(trip: &Trip, from_key: &str, to_key: &str, from: &Place, to: &Place, date: &str) -> LegTravel {
    let _ = (trip, from_key, to_key, from, to, date);
    todo!("phase 1: travel module")
}

/// Google Maps directions link, `api=1` form, with the travel mode mapped
/// (Ride → driving, TwoWheeler → two-wheeler where Google supports it, else driving).
pub fn maps_directions_url(from: &Place, to: &Place, mode: Mode) -> Option<String> {
    let _ = (from, to, mode);
    todo!("phase 1: travel module")
}

/// Coordinates written in a Google Maps link (`@lat,lng`, `!3d…!4d…`,
/// `q=lat,lng`), or a plain `"lat, lng"`. Short links (maps.app.goo.gl) hold
/// none and return `None`.
pub fn coords_from_maps_url(text: &str) -> Option<(f64, f64)> {
    let _ = text;
    todo!("phase 1: travel module")
}

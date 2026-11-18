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

/// Every mode, in the order Google Maps lists them (item 33). The picker
/// (`LegTravel::options`) uses this order.
pub const ALL_MODES: [Mode; 6] = [Mode::Drive, Mode::Transit, Mode::Walk, Mode::TwoWheeler, Mode::Cycle, Mode::Ride];

/// Mean Earth radius for the haversine formula.
const EARTH_RADIUS_KM: f64 = 6371.0;

// Estimate numbers: ROUGH STAND-INS until a routing service fills
// `Leg::routed`. Chosen to give plausible city-trip times, not measured.
// Streets are longer than the straight line (detour factor), speeds are
// average door-to-door speeds, overhead is fixed time per trip.

/// Walking: 4.5 km/h, streets about 30% longer than the straight line.
const WALK: Profile = Profile { detour: 1.3, speed_kmh: 4.5, overhead_min: 0.0 };
/// Cycling (own bike or bike-share): 14 km/h, 2 min to unlock and park.
const CYCLE: Profile = Profile { detour: 1.3, speed_kmh: 14.0, overhead_min: 2.0 };
/// Motor scooter or moped: 25 km/h in town, 3 min to park.
const TWO_WHEELER: Profile = Profile { detour: 1.35, speed_kmh: 25.0, overhead_min: 3.0 };
/// Driving yourself: 25 km/h city average, 5 min to park.
const DRIVE: Profile = Profile { detour: 1.4, speed_kmh: 25.0, overhead_min: 5.0 };
/// Taxi or ride-hail: driving speed plus 6 min waiting for the pickup.
const RIDE: Profile = Profile { detour: 1.4, speed_kmh: 25.0, overhead_min: 6.0 };
/// Train, metro or bus: 10 min to walk to the station and wait, then 20 km/h
/// on average including changes.
const TRANSIT: Profile = Profile { detour: 1.2, speed_kmh: 20.0, overhead_min: 10.0 };

/// Estimates are rounded up to this many minutes, and are at least this long.
const ROUND_TO_MIN: u32 = 5;

#[derive(Debug, Clone, Copy)]
struct Profile {
    detour: f64,
    speed_kmh: f64,
    overhead_min: f64,
}

fn profile(mode: Mode) -> Profile {
    match mode {
        Mode::Walk => WALK,
        Mode::Cycle => CYCLE,
        Mode::TwoWheeler => TWO_WHEELER,
        Mode::Drive => DRIVE,
        Mode::Ride => RIDE,
        Mode::Transit => TRANSIT,
    }
}

fn position(p: &Place) -> Option<(f64, f64)> {
    Some((p.lat?, p.lng?))
}

/// Great-circle distance in kilometres between `(lat, lng)` points.
pub fn distance_km(a: (f64, f64), b: (f64, f64)) -> f64 {
    let (lat1, lat2) = (a.0.to_radians(), b.0.to_radians());
    let dlat = lat2 - lat1;
    let dlng = (b.1 - a.1).to_radians();
    let h = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlng / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_KM * h.sqrt().min(1.0).asin()
}

/// Estimated minutes for a straight-line distance: rounded up to 5, at least 5.
fn estimate_for_km(km: f64, mode: Mode) -> u32 {
    let p = profile(mode);
    let minutes = km * p.detour / p.speed_kmh * 60.0 + p.overhead_min;
    let steps = (minutes / ROUND_TO_MIN as f64).ceil().max(1.0);
    steps as u32 * ROUND_TO_MIN
}

/// The app's own estimate for one mode, from straight-line distance.
/// `None` if either place has no position.
pub fn estimate_minutes(from: &Place, to: &Place, mode: Mode) -> Option<u32> {
    let km = distance_km(position(from)?, position(to)?);
    Some(estimate_for_km(km, mode))
}

/// Travel for the leg `from_key` → `to_key` (encoded `BlockKey`s) on `date`,
/// between places `from` and `to`. Uses, in order: confirmed minutes, a
/// stored routing result, the estimate. Mode: the leg's own choice, else the
/// day's, else the trip default (item 34).
pub fn leg_travel(trip: &Trip, from_key: &str, to_key: &str, from: &Place, to: &Place, date: &str) -> LegTravel {
    let leg = trip.leg(from_key, to_key);
    let mode = leg.and_then(|l| l.mode).unwrap_or_else(|| trip.default_mode_on(date));
    let distance = match (position(from), position(to)) {
        (Some(a), Some(b)) => Some(distance_km(a, b)),
        _ => None,
    };
    let routed_for = |m: Mode| leg.and_then(|l| l.routed.iter().find(|r| r.mode == m));

    let options: Vec<ModeOption> = ALL_MODES
        .iter()
        .map(|&m| match routed_for(m) {
            Some(r) => ModeOption { mode: m, minutes: Some(r.minutes), source: TravelSource::Routed },
            None => ModeOption { mode: m, minutes: distance.map(|km| estimate_for_km(km, m)), source: TravelSource::Estimate },
        })
        .collect();
    let option_for = |m: Mode| options.iter().find(|o| o.mode == m).expect("every mode has an option");

    let (minutes, source) = match leg.and_then(|l| l.confirmed_minutes) {
        Some(c) => (Some(c), TravelSource::Confirmed),
        None => {
            let o = option_for(mode);
            (o.minutes, o.source)
        }
    };

    let walk_hint = match distance {
        Some(km) if km < WALK_HINT_KM && mode != Mode::Walk => option_for(Mode::Walk).minutes,
        _ => None,
    };

    LegTravel {
        mode,
        minutes,
        source,
        distance_km: distance,
        walk_hint,
        line: routed_for(mode).map(|r| r.line.clone()).unwrap_or_default(),
        maps_url: maps_directions_url(from, to, mode),
        options,
    }
}

/// Google Maps directions link, `api=1` form, with the travel mode mapped
/// (Ride → driving, TwoWheeler → two-wheeler where Google supports it, else driving).
pub fn maps_directions_url(from: &Place, to: &Place, mode: Mode) -> Option<String> {
    let (a, b) = (position(from)?, position(to)?);
    let travelmode = match mode {
        Mode::Drive | Mode::Ride => "driving",
        Mode::Transit => "transit",
        Mode::Walk => "walking",
        Mode::Cycle => "bicycling",
        Mode::TwoWheeler => "two-wheeler",
    };
    Some(format!(
        "https://www.google.com/maps/dir/?api=1&origin={},{}&destination={},{}&travelmode={travelmode}",
        a.0, a.1, b.0, b.1
    ))
}

/// Coordinates written in a Google Maps link (`@lat,lng`, `!3d…!4d…`,
/// `q=lat,lng`), or a plain `"lat, lng"`. Short links (maps.app.goo.gl) hold
/// none and return `None`.
pub fn coords_from_maps_url(text: &str) -> Option<(f64, f64)> {
    let text = text.trim();
    if text.is_empty() || text.contains("goo.gl/") {
        return None;
    }
    // The place's own pin, more exact than the viewport centre after `@`.
    let pin = after(text, "!3d").and_then(|rest| {
        let (lat, rest) = leading_number(rest)?;
        let (lng, _) = leading_number(rest.strip_prefix("!4d")?)?;
        valid(lat, lng)
    });
    if pin.is_some() {
        return pin;
    }
    for key in ["?q=", "&q=", "?query=", "&query=", "?ll=", "&ll="] {
        let mut rest = text;
        while let Some(i) = rest.find(key) {
            rest = &rest[i + key.len()..];
            let value = rest.split(['&', '#']).next().unwrap_or("");
            if let Some(found) = pair(&decode(value)) {
                return Some(found);
            }
        }
    }
    let viewport = after(text, "@").and_then(|rest| {
        let (lat, rest) = leading_number(rest)?;
        let (lng, _) = leading_number(rest.strip_prefix(',')?)?;
        valid(lat, lng)
    });
    if viewport.is_some() {
        return viewport;
    }
    pair(text)
}

fn after<'a>(text: &'a str, marker: &str) -> Option<&'a str> {
    text.find(marker).map(|i| &text[i + marker.len()..])
}

/// A decimal number at the start of `s`, and the rest after it.
fn leading_number(s: &str) -> Option<(f64, &str)> {
    let end = s
        .char_indices()
        .find(|&(i, c)| !(c.is_ascii_digit() || c == '.' || ((c == '-' || c == '+') && i == 0)))
        .map_or(s.len(), |(i, _)| i);
    let n: f64 = s[..end].parse().ok()?;
    Some((n, &s[end..]))
}

/// Exactly `"lat,lng"`, spaces allowed around the parts.
fn pair(s: &str) -> Option<(f64, f64)> {
    let (a, b) = s.trim().split_once(',')?;
    valid(a.trim().parse().ok()?, b.trim().parse().ok()?)
}

fn valid(lat: f64, lng: f64) -> Option<(f64, f64)> {
    let ok = lat.is_finite() && lng.is_finite() && (-90.0..=90.0).contains(&lat) && (-180.0..=180.0).contains(&lng);
    ok.then_some((lat, lng))
}

/// Undo the URL escapes that can appear in a coordinate value.
fn decode(s: &str) -> String {
    s.replace("%2C", ",").replace("%2c", ",").replace("%20", " ").replace('+', " ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn place(id: &str, lat: Option<f64>, lng: Option<f64>) -> Place {
        serde_json::from_value(json!({ "id": id, "name": id, "kind": "sight", "lat": lat, "lng": lng })).unwrap()
    }

    // Senso-ji to Tokyo Skytree is about 1.3 km; to Kaminarimon about 400 m;
    // to Shibuya about 10.5 km.
    fn sensoji() -> Place {
        place("sensoji", Some(35.7148), Some(139.7967))
    }
    fn skytree() -> Place {
        place("skytree", Some(35.7101), Some(139.8107))
    }
    fn kaminarimon() -> Place {
        place("kaminarimon", Some(35.7111), Some(139.7963))
    }
    fn shibuya() -> Place {
        place("shibuya", Some(35.6595), Some(139.7005))
    }

    fn trip() -> Trip {
        Trip::new("t1", "Tokyo", "2026-12-02", "2026-12-06")
    }

    #[test]
    fn haversine_distance() {
        // Tokyo Station to Osaka Station is about 403 km in a straight line.
        let d = distance_km((35.6812, 139.7671), (34.7025, 135.4959));
        assert!((d - 403.0).abs() < 3.0, "{d}");
        assert_eq!(distance_km((35.0, 139.0), (35.0, 139.0)), 0.0);
        // One degree of latitude is about 111.2 km.
        assert!((distance_km((0.0, 0.0), (1.0, 0.0)) - 111.19).abs() < 0.1);
    }

    #[test]
    fn estimates_round_up_to_five_minutes() {
        let a = sensoji();
        assert_eq!(estimate_minutes(&a, &a, Mode::Walk), Some(5));
        assert_eq!(estimate_minutes(&a, &a, Mode::Transit), Some(10));
        for m in ALL_MODES {
            for b in [sensoji(), kaminarimon(), skytree(), shibuya()] {
                let e = estimate_minutes(&a, &b, m).unwrap();
                assert!(e >= 5 && e.is_multiple_of(5), "{m:?} {e}");
            }
        }
        // 1.3 km walk: 1.3 × 1.3 / 4.5 h ≈ 22.5 min → 25.
        assert_eq!(estimate_minutes(&a, &skytree(), Mode::Walk), Some(25));
        let walk = estimate_minutes(&a, &shibuya(), Mode::Walk).unwrap();
        let transit = estimate_minutes(&a, &shibuya(), Mode::Transit).unwrap();
        assert!(walk > 120 && transit < 60, "walk {walk} transit {transit}");
        assert_eq!(estimate_minutes(&a, &place("x", None, Some(139.0)), Mode::Walk), None);
    }

    #[test]
    fn leg_mode_from_leg_then_day_then_trip() {
        let mut t = trip();
        let (a, b) = (sensoji(), skytree());
        let lt = leg_travel(&t, "i1", "i2", &a, &b, "2026-12-02");
        assert_eq!(lt.mode, Mode::Transit);
        assert_eq!(lt.source, TravelSource::Estimate);
        assert_eq!(lt.minutes, estimate_minutes(&a, &b, Mode::Transit));
        assert_eq!(lt.options.iter().map(|o| o.mode).collect::<Vec<_>>(), ALL_MODES.to_vec());
        assert!(lt.walk_hint.is_none(), "1.3 km is over the walk hint distance");
        assert!(lt.line.is_empty());

        t.days.push(Day { date: "2026-12-02".into(), city: None, time_zone: None, utc_offset_minutes: None, mode: Some(Mode::Drive), updated_at: None });
        assert_eq!(leg_travel(&t, "i1", "i2", &a, &b, "2026-12-02").mode, Mode::Drive);
        assert_eq!(leg_travel(&t, "i1", "i2", &a, &b, "2026-12-03").mode, Mode::Transit);

        t.legs.push(Leg { from: "i1".into(), to: "i2".into(), mode: Some(Mode::Cycle), routed: vec![], confirmed_minutes: None, updated_at: None });
        let lt = leg_travel(&t, "i1", "i2", &a, &b, "2026-12-02");
        assert_eq!(lt.mode, Mode::Cycle);
        assert!(lt.maps_url.unwrap().ends_with("travelmode=bicycling"));
        // The leg is keyed by direction.
        assert_eq!(leg_travel(&t, "i2", "i1", &b, &a, "2026-12-02").mode, Mode::Drive);
    }

    #[test]
    fn confirmed_beats_routed_beats_estimate() {
        let mut t = trip();
        let (a, b) = (sensoji(), skytree());
        t.legs.push(Leg {
            from: "i1".into(),
            to: "i2#checkIn".into(),
            mode: None,
            routed: vec![
                RoutedTime { mode: Mode::Transit, minutes: 17, line: vec![[139.79, 35.71], [139.81, 35.71]], service: Some("test".into()) },
                RoutedTime { mode: Mode::Walk, minutes: 21, line: vec![], service: None },
            ],
            confirmed_minutes: None,
            updated_at: None,
        });
        let lt = leg_travel(&t, "i1", "i2#checkIn", &a, &b, "2026-12-02");
        assert_eq!((lt.minutes, lt.source), (Some(17), TravelSource::Routed));
        assert_eq!(lt.line.len(), 2);
        let walk = lt.options.iter().find(|o| o.mode == Mode::Walk).unwrap();
        assert_eq!((walk.minutes, walk.source), (Some(21), TravelSource::Routed));
        let drive = lt.options.iter().find(|o| o.mode == Mode::Drive).unwrap();
        assert_eq!(drive.source, TravelSource::Estimate);

        t.legs[0].confirmed_minutes = Some(25);
        let lt = leg_travel(&t, "i1", "i2#checkIn", &a, &b, "2026-12-02");
        assert_eq!((lt.minutes, lt.source), (Some(25), TravelSource::Confirmed));

        // A mode with no routing result falls back to the estimate, with no line.
        t.legs[0].confirmed_minutes = None;
        t.legs[0].mode = Some(Mode::Drive);
        let lt = leg_travel(&t, "i1", "i2#checkIn", &a, &b, "2026-12-02");
        assert_eq!(lt.source, TravelSource::Estimate);
        assert!(lt.line.is_empty());
    }

    #[test]
    fn short_legs_get_a_walk_hint() {
        let (a, b) = (sensoji(), kaminarimon());
        let lt = leg_travel(&trip(), "i1", "i2", &a, &b, "2026-12-02");
        assert!(lt.distance_km.unwrap() < WALK_HINT_KM);
        assert_eq!(lt.mode, Mode::Transit);
        assert_eq!(lt.walk_hint, estimate_minutes(&a, &b, Mode::Walk));

        let mut t = trip();
        t.settings.default_mode = Mode::Walk;
        assert_eq!(leg_travel(&t, "i1", "i2", &a, &b, "2026-12-02").walk_hint, None);
    }

    #[test]
    fn missing_position_gives_no_minutes() {
        let lt = leg_travel(&trip(), "i1", "i2", &sensoji(), &place("x", None, None), "2026-12-02");
        assert_eq!(lt.minutes, None);
        assert_eq!(lt.source, TravelSource::Estimate);
        assert_eq!(lt.distance_km, None);
        assert_eq!(lt.walk_hint, None);
        assert_eq!(lt.maps_url, None);
        assert!(lt.options.iter().all(|o| o.minutes.is_none()));
    }

    #[test]
    fn maps_links() {
        let (a, b) = (sensoji(), skytree());
        assert_eq!(
            maps_directions_url(&a, &b, Mode::Transit).unwrap(),
            "https://www.google.com/maps/dir/?api=1&origin=35.7148,139.7967&destination=35.7101,139.8107&travelmode=transit"
        );
        assert!(maps_directions_url(&a, &b, Mode::Drive).unwrap().ends_with("travelmode=driving"));
        assert!(maps_directions_url(&a, &b, Mode::Ride).unwrap().ends_with("travelmode=driving"));
        assert!(maps_directions_url(&a, &b, Mode::Walk).unwrap().ends_with("travelmode=walking"));
        assert!(maps_directions_url(&a, &b, Mode::Cycle).unwrap().ends_with("travelmode=bicycling"));
        assert!(maps_directions_url(&a, &b, Mode::TwoWheeler).unwrap().ends_with("travelmode=two-wheeler"));
        assert!(maps_directions_url(&a, &place("x", Some(1.0), None), Mode::Walk).is_none());
    }

    #[test]
    fn reads_coordinates_from_links() {
        let place_link = "https://www.google.com/maps/place/Senso-ji/@35.7147651,139.7966553,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d35.7148016!4d139.7967365!16s";
        assert_eq!(coords_from_maps_url(place_link), Some((35.7148016, 139.7967365)));
        assert_eq!(coords_from_maps_url("https://www.google.com/maps/@35.6595,139.7005,15z"), Some((35.6595, 139.7005)));
        assert_eq!(coords_from_maps_url("https://maps.google.com/?q=35.6812,139.7671"), Some((35.6812, 139.7671)));
        assert_eq!(coords_from_maps_url("https://www.google.com/maps/search/?api=1&query=35.6812%2C139.7671"), Some((35.6812, 139.7671)));
        assert_eq!(coords_from_maps_url("https://maps.google.com/?ll=-33.8568,151.2153&z=15"), Some((-33.8568, 151.2153)));
        assert_eq!(coords_from_maps_url("35.6812, 139.7671"), Some((35.6812, 139.7671)));
        assert_eq!(coords_from_maps_url(" -33.8568,151.2153 "), Some((-33.8568, 151.2153)));
        assert_eq!(coords_from_maps_url("https://maps.app.goo.gl/AbCdEf123"), None);
        assert_eq!(coords_from_maps_url("https://maps.google.com/?q=Senso-ji"), None);
        assert_eq!(coords_from_maps_url("95.0, 139.0"), None);
        assert_eq!(coords_from_maps_url("35.0, 200.0"), None);
        assert_eq!(coords_from_maps_url("Senso-ji"), None);
        assert_eq!(coords_from_maps_url(""), None);
    }
}

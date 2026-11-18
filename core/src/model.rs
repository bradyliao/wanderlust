//! The trip file: every record the app stores.
//!
//! Designed from `docs/layout-and-behavior.md` (item numbers in comments) and
//! `docs/import-format.md`. The v0 TypeScript prototype is not a reference.
//!
//! Conventions
//! - Dates are `YYYY-MM-DD` strings in the city's local calendar (see `time.rs`).
//! - Clock times are minutes from local midnight (`u32`, 0..=1440).
//! - Money is an `f64` amount in a named currency (ISO 4217 code). Amounts are
//!   rounded only for display.
//! - Every record has a stable `id` (made by the caller) and `updated_at`
//!   (an ISO timestamp passed in by the caller), so cloud sync can be added
//!   later without reworking the data (decisions.md, Backend).
//! - JSON uses camelCase field names and camelCase enum values.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub type Id = String;

/// Current version of the trip file. Bump it when the shape changes, and
/// teach `Trip::upgrade` to read older files.
pub const TRIP_FORMAT: &str = "wanderlust-trip";
pub const TRIP_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trip {
    pub format: String,
    pub version: u32,
    pub id: Id,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    #[serde(default)]
    pub settings: Settings,
    /// Per-date overrides. A date with no entry uses defaults.
    #[serde(default)]
    pub days: Vec<Day>,
    #[serde(default)]
    pub places: Vec<Place>,
    #[serde(default)]
    pub items: Vec<Item>,
    /// Travel between two consecutive blocks, where the user chose a mode or
    /// a routing result was stored (items 29, 36).
    #[serde(default)]
    pub legs: Vec<Leg>,
    /// Every change, by the user or by AI (item 76). Newest last.
    #[serde(default)]
    pub log: Vec<LogGroup>,
}

/// Trip-wide settings shown in the top bar and on the Budget page.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Number of people on the trip; can change while planning (item 65).
    pub people: u32,
    /// Trip default travel mode (items 34, 45).
    pub default_mode: Mode,
    /// Home currency, TWD or USD for now (item 55).
    pub home_currency: String,
    /// Currencies used on the trip, each with a rate the user typed in
    /// (items 54, 56, 56a). The home currency needs no entry.
    pub currencies: Vec<CurrencyRate>,
    /// Trip budget in the home currency (item 52).
    pub budget: Option<f64>,
    /// Limit per group in the home currency (items 52, 81).
    pub limits: BTreeMap<Group, f64>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            people: 1,
            default_mode: Mode::Transit,
            home_currency: "TWD".into(),
            currencies: Vec::new(),
            budget: None,
            limits: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyRate {
    /// ISO 4217 code, for example `JPY`.
    pub code: String,
    /// Value of 1 unit of `code` in the home currency, typed by the user.
    pub rate_to_home: f64,
    /// When the user last set the rate (`YYYY-MM-DD`), shown next to it.
    pub set_on: Option<String>,
}

/// Overrides for one date of the trip.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Day {
    pub date: String,
    /// City label in the day header, for example `Kyoto`.
    pub city: Option<String>,
    /// IANA time zone name, for example `Asia/Tokyo` (decisions.md defaults).
    pub time_zone: Option<String>,
    /// Offset from UTC in minutes on this date, filled in by the UI from the
    /// time zone (the core carries no time zone database). Used for sun times.
    pub utc_offset_minutes: Option<i32>,
    /// Per-day travel mode that overrides the trip default (item 34).
    pub mode: Option<Mode>,
    pub updated_at: Option<String>,
}

/// A collected place in the Place List (items 16–18, 38, import-format.md).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    pub id: Id,
    pub name: String,
    pub name_local: Option<String>,
    /// Sub-category; never Local travel (item 81).
    pub kind: Kind,
    pub area: Option<String>,
    pub city: Option<String>,
    /// ISO 3166-1 two-letter code.
    pub country: Option<String>,
    pub google_maps_url: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub address: Option<String>,
    /// Typical visit length; the default block length (item 11).
    pub usual_stay_minutes: Option<u32>,
    pub opening_hours: Option<OpeningHours>,
    pub hours_note: Option<String>,
    /// Planning estimate per visit, used when the place is scheduled.
    pub estimated_cost: Option<PlaceCost>,
    #[serde(default)]
    pub rating: Rating,
    #[serde(default)]
    pub tags: Vec<String>,
    pub notes: Option<String>,
    /// The AI's own doubts from an import (`ai_notes` in import-format.md).
    pub ai_notes: Option<String>,
    /// Names of fields that came from an import and are not checked yet
    /// (item 69), for example `["openingHours", "lat", "lng"]`.
    #[serde(default)]
    pub unverified: Vec<String>,
    /// Where the idea came from: kept, not shown (item 71).
    pub source: Option<Source>,
    pub updated_at: Option<String>,
}

impl Place {
    pub fn has_position(&self) -> bool {
        self.lat.is_some() && self.lng.is_some()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub platform: Option<String>,
    pub url: Option<String>,
    pub account: Option<String>,
    pub saved: Option<String>,
}

/// Weekly opening hours. For each weekday: `None` = unknown, `Some(vec![])` =
/// closed, otherwise the open ranges. A range whose `close` is not after its
/// `open` runs past midnight; `0..1440` is open all day.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpeningHours {
    pub mon: Option<Vec<TimeRange>>,
    pub tue: Option<Vec<TimeRange>>,
    pub wed: Option<Vec<TimeRange>>,
    pub thu: Option<Vec<TimeRange>>,
    pub fri: Option<Vec<TimeRange>>,
    pub sat: Option<Vec<TimeRange>>,
    pub sun: Option<Vec<TimeRange>>,
}

impl OpeningHours {
    /// Hours for a weekday, 0 = Monday … 6 = Sunday.
    pub fn for_weekday(&self, weekday: u8) -> Option<&Vec<TimeRange>> {
        match weekday {
            0 => self.mon.as_ref(),
            1 => self.tue.as_ref(),
            2 => self.wed.as_ref(),
            3 => self.thu.as_ref(),
            4 => self.fri.as_ref(),
            5 => self.sat.as_ref(),
            _ => self.sun.as_ref(),
        }
    }

    pub fn set_weekday(&mut self, weekday: u8, value: Option<Vec<TimeRange>>) {
        match weekday {
            0 => self.mon = value,
            1 => self.tue = value,
            2 => self.wed = value,
            3 => self.thu = value,
            4 => self.fri = value,
            5 => self.sat = value,
            _ => self.sun = value,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeRange {
    pub open: u32,
    pub close: u32,
}

/// Anything that can be on the timetable, booked, or costed (items 61–64).
/// A meal, a visit, a hotel stay, a train, a budget-only cost: all items.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: Id,
    /// Shown on the block, booking row and cost row. Defaults to the place name.
    pub title: String,
    pub place_id: Option<Id>,
    /// Sub-category; the budget line is its group (items 52, 81).
    pub kind: Kind,
    /// When it happens. `None` = not on the timetable yet.
    pub slot: Option<Slot>,
    /// Hotel stays: check-in and check-out blocks and the night band (item 63).
    pub stay: Option<Stay>,
    pub booking: Option<Booking>,
    pub cost: Option<Cost>,
    pub notes: Option<String>,
    pub updated_at: Option<String>,
}

/// A block on the timetable.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Slot {
    pub date: String,
    pub start: u32,
    pub end: u32,
    /// Fixed blocks cannot be dragged until unlocked (items 31, 32).
    #[serde(default)]
    pub fixed: bool,
    /// For example "Ticket booked" or "Must be there".
    pub fixed_reason: Option<String>,
}

/// A hotel stay. Nights are `check_in_date` up to the night before
/// `check_out_date`. The check-in and check-out blocks are optional slots on
/// those dates.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stay {
    pub check_in_date: String,
    pub check_out_date: String,
    pub check_in: Option<Slot>,
    pub check_out: Option<Slot>,
    /// Hotel sets these: "from 15:00", "by 11:00".
    pub check_in_from: Option<u32>,
    pub check_out_by: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Booking {
    /// Sub-category; never Local travel (items 50, 81).
    pub kind: Kind,
    pub confirmation: Option<String>,
    /// Where it was booked, for example a booking site.
    pub provider: Option<String>,
    pub url: Option<String>,
    pub address: Option<String>,
    /// Booked for a date but no time yet (item 64).
    pub date: Option<String>,
    /// Last moment to cancel for free: `YYYY-MM-DD HH:MM` local time.
    pub cancel_deadline: Option<String>,
    pub cancel_note: Option<String>,
    /// Files stay on the device; this holds only names and local ids.
    #[serde(default)]
    pub files: Vec<FileRef>,
    #[serde(default = "yes")]
    pub count_in_budget: bool,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRef {
    pub id: Id,
    pub name: String,
}

/// A place's planning estimate: per visit for the group, or per person.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceCost {
    pub amount: f64,
    pub currency: String,
    #[serde(default)]
    pub per_person: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Money {
    pub amount: f64,
    pub currency: String,
}

/// A cost on an item (items 53, 58–62).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cost {
    pub amount: f64,
    pub currency: String,
    /// Off = the whole booking (item 58).
    #[serde(default)]
    pub per_night: bool,
    #[serde(default)]
    pub per_person: bool,
    /// People this cost covers. `None` = everyone on the trip, following
    /// `Settings::people` (items 59, 65).
    pub people: Option<u32>,
    pub status: CostStatus,
    /// The estimate a booked price replaced, kept faint for comparison (item 62).
    pub replaced_estimate: Option<Money>,
    /// For budget-only costs with no slot, booking or stay.
    pub date: Option<String>,
}

/// Travel between two consecutive blocks. Keyed by the two block keys
/// (see `BlockKey`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Leg {
    pub from: String,
    pub to: String,
    /// The mode the user picked for this leg (item 36). `None` = day or trip default.
    pub mode: Option<Mode>,
    /// Routing results stored on drop (item 29), one per mode asked for.
    #[serde(default)]
    pub routed: Vec<RoutedTime>,
    /// Minutes the user confirmed, which replace any estimate.
    pub confirmed_minutes: Option<u32>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutedTime {
    pub mode: Mode,
    pub minutes: u32,
    /// Route line as `[lng, lat]` pairs, if the service returned one.
    #[serde(default)]
    pub line: Vec<[f64; 2]>,
    /// Which service, for example `valhalla`.
    pub service: Option<String>,
}

/// Which block of an item: the item's own slot, or a stay's check-in or
/// check-out. Written as `"<item id>"`, `"<item id>#checkIn"` or
/// `"<item id>#checkOut"` in `Leg.from` / `Leg.to`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BlockPart {
    Main,
    CheckIn,
    CheckOut,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockKey {
    pub item_id: Id,
    pub part: BlockPart,
}

impl BlockKey {
    pub fn encode(&self) -> String {
        match self.part {
            BlockPart::Main => self.item_id.clone(),
            BlockPart::CheckIn => format!("{}#checkIn", self.item_id),
            BlockPart::CheckOut => format!("{}#checkOut", self.item_id),
        }
    }

    pub fn decode(s: &str) -> BlockKey {
        if let Some(id) = s.strip_suffix("#checkIn") {
            BlockKey { item_id: id.into(), part: BlockPart::CheckIn }
        } else if let Some(id) = s.strip_suffix("#checkOut") {
            BlockKey { item_id: id.into(), part: BlockPart::CheckOut }
        } else {
            BlockKey { item_id: s.into(), part: BlockPart::Main }
        }
    }
}

// ---------- change log (items 72, 76) ----------

/// One undo step: a user action, or a whole AI change file.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogGroup {
    pub id: Id,
    pub author: Author,
    /// ISO timestamp from the caller.
    pub at: String,
    /// Short description, for example "Scheduled Koffee Mameya 12/03 15:00".
    pub label: String,
    /// Record changes in the order applied. Undo restores `before` in reverse.
    pub changes: Vec<RecordChange>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum Author {
    User,
    /// An AI change file; `source` is its file name or another label.
    Ai { source: Option<String> },
}

/// A record before and after one change. `None` = did not exist.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordChange {
    pub before: Option<Record>,
    pub after: Option<Record>,
}

/// Anything a change can touch.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "record")]
pub enum Record {
    Settings(Settings),
    Day(Day),
    Place(Place),
    Item(Item),
    Leg(Leg),
    /// Trip name and dates.
    Header { name: String, start_date: String, end_date: String },
}

// ---------- enums ----------

/// One sub-category, stored on every place, booking and item (items 81–83).
/// Its group, colour and budget category follow from it, so they can never
/// disagree. Local travel is only for costs of getting between stops; places
/// and bookings cannot use it (item 81).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Food,
    Cafe,
    Dessert,
    Sight,
    Museum,
    Nature,
    Nightlife,
    Flight,
    Train,
    Bus,
    Car,
    LocalTravel,
    Lodging,
    Shopping,
    Other,
}

impl Kind {
    /// All 15 sub-categories, in the order of item 81's table.
    pub const ALL: [Kind; 15] = [
        Kind::Food,
        Kind::Cafe,
        Kind::Dessert,
        Kind::Sight,
        Kind::Museum,
        Kind::Nature,
        Kind::Nightlife,
        Kind::Flight,
        Kind::Train,
        Kind::Bus,
        Kind::Car,
        Kind::LocalTravel,
        Kind::Lodging,
        Kind::Shopping,
        Kind::Other,
    ];

    /// The group this sub-category belongs to (item 81).
    pub fn group(self) -> Group {
        match self {
            Kind::Food | Kind::Cafe | Kind::Dessert => Group::Food,
            Kind::Sight | Kind::Museum | Kind::Nature | Kind::Nightlife => Group::Activity,
            Kind::Flight | Kind::Train | Kind::Bus | Kind::Car | Kind::LocalTravel => Group::Transport,
            Kind::Lodging => Group::Lodging,
            Kind::Shopping => Group::Shopping,
            Kind::Other => Group::Other,
        }
    }

    /// Whether a place may have this sub-category: everything except Local
    /// travel (item 81). Bookings follow the same rule.
    pub fn allowed_for_places(self) -> bool {
        self != Kind::LocalTravel
    }

    /// Bookings use the same list as places (item 81).
    pub fn allowed_for_bookings(self) -> bool {
        self.allowed_for_places()
    }

    /// The camelCase id used in files, for example `localTravel`.
    pub fn id(self) -> &'static str {
        match self {
            Kind::Food => "food",
            Kind::Cafe => "cafe",
            Kind::Dessert => "dessert",
            Kind::Sight => "sight",
            Kind::Museum => "museum",
            Kind::Nature => "nature",
            Kind::Nightlife => "nightlife",
            Kind::Flight => "flight",
            Kind::Train => "train",
            Kind::Bus => "bus",
            Kind::Car => "car",
            Kind::LocalTravel => "localTravel",
            Kind::Lodging => "lodging",
            Kind::Shopping => "shopping",
            Kind::Other => "other",
        }
    }

    /// The name shown to the user, for example `Local travel`.
    pub fn label(self) -> &'static str {
        match self {
            Kind::Food => "Food",
            Kind::Cafe => "Café",
            Kind::Dessert => "Dessert",
            Kind::Sight => "Sight",
            Kind::Museum => "Museum",
            Kind::Nature => "Nature",
            Kind::Nightlife => "Nightlife",
            Kind::Flight => "Flight",
            Kind::Train => "Train",
            Kind::Bus => "Bus",
            Kind::Car => "Car",
            Kind::LocalTravel => "Local travel",
            Kind::Lodging => "Lodging",
            Kind::Shopping => "Shopping",
            Kind::Other => "Other",
        }
    }

    /// Read a camelCase id, for example `localTravel`.
    pub fn from_id(id: &str) -> Option<Kind> {
        Kind::ALL.into_iter().find(|k| k.id() == id)
    }
}

/// The six groups: one colour each, and the budget's category lines
/// (items 81–83). Every group exists on every list.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Group {
    Food,
    Activity,
    Transport,
    Lodging,
    Shopping,
    Other,
}

impl Group {
    /// The six groups in display order (item 81).
    pub const ALL: [Group; 6] =
        [Group::Food, Group::Activity, Group::Transport, Group::Lodging, Group::Shopping, Group::Other];

    /// The sub-categories in this group, in display order.
    pub fn kinds(self) -> Vec<Kind> {
        Kind::ALL.into_iter().filter(|k| k.group() == self).collect()
    }

    pub fn label(self) -> &'static str {
        match self {
            Group::Food => "Food",
            Group::Activity => "Activity",
            Group::Transport => "Transport",
            Group::Lodging => "Lodging",
            Group::Shopping => "Shopping",
            Group::Other => "Other",
        }
    }
}

/// Unrated, then the three ratings (items 17a, 68).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Rating {
    #[default]
    Unrated,
    Forget,
    SoSo,
    MustGo,
}

/// Travel modes, following Google Maps (item 33).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Mode {
    Drive,
    Transit,
    Walk,
    TwoWheeler,
    Cycle,
    Ride,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CostStatus {
    Estimated,
    Booked,
}

// ---------- lookups ----------

impl Trip {
    /// A new, empty trip.
    pub fn new(id: &str, name: &str, start_date: &str, end_date: &str) -> Trip {
        Trip {
            format: TRIP_FORMAT.into(),
            version: TRIP_VERSION,
            id: id.into(),
            name: name.into(),
            start_date: start_date.into(),
            end_date: end_date.into(),
            settings: Settings::default(),
            days: Vec::new(),
            places: Vec::new(),
            items: Vec::new(),
            legs: Vec::new(),
            log: Vec::new(),
        }
    }

    pub fn place(&self, id: &str) -> Option<&Place> {
        self.places.iter().find(|p| p.id == id)
    }

    pub fn item(&self, id: &str) -> Option<&Item> {
        self.items.iter().find(|i| i.id == id)
    }

    pub fn day(&self, date: &str) -> Option<&Day> {
        self.days.iter().find(|d| d.date == date)
    }

    pub fn leg(&self, from: &str, to: &str) -> Option<&Leg> {
        self.legs.iter().find(|l| l.from == from && l.to == to)
    }

    /// The mode a leg uses when the user has not picked one: the day's
    /// mode, else the trip default (item 34).
    pub fn default_mode_on(&self, date: &str) -> Mode {
        self.day(date).and_then(|d| d.mode).unwrap_or(self.settings.default_mode)
    }

    /// Rate of a currency in the home currency. The home currency is 1.
    /// `None` when the user has not entered a rate yet.
    pub fn rate_to_home(&self, code: &str) -> Option<f64> {
        if code == self.settings.home_currency {
            return Some(1.0);
        }
        self.settings.currencies.iter().find(|c| c.code == code).map(|c| c.rate_to_home)
    }

    /// Read a trip file, upgrading older versions.
    pub fn from_json(text: &str) -> Result<Trip, String> {
        let trip: Trip = serde_json::from_str(text).map_err(|e| format!("Not a Wanderlust trip file: {e}"))?;
        if trip.format != TRIP_FORMAT {
            return Err(format!("Expected format \"{TRIP_FORMAT}\", found \"{}\".", trip.format));
        }
        if trip.version > TRIP_VERSION {
            return Err(format!("This trip was saved by a newer Wanderlust (version {}).", trip.version));
        }
        Ok(trip)
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).expect("a trip always serialises")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_has_one_group() {
        use Group as G;
        let expected = [
            (Kind::Food, G::Food),
            (Kind::Cafe, G::Food),
            (Kind::Dessert, G::Food),
            (Kind::Sight, G::Activity),
            (Kind::Museum, G::Activity),
            (Kind::Nature, G::Activity),
            (Kind::Nightlife, G::Activity),
            (Kind::Flight, G::Transport),
            (Kind::Train, G::Transport),
            (Kind::Bus, G::Transport),
            (Kind::Car, G::Transport),
            (Kind::LocalTravel, G::Transport),
            (Kind::Lodging, G::Lodging),
            (Kind::Shopping, G::Shopping),
            (Kind::Other, G::Other),
        ];
        assert_eq!(expected.map(|(k, _)| k), Kind::ALL);
        for (kind, group) in expected {
            assert_eq!(kind.group(), group, "{kind:?}");
        }
        // Every group has at least one sub-category (item 83), and the groups'
        // sub-categories in order are exactly Kind::ALL.
        assert!(Group::ALL.iter().all(|g| !g.kinds().is_empty()));
        assert_eq!(Group::ALL.iter().flat_map(|g| g.kinds()).collect::<Vec<_>>(), Kind::ALL.to_vec());
    }

    #[test]
    fn ids_are_camel_case_and_only_local_travel_is_not_for_places() {
        for kind in Kind::ALL {
            assert_eq!(serde_json::to_value(kind).unwrap(), kind.id());
            assert_eq!(Kind::from_id(kind.id()), Some(kind));
            assert_eq!(kind.allowed_for_places(), kind != Kind::LocalTravel);
            assert_eq!(kind.allowed_for_bookings(), kind != Kind::LocalTravel);
        }
        assert_eq!(serde_json::to_value(Group::Activity).unwrap(), "activity");
        assert_eq!(Kind::from_id("shop"), None);
    }
}

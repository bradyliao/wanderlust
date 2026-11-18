//! Price totals and the Budget page (items 52–62, 65).
//!
//! - A cost is entered as the whole booking, per night, per person, or per
//!   person per night (item 58). `cost_total` turns it into the total the
//!   budget uses (item 60); `cost_forms` adds the other forms, marked as
//!   calculated in the UI.
//! - People follow `Settings::people` unless the cost has its own head count,
//!   so changing the trip's people changes every "everyone" cost (items 59, 65).
//! - Each cost stays in its own currency (item 54). Home totals use the rates
//!   the user typed in (item 56). A currency with no rate is left out of the
//!   home totals and listed in `missing_rates`; no rate is ever made up.
//! - Items whose booking is not counted in the budget are left out.
//! - Totals are per group (the six budget lines), each opening to its
//!   sub-categories; an item's group follows from its kind (items 81–83).
//!   Local travel (costs of getting between stops) is Transport → Local
//!   travel; legs carry no cost of their own yet.
//! - Nothing is rounded here; the UI rounds for display.

use crate::model::*;
use crate::time::Date;
use serde::Serialize;
use std::collections::BTreeMap;

/// How the entered amount is meant (item 58).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PriceBasis {
    /// The whole booking (the default).
    Total,
    PerNight,
    PerPerson,
    PerPersonPerNight,
}

/// A cost in every form (item 60). `total` is what the budget uses; the
/// others are calculated from it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CostForms {
    pub currency: String,
    /// The amount as the user entered it.
    pub entered: f64,
    pub basis: PriceBasis,
    /// Nights from the stay (check-out minus check-in), else 1.
    pub nights: u32,
    /// Whether `nights` comes from a stay (false = taken as 1).
    pub nights_from_stay: bool,
    /// People the cost covers: its own head count, else the trip's.
    pub people: u32,
    /// True when `people` follows the trip setting (item 65).
    pub people_follow_trip: bool,
    pub total: f64,
    /// Only for stays, or when the price was entered per night.
    pub per_night: Option<f64>,
    pub per_person: f64,
    /// Only when `per_night` is shown.
    pub per_person_per_night: Option<f64>,
}

/// An amount in one currency.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyAmount {
    pub currency: String,
    pub amount: f64,
}

/// A home-currency amount for one group.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupAmount {
    pub group: Group,
    pub home: f64,
}

/// One sub-category inside a group line (item 81).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindLine {
    pub kind: Kind,
    /// One entry per currency column, in column order (0 where unused).
    pub amounts: Vec<CurrencyAmount>,
    /// Total in the home currency, leaving out currencies with no rate.
    pub home: f64,
    pub booked_home: f64,
    pub estimated_home: f64,
}

/// One row of the category table: a group (items 52, 81).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupLine {
    pub group: Group,
    /// One entry per currency column, in column order (0 where unused).
    pub amounts: Vec<CurrencyAmount>,
    /// Total in the home currency, leaving out currencies with no rate.
    pub home: f64,
    pub booked_home: f64,
    pub estimated_home: f64,
    /// The user's limit in the home currency, if set.
    pub limit: Option<f64>,
    /// Every sub-category of the group, in order, even with no costs.
    pub kinds: Vec<KindLine>,
}

/// One column of the day chart.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DateLine {
    /// `YYYY-MM-DD`.
    pub date: String,
    /// `12/02`.
    pub label: String,
    /// `Wed`.
    pub weekday: String,
    /// False for a cost dated outside the trip (for example a flight the day before).
    pub in_trip: bool,
    /// Home amount per group, only groups with costs, in group order.
    pub groups: Vec<GroupAmount>,
    pub home: f64,
}

/// Where a cost row came from, for the small grey line under it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CostSource {
    /// The item has a booking.
    Booking,
    /// A block or a stay on the timetable, with no booking.
    Timetable,
    /// Added on the Budget page: no booking, time or stay.
    Budget,
}

/// One row of the cost list.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CostRow {
    pub item_id: Id,
    pub title: String,
    pub kind: Kind,
    /// Follows from `kind` (item 81).
    pub group: Group,
    pub status: CostStatus,
    pub source: CostSource,
    /// The cost date (see `cost_date`); for a stay, its first night.
    pub date: Option<String>,
    /// For a stay, its last night.
    pub last_night: Option<String>,
    /// `12/02`, `12/02–12/04` for a stay, or `no date`.
    pub date_label: String,
    /// Total in the cost's own currency.
    pub amount: f64,
    pub currency: String,
    /// `None` when the currency has no rate.
    pub home: Option<f64>,
    /// Home amount per person covered by this cost (`forms.people`).
    pub per_person_home: Option<f64>,
    /// The estimate a booked price replaced, shown faint (item 62).
    pub replaced_estimate: Option<Money>,
    pub forms: CostForms,
}

/// Everything the Budget page shows.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetSummary {
    pub home_currency: String,
    pub people: u32,
    /// All counted costs in the home currency (the top bar's running total).
    pub planned: f64,
    pub booked: f64,
    pub estimated: f64,
    /// `planned / people`.
    pub per_person: f64,
    pub budget: Option<f64>,
    /// `budget - planned` (negative when over).
    pub left: Option<f64>,
    /// Currency columns: the trip's added currencies in order, then any other
    /// currency a cost uses (the home currency, or one with no rate).
    pub currencies: Vec<String>,
    /// The "All" row: totals per currency column.
    pub currency_totals: Vec<CurrencyAmount>,
    /// All six groups, in `Group::ALL` order (items 81, 83).
    pub groups: Vec<GroupLine>,
    /// Every trip date (even with nothing on it), plus dated costs outside
    /// the trip, in date order. Lodging is spread evenly over its nights.
    pub dates: Vec<DateLine>,
    /// Costs with no date, per group.
    pub undated: Vec<GroupAmount>,
    pub undated_home: f64,
    /// Largest home amount first; rows with no rate last.
    pub rows: Vec<CostRow>,
    /// Currencies used by a cost but with no rate yet: their costs are left
    /// out of every home total. The UI should ask for the rate.
    pub missing_rates: Vec<String>,
}

/// Nights of a stay (check-out minus check-in), or `None` when the item has
/// no stay or its dates don't make a positive number of nights.
pub fn stay_nights(item: &Item) -> Option<u32> {
    let stay = item.stay.as_ref()?;
    let a = Date::parse(&stay.check_in_date)?;
    let b = Date::parse(&stay.check_out_date)?;
    let n = a.days_until(b);
    (n > 0).then_some(n as u32)
}

/// People a cost covers: its own head count, else the trip's (at least 1).
pub fn cost_people(trip: &Trip, cost: &Cost) -> u32 {
    cost.people.unwrap_or(trip.settings.people).max(1)
}

/// The total in the cost's own currency (items 58, 60). `None` = no cost.
pub fn cost_total(trip: &Trip, item: &Item) -> Option<f64> {
    let cost = item.cost.as_ref()?;
    let mut total = cost.amount;
    if cost.per_night {
        total *= stay_nights(item).unwrap_or(1) as f64;
    }
    if cost.per_person {
        total *= cost_people(trip, cost) as f64;
    }
    Some(total)
}

/// The total plus the calculated forms (item 60). `None` = no cost.
pub fn cost_forms(trip: &Trip, item: &Item) -> Option<CostForms> {
    let cost = item.cost.as_ref()?;
    let total = cost_total(trip, item)?;
    let stay = stay_nights(item);
    let nights = stay.unwrap_or(1);
    let people = cost_people(trip, cost);
    let basis = match (cost.per_night, cost.per_person) {
        (false, false) => PriceBasis::Total,
        (true, false) => PriceBasis::PerNight,
        (false, true) => PriceBasis::PerPerson,
        (true, true) => PriceBasis::PerPersonPerNight,
    };
    let show_nights = stay.is_some() || cost.per_night;
    let per_night = show_nights.then(|| total / nights as f64);
    Some(CostForms {
        currency: cost.currency.clone(),
        entered: cost.amount,
        basis,
        nights,
        nights_from_stay: stay.is_some(),
        people,
        people_follow_trip: cost.people.is_none(),
        total,
        per_night,
        per_person: total / people as f64,
        per_person_per_night: per_night.map(|n| n / people as f64),
    })
}

/// The date a cost falls on: slot date, else booking date, else stay
/// check-in, else the cost's own date. `None` = undated.
pub fn cost_date(item: &Item) -> Option<String> {
    item.slot
        .as_ref()
        .map(|s| s.date.clone())
        .or_else(|| item.booking.as_ref().and_then(|b| b.date.clone()))
        .or_else(|| item.stay.as_ref().map(|s| s.check_in_date.clone()))
        .or_else(|| item.cost.as_ref().and_then(|c| c.date.clone()))
}

/// Whether an item's cost counts in the budget.
pub fn counts_in_budget(item: &Item) -> bool {
    item.cost.is_some() && item.booking.as_ref().is_none_or(|b| b.count_in_budget)
}

fn source_of(item: &Item) -> CostSource {
    if item.booking.is_some() {
        CostSource::Booking
    } else if item.slot.is_some() || item.stay.is_some() {
        CostSource::Timetable
    } else {
        CostSource::Budget
    }
}

/// The nights of a stay as dates (first night to last night).
fn night_dates(item: &Item) -> Option<Vec<Date>> {
    let n = stay_nights(item)?;
    let first = Date::parse(&item.stay.as_ref()?.check_in_date)?;
    Some((0..n as i64).map(|i| first.add_days(i)).collect())
}

/// The Budget page (items 52–57, 62).
pub fn summary(trip: &Trip) -> BudgetSummary {
    let s = &trip.settings;
    let trip_dates = crate::time::dates_between(&trip.start_date, &trip.end_date);

    // Currency columns.
    let mut currencies: Vec<String> = s.currencies.iter().map(|c| c.code.clone()).collect();
    let mut missing_rates: Vec<String> = Vec::new();

    let mut rows: Vec<CostRow> = Vec::new();
    let mut planned = 0.0;
    let mut booked = 0.0;
    let mut estimated = 0.0;
    // kind -> currency -> amount
    let mut by_kind_cur: BTreeMap<Kind, BTreeMap<String, f64>> = BTreeMap::new();
    let mut by_kind_home: BTreeMap<Kind, (f64, f64)> = BTreeMap::new(); // (booked, estimated)
    let mut by_date: BTreeMap<Date, BTreeMap<Group, f64>> = BTreeMap::new();
    let mut undated: BTreeMap<Group, f64> = BTreeMap::new();

    for item in trip.items.iter().filter(|i| counts_in_budget(i)) {
        let cost = item.cost.as_ref().expect("counts_in_budget checks the cost");
        let forms = cost_forms(trip, item).expect("item has a cost");
        let total = forms.total;
        let group = item.kind.group();
        if !currencies.contains(&cost.currency) {
            currencies.push(cost.currency.clone());
        }
        *by_kind_cur.entry(item.kind).or_default().entry(cost.currency.clone()).or_default() += total;

        let rate = trip.rate_to_home(&cost.currency);
        let home = rate.map(|r| total * r);
        match home {
            Some(h) => {
                planned += h;
                let entry = by_kind_home.entry(item.kind).or_default();
                match cost.status {
                    CostStatus::Booked => {
                        booked += h;
                        entry.0 += h;
                    }
                    CostStatus::Estimated => {
                        estimated += h;
                        entry.1 += h;
                    }
                }
                // Per date: a stay spreads over its nights.
                if let Some(nights) = night_dates(item) {
                    let share = h / nights.len() as f64;
                    for d in nights {
                        *by_date.entry(d).or_default().entry(group).or_default() += share;
                    }
                } else if let Some(d) = cost_date(item).as_deref().and_then(Date::parse) {
                    *by_date.entry(d).or_default().entry(group).or_default() += h;
                } else {
                    *undated.entry(group).or_default() += h;
                }
            }
            None => {
                if !missing_rates.contains(&cost.currency) {
                    missing_rates.push(cost.currency.clone());
                }
            }
        }

        let nights = night_dates(item);
        let (date, last_night, date_label) = match &nights {
            Some(n) => {
                let (a, b) = (n[0], n[n.len() - 1]);
                let label = if a == b { a.month_day() } else { format!("{}–{}", a.month_day(), b.month_day()) };
                (Some(a.to_string()), Some(b.to_string()), label)
            }
            None => {
                let d = cost_date(item);
                let label = match d.as_deref().and_then(Date::parse) {
                    Some(x) => x.month_day(),
                    None => "no date".to_string(),
                };
                (d, None, label)
            }
        };
        rows.push(CostRow {
            item_id: item.id.clone(),
            title: item.title.clone(),
            kind: item.kind,
            group,
            status: cost.status,
            source: source_of(item),
            date,
            last_night,
            date_label,
            amount: total,
            currency: cost.currency.clone(),
            home,
            per_person_home: home.map(|h| h / forms.people as f64),
            replaced_estimate: cost.replaced_estimate.clone(),
            forms,
        });
    }

    // Columns: only the home currency and rate-less codes are added on use;
    // the trip's added currencies always get a column (item 56a).
    let currency_totals: Vec<CurrencyAmount> = currencies
        .iter()
        .map(|c| CurrencyAmount {
            currency: c.clone(),
            amount: by_kind_cur.values().filter_map(|m| m.get(c)).sum(),
        })
        .collect();

    let amounts_of = |m: &dyn Fn(&str) -> f64| -> Vec<CurrencyAmount> {
        currencies.iter().map(|c| CurrencyAmount { currency: c.clone(), amount: m(c) }).collect()
    };
    let groups = Group::ALL
        .iter()
        .map(|&group| {
            let kinds: Vec<KindLine> = group
                .kinds()
                .into_iter()
                .map(|kind| {
                    let cur = by_kind_cur.get(&kind);
                    let (b, e) = by_kind_home.get(&kind).copied().unwrap_or_default();
                    KindLine {
                        kind,
                        amounts: amounts_of(&|c| cur.and_then(|m| m.get(c)).copied().unwrap_or(0.0)),
                        home: b + e,
                        booked_home: b,
                        estimated_home: e,
                    }
                })
                .collect();
            let (b, e) = kinds.iter().fold((0.0, 0.0), |(b, e), k| (b + k.booked_home, e + k.estimated_home));
            GroupLine {
                group,
                amounts: amounts_of(&|c| kinds.iter().flat_map(|k| k.amounts.iter()).filter(|a| a.currency == c).map(|a| a.amount).sum()),
                home: b + e,
                booked_home: b,
                estimated_home: e,
                limit: s.limits.get(&group).copied(),
                kinds,
            }
        })
        .collect();

    for d in &trip_dates {
        by_date.entry(*d).or_default();
    }
    let dates = by_date
        .into_iter()
        .map(|(d, groups)| DateLine {
            date: d.to_string(),
            label: d.month_day(),
            weekday: d.weekday_short().to_string(),
            in_trip: trip_dates.contains(&d),
            home: groups.values().sum(),
            groups: groups.into_iter().map(|(group, home)| GroupAmount { group, home }).collect(),
        })
        .collect();

    rows.sort_by(|a, b| match (a.home, b.home) {
        (Some(x), Some(y)) => y.total_cmp(&x).then_with(|| a.title.cmp(&b.title)),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.title.cmp(&b.title),
    });

    let people = s.people.max(1);
    BudgetSummary {
        home_currency: s.home_currency.clone(),
        people,
        planned,
        booked,
        estimated,
        per_person: planned / people as f64,
        budget: s.budget,
        left: s.budget.map(|b| b - planned),
        currencies,
        currency_totals,
        groups,
        dates,
        undated_home: undated.values().sum(),
        undated: undated.into_iter().map(|(group, home)| GroupAmount { group, home }).collect(),
        rows,
        missing_rates,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::{apply, Command, Stamp};
    use serde_json::json;

    fn stamp() -> Stamp {
        Stamp { group_id: "g".into(), author: Author::User, at: "2026-11-19T10:00:00Z".into(), label: "test".into() }
    }

    fn run(t: &mut Trip, cmds: Vec<Command>) {
        apply(t, &cmds, stamp()).unwrap();
    }

    /// Tokyo, 12/02–12/06, 3 people, home TWD, 1 JPY = 0.2 TWD, 1 USD = 32 TWD.
    fn trip() -> Trip {
        let mut t = Trip::new("t1", "Tokyo", "2026-12-02", "2026-12-06");
        run(
            &mut t,
            vec![
                Command::SetPeople { people: 3 },
                Command::SetCurrency { code: "JPY".into(), rate_to_home: 0.2, set_on: None },
                Command::SetCurrency { code: "USD".into(), rate_to_home: 32.0, set_on: None },
            ],
        );
        t
    }

    fn item(id: &str, title: &str, kind: &str, extra: serde_json::Value) -> Item {
        let mut v = json!({ "id": id, "title": title, "kind": kind });
        v.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
        serde_json::from_value(v).unwrap()
    }

    fn cost(amount: f64, currency: &str, extra: serde_json::Value) -> Cost {
        let mut v = json!({ "amount": amount, "currency": currency, "status": "estimated" });
        v.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
        serde_json::from_value(v).unwrap()
    }

    fn stay(check_in: &str, check_out: &str) -> Stay {
        Stay { check_in_date: check_in.into(), check_out_date: check_out.into(), check_in: None, check_out: None, check_in_from: None, check_out_by: None }
    }

    fn add_hotel(t: &mut Trip, id: &str, c: Cost, check_in: &str, check_out: &str) {
        run(
            t,
            vec![
                Command::AddItem { item: item(id, "Hotel", "lodging", json!({})) },
                Command::SetStay { id: id.into(), stay: Some(stay(check_in, check_out)) },
                Command::SetCost { id: id.into(), cost: Some(c) },
            ],
        );
    }

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    #[test]
    fn whole_booking_is_the_default() {
        let mut t = trip();
        add_hotel(&mut t, "h", cost(54000.0, "JPY", json!({})), "2026-12-02", "2026-12-05");
        let f = cost_forms(&t, t.item("h").unwrap()).unwrap();
        assert_eq!(f.basis, PriceBasis::Total);
        assert_eq!(f.total, 54000.0);
        assert_eq!(f.nights, 3);
        assert_eq!(f.per_night, Some(18000.0));
        assert_eq!(f.per_person, 18000.0);
        assert_eq!(f.per_person_per_night, Some(6000.0));
    }

    #[test]
    fn per_night_per_person_and_both() {
        let mut t = trip();
        add_hotel(&mut t, "n", cost(18000.0, "JPY", json!({ "perNight": true })), "2026-12-02", "2026-12-05");
        add_hotel(&mut t, "p", cost(5000.0, "JPY", json!({ "perPerson": true })), "2026-12-02", "2026-12-05");
        add_hotel(&mut t, "b", cost(6000.0, "JPY", json!({ "perNight": true, "perPerson": true })), "2026-12-02", "2026-12-05");
        assert_eq!(cost_total(&t, t.item("n").unwrap()), Some(54000.0));
        assert_eq!(cost_total(&t, t.item("p").unwrap()), Some(15000.0));
        assert_eq!(cost_total(&t, t.item("b").unwrap()), Some(54000.0));
        assert_eq!(cost_forms(&t, t.item("b").unwrap()).unwrap().basis, PriceBasis::PerPersonPerNight);

        // Per night with no stay counts one night.
        run(&mut t, vec![Command::AddItem { item: item("x", "Locker", "other", json!({ "cost": { "amount": 700, "currency": "JPY", "status": "estimated", "perNight": true } })) }]);
        let f = cost_forms(&t, t.item("x").unwrap()).unwrap();
        assert_eq!((f.total, f.nights, f.nights_from_stay), (700.0, 1, false));
        // No cost, no total.
        run(&mut t, vec![Command::AddItem { item: item("y", "Walk", "other", json!({})) }]);
        assert_eq!(cost_total(&t, t.item("y").unwrap()), None);
        assert!(cost_forms(&t, t.item("y").unwrap()).is_none());
    }

    #[test]
    fn per_person_follows_the_trip_unless_the_cost_has_its_own_count() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                Command::AddItem { item: item("a", "Shibuya Sky", "sight", json!({})) },
                Command::SetCost { id: "a".into(), cost: Some(cost(2500.0, "JPY", json!({ "perPerson": true }))) },
                Command::AddItem { item: item("r", "Room for 2", "lodging", json!({})) },
                Command::SetCost { id: "r".into(), cost: Some(cost(9000.0, "JPY", json!({ "perPerson": true, "people": 2 }))) },
            ],
        );
        assert_eq!(cost_total(&t, t.item("a").unwrap()), Some(7500.0));
        assert_eq!(cost_total(&t, t.item("r").unwrap()), Some(18000.0));
        assert!(cost_forms(&t, t.item("a").unwrap()).unwrap().people_follow_trip);

        run(&mut t, vec![Command::SetPeople { people: 4 }]);
        assert_eq!(cost_total(&t, t.item("a").unwrap()), Some(10000.0));
        assert_eq!(cost_total(&t, t.item("r").unwrap()), Some(18000.0));
        let s = summary(&t);
        assert_eq!(s.people, 4);
        assert!(close(s.planned, (10000.0 + 18000.0) * 0.2));
        assert!(close(s.per_person, s.planned / 4.0));
        let room = s.rows.iter().find(|r| r.item_id == "r").unwrap();
        assert!(close(room.per_person_home.unwrap(), 18000.0 * 0.2 / 2.0));
    }

    #[test]
    fn currencies_keep_their_own_columns_and_convert_home() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                Command::AddItem { item: item("f", "Flights", "flight", json!({ "booking": { "kind": "flight", "date": "2026-12-02" } })) },
                Command::SetCost { id: "f".into(), cost: Some(cost(1260.0, "USD", json!({ "status": "booked" }))) },
                Command::AddItem { item: item("m", "Monja", "food", json!({ "cost": { "amount": 9000, "currency": "JPY", "status": "estimated", "date": "2026-12-03" } })) },
                Command::AddItem { item: item("c", "Coffee", "food", json!({ "cost": { "amount": 300, "currency": "TWD", "status": "estimated" } })) },
                Command::SetBudget { total: Some(Some(110000.0)), limits: [(Group::Food, 2000.0)].into_iter().collect() },
            ],
        );
        let s = summary(&t);
        assert_eq!(s.home_currency, "TWD");
        assert_eq!(s.currencies, vec!["JPY", "USD", "TWD"]);
        assert_eq!(s.currency_totals[0], CurrencyAmount { currency: "JPY".into(), amount: 9000.0 });
        assert_eq!(s.currency_totals[1].amount, 1260.0);
        let planned = 1260.0 * 32.0 + 9000.0 * 0.2 + 300.0;
        assert!(close(s.planned, planned));
        assert!(close(s.left.unwrap(), 110000.0 - planned));
        assert_eq!(s.budget, Some(110000.0));
        assert!(s.missing_rates.is_empty());

        let food = s.groups.iter().find(|c| c.group == Group::Food).unwrap();
        assert_eq!(food.amounts.iter().map(|a| a.amount).collect::<Vec<_>>(), vec![9000.0, 0.0, 300.0]);
        assert!(close(food.home, 1800.0 + 300.0));
        assert_eq!(food.limit, Some(2000.0));
        assert_eq!(s.groups.len(), 6);
        assert_eq!(s.groups[1].limit, None);

        // Largest first, with home amounts and sources.
        assert_eq!(s.rows[0].item_id, "f");
        assert_eq!(s.rows[0].source, CostSource::Booking);
        assert_eq!(s.rows[0].date_label, "12/02");
        assert_eq!(s.rows.last().unwrap().date_label, "no date");
        assert_eq!(s.rows.last().unwrap().source, CostSource::Budget);
    }

    #[test]
    fn a_currency_with_no_rate_is_left_out_of_home_totals() {
        let mut t = trip();
        run(&mut t, vec![Command::AddItem { item: item("k", "Seoul hotel", "lodging", json!({})) }]);
        // Commands refuse costs in unknown currencies, so put one in directly
        // (as a file from an older version or another tool could).
        t.items[0].cost = Some(cost(100000.0, "KRW", json!({ "date": "2026-12-04" })));
        run(&mut t, vec![Command::AddItem { item: item("m", "Monja", "food", json!({ "cost": { "amount": 9000, "currency": "JPY", "status": "estimated" } })) }]);
        let s = summary(&t);
        assert_eq!(s.missing_rates, vec!["KRW"]);
        assert!(close(s.planned, 1800.0));
        assert!(s.currencies.contains(&"KRW".to_string()));
        let lodging = &s.groups[3];
        assert_eq!(lodging.home, 0.0);
        assert_eq!(lodging.amounts.iter().find(|a| a.currency == "KRW").unwrap().amount, 100000.0);
        let k = s.rows.last().unwrap();
        assert_eq!((k.item_id.as_str(), k.home, k.per_person_home), ("k", None, None));
        assert!(s.dates.iter().all(|d| d.home == 0.0));
    }

    #[test]
    fn booked_and_estimated_totals_and_replaced_estimate() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                Command::AddItem { item: item("s", "Shinkansen", "train", json!({})) },
                Command::SetCost {
                    id: "s".into(),
                    cost: Some(cost(42510.0, "JPY", json!({ "status": "booked", "replacedEstimate": { "amount": 45000, "currency": "JPY" } }))),
                },
                Command::AddItem { item: item("e", "Souvenirs", "shopping", json!({ "cost": { "amount": 9000, "currency": "JPY", "status": "estimated" } })) },
            ],
        );
        let s = summary(&t);
        assert!(close(s.booked, 42510.0 * 0.2));
        assert!(close(s.estimated, 9000.0 * 0.2));
        assert!(close(s.planned, s.booked + s.estimated));
        let transport = &s.groups[2];
        assert!(close(transport.booked_home, 42510.0 * 0.2) && transport.estimated_home == 0.0);
        let row = s.rows.iter().find(|r| r.item_id == "s").unwrap();
        assert_eq!(row.status, CostStatus::Booked);
        assert_eq!(row.replaced_estimate, Some(Money { amount: 45000.0, currency: "JPY".into() }));
    }

    #[test]
    fn bookings_not_counted_in_the_budget_are_left_out() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                Command::AddItem { item: item("g", "Ghibli (paid by friend)", "sight", json!({ "booking": { "kind": "sight", "countInBudget": false } })) },
                Command::SetCost { id: "g".into(), cost: Some(cost(3000.0, "JPY", json!({}))) },
                Command::AddItem { item: item("h", "Hotel", "lodging", json!({ "booking": { "kind": "lodging" } })) },
                Command::SetCost { id: "h".into(), cost: Some(cost(1000.0, "JPY", json!({}))) },
            ],
        );
        assert!(!counts_in_budget(t.item("g").unwrap()));
        let s = summary(&t);
        assert_eq!(s.rows.len(), 1);
        assert_eq!(s.rows[0].item_id, "h");
        assert!(close(s.planned, 200.0));
        assert_eq!(s.groups[1].home, 0.0);
    }

    #[test]
    fn lodging_is_spread_over_its_nights() {
        let mut t = trip();
        add_hotel(&mut t, "h", cost(54000.0, "JPY", json!({ "status": "booked" })), "2026-12-02", "2026-12-05");
        run(&mut t, vec![Command::AddItem { item: item("d", "Dinner", "food", json!({ "slot": { "date": "2026-12-03", "start": 1140, "end": 1230 } })) }]);
        run(&mut t, vec![Command::SetCost { id: "d".into(), cost: Some(cost(5000.0, "JPY", json!({}))) }]);
        let s = summary(&t);
        let labels: Vec<&str> = s.dates.iter().map(|d| d.label.as_str()).collect();
        assert_eq!(labels, vec!["12/02", "12/03", "12/04", "12/05", "12/06"]);
        assert_eq!(s.dates[0].weekday, "Wed");
        assert!(close(s.dates[0].home, 3600.0));
        assert!(close(s.dates[1].home, 3600.0 + 1000.0));
        assert_eq!(s.dates[1].groups.len(), 2);
        assert!(close(s.dates[2].home, 3600.0));
        assert_eq!(s.dates[3].home, 0.0);
        assert!(s.dates[3].groups.is_empty());
        let hotel = s.rows.iter().find(|r| r.item_id == "h").unwrap();
        assert_eq!(hotel.date_label, "12/02–12/04");
        assert_eq!(hotel.date.as_deref(), Some("2026-12-02"));
        assert_eq!(hotel.last_night.as_deref(), Some("2026-12-04"));
        assert_eq!(hotel.source, CostSource::Timetable);
    }

    #[test]
    fn cost_dates_follow_the_order_of_sources_and_undated_costs_get_a_bucket() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                // Slot wins over the booking date.
                Command::AddItem {
                    item: item("a", "Sushi", "food", json!({
                        "slot": { "date": "2026-12-05", "start": 1140, "end": 1230 },
                        "booking": { "kind": "food", "date": "2026-12-04" },
                        "cost": { "amount": 9000, "currency": "JPY", "status": "estimated", "date": "2026-12-02" } })),
                },
                // Booking date wins over the cost's own date; outside the trip.
                Command::AddItem {
                    item: item("b", "Airport train", "train", json!({
                        "booking": { "kind": "train", "date": "2026-12-01" },
                        "cost": { "amount": 1000, "currency": "JPY", "status": "booked", "date": "2026-12-03" } })),
                },
                Command::AddItem { item: item("c", "Souvenirs", "shopping", json!({ "cost": { "amount": 5000, "currency": "JPY", "status": "estimated" } })) },
                Command::AddItem { item: item("d", "Snacks", "food", json!({ "cost": { "amount": 500, "currency": "JPY", "status": "estimated" } })) },
            ],
        );
        assert_eq!(cost_date(t.item("a").unwrap()).as_deref(), Some("2026-12-05"));
        assert_eq!(cost_date(t.item("b").unwrap()).as_deref(), Some("2026-12-01"));
        assert_eq!(cost_date(t.item("c").unwrap()), None);
        let s = summary(&t);
        assert_eq!(s.dates.len(), 6);
        assert_eq!((s.dates[0].date.as_str(), s.dates[0].in_trip), ("2026-12-01", false));
        assert!(close(s.dates[0].home, 200.0));
        assert!(close(s.dates.iter().find(|d| d.date == "2026-12-05").unwrap().home, 1800.0));
        assert!(close(s.undated_home, 1100.0));
        assert_eq!(s.undated.iter().map(|c| c.group).collect::<Vec<_>>(), vec![Group::Food, Group::Shopping]);
        let total_dated: f64 = s.dates.iter().map(|d| d.home).sum();
        assert!(close(total_dated + s.undated_home, s.planned));
    }

    #[test]
    fn summary_serialises_in_camel_case() {
        let mut t = trip();
        run(&mut t, vec![Command::AddItem { item: item("c", "Souvenirs", "shopping", json!({ "cost": { "amount": 5000, "currency": "JPY", "status": "estimated" } })) }]);
        let v = serde_json::to_value(summary(&t)).unwrap();
        assert!(v.get("homeCurrency").is_some() && v.get("missingRates").is_some());
        assert_eq!(v["rows"][0]["forms"]["basis"], "total");
        assert_eq!(v["rows"][0]["source"], "budget");
    }

    #[test]
    fn groups_open_to_their_sub_categories() {
        let mut t = trip();
        run(
            &mut t,
            vec![
                Command::AddItem { item: item("a", "Ramen", "food", json!({ "cost": { "amount": 3000, "currency": "JPY", "status": "estimated" } })) },
                Command::AddItem { item: item("b", "Coffee", "cafe", json!({ "cost": { "amount": 1000, "currency": "JPY", "status": "booked" } })) },
                Command::AddItem { item: item("c", "Parfait", "dessert", json!({ "cost": { "amount": 500, "currency": "TWD", "status": "estimated" } })) },
                Command::AddItem { item: item("f", "Flight", "flight", json!({ "cost": { "amount": 100, "currency": "USD", "status": "booked" } })) },
                Command::AddItem { item: item("l", "Taxi to dinner", "localTravel", json!({ "cost": { "amount": 2000, "currency": "JPY", "status": "estimated" } })) },
            ],
        );
        let s = summary(&t);
        assert_eq!(s.groups.iter().map(|g| g.group).collect::<Vec<_>>(), Group::ALL.to_vec());
        let food = &s.groups[0];
        assert_eq!(food.kinds.iter().map(|k| k.kind).collect::<Vec<_>>(), vec![Kind::Food, Kind::Cafe, Kind::Dessert]);
        assert!(close(food.kinds[0].home, 600.0));
        assert!(close(food.kinds[1].booked_home, 200.0));
        assert!(close(food.kinds[2].home, 500.0));
        assert!(close(food.home, 1300.0));
        assert!(close(food.booked_home, 200.0) && close(food.estimated_home, 1100.0));
        // Group amounts per currency are the sum of their sub-categories.
        let jpy = food.amounts.iter().find(|a| a.currency == "JPY").unwrap();
        assert_eq!(jpy.amount, 4000.0);

        // Flights and local travel are both Transport (item 82).
        let transport = &s.groups[2];
        assert_eq!(transport.kinds.len(), 5);
        let local = transport.kinds.iter().find(|k| k.kind == Kind::LocalTravel).unwrap();
        assert!(close(local.home, 400.0));
        assert!(close(transport.home, 3200.0 + 400.0));
        // Every group is listed, even empty ones (item 83).
        assert_eq!(s.groups[5].kinds.len(), 1);
        assert_eq!(s.groups[5].home, 0.0);

        let row = s.rows.iter().find(|r| r.item_id == "l").unwrap();
        assert_eq!((row.kind, row.group), (Kind::LocalTravel, Group::Transport));
        let v = serde_json::to_value(&s).unwrap();
        assert_eq!(v["groups"][2]["kinds"][4]["kind"], "localTravel");
    }
}

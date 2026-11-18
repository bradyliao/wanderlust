//! JavaScript bindings: the calls in `api.rs`, unchanged. Every function takes
//! and returns JSON text; JavaScript does `JSON.parse` on the result and checks
//! `ok`. Build with `wasm-pack build --target web --features wasm`.

use crate::api;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = newTrip)]
pub fn new_trip(id: &str, name: &str, start_date: &str, end_date: &str) -> String {
    api::new_trip(id, name, start_date, end_date)
}

#[wasm_bindgen(js_name = openTrip)]
pub fn open_trip(text: &str) -> String {
    api::open_trip(text)
}

#[wasm_bindgen(js_name = applyCommands)]
pub fn apply_commands(trip: &str, commands: &str, stamp: &str) -> String {
    api::apply_commands(trip, commands, stamp)
}

#[wasm_bindgen(js_name = applyChangeFile)]
pub fn apply_change_file(trip: &str, file: &str, group_id: &str, at: &str, source: &str) -> String {
    api::apply_change_file(trip, file, group_id, at, source)
}

#[wasm_bindgen(js_name = undoLast)]
pub fn undo_last(trip: &str) -> String {
    api::undo_last(trip)
}

#[wasm_bindgen(js_name = undoTo)]
pub fn undo_to(trip: &str, group_id: &str) -> String {
    api::undo_to(trip, group_id)
}

#[wasm_bindgen(js_name = planView)]
pub fn plan_view(trip: &str) -> String {
    api::plan_view(trip)
}

#[wasm_bindgen(js_name = dragPreview)]
pub fn drag_preview(trip: &str, place_id: &str, date: &str, start: u32, end: u32) -> String {
    api::drag_preview(trip, place_id, date, start, end)
}

#[wasm_bindgen(js_name = movePreview)]
pub fn move_preview(trip: &str, block_key: &str, date: &str, start: u32, end: u32) -> String {
    api::move_preview(trip, block_key, date, start, end)
}

#[wasm_bindgen(js_name = budgetSummary)]
pub fn budget_summary(trip: &str) -> String {
    api::budget_summary(trip)
}

#[wasm_bindgen(js_name = costForms)]
pub fn cost_forms(trip: &str, item_id: &str) -> String {
    api::cost_forms(trip, item_id)
}

#[wasm_bindgen(js_name = importPreview)]
pub fn import_preview(trip: &str, file: &str) -> String {
    api::import_preview(trip, file)
}

#[wasm_bindgen(js_name = importPlaces)]
pub fn import_places(trip: &str, file: &str, id_prefix: &str, stamp: &str) -> String {
    api::import_places(trip, file, id_prefix, stamp)
}

#[wasm_bindgen]
pub fn daylight(lat: f64, lng: f64, date: &str, utc_offset_minutes: i32) -> String {
    api::daylight(lat, lng, date, utc_offset_minutes)
}

#[wasm_bindgen(js_name = coordsFromMapsUrl)]
pub fn coords_from_maps_url(text: &str) -> String {
    api::coords_from_maps_url(text)
}

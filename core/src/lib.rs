//! Wanderlust core: the trip data model and all planning logic.
//!
//! The web app (and later the Tauri app) calls this crate; it holds no UI.
//! Read `README.md` in this folder for the module map and the rules every
//! module follows.

pub mod api;
pub mod budget;
pub mod commands;
pub mod hours;
pub mod import;
pub mod model;
pub mod schedule;
pub mod sun;
pub mod time;
pub mod travel;

#[cfg(feature = "wasm")]
pub mod wasm;

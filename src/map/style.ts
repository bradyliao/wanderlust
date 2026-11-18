// Our own map style (items 41–42): OpenFreeMap vector tiles (OpenMapTiles
// schema), drawn in matte greys from the theme tokens. No POI icons; labels
// muted; English names first. The app's own layers (legs) are added on top by
// the Map pane; pins are HTML markers so they show even when tiles can't load.

import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'

/** OpenFreeMap's TileJSON for the whole planet (free, no key). */
export const TILES_URL = 'https://tiles.openfreemap.org/planet'
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'

/** The colours the style uses, read from the theme's CSS variables. */
export interface MapColors {
  land: string
  water: string
  waterLabel: string
  park: string
  building: string
  road: string
  roadCasing: string
  rail: string
  boundary: string
  label: string
  labelStrong: string
  labelHalo: string
  accent: string
  compare: string
}

const TOKENS: Record<keyof MapColors, [string, string]> = {
  land: ['--map-land', '#ecebe7'],
  water: ['--map-water', '#d8dfe4'],
  waterLabel: ['--map-water-label', '#8e9ba5'],
  park: ['--map-park', '#e1e5dc'],
  building: ['--map-building', '#e3e1dc'],
  road: ['--map-road', '#f8f7f4'],
  roadCasing: ['--map-road-casing', '#dad8d2'],
  rail: ['--map-rail', '#bfbcb5'],
  boundary: ['--map-boundary', '#c6c3bc'],
  label: ['--map-label', '#8b9099'],
  labelStrong: ['--map-label-strong', '#6b7079'],
  labelHalo: ['--map-label-halo', '#f3f2ee'],
  accent: ['--accent', '#3f6b86'],
  compare: ['--map-compare', '#8aa5b7'],
}

/** Read the map colours from CSS variables on `el` (default: the root), with fallbacks. */
export function readMapColors(el: Element = document.documentElement): MapColors {
  const css = getComputedStyle(el)
  const out = {} as MapColors
  for (const [key, [name, fallback]] of Object.entries(TOKENS) as [keyof MapColors, [string, string]][]) {
    out[key] = css.getPropertyValue(name).trim() || fallback
  }
  return out
}

const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']]
const REGULAR = ['Noto Sans Regular']
const ITALIC = ['Noto Sans Italic']

/** Line width that grows with zoom. */
const widths = (pairs: [number, number][]): ExpressionSpecification => ['interpolate', ['exponential', 1.5], ['zoom'], ...pairs.flat()]

/** The base map: background, land cover, water, roads, rail, boundaries, place and road labels. */
export function mapStyle(c: MapColors): StyleSpecification {
  const major = ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false] as ExpressionSpecification
  const middle = ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false] as ExpressionSpecification
  const minor = ['match', ['get', 'class'], ['minor', 'service', 'street', 'residential', 'unclassified'], true, false] as ExpressionSpecification
  const rail = ['match', ['get', 'class'], ['rail', 'transit'], true, false] as ExpressionSpecification
  return {
    version: 8,
    name: 'Wanderlust grey',
    glyphs: GLYPHS_URL,
    sources: {
      base: { type: 'vector', url: TILES_URL, attribution: ATTRIBUTION },
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': c.land } },
      {
        id: 'park',
        type: 'fill',
        source: 'base',
        'source-layer': 'park',
        paint: { 'fill-color': c.park, 'fill-opacity': 0.8 },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'base',
        'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['wood', 'grass', 'farmland'], true, false],
        paint: { 'fill-color': c.park, 'fill-opacity': 0.55 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'base',
        'source-layer': 'water',
        paint: { 'fill-color': c.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'base',
        'source-layer': 'waterway',
        paint: { 'line-color': c.water, 'line-width': widths([[8, 0.5], [16, 3]]) },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'base',
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': c.building, 'fill-opacity': 0.7 },
      },
      {
        id: 'road-casing',
        type: 'line',
        source: 'base',
        'source-layer': 'transportation',
        minzoom: 10,
        filter: ['any', major, middle],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': c.roadCasing, 'line-width': widths([[10, 1.5], [18, 18]]) },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'base',
        'source-layer': 'transportation',
        minzoom: 13,
        filter: minor,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': c.road, 'line-width': widths([[13, 0.8], [18, 10]]) },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'base',
        'source-layer': 'transportation',
        minzoom: 6,
        filter: ['any', major, middle],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': c.road, 'line-width': widths([[6, 0.5], [18, 15]]) },
      },
      {
        id: 'rail',
        type: 'line',
        source: 'base',
        'source-layer': 'transportation',
        minzoom: 9,
        filter: rail,
        paint: { 'line-color': c.rail, 'line-width': widths([[9, 0.6], [18, 2.5]]), 'line-dasharray': [4, 2] },
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'base',
        'source-layer': 'boundary',
        filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': c.boundary, 'line-width': 0.8, 'line-dasharray': [3, 2] },
      },
      {
        id: 'water-name',
        type: 'symbol',
        source: 'base',
        'source-layer': 'water_name',
        minzoom: 8,
        layout: { 'text-field': NAME, 'text-font': ITALIC, 'text-size': 11 },
        paint: { 'text-color': c.waterLabel, 'text-halo-color': c.water, 'text-halo-width': 1 },
      },
      {
        id: 'road-name',
        type: 'symbol',
        source: 'base',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': REGULAR, 'text-size': 10 },
        paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 },
      },
      {
        id: 'place-small',
        type: 'symbol',
        source: 'base',
        'source-layer': 'place',
        minzoom: 12,
        filter: ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet'], true, false],
        layout: { 'text-field': NAME, 'text-font': REGULAR, 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.06 },
        paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 },
      },
      {
        id: 'place-town',
        type: 'symbol',
        source: 'base',
        'source-layer': 'place',
        minzoom: 7,
        filter: ['==', ['get', 'class'], 'town'],
        layout: { 'text-field': NAME, 'text-font': REGULAR, 'text-size': 12 },
        paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 },
      },
      {
        id: 'place-city',
        type: 'symbol',
        source: 'base',
        'source-layer': 'place',
        maxzoom: 14,
        filter: ['==', ['get', 'class'], 'city'],
        layout: { 'text-field': NAME, 'text-font': REGULAR, 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 10, 15] },
        paint: { 'text-color': c.labelStrong, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4 },
      },
      {
        id: 'place-country',
        type: 'symbol',
        source: 'base',
        'source-layer': 'place',
        maxzoom: 7,
        filter: ['==', ['get', 'class'], 'country'],
        layout: { 'text-field': NAME, 'text-font': REGULAR, 'text-size': 12, 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 },
        paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4 },
      },
    ],
  }
}

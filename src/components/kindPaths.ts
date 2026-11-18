// Sub-category icon paths (item 81), shared by the React icons and the map's HTML pins.

import type { Kind } from '../types'

/** Sub-category icons (item 81): one line drawing each, 16×16. */
export const KIND_PATHS: Record<Kind, string> = {
  // bowl with steam
  food: 'M2.5 8h11a5.5 5.5 0 01-11 0zM6 2.5c-.6.8.6 1.7 0 2.5M9.5 2.5c-.6.8.6 1.7 0 2.5',
  // cup with handle
  cafe: 'M3 5.5h8v4a3.5 3.5 0 01-7 0zM11 6.5h1.2a1.6 1.6 0 010 3.2H11M3 14h8',
  // ice cream cone
  dessert: 'M4.5 7a3.5 3.5 0 017 0zM4.5 7L8 14.5 11.5 7',
  // torii gate
  sight: 'M1.5 3c4.3 1 8.7 1 13 0M3 6.5h10M5 4v10M11 4v10M8 4v2.5',
  // columns
  museum: 'M2 5.5L8 2.5l6 3zM3.5 7v5.5M6.5 7v5.5M9.5 7v5.5M12.5 7v5.5M2 13.5h12',
  // tree
  nature: 'M8 2l4.5 7h-9zM8 6l5 6H3zM8 12v2.5',
  // moon
  nightlife: 'M12.5 10A5.5 5.5 0 016 3.5a5.5 5.5 0 106.5 6.5z',
  // plane
  flight: 'M2 9.5l12-5-3 9-3-3.5zM8 10l-1 3.5',
  // train front
  train: 'M4 2.5h8v8.5H4zM4 7.5h8M6 13.5L5 15M10 13.5l1 1.5M6 9.5h.01M10 9.5h.01',
  // bus
  bus: 'M3 2.5h10v10H3zM3 8h10M5 12.5v2M11 12.5v2M5.5 10.3h.01M10.5 10.3h.01',
  // car
  car: 'M2 10V8l1.5-4h9L14 8v2zM2 10v2.5h2V10M12 10v2.5h2V10M4.5 8h.01M11.5 8h.01',
  // two arrows
  localTravel: 'M2.5 5.5h10l-2-2M13.5 10.5h-10l2 2',
  // house
  lodging: 'M2 7.5L8 2.5l6 5M3.5 6.5v7h9v-7M6.5 13.5V10h3v3.5',
  // shopping bag
  shopping: 'M3 5.5h10l-.7 8.5H3.7zM5.5 5.5V5a2.5 2.5 0 015 0v.5',
  // map pin
  other: 'M8 14.5S3 9.6 3 6.5a5 5 0 0110 0c0 3.1-5 8-5 8zM8 8.2a1.7 1.7 0 100-3.4 1.7 1.7 0 000 3.4z',
}

/** A 16×16 line icon as SVG markup, for elements built outside React (map pins). */
export function kindIconSvg(kind: Kind, size = 12): string {
  const d = KIND_PATHS[kind] ?? KIND_PATHS.other
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`
}

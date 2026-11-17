import type { Block, Place, Trip } from './types'

/**
 * A made-up Tokyo trip so the app has something to show on first run.
 * Coordinates, hours and prices are approximate placeholders, not verified data.
 */

function place(p: Place): Place {
  return p
}

const places: Place[] = [
  place({ id: 'hotel', name: 'Hotel near Ueno Station', area: 'Ueno', category: 'lodging', lat: 35.712, lng: 139.778, stayMin: 60, note: 'Placeholder lodging.' }),
  place({ id: 'haneda', name: 'Haneda Airport Terminal 3', area: 'Haneda', category: 'transport', lat: 35.5494, lng: 139.7798, stayMin: 60 }),
  place({ id: 'sensoji', name: 'Senso-ji', area: 'Asakusa', category: 'sight', lat: 35.7148, lng: 139.7967, stayMin: 90, rating: 3 }),
  place({ id: 'kappabashi', name: 'Kappabashi Kitchen Street', area: 'Asakusa', category: 'shopping', lat: 35.7143, lng: 139.7888, stayMin: 60, open: 600, close: 1020, rating: 2 }),
  place({ id: 'skytree', name: 'Tokyo Skytree', area: 'Oshiage', category: 'sight', lat: 35.7101, lng: 139.8107, stayMin: 90, open: 600, close: 1320, rating: 2 }),
  place({ id: 'uenopark', name: 'Ueno Park', area: 'Ueno', category: 'sight', lat: 35.7146, lng: 139.7734, stayMin: 60, rating: 3 }),
  place({ id: 'tnm', name: 'Tokyo National Museum', area: 'Ueno', category: 'sight', lat: 35.7188, lng: 139.7765, stayMin: 120, open: 570, close: 1020, closedDays: [1], rating: 3 }),
  place({ id: 'ameyoko', name: 'Ameyoko Market', area: 'Ueno', category: 'food', lat: 35.7106, lng: 139.7745, stayMin: 60, rating: 2 }),
  place({ id: 'rikugien', name: 'Rikugien Garden', area: 'Komagome', category: 'sight', lat: 35.7331, lng: 139.7466, stayMin: 75, open: 540, close: 1020, seasonal: 'Autumn leaves', rating: 3 }),
  place({ id: 'meiji', name: 'Meiji Jingu', area: 'Harajuku', category: 'sight', lat: 35.6764, lng: 139.6993, stayMin: 75, rating: 3 }),
  place({ id: 'gaien', name: 'Jingu Gaien Ginkgo Avenue', area: 'Aoyama', category: 'sight', lat: 35.6747, lng: 139.718, stayMin: 45, seasonal: 'Ginkgo', rating: 3 }),
  place({ id: 'gyoen', name: 'Shinjuku Gyoen', area: 'Shinjuku', category: 'sight', lat: 35.6852, lng: 139.71, stayMin: 90, open: 540, close: 960, closedDays: [1], seasonal: 'Autumn leaves', rating: 2 }),
  place({ id: 'shibuyasky', name: 'Shibuya Sky', area: 'Shibuya', category: 'sight', lat: 35.6585, lng: 139.7021, stayMin: 75, open: 600, close: 1350, note: 'Timed tickets; sunset slots sell out.', rating: 2 }),
  place({ id: 'omoide', name: 'Omoide Yokocho', area: 'Shinjuku', category: 'food', lat: 35.6929, lng: 139.6995, stayMin: 75, open: 1020, close: 1410, rating: 1 }),
  place({ id: 'tsukiji', name: 'Tsukiji Outer Market', area: 'Tsukiji', category: 'food', lat: 35.6655, lng: 139.7707, stayMin: 90, open: 480, close: 840, closedDays: [0, 3], rating: 3 }),
  place({ id: 'teamlab', name: 'teamLab Planets', area: 'Toyosu', category: 'sight', lat: 35.6491, lng: 139.7898, stayMin: 120, open: 540, close: 1320, rating: 1 }),
  place({ id: 'eastgardens', name: 'Imperial Palace East Gardens', area: 'Marunouchi', category: 'sight', lat: 35.6852, lng: 139.7528, stayMin: 75, open: 540, close: 960, closedDays: [1, 5], rating: 3 }),
  place({ id: 'tokyostation', name: 'Tokyo Station Marunouchi side', area: 'Marunouchi', category: 'sight', lat: 35.6812, lng: 139.7671, stayMin: 45, rating: 2 }),
  place({ id: 'tower', name: 'Tokyo Tower', area: 'Shiba', category: 'sight', lat: 35.6586, lng: 139.7454, stayMin: 75, open: 540, close: 1380, rating: 2 }),
  place({ id: 'keyakizaka', name: 'Roppongi Keyakizaka illumination', area: 'Roppongi', category: 'sight', lat: 35.6605, lng: 139.7292, stayMin: 45, open: 1020, close: 1380, seasonal: 'Winter lights', rating: 3 }),
]

const D1 = '2026-11-28'
const D2 = '2026-11-29'
const D3 = '2026-11-30'
const D4 = '2026-12-01'

function stay(id: string, day: string, start: number, end: number, placeId: string, extra: Partial<Block> = {}): Block {
  const p = places.find((x) => x.id === placeId)!
  return { id, day, start, end, placeId, title: p.name, category: p.category, ...extra }
}

const blocks: Block[] = [
  stay('b1', D1, 13 * 60, 14 * 60, 'haneda', { title: 'Land at Haneda', locked: true, note: 'Immigration and bags.' }),
  stay('b2', D1, 15 * 60, 16 * 60, 'hotel', { title: 'Drop bags at hotel' }),
  stay('b3', D1, 16 * 60 + 15, 17 * 60 + 15, 'uenopark'),
  stay('b4', D1, 17 * 60 + 30, 19 * 60, 'ameyoko', { title: 'Dinner at Ameyoko', cost: 2500, tentative: true }),

  stay('b5', D2, 9 * 60, 10 * 60 + 30, 'sensoji'),
  stay('b6', D2, 10 * 60 + 45, 11 * 60 + 45, 'kappabashi'),
  stay('b7', D2, 13 * 60, 14 * 60 + 30, 'skytree', { cost: 2400 }),
  stay('b8', D2, 16 * 60, 17 * 60 + 15, 'rikugien', { cost: 300 }),

  stay('b9', D3, 9 * 60 + 30, 10 * 60 + 45, 'meiji'),
  stay('b10', D3, 11 * 60 + 15, 12 * 60, 'gaien'),
  stay('b11', D3, 13 * 60 + 30, 15 * 60, 'gyoen', { cost: 500 }),
  stay('b12', D3, 15 * 60 + 45, 17 * 60, 'shibuyasky', { title: 'Shibuya Sky at sunset', locked: true, cost: 2500, note: 'Sunset about 16:30. Ticket is for a fixed entry time.' }),

  stay('b13', D4, 8 * 60 + 30, 10 * 60, 'tsukiji', { title: 'Breakfast at Tsukiji', cost: 3000 }),
  stay('b14', D4, 10 * 60 + 30, 11 * 60 + 45, 'eastgardens'),
  stay('b15', D4, 12 * 60 + 15, 13 * 60, 'tokyostation'),
  stay('b16', D4, 17 * 60 + 30, 18 * 60 + 15, 'keyakizaka'),
]

export function sampleTrip(): Trip {
  return {
    id: 'sample-tokyo',
    name: 'Tokyo in late autumn',
    destination: 'Tokyo, Japan',
    startDate: D1,
    endDate: D4,
    partySize: 2,
    pace: 'relaxed',
    currency: 'JPY',
    homeCurrency: 'TWD',
    rate: 0.21,
    rateDate: '2026-11-17',
    places: structuredClone(places),
    blocks: structuredClone(blocks),
    legs: {
      'b1>b2': { mode: 'transit', minutes: 50, cost: 600, note: 'Monorail, then JR Yamanote line.', verified: true },
    },
    checklist: [
      { id: 'c1', text: 'Book Shibuya Sky sunset tickets', note: 'Sales open about four weeks ahead.', done: false },
      { id: 'c2', text: 'Ask the hotel about early luggage drop', done: false },
      { id: 'c3', text: 'Decide on a subway pass', note: 'Compare with pay-as-you-go once the timetable settles.', done: false },
      { id: 'c4', text: 'Rain plan for the Skytree day', done: true },
    ],
  }
}

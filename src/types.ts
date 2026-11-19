// JSON shapes returned by the Rust core (core/src/model.rs, api.rs, budget.rs).
// Only the fields the app shell reads are typed; the rest stay `unknown` and
// are passed back to the core untouched.

/** Travel modes in Google Maps order (item 33). */
export type Mode = 'drive' | 'transit' | 'walk' | 'twoWheeler' | 'cycle' | 'ride'

/** The six groups (item 81). */
export type Group = 'food' | 'activity' | 'transport' | 'lodging' | 'shopping' | 'other'

export interface CurrencyRate {
  code: string
  rateToHome: number
  setOn: string | null
}

export interface Settings {
  people: number
  defaultMode: Mode
  homeCurrency: string
  currencies: CurrencyRate[]
  budget: number | null
  limits: Partial<Record<Group, number>>
}

export type Author = { type: 'user' } | { type: 'ai'; source: string | null }

/** One undo step in the change log (item 76). */
export interface LogGroup {
  id: string
  author: Author
  at: string
  label: string
  changes: unknown[]
}

/** Overrides for one date (model.rs `Day`). */
export interface Day {
  date: string
  city?: string | null
  timeZone?: string | null
  utcOffsetMinutes?: number | null
  mode?: Mode | null
}

export interface Trip {
  format: string
  version: number
  id: string
  name: string
  startDate: string
  endDate: string
  settings: Settings
  days: Day[]
  places: Place[]
  items: Item[]
  legs: unknown[]
  /** Newest last. */
  log: LogGroup[]
}

/** The 15 sub-categories (item 81). Places use all but `localTravel`. */
export type Kind =
  | 'food'
  | 'cafe'
  | 'dessert'
  | 'sight'
  | 'museum'
  | 'nature'
  | 'nightlife'
  | 'flight'
  | 'train'
  | 'bus'
  | 'car'
  | 'localTravel'
  | 'lodging'
  | 'shopping'
  | 'other'

/** Unrated, then the three ratings (items 17a, 68). */
export type Rating = 'unrated' | 'forget' | 'soSo' | 'mustGo'

/** Minutes from local midnight; `close <= open` runs past midnight, `0..1440` is all day. */
export interface TimeRange {
  open: number
  close: number
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

/** Per weekday: missing or null = unknown, `[]` = closed. */
export type OpeningHours = Partial<Record<Weekday, TimeRange[] | null>>

export interface PlaceCost {
  amount: number
  currency: string
  perPerson: boolean
}

/** A place in the Place List (model.rs `Place`). */
export interface Place {
  id: string
  name: string
  nameLocal?: string | null
  kind: Kind
  area?: string | null
  city?: string | null
  country?: string | null
  googleMapsUrl?: string | null
  lat?: number | null
  lng?: number | null
  address?: string | null
  usualStayMinutes?: number | null
  openingHours?: OpeningHours | null
  hoursNote?: string | null
  estimatedCost?: PlaceCost | null
  rating: Rating
  tags?: string[]
  notes?: string | null
  aiNotes?: string | null
  /** Field names (camelCase) that came from an import and are not checked yet (item 69). */
  unverified?: string[]
  source?: unknown
  updatedAt?: string | null
}

export interface Slot {
  date: string
  start: number
  end: number
  fixed?: boolean
  fixedReason?: string | null
}

/** A stay's dates and blocks (model.rs `Stay`, item 63). Nights run from `checkInDate` to the night before `checkOutDate`. */
export interface Stay {
  checkInDate: string
  checkOutDate: string
  checkIn?: Slot | null
  checkOut?: Slot | null
  /** Set by the hotel, minutes: "from 15:00", "by 11:00". */
  checkInFrom?: number | null
  checkOutBy?: number | null
}

/** model.rs `Booking` (items 49–51). */
export interface Booking {
  kind: Kind
  confirmation?: string | null
  provider?: string | null
  url?: string | null
  address?: string | null
  /** Booked for a date but no time yet (item 64). */
  date?: string | null
  /** `YYYY-MM-DD HH:MM`, local time. */
  cancelDeadline?: string | null
  cancelNote?: string | null
  files?: { id: string; name: string }[]
  /** Defaults to true in the core. */
  countInBudget?: boolean
}

export type CostStatus = 'estimated' | 'booked'

export interface Money {
  amount: number
  currency: string
}

/** model.rs `Cost` (items 53, 58–62). */
export interface Cost {
  amount: number
  currency: string
  /** Off = the whole booking (item 58). */
  perNight?: boolean
  perPerson?: boolean
  /** People it covers; null = everyone on the trip (items 59, 65). */
  people?: number | null
  status: CostStatus
  /** The estimate a booked price replaced (item 62). */
  replacedEstimate?: Money | null
  /** For budget-only costs with no slot, booking or stay. */
  date?: string | null
}

/** model.rs `Item`: one thing with an optional time, booking and cost (item 61). */
export interface Item {
  id: string
  title: string
  placeId?: string | null
  kind: Kind
  slot?: Slot | null
  stay?: Stay | null
  booking?: Booking | null
  cost?: Cost | null
  notes?: string | null
  updatedAt?: string | null
}

/** One place in an import preview (import.rs `PreviewPlace`). */
export interface PreviewPlace {
  number: number
  name: string
  area: string | null
  kind: Kind | null
  rating: Rating
}

export interface PreviewDuplicate {
  number: number
  name: string
  matchedBy: 'link' | 'nameAndArea'
  existingPlaceId: string | null
  sameAsNumber: number | null
  existingName: string
  /** Place field names it would fill; empty = nothing new. */
  fills: string[]
}

/** What a place import would do (import.rs `Preview`, item 70). */
export interface ImportPreview {
  newPlaces: PreviewPlace[]
  linkOnly: PreviewPlace[]
  duplicates: PreviewDuplicate[]
  problems: string[]
}

/** Who made a change and when (api.rs `StampIn`). */
export interface Stamp {
  groupId: string
  at: string
  label: string
  aiSource?: string
}

/** A command (core/src/commands.rs). Only the ones the shell sends are typed. */
export type Command =
  | { op: 'setPeople'; people: number }
  | { op: 'setDefaultMode'; mode: Mode }
  | { op: 'addPlace'; place: Place }
  /** `set` holds place fields (camelCase); `null` clears one. */
  | { op: 'updatePlace'; id: string; set: Record<string, unknown> }
  | { op: 'ratePlace'; id: string; rating: Rating }
  | { op: 'removePlace'; id: string }
  | { op: 'schedulePlace'; placeId: string; itemId: string; date: string; start: number; end?: number | null }
  | { op: 'moveItem'; id: string; part?: BlockPart; date: string; start: number; end: number }
  | { op: 'unschedule'; id: string }
  | { op: 'setFixed'; id: string; part?: BlockPart; fixed: boolean; reason?: string | null }
  /** `mode: null` goes back to the day's mode. */
  | { op: 'setLegMode'; from: string; to: string; mode: Mode | null }
  | { op: 'setHomeCurrency'; code: string }
  | { op: 'setCurrency'; code: string; rateToHome: number; setOn?: string | null }
  | { op: 'removeCurrency'; code: string }
  /** Leave `total` out to keep it, `null` clears it; a limit of 0 removes it. */
  | { op: 'setBudget'; total?: number | null; limits?: Partial<Record<Group, number>> }
  | { op: 'addItem'; item: Item }
  /** `set` holds item fields (camelCase), merged; `null` clears one. */
  | { op: 'updateItem'; id: string; set: Record<string, unknown> }
  | { op: 'removeItem'; id: string }
  | { op: 'setCost'; id: string; cost: Cost | null }
  | { op: 'setBooking'; id: string; booking: Booking | null }
  | { op: 'setStay'; id: string; stay: Stay | null }

export type BlockPart = 'main' | 'checkIn' | 'checkOut'

/** A block on the timetable (schedule.rs `Block`). `key` is the item id, or `<id>#checkIn` / `<id>#checkOut`. */
export interface Block {
  key: string
  itemId: string
  part: BlockPart
  title: string
  date: string
  start: number
  end: number
  fixed: boolean
  reason: string | null
  placeId: string | null
}

export type TravelSource = 'estimate' | 'routed' | 'confirmed'

export interface ModeOption {
  mode: Mode
  minutes: number | null
  source: TravelSource
}

/** Travel for one leg (travel.rs `LegTravel`). */
export interface LegTravel {
  mode: Mode
  minutes: number | null
  source: TravelSource
  distanceKm: number | null
  /** Walking minutes, when the leg is short and not already Walk (item 35). */
  walkHint: number | null
  options: ModeOption[]
  line: [number, number][]
  mapsUrl: string | null
}

/** Travel between two consecutive blocks (schedule.rs `LegView`). */
export interface LegView {
  date: string
  fromKey: string
  toKey: string
  fromPlaceId: string
  toPlaceId: string
  fromEnd: number
  toStart: number
  gapMinutes: number
  travel: LegTravel
  tight: boolean
}

/** The stay covering a night (schedule.rs `Night`, item 63). */
export interface Night {
  itemId: string
  title: string
  placeId: string | null
  checkInDate: string
  checkOutDate: string
  night: number
  nights: number
}

export type WarningKind = 'overlap' | 'closed' | 'outsideHours' | 'tooTight'

export interface Warning {
  date: string
  blockKey: string
  kind: WarningKind
  message: string
  otherKey: string | null
}

export interface SunTimes {
  dawn: number | null
  sunrise: number | null
  sunset: number | null
  dusk: number | null
}

export type Stage = 'night' | 'twilight' | 'goldenHour' | 'day'

/** From `minute` on, the sky is `stage` (sun.rs `Stop`). */
export interface DaylightStop {
  minute: number
  stage: Stage
}

export interface DayClosed {
  date: string
  /** Closed ranges; null = hours unknown. */
  ranges: [number, number][] | null
  allDay: boolean
}

export interface Neighbour {
  key: string
  title: string
  placeId: string | null
  start: number
  end: number
  travel: LegTravel | null
  needs: number | null
  has: number
  fits: boolean | null
  message: string | null
}

/** `dragPreview` / `movePreview` (schedule.rs `DragPreview`, items 27–31). */
export interface DragPreview {
  date: string
  start: number
  end: number
  closed: DayClosed[]
  before: Neighbour | null
  after: Neighbour | null
  inClosedHours: boolean | null
  hoursMessage: string | null
  overFixed: string[]
}

/** One day of `planView`. */
export interface PlanDay {
  date: string
  /** `12/02` */
  label: string
  /** `Wed` */
  weekday: string
  city: string | null
  mode: Mode
  modeIsOverride: boolean
  blocks: Block[]
  legs: LegView[]
  night: Night | null
  warnings: Warning[]
  location: [number, number] | null
  sun: SunTimes | null
  /** Gradient stops; empty when the day has no location or UTC offset. */
  daylight: DaylightStop[]
}

export interface CurrencyAmount {
  currency: string
  amount: number
}

/** One sub-category inside a group line (budget.rs `KindLine`). */
export interface KindLine {
  kind: Kind
  amounts: CurrencyAmount[]
  home: number
  bookedHome: number
  estimatedHome: number
}

/** One of the six group lines, in order (budget.rs `GroupLine`, items 81–83). */
export interface GroupLine {
  group: Group
  /** One per column in `BudgetSummary.currencies`. */
  amounts: CurrencyAmount[]
  home: number
  bookedHome: number
  estimatedHome: number
  limit: number | null
  kinds: KindLine[]
}

export interface GroupAmount {
  group: Group
  home: number
}

/** Planned spending on one date (lodging spread over its nights). */
export interface DateLine {
  date: string
  label: string
  weekday: string
  inTrip: boolean
  groups: GroupAmount[]
  home: number
}

export type PriceBasis = 'total' | 'perNight' | 'perPerson' | 'perPersonPerNight'

/** A price's total and calculated forms (budget.rs `CostForms`, item 60). */
export interface CostForms {
  currency: string
  entered: number
  basis: PriceBasis
  nights: number
  nightsFromStay: boolean
  people: number
  peopleFollowTrip: boolean
  total: number
  perNight: number | null
  perPerson: number
  perPersonPerNight: number | null
}

export type CostSource = 'booking' | 'timetable' | 'budget'

/** One line of the cost list (budget.rs `CostRow`). */
export interface CostRow {
  itemId: string
  title: string
  kind: Kind
  group: Group
  status: CostStatus
  source: CostSource
  date: string | null
  lastNight: string | null
  dateLabel: string
  /** The total, in `currency`. */
  amount: number
  currency: string
  /** Null when the currency has no rate. */
  home: number | null
  perPersonHome: number | null
  replacedEstimate: Money | null
  forms: CostForms
}

/** `budgetSummary` (budget.rs `BudgetSummary`, items 52–57). */
export interface BudgetSummary {
  homeCurrency: string
  people: number
  planned: number
  booked: number
  estimated: number
  perPerson: number
  budget: number | null
  left: number | null
  /** Currency columns in use: the trip's currencies, then any a cost uses. */
  currencies: string[]
  currencyTotals: CurrencyAmount[]
  groups: GroupLine[]
  dates: DateLine[]
  undated: GroupAmount[]
  undatedHome: number
  /** Largest home amount first. */
  rows: CostRow[]
  missingRates: string[]
}

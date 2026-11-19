// Budget page logic as pure functions (items 52–57, 62, 81–83): bars against
// limits, the per-day chart, the budget bar, which currencies can be removed,
// and the "Add estimated cost" form turned into a command. The sums themselves
// come from the core (`budgetSummary`); nothing here adds money up except to
// scale the drawings. Tested in budget.test.ts.

import { parseAmount } from './money'
import type { BudgetSummary, Command, CostRow, CostSource, Group, Item, Kind, Trip } from './types'

/** How full a group's bar is: against its limit, else against the largest group. */
export function groupBar(home: number, limit: number | null, largest: number): { fill: number; over: boolean } {
  if (limit != null && limit > 0) return { fill: Math.min(home / limit, 1), over: home > limit }
  return { fill: largest > 0 ? Math.min(home / largest, 1) : 0, over: false }
}

/** The budget bar at the top: each group's share of the budget (or of the planned total when it is larger). */
export function budgetSegments(s: Pick<BudgetSummary, 'groups' | 'budget' | 'planned'>): { group: Group; fraction: number }[] {
  const whole = Math.max(s.budget ?? 0, s.planned)
  if (whole <= 0) return []
  return s.groups.filter((g) => g.home > 0).map((g) => ({ group: g.group, fraction: g.home / whole }))
}

export interface DayColumn {
  key: string
  /** `12/02`, or `No date`. */
  label: string
  weekday: string
  inTrip: boolean
  home: number
  /** Bottom to top, in group order; fractions of the tallest column. */
  segments: { group: Group; home: number; fraction: number }[]
}

const GROUP_ORDER: Group[] = ['food', 'activity', 'transport', 'lodging', 'shopping', 'other']

/** Columns for the per-day chart (shown in the mock, to confirm): one per date, then "No date" when some costs have none. */
export function dayColumns(s: Pick<BudgetSummary, 'dates' | 'undated' | 'undatedHome'>): DayColumn[] {
  const raw = s.dates.map((d) => ({ key: d.date, label: d.label, weekday: d.weekday, inTrip: d.inTrip, home: d.home, groups: d.groups }))
  if (s.undatedHome > 0) raw.push({ key: 'undated', label: 'No date', weekday: '', inTrip: true, home: s.undatedHome, groups: s.undated })
  const tallest = Math.max(0, ...raw.map((c) => c.home))
  return raw.map((c) => ({
    key: c.key,
    label: c.label,
    weekday: c.weekday,
    inTrip: c.inTrip,
    home: c.home,
    segments: GROUP_ORDER.flatMap((group) => {
      const home = c.groups.find((g) => g.group === group)?.home ?? 0
      return home > 0 ? [{ group, home, fraction: tallest > 0 ? home / tallest : 0 }] : []
    }),
  }))
}

/** Currencies some cost (or replaced estimate) still uses; the core refuses to remove these. */
export function currenciesInUse(trip: Pick<Trip, 'items'>): Set<string> {
  const out = new Set<string>()
  for (const i of trip.items) {
    if (!i.cost) continue
    out.add(i.cost.currency)
    if (i.cost.replacedEstimate) out.add(i.cost.replacedEstimate.currency)
  }
  return out
}

/** Where a cost came from, in words. */
export function sourceLabel(source: CostSource): string {
  switch (source) {
    case 'booking':
      return 'booking'
    case 'timetable':
      return 'timetable block'
    case 'budget':
      return 'added on Budget'
  }
}

/** The row's amount in one currency column, or null for the other columns. */
export const amountIn = (row: Pick<CostRow, 'amount' | 'currency'>, currency: string): number | null => (row.currency === currency ? row.amount : null)

export interface EstimateFields {
  title: string
  kind: Kind
  amount: string
  currency: string
  /** `YYYY-MM-DD` or empty. */
  date: string
}

/** "+ Add estimated cost" (item 62): a new item with only an estimated cost. */
export function estimateCommand(f: EstimateFields, id: string): { command: Command } | { error: string } {
  const title = f.title.trim()
  if (!title) return { error: 'Give the cost a name.' }
  const amount = parseAmount(f.amount)
  if (amount == null) return { error: 'The amount is not a number of 0 or more.' }
  const item: Item = {
    id,
    title,
    kind: f.kind,
    cost: { amount, currency: f.currency, perNight: false, perPerson: false, people: null, status: 'estimated', replacedEstimate: null, date: f.date || null },
  }
  return { command: { op: 'addItem', item } }
}

/** `YYYY-MM-DD` in local time, for "rate set on". */
export function today(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

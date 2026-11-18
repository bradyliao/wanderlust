import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import * as core from './core'

beforeAll(() => {
  core.loadCoreSync(readFileSync(new URL('../core/pkg/wanderlust_core_bg.wasm', import.meta.url)))
})

const trip = () => core.newTrip('Tokyo', '2026-12-02', '2026-12-06')

describe('core wrapper', () => {
  it('makes a trip with an id and default settings', () => {
    const t = trip()
    expect(t.id).toMatch(/[0-9a-f-]{36}/)
    expect(t.settings.people).toBe(1)
    expect(t.settings.defaultMode).toBe('transit')
  })

  it('throws the core message in plain words', () => {
    expect(() => core.newTrip('Bad', '2026-12-06', '2026-12-02')).toThrow('is not a valid date range')
    try {
      core.applyCommands(trip(), [{ op: 'setPeople', people: 0 }], core.userStamp('People: 0'))
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(core.CoreError)
      expect((e as core.CoreError).message).toBe('A trip needs at least one person.')
      expect((e as core.CoreError).index).toBe(0)
    }
  })

  it('applies commands, logs them as the user, and undoes', () => {
    let t = core.applyCommands(trip(), [{ op: 'setPeople', people: 3 }], core.userStamp('People: 3'))
    t = core.applyCommands(t, [{ op: 'setDefaultMode', mode: 'walk' }], core.userStamp('Transport: Walk'))
    expect(t.settings.people).toBe(3)
    expect(t.log.map((g) => g.label)).toEqual(['People: 3', 'Transport: Walk'])
    expect(t.log[0].author).toEqual({ type: 'user' })

    const one = core.undoLast(t)
    expect(one.undone).toBe('Transport: Walk')
    expect(one.trip.settings.defaultMode).toBe('transit')

    const back = core.undoTo(t, t.log[0].id)
    expect(back.steps).toBe(2)
    expect(back.trip.settings.people).toBe(1)
    expect(back.trip.log).toEqual([])
    expect(core.undoLast(back.trip).undone).toBeNull()
  })

  it('applies an AI change file as one group, or explains why not', () => {
    const file = JSON.stringify({
      format: 'wanderlust-changes',
      version: 1,
      label: 'Four of us',
      commands: [{ op: 'setPeople', people: 4 }, { op: 'setDefaultMode', mode: 'drive' }],
    })
    const r = core.applyChangeFile(trip(), file, 'ideas.json')
    expect(r.count).toBe(2)
    expect(r.trip.log).toHaveLength(1)
    expect(r.trip.log[0].author).toEqual({ type: 'ai', source: 'ideas.json' })
    expect(r.trip.log[0].label).toBe('Four of us')

    const bad = JSON.stringify({ format: 'wanderlust-changes', version: 1, commands: [{ op: 'setPeople', people: 0 }] })
    expect(() => core.applyChangeFile(trip(), bad, 'bad.json')).toThrow('Command 1 of 1: A trip needs at least one person.')
    expect(() => core.applyChangeFile(trip(), 'not json', 'x.json')).toThrow(core.CoreError)
  })

  it('round-trips a trip through export and open', () => {
    const t = core.applyCommands(trip(), [{ op: 'setPeople', people: 2 }], core.userStamp('People: 2'))
    expect(core.openTrip(JSON.stringify(t, null, 2))).toEqual(t)
    expect(() => core.openTrip('{"hello":1}')).toThrow(core.CoreError)
  })

  it('reads plan days and the budget summary', () => {
    const days = core.planView(trip())
    expect(days.map((d) => `${d.label} ${d.weekday}`)).toEqual(['12/02 Wed', '12/03 Thu', '12/04 Fri', '12/05 Sat', '12/06 Sun'])
    const b = core.budgetSummary(trip())
    expect(b.homeCurrency).toBe('TWD')
    expect(b.budget).toBeNull()
    expect(b.groups.map((g) => g.group)).toEqual(['food', 'activity', 'transport', 'lodging', 'shopping', 'other'])
  })

  it('previews and imports the sample places file as one step', () => {
    const sample = (name: string) => readFileSync(new URL(`../docs/samples/${name}`, import.meta.url), 'utf8')
    const t = core.applyChangeFile(trip(), sample('sample-trip.changes.json'), 'sample').trip
    const file = sample('sample-places.json')
    const pv = core.importPreview(t, file)
    expect(pv.newPlaces).toHaveLength(4)
    expect(pv.linkOnly.map((p) => p.name)).toEqual(['Tiny gallery from a reel (sample)'])
    expect(pv.duplicates.map((d) => [d.existingName, d.sameAsNumber])).toEqual([
      ['Senso-ji', null],
      ['Yanaka Ginza (sample)', 1],
    ])
    expect(pv.problems).toHaveLength(4)
    const r = core.importPlaces(t, file, 'imp-test', core.userStamp('Imported places'))
    expect(r.trip.places).toHaveLength(t.places.length + 5)
    expect(r.trip.log).toHaveLength(t.log.length + 1)
    expect(r.trip.places.find((p) => p.id === 'p-sensoji')?.unverified).toContain('address')
    expect(core.coordsFromMapsUrl('https://www.google.com/maps/place/x/@35.7277,139.766,17z')).toEqual([35.7277, 139.766])
    expect(core.coordsFromMapsUrl('https://maps.app.goo.gl/abc')).toBeNull()
  })
})

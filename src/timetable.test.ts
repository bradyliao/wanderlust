import { describe, expect, it } from 'vitest'
import {
  daylightGradient,
  dropSlot,
  hatchBands,
  layoutLanes,
  minutesText,
  minuteToPx,
  moveSlot,
  pxToMinute,
  resizeSlot,
  scrollTopFor,
  snap,
  sunMarks,
  timeRange,
  travelBand,
} from './timetable'
import type { Neighbour } from './types'

describe('minutes and pixels', () => {
  it('converts both ways', () => {
    expect(minuteToPx(90, 40)).toBe(60)
    expect(pxToMinute(60, 40)).toBe(90)
    expect(pxToMinute(minuteToPx(555, 44), 44)).toBeCloseTo(555)
  })

  it('snaps to 15 minutes', () => {
    expect(snap(547)).toBe(540)
    expect(snap(553)).toBe(555)
    expect(snap(7.4)).toBe(0)
    expect(snap(7.6)).toBe(15)
  })
})

describe('drop, move and resize (items 11, 13)', () => {
  it('drops a place for its usual stay, or an hour', () => {
    expect(dropSlot(545, 90)).toEqual({ start: 540, end: 630 })
    expect(dropSlot(545, null)).toEqual({ start: 540, end: 600 })
    expect(dropSlot(1430, 90)).toEqual({ start: 1350, end: 1440 })
    expect(dropSlot(-20, 30)).toEqual({ start: 0, end: 30 })
  })

  it('moves a block by where it was grabbed', () => {
    expect(moveSlot(620, 20, 60)).toEqual({ start: 600, end: 660 })
    expect(moveSlot(10, 30, 60)).toEqual({ start: 0, end: 60 })
    expect(moveSlot(1430, 0, 120)).toEqual({ start: 1320, end: 1440 })
  })

  it('resizes from either edge and keeps 15 minutes', () => {
    const slot = { start: 540, end: 630 }
    expect(resizeSlot('top', slot, 512)).toEqual({ start: 510, end: 630 })
    expect(resizeSlot('top', slot, 700)).toEqual({ start: 615, end: 630 })
    expect(resizeSlot('bottom', slot, 664)).toEqual({ start: 540, end: 660 })
    expect(resizeSlot('bottom', slot, 500)).toEqual({ start: 540, end: 555 })
    expect(resizeSlot('bottom', slot, 1500)).toEqual({ start: 540, end: 1440 })
  })
})

describe('lanes', () => {
  it('puts overlapping blocks side by side', () => {
    const lanes = layoutLanes([
      { key: 'a', start: 540, end: 630 },
      { key: 'b', start: 600, end: 660 },
      { key: 'c', start: 640, end: 700 },
      { key: 'd', start: 720, end: 780 },
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(lanes.get('b')).toEqual({ lane: 1, lanes: 2 })
    expect(lanes.get('c')).toEqual({ lane: 0, lanes: 2 })
    expect(lanes.get('d')).toEqual({ lane: 0, lanes: 1 })
  })

  it('lets touching blocks share a lane', () => {
    const lanes = layoutLanes([
      { key: 'a', start: 540, end: 600 },
      { key: 'b', start: 600, end: 660 },
    ])
    expect(lanes.get('b')).toEqual({ lane: 0, lanes: 1 })
  })
})

describe('daylight gradient (items 21–23)', () => {
  it('is plain day without stops', () => {
    expect(daylightGradient([])).toBe('linear-gradient(var(--daylight-day), var(--daylight-day))')
  })

  it('holds each stage and blends at the stops', () => {
    const g = daylightGradient([
      { minute: 0, stage: 'night' },
      { minute: 360, stage: 'twilight' },
      { minute: 400, stage: 'goldenHour' },
      { minute: 460, stage: 'day' },
    ])
    // night 0..340, blend to twilight around 360 (half the 40-minute twilight is 20)
    expect(g).toBe(
      'linear-gradient(to bottom, var(--daylight-night) 0%, var(--daylight-night) 23.61%, ' +
        'var(--daylight-twilight) 26.39%, var(--daylight-twilight) 26.39%, ' +
        'var(--daylight-golden) 29.17%, var(--daylight-golden) 30.56%, ' +
        'var(--daylight-day) 33.33%, var(--daylight-day) 100%)',
    )
  })

  it('draws a slice of the day for a list row', () => {
    const g = daylightGradient([{ minute: 0, stage: 'day' }], 600, 660)
    expect(g).toBe('linear-gradient(to bottom, var(--daylight-day) -1000%, var(--daylight-day) 1400%)')
  })

  it('marks sunrise and sunset', () => {
    expect(sunMarks({ sunrise: 395, sunset: 988 })).toEqual([
      { minute: 395, kind: 'sunrise', text: 'Sunrise 6:35' },
      { minute: 988, kind: 'sunset', text: 'Sunset 16:28' },
    ])
    expect(sunMarks(null)).toEqual([])
  })
})

describe('closed hours (item 27)', () => {
  it('fades into the open hours and tags the times', () => {
    const { bands, tags, allDay } = hatchBands([
      [0, 570],
      [1020, 1440],
    ])
    expect(allDay).toBe(false)
    expect(bands[0]).toMatchObject({ start: 0, end: 570, from: 0, to: 600 })
    expect(bands[0].mask).toBe('linear-gradient(to bottom, #000 0%, #000 95%, transparent 100%)')
    expect(bands[1]).toMatchObject({ start: 1020, end: 1440, from: 990, to: 1440 })
    expect(bands[1].mask).toBe('linear-gradient(to bottom, transparent 0%, #000 6.67%, #000 100%)')
    expect(tags).toEqual([
      { minute: 570, text: 'Opens 9:30', side: 'below' },
      { minute: 1020, text: 'Closes 17:00', side: 'above' },
    ])
  })

  it('knows a day closed all day', () => {
    const r = hatchBands([[0, 1440]])
    expect(r.allDay).toBe(true)
    expect(r.tags).toEqual([{ minute: 360, text: 'Closed all day', side: 'below' }])
  })

  it('joins touching ranges and treats unknown as open', () => {
    expect(hatchBands([[0, 300], [300, 600]]).bands).toHaveLength(1)
    expect(hatchBands(null).bands).toEqual([])
  })
})

describe('travel', () => {
  const n = (more: Partial<Neighbour>): Neighbour => ({
    key: 'a',
    title: 'A',
    placeId: 'p',
    start: 540,
    end: 600,
    travel: null,
    needs: 20,
    has: 30,
    fits: true,
    message: null,
    ...more,
  })

  it('shows a band that fits or not (items 29, 30)', () => {
    expect(travelBand(n({}), { start: 630, end: 690 }, 'before')).toEqual({ from: 600, to: 630, fits: true, text: '20 min · fits' })
    expect(travelBand(n({ start: 700, needs: 25, has: 10, fits: false, message: 'needs 25 min, has 10' }), { start: 630, end: 690 }, 'after')).toEqual({
      from: 690,
      to: 700,
      fits: false,
      text: 'needs 25 min, has 10',
    })
    expect(travelBand(n({ needs: null, fits: null }), { start: 630, end: 690 }, 'before')).toBeNull()
    expect(travelBand(n({ needs: 0 }), { start: 630, end: 690 }, 'before')).toBeNull()
    expect(travelBand(null, { start: 630, end: 690 }, 'before')).toBeNull()
  })

  it('writes minutes and times', () => {
    expect(minutesText(25)).toBe('25 min')
    expect(minutesText(70)).toBe('1 h 10 min')
    expect(minutesText(120)).toBe('2 h')
    expect(timeRange(540, 630)).toBe('9:00–10:30')
  })

  it('scrolls to a little before a time', () => {
    expect(scrollTopFor(360, 40)).toBe(220)
    expect(scrollTopFor(0, 40)).toBe(0)
  })
})

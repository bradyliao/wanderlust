// The Map pane (phase 5, items 5–10, 12, 37–42). MapLibre on OpenFreeMap
// tiles with our own grey style (src/map/style.ts). Every place is a small
// grey pin with its sub-category icon; the highlighted days' stops are
// numbered in time order in the accent colour and joined by their legs (line
// style by mode). Chips choose the highlighted days and groups. Pins are HTML
// markers and legs a GeoJSON layer, so both show when the tiles can't load.
// Loaded lazily (PlanPage), so MapLibre stays out of the main bundle.

import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibre, MapLayerMouseEvent, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre finds its worker next to its own file, which a bundle moves; point it at the copied file.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GROUPS, modeLabel } from '../format'
import {
  boundsOf,
  dayStops,
  dashFor,
  defaultHighlight,
  fitPoints,
  groupOn,
  legendModes,
  legLines,
  mapPins,
  primaryDate,
  svgDash,
  toggleDate,
  toggleGroup,
  type Highlight,
  type LegLine,
  type Pin,
} from '../map/mapData'
import { mapStyle, readMapColors } from '../map/style'
import { useSelection } from '../selection'
import { blockName, legHasOwnMode } from '../timetable'
import type { Command, Group, Kind, LegView, Mode, PlanDay, Trip } from '../types'
import { KindIcon } from './icons'
import { kindIconSvg } from './kindPaths'
import { ModePicker } from './TimetableParts'

interface Props {
  trip: Trip
  days: PlanDay[]
  apply: (commands: Command[], label: string) => boolean
}

maplibregl.setWorkerUrl(workerUrl)

const MODES: Mode[] = ['drive', 'transit', 'walk', 'twoWheeler', 'cycle', 'ride']
/** The icon each group chip shows. */
const GROUP_ICON: Record<Group, Kind> = { food: 'food', activity: 'sight', transport: 'train', lodging: 'lodging', shopping: 'shopping', other: 'other' }
/** Room for the chips (top), the legend (bottom) and the stop names (right) when fitting. */
const FIT_PADDING = { top: 72, bottom: 96, left: 48, right: 130 }

type MarkerEntry = { marker: Marker; el: HTMLDivElement }

export default function MapPane({ trip, days, apply }: Props) {
  const sel = useSelection()
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const markers = useRef(new Map<string, MarkerEntry>())
  const [ready, setReady] = useState(false)
  const [tilesFailed, setTilesFailed] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [pop, setPop] = useState<{ leg: LegView; anchor: DOMRect } | null>(null)

  // Highlight chips (item 40): the default follows the focus day; the group filter stays.
  const focusDate = sel.focusDate
  const [chips, setChips] = useState<{ focus: string | null; h: Highlight }>(() => ({ focus: focusDate, h: defaultHighlight(focusDate) }))
  const h = useMemo<Highlight>(
    () => (chips.focus === focusDate ? chips.h : { ...defaultHighlight(focusDate), groups: chips.h.groups }),
    [chips, focusDate],
  )
  const setH = (next: Highlight) => setChips({ focus: focusDate, h: next })
  const order = useMemo(() => days.map((d) => d.date), [days])

  const pins = useMemo(() => mapPins(trip.places, days, h, focusDate), [trip.places, days, h, focusDate])
  const lines = useMemo(() => legLines(days, trip.places, h, focusDate), [days, trip.places, h, focusDate])

  // Latest values for MapLibre's handlers, which are bound once.
  const live = useRef({ sel, lines, pins })
  useEffect(() => {
    live.current = { sel, lines, pins }
  })

  // ----- the map itself, once
  useEffect(() => {
    const el = box.current
    if (!el) return
    const colors = readMapColors(el)
    let map: MapLibre
    try {
      map = new maplibregl.Map({
        container: el,
        style: mapStyle(colors),
        center: [139.75, 35.68],
        zoom: 11,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
      })
    } catch (e) {
      // oxlint-disable-next-line react/set-state-in-effect -- MapLibre (an outside system) refused to start
      setFailed(e instanceof Error && /webgl/i.test(e.message) ? 'The map needs WebGL, which this browser has turned off.' : 'The map could not start.')
      return
    }
    mapRef.current = map
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // Tiles, glyphs or the TileJSON failing (offline): keep going on the plain background.
    map.on('error', (e) => {
      const msg = String((e as { error?: { message?: string } }).error?.message ?? '')
      const src = (e as { sourceId?: string }).sourceId
      if (src === 'base' || /openfreemap|fetch|network|glyph|font|tile/i.test(msg)) setTilesFailed(true)
      else console.warn('Map:', msg)
    })

    // 'style.load', not 'load': 'load' waits for the tiles, which never come offline.
    map.once('style.load', () => {
      map.addSource('legs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      const color = ['case', ['get', 'primary'], colors.accent, colors.compare] as maplibregl.ExpressionSpecification
      map.addLayer({
        id: 'leg-casing',
        type: 'line',
        source: 'legs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colors.labelHalo, 'line-width': ['case', ['get', 'primary'], 6, 5], 'line-opacity': 0.8 },
      })
      for (const mode of MODES) {
        const dash = dashFor(mode)
        map.addLayer({
          id: `leg-${mode}`,
          type: 'line',
          source: 'legs',
          filter: ['==', ['get', 'mode'], mode],
          layout: { 'line-cap': mode === 'walk' ? 'round' : 'butt', 'line-join': 'round' },
          paint: { 'line-color': color, 'line-width': ['case', ['get', 'primary'], 3, 2.5], ...(dash ? { 'line-dasharray': dash } : {}) },
        })
      }
      map.addLayer({ id: 'leg-hit', type: 'line', source: 'legs', paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 14 } })

      map.on('mouseenter', 'leg-hit', () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', 'leg-hit', () => (map.getCanvas().style.cursor = ''))
      map.on('click', 'leg-hit', (e: MapLayerMouseEvent) => {
        // A click on a pin is the pin's, not the leg's under it.
        if (e.originalEvent.target !== map.getCanvas()) return
        const index = e.features?.[0]?.properties?.index
        const line = live.current.lines.find((l) => l.index === index)
        if (!line) return
        const r = map.getContainer().getBoundingClientRect()
        setPop({ leg: line.leg, anchor: new DOMRect(r.left + e.point.x - 4, r.top + e.point.y - 4, 8, 8) })
      })
      setReady(true)
    })

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)
    const markerMap = markers.current
    return () => {
      ro.disconnect()
      for (const m of markerMap.values()) m.marker.remove()
      markerMap.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ----- legs
  useEffect(() => {
    const src = ready ? mapRef.current?.getSource<GeoJSONSource>('legs') : undefined
    src?.setData({
      type: 'FeatureCollection',
      features: lines.map((l) => ({
        type: 'Feature',
        id: l.index,
        properties: { index: l.index, mode: l.mode, primary: l.primary },
        geometry: { type: 'LineString', coordinates: l.coords },
      })),
    })
  }, [ready, lines])

  // ----- pins (HTML markers, rebuilt when what they show changes)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const old = markers.current
    for (const m of old.values()) m.marker.remove()
    old.clear()
    pins.forEach((pin, i) => {
      const el = pinElement(pin)
      el.dataset.z = String(i + 1)
      el.style.zIndex = el.dataset.z
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        live.current.sel.select(pin.id, 'map')
      })
      el.addEventListener('mouseenter', () => live.current.sel.hover(pin.id))
      el.addEventListener('mouseleave', () => live.current.sel.hover(null))
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(pin.pos).addTo(map)
      old.set(pin.id, { marker, el })
    })
  }, [pins])

  // ----- selected and hovered rings (items 5–8)
  const selectedId = sel.selectedPlaceId
  const hoveredId = sel.hoveredPlaceId
  useEffect(() => markRings(markers.current, selectedId, hoveredId), [pins, selectedId, hoveredId])

  // ----- pan to a place selected in another pane, keeping the zoom (items 5, 6)
  const selectedFrom = sel.selectedFrom
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId || selectedFrom === 'map') return
    // Only when the selection changes, not when the pins do.
    const pin = live.current.pins.find((p) => p.id === selectedId)
    if (pin) map.easeTo({ center: pin.pos, duration: 450 })
  }, [selectedId, selectedFrom])

  // ----- fit to the highlighted day when the focus day (or the trip) changes, not on every selection
  const fitted = useRef<string | null>(null)
  useEffect(() => {
    const map = mapRef.current
    const key = `${trip.id}|${focusDate}`
    // Wait for the first load: until then the pane may still be settling its size.
    if (!map || !ready || fitted.current === key) return
    const b = boundsOf(fitPoints(pins, lines))
    if (!b) return
    const first = fitted.current == null
    fitted.current = key
    map.resize()
    map.fitBounds(b, { padding: fitPadding(map), maxZoom: 15, duration: first ? 0 : 600 })
  }, [ready, trip.id, focusDate, pins, lines])

  // ----- leg mode picker (item 36, same as the timetable's)
  const blockByKey = useMemo(() => new Map(days.flatMap((d) => d.blocks).map((b) => [b.key, b])), [days])
  const close = useCallback(() => setPop(null), [])
  const pickMode = (leg: LegView, mode: Mode | null) => {
    const to = blockByKey.get(leg.toKey)
    apply([{ op: 'setLegMode', from: leg.fromKey, to: leg.toKey, mode }], `Travel to ${to ? blockName(to) : 'the next stop'}: ${mode ? modeLabel(mode) : "the day's mode"}`)
  }

  const primary = primaryDate(h, focusDate)
  const primaryDay = days.find((d) => d.date === primary)
  const placesById = useMemo(() => new Map(trip.places.map((p) => [p.id, p])), [trip.places])
  const unmapped = primaryDay ? dayStops(primaryDay, placesById).filter((s) => s.n == null).length : 0

  if (failed) return <p className="placeholder map-failed">{failed}</p>

  return (
    <div className="map-pane">
      <div className="map-canvas" ref={box} />

      <div className="map-chips" role="toolbar" aria-label="Highlight on the map">
        <span className="map-chips-label">Highlight</span>
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            className={`map-chip ${d.date === primary ? 'primary' : ''}`}
            aria-pressed={h.dates.includes(d.date)}
            title={`${d.weekday} ${d.label}${d.city ? ` · ${d.city}` : ''}`}
            onClick={() => setH(toggleDate(h, d.date, order))}
          >
            {d.label}
          </button>
        ))}
        <span className="map-chips-sep" aria-hidden />
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`map-chip icon g-${g.id}`}
            aria-pressed={h.groups != null && groupOn(h, g.id)}
            title={h.groups == null ? `Highlight only ${g.label}` : groupOn(h, g.id) ? `Stop highlighting ${g.label}` : `Also highlight ${g.label}`}
            aria-label={g.label}
            onClick={() => setH(toggleGroup(h, g.id))}
          >
            <KindIcon kind={GROUP_ICON[g.id]} />
          </button>
        ))}
      </div>

      <Legend lines={lines} primaryLabel={primaryDay?.label ?? null} compare={h.dates.length > 1} groups={h.groups} unmapped={unmapped} />

      {tilesFailed && <p className="map-note">The map tiles couldn't load (offline?). Pins and routes still show.</p>}

      {pop && (
        <ModePicker
          leg={pop.leg}
          anchor={pop.anchor}
          toTitle={(() => {
            const b = blockByKey.get(pop.leg.toKey)
            return b ? blockName(b) : 'the next stop'
          })()}
          explicit={legHasOwnMode(trip, pop.leg)}
          dayMode={days.find((d) => d.date === pop.leg.date)?.mode ?? trip.settings.defaultMode}
          onPick={(mode) => {
            pickMode(pop.leg, mode)
            close()
          }}
          onClose={close}
        />
      )}
    </div>
  )
}

/** Ring the selected pin, light ring the hovered one, and lift both above the rest. */
function markRings(markers: Map<string, MarkerEntry>, selectedId: string | null, hoveredId: string | null) {
  for (const [id, { el }] of markers) {
    el.classList.toggle('selected', id === selectedId)
    el.classList.toggle('hovered', id === hoveredId && id !== selectedId)
    el.style.zIndex = id === selectedId ? '10000' : id === hoveredId ? '9999' : (el.dataset.z ?? '1')
  }
}

/** Fit padding clear of the chips and the legend (measured, since they wrap), never more than a small pane allows. */
function fitPadding(map: MapLibre) {
  const box = map.getContainer()
  const { clientWidth: w, clientHeight: ht } = box
  const pane = box.parentElement
  const chips = pane?.querySelector<HTMLElement>('.map-chips')
  const legend = pane?.querySelector<HTMLElement>('.map-legend')
  const top = Math.max(FIT_PADDING.top, (chips ? chips.offsetTop + chips.offsetHeight : 0) + 28)
  const bottom = Math.max(FIT_PADDING.bottom, (legend ? ht - legend.offsetTop : 0) + 24)
  const sx = Math.min(1, (w * 0.6) / (FIT_PADDING.left + FIT_PADDING.right))
  const sy = Math.min(1, (ht * 0.6) / (top + bottom))
  return { top: top * sy, bottom: bottom * sy, left: FIT_PADDING.left * sx, right: FIT_PADDING.right * sx }
}

/** One pin: a small round mark with the icon (or the stop numbers) and, for stops, the name. */
function pinElement(pin: Pin): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `map-pin look-${pin.look} g-${pin.group}`
  el.dataset.placeId = pin.id
  el.title = pin.name
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', pin.label ? `${pin.label}. ${pin.name}` : pin.name)
  const dot = document.createElement('span')
  dot.className = 'pin-dot'
  if (pin.label) dot.textContent = pin.label
  else dot.innerHTML = kindIconSvg(pin.kind, 11)
  el.appendChild(dot)
  if (pin.look === 'day' || pin.look === 'compare') {
    const name = document.createElement('span')
    name.className = 'pin-name'
    name.textContent = pin.name
    el.appendChild(name)
  }
  return el
}

function Legend({ lines, primaryLabel, compare, groups, unmapped }: { lines: LegLine[]; primaryLabel: string | null; compare: boolean; groups: Group[] | null; unmapped: number }) {
  const modes = legendModes(lines)
  return (
    <div className="map-legend" aria-label="Map legend">
      {primaryLabel && (
        <span className="legend-item">
          <span className="legend-dot day" />
          {primaryLabel}, in order
        </span>
      )}
      {compare && (
        <span className="legend-item">
          <span className="legend-dot compare" />
          Other days
        </span>
      )}
      {modes.map((m) => (
        <span className="legend-item" key={m.mode}>
          <svg width="22" height="8" aria-hidden>
            <line x1="2" y1="4" x2="20" y2="4" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray={svgDash(m.mode, 2.5)} strokeLinecap={m.mode === 'walk' ? 'round' : 'butt'} />
          </svg>
          {m.text}
        </span>
      ))}
      {groups && (
        <span className="legend-item">
          {groups.map((g) => (
            <span key={g} className={`legend-dot group g-${g}`} />
          ))}
          {groups.length === 1 ? GROUPS.find((g) => g.id === groups[0])?.label : 'Highlighted types'}
        </span>
      )}
      <span className="legend-item">
        <span className="legend-dot other" />
        Other places
      </span>
      {unmapped > 0 && <span className="legend-item muted">{unmapped === 1 ? '1 stop has' : `${unmapped} stops have`} no position</span>}
    </div>
  )
}

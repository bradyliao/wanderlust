import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef, useState } from 'react'
import { dayBlocks, placeOf } from '../lib/schedule'
import { shortDate, weekdayName } from '../lib/time'
import { useApp } from '../store'

// The library runs tile parsing in a worker; hand it the copy Vite bundles.
maplibregl.setWorkerUrl(workerUrl)

/** Free vector tiles, no API key. A quiet grey base so the route stands out. */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

export function MapPane() {
  const { trip, activeDay, selection, select } = useApp()
  const holder = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markers = useRef<Marker[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [showPool, setShowPool] = useState(true)
  const selectRef = useRef(select)
  selectRef.current = select

  useEffect(() => {
    if (!holder.current) return
    let map: MlMap
    try {
      map = new maplibregl.Map({ container: holder.current, style: STYLE_URL, center: [139.76, 35.69], zoom: 11, attributionControl: { compact: true } })
    } catch {
      setFailed(true)
      return
    }
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('error', (e) => {
      // Only a failure to load the style itself leaves the map unusable.
      if (!map.isStyleLoaded() && /style|Failed to fetch|NetworkError/i.test(String(e.error?.message))) setFailed(true)
    })
    map.on('load', () => {
      // Make railways readable: they are how most city trips move.
      for (const layer of map.getStyle().layers) {
        if (layer.id === 'railway' || layer.id === 'railway_transit') map.setPaintProperty(layer.id, 'line-color', '#8a94a5')
      }
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#18212f', 'line-width': 3, 'line-dasharray': [1, 1.6] }, layout: { 'line-cap': 'round' } })
      map.addSource('pool', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'pool',
        type: 'circle',
        source: 'pool',
        // Must Go is a solid dot, Forget fades back, everything else is an open ring.
        paint: {
          'circle-radius': ['match', ['get', 'rating'], 3, 6, 5],
          'circle-color': ['match', ['get', 'rating'], 3, '#18212f', '#ffffff'],
          'circle-stroke-color': ['match', ['get', 'rating'], 3, '#ffffff', '#5a6577'],
          'circle-stroke-width': 2,
          'circle-opacity': ['match', ['get', 'rating'], 1, 0.35, 1],
          'circle-stroke-opacity': ['match', ['get', 'rating'], 1, 0.35, 1],
        },
      })
      map.on('click', 'pool', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (typeof id === 'string') selectRef.current({ type: 'place', id })
      })
      map.on('mouseenter', 'pool', () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', 'pool', () => (map.getCanvas().style.cursor = ''))
      setReady(true)
    })
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(holder.current)
    return () => {
      resize.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Day route: numbered stops in timetable order.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    markers.current.forEach((m) => m.remove())
    markers.current = []
    const stops = dayBlocks(trip, activeDay)
      .map((b) => ({ block: b, place: placeOf(trip, b) }))
      .filter((s) => s.place)
    const onDay = new Set(stops.map((s) => s.place!.id))

    stops.forEach((s, i) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `map-stop cat-${s.block.category}`
      el.textContent = String(i + 1)
      el.setAttribute('aria-label', `Stop ${i + 1}: ${s.block.title}`)
      el.dataset.block = s.block.id
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        selectRef.current({ type: 'block', id: s.block.id })
      })
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([s.place!.lng, s.place!.lat]).addTo(map))
    })

    ;(map.getSource('route') as GeoJSONSource).setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: stops.map((s) => [s.place!.lng, s.place!.lat]) },
    })
    ;(map.getSource('pool') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: showPool
        ? trip.places
            .filter((p) => !onDay.has(p.id))
            .map((p) => ({ type: 'Feature' as const, properties: { id: p.id, name: p.name, rating: p.rating ?? 0 }, geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] } }))
        : [],
    })
  }, [trip, activeDay, ready, showPool])

  // Frame the whole day when the day changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const pts = dayBlocks(trip, activeDay)
      .map((b) => placeOf(trip, b))
      .filter((p) => !!p)
    if (pts.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    pts.forEach((p) => bounds.extend([p.lng, p.lat]))
    map.fitBounds(bounds, { padding: 64, maxZoom: 14.5, duration: 500 })
    // Re-framing on every edit would fight the user, so only the day drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay, ready])

  // Follow the selection.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const blockId = selection?.type === 'block' ? selection.id : undefined
    markers.current.forEach((m) => m.getElement().classList.toggle('selected', m.getElement().dataset.block === blockId))
    const block = blockId ? trip.blocks.find((b) => b.id === blockId) : undefined
    const place = selection?.type === 'place' ? trip.places.find((p) => p.id === selection.id) : block ? placeOf(trip, block) : undefined
    if (place) map.easeTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 13.5), duration: 500 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, ready])

  return (
    <section className="map-pane" aria-label="Map">
      <div className="map-bar">
        <span className="map-day">{activeDay ? `${weekdayName(activeDay)} ${shortDate(activeDay)} route` : 'Map'}</span>
        <label className="check-inline">
          <input type="checkbox" checked={showPool} onChange={(e) => setShowPool(e.target.checked)} />
          Show other places
        </label>
      </div>
      <div ref={holder} className="map-canvas" />
      {failed && <p className="map-fallback">The map could not load. Check the connection; the timetable still works without it.</p>}
    </section>
  )
}

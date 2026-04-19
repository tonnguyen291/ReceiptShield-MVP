import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

// Vite resolves Leaflet's default marker images (defaults break without this).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export type MapPoint = {
  id: string
  lat: number
  lng: number
  label?: string
}

/** Optional circle overlay in meters (e.g. geofence or accuracy radius). */
export type MapCircleOverlay = {
  id: string
  lat: number
  lng: number
  radiusMeters: number
  label?: string
}

/** Origin or destination pin shown at trip start/end. */
export type RoutePin = {
  lat: number
  lng: number
  label?: string
  sublabel?: string
}

function FitBounds({
  points,
  routePath,
  completedRoutePath,
  remainingRoutePath,
}: {
  points: MapPoint[]
  routePath?: [number, number][]
  completedRoutePath?: [number, number][]
  remainingRoutePath?: [number, number][]
}) {
  const map = useMap()
  useEffect(() => {
    const allLatLngs: [number, number][] = [
      ...points.map((p): [number, number] => [p.lat, p.lng]),
      ...(routePath ?? []),
      ...(completedRoutePath ?? []),
      ...(remainingRoutePath ?? []),
    ]
    if (allLatLngs.length === 0) return
    if (allLatLngs.length === 1) {
      map.setView(allLatLngs[0], 12)
      return
    }
    const bounds = L.latLngBounds(allLatLngs)
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 })
  }, [map, points, routePath, completedRoutePath, remainingRoutePath])
  return null
}

export type DriverStatus = 'available' | 'busy' | 'offline'

export type DriverMarker = {
  id: string
  lat: number
  lng: number
  name: string
  initials: string
  status: DriverStatus
}

/** Teardrop map pin (viewBox 0 0 24 35); tip at bottom center — anchor there for correct placement. */
const PIN_PATH =
  'M12 0C5.4 0 0 5.4 0 12c0 10 12 23 12 23s12-13 12-23C24 5.4 18.6 0 12 0z'

const STATUS_COLOR: Record<DriverStatus, string> = {
  available: '#22c55e',
  busy: '#ef4444',
  offline: '#f59e0b',
}

const PIN_MARKER_W = 54

function makeDriverIcon(driver: DriverMarker): L.DivIcon {
  const fill = STATUS_COLOR[driver.status]
  const size = PIN_MARKER_W

  // Steering wheel geometry — precise 120° spoke intervals
  // Outer rim: r=9.5  |  Hub: r=3  |  Spokes: from r=3.2 to r=7.8
  // Spoke angles: top=270° (-90°), bottom-right=30°, bottom-left=150°
  // cos/sin for each angle in radians:
  // top:        cos(-90)=0,      sin(-90)=-1
  // btm-right:  cos(30°)=0.866,  sin(30°)=0.5
  // btm-left:   cos(150°)=-0.866, sin(150°)=0.5




  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="1.5 1.5 21 21" width="44" height="44" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round">`,
    `<circle cx="12" cy="12" r="9.5" stroke-width="2.5"/>`,
    ...[[0,-1],[0.866,0.5],[-0.866,0.5]].map(([cx,sy]) =>
      `<line x1="${(12+3.2*cx).toFixed(2)}" y1="${(12+3.2*sy).toFixed(2)}" x2="${(12+7.8*cx).toFixed(2)}" y2="${(12+7.8*sy).toFixed(2)}" stroke-width="2.2"/>`
    ),
    `<circle cx="12" cy="12" r="3.2" fill="white" stroke="none"/>`,
    `</svg>`,
  ].join('')

  const html = `
    <div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${fill};
      border:3px solid rgba(255,255,255,0.95);
      box-shadow:0 4px 14px rgba(0,0,0,0.45),0 1px 4px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      box-sizing:border-box;
    ">${svg}</div>`

  return L.divIcon({
    html,
    className: 'leaflet-div-icon rc-driver-pin-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 6)],
  })
}

const originIcon = L.divIcon({
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
    <div style="width:8px;height:8px;border-radius:50%;background:white;"></div>
  </div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11],
})

function makeDestinationIcon(): L.DivIcon {
  const w = 28
  const h = Math.round((w * 35) / 24)
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 35" width="${w}" height="${h}" style="display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.45))">
      <path fill="#e84040" d="${PIN_PATH}"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>`,
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  })
}

export type LatLngMapProps = {
  points?: MapPoint[]
  circles?: MapCircleOverlay[]
  drivers?: DriverMarker[]
  /** Ordered lat/lng pairs rendered as a polyline (like a route line). */
  routePath?: [number, number][]
  /** Completed portion of the route — rendered as solid blue. Overrides routePath rendering when provided. */
  completedRoutePath?: [number, number][]
  /** Remaining portion of the route — rendered as dashed lighter blue. */
  remainingRoutePath?: [number, number][]
  /** Origin pin (trip start). */
  startPin?: RoutePin
  /** Destination pin (trip end). */
  endPin?: RoutePin
  /** Called when a driver map pin is clicked. */
  onDriverClick?: (driverId: string) => void
  className?: string
  /** Fill parent height (use with a `h-svh` or `h-full` wrapper). */
  fillViewport?: boolean
  /** When there are no points, map centers here */
  defaultCenter?: [number, number]
  defaultZoom?: number
}

function SingleDriverMarker({
  driver,
  onClick,
}: {
  driver: DriverMarker
  onClick?: (id: string) => void
}) {
  const icon = useMemo(() => makeDriverIcon(driver), [driver])
  return (
    <Marker position={[driver.lat, driver.lng]} icon={icon}>
      <Popup>
        <div style={{ fontFamily: 'system-ui', minWidth: 140 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>{driver.name}</strong>
          <span style={{ textTransform: 'capitalize', color: STATUS_COLOR[driver.status], fontWeight: 600, display: 'block', marginBottom: 10 }}>
            ● {driver.status}
          </span>
          {onClick && (
            <button
              type="button"
              onClick={() => onClick(driver.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 0',
                background: '#2f6fe0',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              View Details →
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  )
}

function DriverMarkers({
  drivers,
  onClick,
}: {
  drivers: DriverMarker[]
  onClick?: (id: string) => void
}) {
  return (
    <>
      {drivers.map((d) => (
        <SingleDriverMarker key={d.id} driver={d} onClick={onClick} />
      ))}
    </>
  )
}

/** Imperative route renderer — creates/removes Leaflet polyline layers directly. */
function RouteLayer({
  completedRoutePath,
  remainingRoutePath,
  routePath,
}: {
  completedRoutePath?: [number, number][]
  remainingRoutePath?: [number, number][]
  routePath?: [number, number][]
}) {
  const map = useMap()

  // Primary route (solid blue) — uses completedRoutePath if available, else routePath
  useEffect(() => {
    const path = completedRoutePath ?? routePath
    if (!path || path.length < 2) return
    const color = completedRoutePath ? '#2563eb' : '#2f6fe0'
    const shadow = L.polyline(path, { color: '#1a4fa8', weight: 8, opacity: 0.18, lineCap: 'round', lineJoin: 'round' }).addTo(map)
    const main = L.polyline(path, { color, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map)
    return () => {
      shadow.remove()
      main.remove()
    }
  }, [map, completedRoutePath, routePath])

  // Remaining route (dashed lighter blue)
  useEffect(() => {
    if (!remainingRoutePath || remainingRoutePath.length < 2) return
    const rem = L.polyline(remainingRoutePath, { color: '#93c5fd', weight: 4, opacity: 0.8, dashArray: '9 7', lineCap: 'round', lineJoin: 'round' }).addTo(map)
    return () => {
      rem.remove()
    }
  }, [map, remainingRoutePath])

  return null
}

function OriginMarker({ pin }: { pin: RoutePin }) {
  return (
    <Marker position={[pin.lat, pin.lng]} icon={originIcon}>
      {pin.label ? (
        <Popup>
          <div style={{ fontFamily: 'system-ui', minWidth: 130 }}>
            <strong style={{ display: 'block', marginBottom: 2, color: '#22c55e' }}>Origin</strong>
            <span style={{ fontSize: 13, color: '#2f3850' }}>{pin.label}</span>
            {pin.sublabel ? <span style={{ display: 'block', fontSize: 11, color: '#93a4c4', marginTop: 2 }}>{pin.sublabel}</span> : null}
          </div>
        </Popup>
      ) : null}
    </Marker>
  )
}

function DestinationMarker({ pin }: { pin: RoutePin }) {
  const icon = useMemo(() => makeDestinationIcon(), [])
  return (
    <Marker position={[pin.lat, pin.lng]} icon={icon}>
      {pin.label ? (
        <Popup>
          <div style={{ fontFamily: 'system-ui', minWidth: 130 }}>
            <strong style={{ display: 'block', marginBottom: 2, color: '#e84040' }}>Destination</strong>
            <span style={{ fontSize: 13, color: '#2f3850' }}>{pin.label}</span>
            {pin.sublabel ? <span style={{ display: 'block', fontSize: 11, color: '#93a4c4', marginTop: 2 }}>{pin.sublabel}</span> : null}
          </div>
        </Popup>
      ) : null}
    </Marker>
  )
}

export function LatLngMap({
  points = [],
  circles = [],
  drivers = [],
  routePath,
  completedRoutePath,
  remainingRoutePath,
  startPin,
  endPin,
  onDriverClick,
  className = '',
  fillViewport = false,
  defaultCenter = [39.8283, -98.5795],
  defaultZoom = 4,
}: LatLngMapProps) {
  const firstRoutePoint = completedRoutePath?.[0] ?? routePath?.[0]
  const center: [number, number] =
    points[0] !== undefined
      ? [points[0].lat, points[0].lng]
      : firstRoutePoint !== undefined
        ? firstRoutePoint
        : defaultCenter
  const zoom = points.length === 0 && !routePath?.length && !completedRoutePath?.length ? defaultZoom : 4

  const frameClass = fillViewport
    ? 'h-full min-h-0 w-full overflow-hidden'
    : 'h-[min(420px,50vh)] w-full max-w-[720px] overflow-hidden rounded-lg border border-[#dfe5f0]'

  return (
    <div className={`${frameClass} ${className}`.trim()}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="z-0 h-full w-full bg-[#e6edf5]"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds
          points={points}
          routePath={routePath}
          completedRoutePath={completedRoutePath}
          remainingRoutePath={remainingRoutePath}
        />

        <RouteLayer
          completedRoutePath={completedRoutePath}
          remainingRoutePath={remainingRoutePath}
          routePath={routePath}
        />

        {circles.map((c) => (
          <Circle
            key={c.id}
            center={[c.lat, c.lng]}
            radius={c.radiusMeters}
            pathOptions={{
              color: 'var(--accent, #646cff)',
              fillOpacity: 0.12,
              weight: 2,
            }}
          >
            {c.label ? <Popup>{c.label}</Popup> : null}
          </Circle>
        ))}
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]}>
            {p.label ? <Popup>{p.label}</Popup> : null}
          </Marker>
        ))}

        {/* Origin / destination pins — rendered below driver pin so driver pin stays on top */}
        {startPin ? <OriginMarker pin={startPin} /> : null}
        {endPin ? <DestinationMarker pin={endPin} /> : null}

        {drivers.length > 0 ? <DriverMarkers drivers={drivers} onClick={onDriverClick} /> : null}
      </MapContainer>
    </div>
  )
}

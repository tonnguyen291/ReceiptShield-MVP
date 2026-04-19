import type { DriverMarker } from '../components/LatLngMap'

export const DEFAULT_ARIZONA_DRIVERS: DriverMarker[] = [
  {
    id: 'driver-1',
    lat: 33.4484,
    lng: -112.074,
    name: 'Marcus Webb',
    initials: 'MW',
    status: 'available',
  },
  {
    id: 'driver-2',
    lat: 32.2226,
    lng: -110.9747,
    name: 'Rosa Delgado',
    initials: 'RD',
    status: 'busy',
  },
  {
    id: 'driver-3',
    lat: 35.1983,
    lng: -111.6513,
    name: 'Troy Haines',
    initials: 'TH',
    status: 'offline',
  },
]

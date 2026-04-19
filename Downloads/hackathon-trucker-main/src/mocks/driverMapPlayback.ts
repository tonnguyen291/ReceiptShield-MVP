import {
  driverRiskSimulation,
  driverSnapshotsById,
  getDriverStateAtSecond,
  getSimulationFrame,
  simulationMeta,
  type SimulationFrame,
} from './driverRiskSimulation'
import type { DriverSummary, RiskBand, TimelineTick } from './driverRiskSimulation'

export type PlaybackMarkerStatus = 'available' | 'busy' | 'offline'

export type DriverTripPhase =
  | 'heading-to-pickup'
  | 'linehaul'
  | 'final-approach'
  | 'completed'

export interface TripStop {
  id: string
  kind: 'pickup' | 'dropoff'
  label: string
  cityLabel: string
  lat: number
  lng: number
  plannedTimestamp: string
}

export interface DriverTripPlan {
  driverId: string
  tripId: string
  loadId: string
  vehicleLabel: string
  routeLabel: string
  originLabel: string
  destinationLabel: string
  pickupStop: TripStop
  dropoffStop: TripStop
  pickupCompletedSecond: number
  finalApproachStartSecond: number
}

export interface DriverTripState {
  driverId: string
  second: number
  timestamp: string
  tripId: string
  loadId: string
  phase: DriverTripPhase
  progressPct: number
  currentLegLabel: string
  currentStopLabel: string
  etaTimestamp: string
  etaLabel: string
  remainingMinutes: number
  routeLabel: string
  originLabel: string
  destinationLabel: string
  pickupStop: TripStop
  dropoffStop: TripStop
}

export interface PlaybackDriverMarker {
  id: string
  name: string
  initials: string
  lat: number
  lng: number
  riskBand: RiskBand
  status: PlaybackMarkerStatus
  vehicleLabel: string
  routeLabel: string
}

export interface DriverPlaybackState {
  driver: DriverSummary
  tick: TimelineTick
  trip: DriverTripState
  marker: PlaybackDriverMarker
}

export interface FleetPlaybackFrame {
  second: number
  simulatedMinute: number
  timestamp: string
  drivers: DriverPlaybackState[]
}

export interface PlaybackDriverProfile {
  id: string
  name: string
  initials: string
  vehicleLabel: string
  routeLabel: string
  riskBand: RiskBand
  riskScore: number
  primaryRiskReason: string
  shortExplanation: string
  tripId: string
  loadId: string
  etaLabel: string
  markerStatus: PlaybackMarkerStatus
}

type TripScenarioBlueprint = {
  tripId: string
  loadId: string
  originLabel: string
  destinationLabel: string
  pickupLabel: string
  dropoffLabel: string
  pickupCityLabel: string
  dropoffCityLabel: string
  pickupStopSecond: number
  pickupCompletedSecond: number
  finalApproachStartSecond: number
}

const playbackTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Phoenix',
})

const driverSummaryById: Record<string, DriverSummary> = Object.fromEntries(
  driverRiskSimulation.map(({ driver }) => [driver.id, driver]),
)

const tripScenarioBlueprints: Record<string, TripScenarioBlueprint> = {
  'driver-01': {
    tripId: 'trip-218-west',
    loadId: 'LD-2184',
    originLabel: 'Phoenix Yard',
    destinationLabel: 'Buckeye Grocery DC',
    pickupLabel: 'Pickup at Phoenix Yard',
    dropoffLabel: 'Dropoff at Buckeye Grocery DC',
    pickupCityLabel: 'Phoenix, AZ',
    dropoffCityLabel: 'Buckeye, AZ',
    pickupStopSecond: 4,
    pickupCompletedSecond: 6,
    finalApproachStartSecond: 48,
  },
  'driver-02': {
    tripId: 'trip-431-north',
    loadId: 'LD-4317',
    originLabel: 'Phoenix Relay Point',
    destinationLabel: 'Anthem Retail Hub',
    pickupLabel: 'Pickup at Phoenix Relay Point',
    dropoffLabel: 'Dropoff at Anthem Retail Hub',
    pickupCityLabel: 'Phoenix, AZ',
    dropoffCityLabel: 'Anthem, AZ',
    pickupStopSecond: 5,
    pickupCompletedSecond: 8,
    finalApproachStartSecond: 50,
  },
  'driver-03': {
    tripId: 'trip-507-east',
    loadId: 'LD-5072',
    originLabel: 'Tolleson Cold Storage',
    destinationLabel: 'Downtown Phoenix Produce Market',
    pickupLabel: 'Pickup at Tolleson Cold Storage',
    dropoffLabel: 'Dropoff at Phoenix Produce Market',
    pickupCityLabel: 'Tolleson, AZ',
    dropoffCityLabel: 'Phoenix, AZ',
    pickupStopSecond: 3,
    pickupCompletedSecond: 5,
    finalApproachStartSecond: 46,
  },
  'driver-04': {
    tripId: 'trip-612-east',
    loadId: 'LD-6120',
    originLabel: 'Mesa Consolidation',
    destinationLabel: 'Globe Transfer',
    pickupLabel: 'Pickup at Mesa Consolidation',
    dropoffLabel: 'Dropoff at Globe Transfer',
    pickupCityLabel: 'Mesa, AZ',
    dropoffCityLabel: 'Globe, AZ',
    pickupStopSecond: 4,
    pickupCompletedSecond: 7,
    finalApproachStartSecond: 49,
  },
  'driver-05': {
    tripId: 'trip-445-loop',
    loadId: 'LD-4451',
    originLabel: 'Chandler DC',
    destinationLabel: 'I-10 Phoenix interchange',
    pickupLabel: 'Pickup at Chandler DC',
    dropoffLabel: 'Dropoff at Phoenix interchange',
    pickupCityLabel: 'Chandler, AZ',
    dropoffCityLabel: 'Phoenix, AZ',
    pickupStopSecond: 5,
    pickupCompletedSecond: 8,
    finalApproachStartSecond: 50,
  },
  'driver-06': {
    tripId: 'trip-301-west',
    loadId: 'LD-3019',
    originLabel: 'Flagstaff Yard',
    destinationLabel: 'Williams relay',
    pickupLabel: 'Pickup at Flagstaff Yard',
    dropoffLabel: 'Dropoff at Williams relay',
    pickupCityLabel: 'Flagstaff, AZ',
    dropoffCityLabel: 'Williams, AZ',
    pickupStopSecond: 4,
    pickupCompletedSecond: 6,
    finalApproachStartSecond: 48,
  },
  'driver-07': {
    tripId: 'trip-889-north',
    loadId: 'LD-8893',
    originLabel: 'Payson staging',
    destinationLabel: 'Show Low DC',
    pickupLabel: 'Pickup at Payson staging',
    dropoffLabel: 'Dropoff at Show Low DC',
    pickupCityLabel: 'Payson, AZ',
    dropoffCityLabel: 'Show Low, AZ',
    pickupStopSecond: 3,
    pickupCompletedSecond: 6,
    finalApproachStartSecond: 47,
  },
  'driver-08': {
    tripId: 'trip-156-west',
    loadId: 'LD-1566',
    originLabel: 'Gila Bend hub',
    destinationLabel: 'Yuma linehaul',
    pickupLabel: 'Pickup at Gila Bend hub',
    dropoffLabel: 'Dropoff at Yuma linehaul',
    pickupCityLabel: 'Gila Bend, AZ',
    dropoffCityLabel: 'Yuma, AZ',
    pickupStopSecond: 4,
    pickupCompletedSecond: 7,
    finalApproachStartSecond: 49,
  },
  'driver-09': {
    tripId: 'trip-773-loop',
    loadId: 'LD-7732',
    originLabel: 'Scottsdale retail',
    destinationLabel: 'Tempe cross-dock',
    pickupLabel: 'Pickup at Scottsdale retail',
    dropoffLabel: 'Dropoff at Tempe cross-dock',
    pickupCityLabel: 'Scottsdale, AZ',
    dropoffCityLabel: 'Tempe, AZ',
    pickupStopSecond: 5,
    pickupCompletedSecond: 9,
    finalApproachStartSecond: 51,
  },
  'driver-10': {
    tripId: 'trip-234-south',
    loadId: 'LD-2348',
    originLabel: 'Tucson yard',
    destinationLabel: 'Nogales border freight',
    pickupLabel: 'Pickup at Tucson yard',
    dropoffLabel: 'Dropoff at Nogales border freight',
    pickupCityLabel: 'Tucson, AZ',
    dropoffCityLabel: 'Nogales, AZ',
    pickupStopSecond: 4,
    pickupCompletedSecond: 7,
    finalApproachStartSecond: 48,
  },
  'driver-11': {
    tripId: 'trip-567-north',
    loadId: 'LD-5675',
    originLabel: 'Wickenburg depot',
    destinationLabel: 'Kingman relay',
    pickupLabel: 'Pickup at Wickenburg depot',
    dropoffLabel: 'Dropoff at Kingman relay',
    pickupCityLabel: 'Wickenburg, AZ',
    dropoffCityLabel: 'Kingman, AZ',
    pickupStopSecond: 3,
    pickupCompletedSecond: 6,
    finalApproachStartSecond: 46,
  },
  'driver-12': {
    tripId: 'trip-901-east',
    loadId: 'LD-9011',
    originLabel: 'Casa Grande plant',
    destinationLabel: 'Tucson distribution',
    pickupLabel: 'Pickup at Casa Grande plant',
    dropoffLabel: 'Dropoff at Tucson distribution',
    pickupCityLabel: 'Casa Grande, AZ',
    dropoffCityLabel: 'Tucson, AZ',
    pickupStopSecond: 3,
    pickupCompletedSecond: 5,
    finalApproachStartSecond: 45,
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function normalizePlaybackSecond(second: number) {
  return clamp(Math.floor(second), 0, simulationMeta.playbackSeconds - 1)
}

export function mapRiskBandToMarkerStatus(riskBand: RiskBand): PlaybackMarkerStatus {
  if (riskBand === 'red') {
    return 'busy'
  }

  if (riskBand === 'yellow') {
    return 'offline'
  }

  return 'available'
}

function formatEtaLabel(timestamp: string) {
  return playbackTimeFormatter.format(new Date(timestamp))
}

function getSnapshotAtSecond(snapshots: TimelineTick[], second: number) {
  return snapshots[normalizePlaybackSecond(second)]
}

function buildTripPlan(driver: DriverSummary, snapshots: TimelineTick[]): DriverTripPlan {
  const blueprint = tripScenarioBlueprints[driver.id]

  if (!blueprint) {
    throw new Error(`Missing trip scenario blueprint for ${driver.id}`)
  }

  const pickupTick = getSnapshotAtSecond(snapshots, blueprint.pickupStopSecond)
  const dropoffTick = getSnapshotAtSecond(snapshots, simulationMeta.playbackSeconds - 1)

  return {
    driverId: driver.id,
    tripId: blueprint.tripId,
    loadId: blueprint.loadId,
    vehicleLabel: driver.vehicleLabel,
    routeLabel: driver.routeLabel,
    originLabel: blueprint.originLabel,
    destinationLabel: blueprint.destinationLabel,
    pickupCompletedSecond: blueprint.pickupCompletedSecond,
    finalApproachStartSecond: blueprint.finalApproachStartSecond,
    pickupStop: {
      id: `${driver.id}-pickup`,
      kind: 'pickup',
      label: blueprint.pickupLabel,
      cityLabel: blueprint.pickupCityLabel,
      lat: pickupTick.lat,
      lng: pickupTick.lng,
      plannedTimestamp: pickupTick.timestamp,
    },
    dropoffStop: {
      id: `${driver.id}-dropoff`,
      kind: 'dropoff',
      label: blueprint.dropoffLabel,
      cityLabel: blueprint.dropoffCityLabel,
      lat: dropoffTick.lat,
      lng: dropoffTick.lng,
      plannedTimestamp: dropoffTick.timestamp,
    },
  }
}

export const driverTripPlansById: Record<string, DriverTripPlan> = Object.fromEntries(
  driverRiskSimulation.map(({ driver, snapshots }) => [driver.id, buildTripPlan(driver, snapshots)]),
)

export const driverRoutePathsById: Record<string, [number, number][]> = Object.fromEntries(
  Object.entries(driverSnapshotsById).map(([driverId, snapshots]) => [
    driverId,
    snapshots.map((snapshot): [number, number] => [snapshot.lat, snapshot.lng]),
  ]),
)

export function getDriverTripPlan(driverId: string) {
  return driverTripPlansById[driverId]
}

export function getDriverRoutePath(driverId: string) {
  return driverRoutePathsById[driverId] ?? []
}

export function getDriverTripAtSecond(driverId: string, second: number): DriverTripState | undefined {
  const tick = getDriverStateAtSecond(driverId, second)
  const tripPlan = driverTripPlansById[driverId]

  if (!tick || !tripPlan) {
    return undefined
  }

  const normalizedSecond = normalizePlaybackSecond(second)
  const maxSecond = simulationMeta.playbackSeconds - 1
  const progressPct = Math.round((normalizedSecond / maxSecond) * 100)

  let phase: DriverTripPhase = 'completed'
  let etaTimestamp = tripPlan.dropoffStop.plannedTimestamp
  let currentStopLabel = tripPlan.dropoffStop.label
  let currentLegLabel = `${tripPlan.pickupStop.cityLabel} to ${tripPlan.dropoffStop.cityLabel}`

  if (normalizedSecond < tripPlan.pickupCompletedSecond) {
    phase = 'heading-to-pickup'
    etaTimestamp = tripPlan.pickupStop.plannedTimestamp
    currentStopLabel = tripPlan.pickupStop.label
    currentLegLabel = `${tripPlan.originLabel} to ${tripPlan.pickupStop.cityLabel}`
  } else if (normalizedSecond < tripPlan.finalApproachStartSecond) {
    phase = 'linehaul'
  } else if (normalizedSecond < maxSecond) {
    phase = 'final-approach'
  }

  const etaDate = new Date(etaTimestamp)
  const tickDate = new Date(tick.timestamp)
  const remainingMinutes = Math.max(
    0,
    Math.round((etaDate.getTime() - tickDate.getTime()) / 60_000),
  )

  return {
    driverId,
    second: normalizedSecond,
    timestamp: tick.timestamp,
    tripId: tripPlan.tripId,
    loadId: tripPlan.loadId,
    phase,
    progressPct,
    currentLegLabel,
    currentStopLabel,
    etaTimestamp,
    etaLabel: formatEtaLabel(etaTimestamp),
    remainingMinutes,
    routeLabel: tripPlan.routeLabel,
    originLabel: tripPlan.originLabel,
    destinationLabel: tripPlan.destinationLabel,
    pickupStop: tripPlan.pickupStop,
    dropoffStop: tripPlan.dropoffStop,
  }
}

export function getPlaybackMarkerAtSecond(driverId: string, second: number): PlaybackDriverMarker | undefined {
  const tick = getDriverStateAtSecond(driverId, second)
  const driver = driverSummaryById[driverId]

  if (!tick || !driver) {
    return undefined
  }

  return {
    id: driver.id,
    name: driver.name,
    initials: driver.initials,
    lat: tick.lat,
    lng: tick.lng,
    riskBand: tick.riskBand,
    status: mapRiskBandToMarkerStatus(tick.riskBand),
    vehicleLabel: driver.vehicleLabel,
    routeLabel: driver.routeLabel,
  }
}

export function getDriverPlaybackState(driverId: string, second: number): DriverPlaybackState | undefined {
  const tick = getDriverStateAtSecond(driverId, second)
  const trip = getDriverTripAtSecond(driverId, second)
  const marker = getPlaybackMarkerAtSecond(driverId, second)
  const driver = driverSummaryById[driverId]

  if (!tick || !trip || !marker || !driver) {
    return undefined
  }

  return {
    driver,
    tick,
    trip,
    marker,
  }
}

function buildPlaybackDriversForFrame(frame: SimulationFrame): DriverPlaybackState[] {
  return frame.drivers
    .map((tick) => getDriverPlaybackState(tick.driverId, frame.second))
    .filter((driver): driver is DriverPlaybackState => driver !== undefined)
}

export function getFleetPlaybackFrame(second: number): FleetPlaybackFrame {
  const frame = getSimulationFrame(second)

  return {
    second: frame.second,
    simulatedMinute: frame.simulatedMinute,
    timestamp: frame.timestamp,
    drivers: buildPlaybackDriversForFrame(frame),
  }
}

export function getPlaybackDriverProfiles(second: number): PlaybackDriverProfile[] {
  const frame = getSimulationFrame(second)
  return buildPlaybackDriversForFrame(frame)
    .map(({ driver, tick, trip, marker }) => ({
      id: driver.id,
      name: driver.name,
      initials: driver.initials,
      vehicleLabel: driver.vehicleLabel,
      routeLabel: driver.routeLabel,
      riskBand: tick.riskBand,
      riskScore: tick.riskScore,
      primaryRiskReason: tick.primaryRiskReason,
      shortExplanation: tick.shortExplanation,
      tripId: trip.tripId,
      loadId: trip.loadId,
      etaLabel: trip.etaLabel,
      markerStatus: marker.status,
    }))
    .sort((left, right) => right.riskScore - left.riskScore)
}

export function getDefaultSelectedDriverId(second = simulationMeta.playbackSeconds - 1) {
  return getPlaybackDriverProfiles(second)[0]?.id
}

import routeData from './routeData.json'

export type RiskBand = 'green' | 'yellow' | 'red'

export type TrafficLevel = 'light' | 'moderate' | 'heavy' | 'stop-and-go'

export type WeatherCondition = 'clear' | 'windy' | 'rain' | 'fog' | 'dust'

export type RoadClass = 'interstate' | 'state-highway' | 'urban-arterial'

export interface DriverSummary {
  id: string
  name: string
  initials: string
  vehicleLabel: string
  routeLabel: string
  riskBand: RiskBand
  latestRiskScore: number
  primaryRiskReason: string
  shortExplanation: string
}

export interface TimelineTick {
  driverId: string
  second: number
  simulatedMinute: number
  timestamp: string
  lat: number
  lng: number
  speedMph: number
  speedLimitMph: number
  trafficLevel: TrafficLevel
  weatherCondition: WeatherCondition
  roadClass: RoadClass
  continuousDriveMin: number
  timeSinceLastBreakMin: number
  hosDriveRemainingMin: number
  hosShiftRemainingMin: number
  idleTimeMin: number
  brakeHealthScore: number
  tirePressureAlertCount: number
  maintenanceOverdueDays: number
  fuelLevelPct: number
  riskScore: number
  riskBand: RiskBand
  primaryRiskReason: string
  shortExplanation: string
}

export interface DriverTimeline {
  driver: DriverSummary
  snapshots: TimelineTick[]
}

export interface SimulationFrame {
  second: number
  simulatedMinute: number
  timestamp: string
  drivers: TimelineTick[]
}

export const simulationMeta = {
  simulatedMinutes: 120,
  playbackSeconds: 60,
  secondsPerTick: 1,
  simulatedMinutesPerTick: 2,
} as const

type RouteDataMap = Record<string, [number, number][] | undefined>

const routesByDriverId = routeData as unknown as RouteDataMap

const simulationStartTime = new Date('2026-04-19T08:00:00-07:00').getTime()

const trafficRiskWeight: Record<TrafficLevel, number> = {
  light: 0,
  moderate: 8,
  heavy: 16,
  'stop-and-go': 24,
}

const weatherRiskWeight: Record<WeatherCondition, number> = {
  clear: 0,
  windy: 3,
  rain: 8,
  fog: 12,
  dust: 10,
}

const roadRiskWeight: Record<RoadClass, number> = {
  interstate: 3,
  'state-highway': 4,
  'urban-arterial': 6,
}

type SnapshotInputs = {
  second: number
  lat: number
  lng: number
  speedMph: number
  speedLimitMph: number
  trafficLevel: TrafficLevel
  weatherCondition: WeatherCondition
  roadClass: RoadClass
  continuousDriveMin: number
  timeSinceLastBreakMin: number
  hosDriveRemainingMin: number
  hosShiftRemainingMin: number
  idleTimeMin: number
  brakeHealthScore: number
  tirePressureAlertCount: number
  maintenanceOverdueDays: number
  fuelLevelPct: number
  riskOffset: number
}

type DriverProfile = {
  id: string
  name: string
  initials: string
  vehicleLabel: string
  routeLabel: string
  startLat: number
  startLng: number
  bearingDeg: number
  bearingDriftDeg?: number
  speedMph: (second: number, progress: number) => number
  speedLimitMph: (second: number, progress: number) => number
  trafficLevel: (second: number, progress: number) => TrafficLevel
  weatherCondition: (second: number, progress: number) => WeatherCondition
  roadClass: (second: number, progress: number) => RoadClass
  continuousDriveMin: (second: number) => number
  timeSinceLastBreakMin: (second: number) => number
  hosDriveRemainingMin: (second: number) => number
  hosShiftRemainingMin: (second: number) => number
  idleTimeMin: (second: number, progress: number) => number
  brakeHealthScore: (second: number, progress: number) => number
  tirePressureAlertCount: (second: number, progress: number) => number
  maintenanceOverdueDays: (second: number, progress: number) => number
  fuelLevelPct: (second: number, progress: number) => number
  riskOffset: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, decimals = 0) {
  const precision = 10 ** decimals
  return Math.round(value * precision) / precision
}

function normalizeSecond(second: number) {
  return clamp(Math.floor(second), 0, simulationMeta.playbackSeconds - 1)
}

function getTimestamp(second: number) {
  return new Date(
    simulationStartTime + second * simulationMeta.simulatedMinutesPerTick * 60_000,
  ).toISOString()
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function movePoint(lat: number, lng: number, miles: number, bearingDeg: number) {
  const northMiles = miles * Math.cos(toRadians(bearingDeg))
  const eastMiles = miles * Math.sin(toRadians(bearingDeg))
  const nextLat = lat + northMiles / 69
  const longitudeScale = Math.max(Math.cos(toRadians((lat + nextLat) / 2)), 0.25)
  const nextLng = lng + eastMiles / (69 * longitudeScale)

  return {
    lat: round(nextLat, 5),
    lng: round(nextLng, 5),
  }
}

function distanceBetween(p1: [number, number], p2: [number, number]) {
  const dLat = p2[0] - p1[0]
  const avgLat = (p1[0] + p2[0]) / 2
  const dLng = (p2[1] - p1[1]) * Math.max(Math.cos(toRadians(avgLat)), 0.25)
  return Math.sqrt(dLat * dLat + dLng * dLng) * 69
}

function getRiskBand(riskScore: number): RiskBand {
  if (riskScore >= 60) {
    return 'red'
  }

  if (riskScore >= 35) {
    return 'yellow'
  }

  return 'green'
}

function joinLabels(labels: string[]) {
  if (labels.length === 0) {
    return ''
  }

  if (labels.length === 1) {
    return labels[0]
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`
  }

  return `${labels[0]}, ${labels[1]}, and ${labels[2]}`
}

function describeRisk(inputs: SnapshotInputs, riskScore: number, riskBand: RiskBand) {
  const speedOverLimit = Math.max(inputs.speedMph - inputs.speedLimitMph, 0)

  const reasonCandidates = [
    {
      label:
        inputs.trafficLevel === 'stop-and-go'
          ? 'Stop-and-go traffic'
          : inputs.trafficLevel === 'heavy'
            ? 'Heavy traffic'
            : inputs.trafficLevel === 'moderate'
              ? 'Moderate traffic'
              : 'Light traffic',
      score: trafficRiskWeight[inputs.trafficLevel],
    },
    {
      label: 'Low HOS remaining',
      score:
        clamp((150 - inputs.hosDriveRemainingMin) * 0.14, 0, 18) +
        clamp((210 - inputs.hosShiftRemainingMin) * 0.06, 0, 8),
    },
    {
      label: 'Growing fatigue risk',
      score:
        clamp((inputs.continuousDriveMin - 105) * 0.11, 0, 14) +
        clamp((inputs.timeSinceLastBreakMin - 135) * 0.06, 0, 8),
    },
    {
      label: 'Speeding',
      score: clamp(speedOverLimit * 2.2, 0, 18),
    },
    {
      label: 'Poor visibility',
      score: weatherRiskWeight[inputs.weatherCondition],
    },
    {
      label: 'Vehicle condition issues',
      score:
        clamp((84 - inputs.brakeHealthScore) * 0.4, 0, 10) +
        inputs.tirePressureAlertCount * 4 +
        clamp(inputs.maintenanceOverdueDays * 0.45, 0, 8),
    },
  ]
    .filter((candidate) => candidate.score >= 3)
    .sort((left, right) => right.score - left.score)

  const topLabels = reasonCandidates.slice(0, 3).map((candidate) => candidate.label)
  const primaryRiskReason = reasonCandidates[0]?.label ?? 'Safe operating profile'

  if (riskBand === 'green') {
    return {
      primaryRiskReason: 'Safe operating profile',
      shortExplanation: 'Safe conditions and good HOS buffer',
    }
  }

  if (riskBand === 'yellow') {
    const labels = joinLabels(topLabels.slice(0, 2))
    return {
      primaryRiskReason,
      shortExplanation: labels
        ? `${labels} are pushing risk into a watch zone`
        : 'Moderate risk is building over this run',
    }
  }

  const labels = joinLabels(topLabels)

  return {
    primaryRiskReason,
    shortExplanation: labels
      ? `${labels} are pushing this run into high concern`
      : `Risk is elevated at ${riskScore}`,
  }
}

function calculateRiskScore(inputs: SnapshotInputs) {
  const speedOverLimit = Math.max(inputs.speedMph - inputs.speedLimitMph, 0)

  const score =
    inputs.riskOffset +
    roadRiskWeight[inputs.roadClass] +
    trafficRiskWeight[inputs.trafficLevel] +
    weatherRiskWeight[inputs.weatherCondition] +
    clamp((inputs.continuousDriveMin - 90) * 0.11, 0, 16) +
    clamp((inputs.timeSinceLastBreakMin - 120) * 0.07, 0, 10) +
    clamp((160 - inputs.hosDriveRemainingMin) * 0.16, 0, 22) +
    clamp((220 - inputs.hosShiftRemainingMin) * 0.07, 0, 10) +
    clamp(speedOverLimit * 2.3, 0, 20) +
    clamp(inputs.idleTimeMin * 0.22, 0, 6) +
    clamp((88 - inputs.brakeHealthScore) * 0.35, 0, 12) +
    clamp(inputs.tirePressureAlertCount * 4.5, 0, 9) +
    clamp(inputs.maintenanceOverdueDays * 0.45, 0, 10) +
    clamp((25 - inputs.fuelLevelPct) * 0.3, 0, 6)

  return clamp(Math.round(score), 0, 100)
}

function buildSnapshot(driverId: string, inputs: SnapshotInputs): TimelineTick {
  const riskScore = calculateRiskScore(inputs)
  const riskBand = getRiskBand(riskScore)
  const { primaryRiskReason, shortExplanation } = describeRisk(inputs, riskScore, riskBand)

  return {
    driverId,
    second: inputs.second,
    simulatedMinute: inputs.second * simulationMeta.simulatedMinutesPerTick,
    timestamp: getTimestamp(inputs.second),
    lat: inputs.lat,
    lng: inputs.lng,
    speedMph: inputs.speedMph,
    speedLimitMph: inputs.speedLimitMph,
    trafficLevel: inputs.trafficLevel,
    weatherCondition: inputs.weatherCondition,
    roadClass: inputs.roadClass,
    continuousDriveMin: inputs.continuousDriveMin,
    timeSinceLastBreakMin: inputs.timeSinceLastBreakMin,
    hosDriveRemainingMin: inputs.hosDriveRemainingMin,
    hosShiftRemainingMin: inputs.hosShiftRemainingMin,
    idleTimeMin: inputs.idleTimeMin,
    brakeHealthScore: inputs.brakeHealthScore,
    tirePressureAlertCount: inputs.tirePressureAlertCount,
    maintenanceOverdueDays: inputs.maintenanceOverdueDays,
    fuelLevelPct: inputs.fuelLevelPct,
    riskScore,
    riskBand,
    primaryRiskReason,
    shortExplanation,
  }
}

const driverProfiles: DriverProfile[] = [
  {
    id: 'driver-01',
    name: 'Bill Gates',
    initials: 'ET',
    vehicleLabel: 'Truck 218',
    routeLabel: 'I-10 West / Phoenix to Buckeye',
    startLat: 33.4484,
    startLng: -112.074,
    bearingDeg: 278,
    bearingDriftDeg: 3,
    speedMph: (_second, progress) =>
      round(61 + Math.sin(progress * Math.PI * 2.1) * 3 + Math.cos(progress * Math.PI * 5.3) * 1.2, 1),
    speedLimitMph: (second) => (second >= 46 ? 60 : 65),
    trafficLevel: (second) => {
      if (second >= 18 && second <= 33) {
        return 'moderate'
      }

      return 'light'
    },
    weatherCondition: (second) => (second >= 40 ? 'windy' : 'clear'),
    roadClass: () => 'interstate',
    continuousDriveMin: (second) => 26 + second * 2,
    timeSinceLastBreakMin: (second) => 18 + second * 2,
    hosDriveRemainingMin: (second) => 412 - second * 2,
    hosShiftRemainingMin: (second) => 585 - second * 2,
    idleTimeMin: (second) => (second >= 50 ? round((second - 49) * 0.35, 1) : 0),
    brakeHealthScore: (second) => round(95 - second * 0.05, 1),
    tirePressureAlertCount: () => 0,
    maintenanceOverdueDays: () => 0,
    fuelLevelPct: (second) => round(82 - second * 0.32, 1),
    riskOffset: 10,
  },
  {
    id: 'driver-02',
    name: 'LeBron James',
    initials: 'JP',
    vehicleLabel: 'Truck 431',
    routeLabel: 'I-17 North / Phoenix to Anthem',
    startLat: 33.4484,
    startLng: -112.074,
    bearingDeg: 352,
    bearingDriftDeg: 7,
    speedMph: (second, progress) =>
      round(
        52 +
          Math.sin(progress * Math.PI * 1.8) * 6 +
          Math.cos(progress * Math.PI * 5.1) * 2 -
          clamp((second - 34) * 0.18, 0, 5),
        1,
      ),
    speedLimitMph: (second) => {
      if (second >= 42) {
        return 50
      }

      if (second >= 28) {
        return 55
      }

      return 65
    },
    trafficLevel: (second) => {
      if (second >= 16) {
        return 'heavy'
      }

      return 'moderate'
    },
    weatherCondition: (second) => {
      if (second >= 24) {
        return 'windy'
      }

      return 'clear'
    },
    roadClass: (second) => (second >= 32 ? 'urban-arterial' : 'interstate'),
    continuousDriveMin: (second) => 82 + second * 2,
    timeSinceLastBreakMin: (second) => 70 + second * 2,
    hosDriveRemainingMin: (second) => 238 - second * 2,
    hosShiftRemainingMin: (second) => 356 - second * 2,
    idleTimeMin: (second) => (second >= 30 ? round((second - 29) * 0.32, 1) : 0),
    brakeHealthScore: (second) => round(85 - second * 0.1, 1),
    tirePressureAlertCount: () => 0,
    maintenanceOverdueDays: () => 2,
    fuelLevelPct: (second) => round(64 - second * 0.48, 1),
    riskOffset: 5,
  },
  {
    id: 'driver-03',
    name: 'Jason Huang',
    initials: 'MW',
    vehicleLabel: 'Truck 507',
    routeLabel: 'I-10 East / Tolleson to downtown Phoenix',
    startLat: 33.4606,
    startLng: -112.2543,
    bearingDeg: 96,
    bearingDriftDeg: 10,
    speedMph: (second, progress) => {
      if (second < 22) {
        return round(67 + Math.sin(progress * Math.PI * 4.2) * 4, 1)
      }

      if (second < 42) {
        return round(63 + Math.sin(progress * Math.PI * 5.4) * 7, 1)
      }

      return round(36 + Math.abs(Math.sin(progress * Math.PI * 9.2)) * 17, 1)
    },
    speedLimitMph: (second) => {
      if (second >= 42) {
        return 45
      }

      if (second >= 18) {
        return 55
      }

      return 65
    },
    trafficLevel: (second) => {
      if (second >= 32) {
        return 'stop-and-go'
      }

      return 'heavy'
    },
    weatherCondition: (second) => {
      if (second >= 46) {
        return 'fog'
      }

      if (second >= 20) {
        return 'dust'
      }

      return 'windy'
    },
    roadClass: (second) => (second >= 28 ? 'urban-arterial' : 'interstate'),
    continuousDriveMin: (second) => 176 + second * 2,
    timeSinceLastBreakMin: (second) => 164 + second * 2,
    hosDriveRemainingMin: (second) => 134 - second * 2,
    hosShiftRemainingMin: (second) => 244 - second * 2,
    idleTimeMin: (second) => (second >= 16 ? round((second - 15) * 0.75, 1) : 0),
    brakeHealthScore: (second) => round(66 - second * 0.14, 1),
    tirePressureAlertCount: (second) => (second >= 28 ? 2 : 1),
    maintenanceOverdueDays: (second) => 11 + Math.floor(second / 20),
    fuelLevelPct: (second) => round(48 - second * 0.5, 1),
    riskOffset: 16,
  },
  {
    id: 'driver-04',
    name: 'Justin Bieber',
    initials: 'SR',
    vehicleLabel: 'Truck 612',
    routeLabel: 'US-60 East / Mesa toward Globe',
    startLat: 33.4158,
    startLng: -111.8317,
    bearingDeg: 118,
    bearingDriftDeg: 6,
    speedMph: (_second, progress) => round(58 + Math.sin(progress * Math.PI * 2.4) * 4, 1),
    speedLimitMph: () => 65,
    trafficLevel: (second) => (second >= 25 ? 'moderate' : 'light'),
    weatherCondition: () => 'clear',
    roadClass: () => 'state-highway',
    continuousDriveMin: (second) => 48 + second * 1.4,
    timeSinceLastBreakMin: (second) => 40 + second * 1.4,
    hosDriveRemainingMin: (second) => 355 - second * 2,
    hosShiftRemainingMin: (second) => 475 - second * 2,
    idleTimeMin: () => 0,
    brakeHealthScore: (_second, progress) => round(91 - progress * 5, 1),
    tirePressureAlertCount: () => 0,
    maintenanceOverdueDays: () => 0,
    fuelLevelPct: (second) => round(72 - second * 0.22, 1),
    riskOffset: 7,
  },
  {
    id: 'driver-05',
    name: 'Kim Kardashian',
    initials: 'DK',
    vehicleLabel: 'Truck 445',
    routeLabel: 'Loop 202 South / Chandler to I-10',
    startLat: 33.3062,
    startLng: -111.8411,
    bearingDeg: 268,
    bearingDriftDeg: 4,
    speedMph: (second, progress) => round(54 + Math.sin(progress * Math.PI * 2) * 5 - clamp((second - 38) * 0.12, 0, 4), 1),
    speedLimitMph: (second) => (second >= 40 ? 55 : 65),
    trafficLevel: (second) => (second >= 20 ? 'heavy' : 'moderate'),
    weatherCondition: (second) => (second >= 30 ? 'rain' : 'clear'),
    roadClass: (second) => (second >= 35 ? 'urban-arterial' : 'interstate'),
    continuousDriveMin: (second) => 95 + second * 1.8,
    timeSinceLastBreakMin: (second) => 88 + second * 1.8,
    hosDriveRemainingMin: (second) => 248 - second * 2,
    hosShiftRemainingMin: (second) => 340 - second * 2,
    idleTimeMin: (second) => (second >= 28 ? round((second - 27) * 0.25, 1) : 0),
    brakeHealthScore: (second) => round(82 - second * 0.09, 1),
    tirePressureAlertCount: () => 0,
    maintenanceOverdueDays: () => 1,
    fuelLevelPct: (second) => round(62 - second * 0.35, 1),
    riskOffset: 6,
  },
  {
    id: 'driver-06',
    name: 'Jackie Chan',
    initials: 'CV',
    vehicleLabel: 'Truck 301',
    routeLabel: 'I-40 West / Flagstaff lane (sim)',
    startLat: 35.1983,
    startLng: -111.6513,
    bearingDeg: 245,
    bearingDriftDeg: 8,
    speedMph: (_second, progress) => round(62 + Math.cos(progress * Math.PI * 3) * 3, 1),
    speedLimitMph: () => 65,
    trafficLevel: () => 'light',
    weatherCondition: (second) => (second >= 45 ? 'windy' : 'clear'),
    roadClass: () => 'interstate',
    continuousDriveMin: (second) => 32 + second * 1.2,
    timeSinceLastBreakMin: (second) => 24 + second * 1.2,
    hosDriveRemainingMin: (second) => 400 - second * 2,
    hosShiftRemainingMin: (second) => 540 - second * 2,
    idleTimeMin: () => 0,
    brakeHealthScore: () => 94,
    tirePressureAlertCount: () => 0,
    maintenanceOverdueDays: () => 0,
    fuelLevelPct: (second) => round(78 - second * 0.18, 1),
    riskOffset: 4,
  },
  {
    id: 'driver-07',
    name: 'Wu Kong',
    initials: 'MB',
    vehicleLabel: 'Truck 889',
    routeLabel: 'SR-87 North / Payson approach',
    startLat: 33.7892,
    startLng: -111.2521,
    bearingDeg: 12,
    bearingDriftDeg: 5,
    speedMph: (second, progress) =>
      round(49 + Math.sin(progress * Math.PI * 2.2) * 7 + (second > 35 ? 6 : 0), 1),
    speedLimitMph: () => 55,
    trafficLevel: (second) => (second >= 14 ? 'stop-and-go' : 'heavy'),
    weatherCondition: () => 'dust',
    roadClass: () => 'state-highway',
    continuousDriveMin: (second) => 140 + second * 2,
    timeSinceLastBreakMin: (second) => 130 + second * 2,
    hosDriveRemainingMin: (second) => 168 - second * 2,
    hosShiftRemainingMin: (second) => 260 - second * 2,
    idleTimeMin: (second) => (second >= 22 ? round((second - 21) * 0.5, 1) : 0),
    brakeHealthScore: (second) => round(72 - second * 0.12, 1),
    tirePressureAlertCount: (second) => (second >= 26 ? 1 : 0),
    maintenanceOverdueDays: () => 5,
    fuelLevelPct: (second) => round(52 - second * 0.42, 1),
    riskOffset: 12,
  },
  {
    id: 'driver-08',
    name: 'Garry Tan',
    initials: 'RP',
    vehicleLabel: 'Truck 156',
    routeLabel: 'I-8 West / Gila Bend corridor',
    startLat: 32.8487,
    startLng: -112.5821,
    bearingDeg: 275,
    bearingDriftDeg: 3,
    speedMph: (_second, progress) => round(63 + Math.sin(progress * Math.PI * 1.9) * 2.5, 1),
    speedLimitMph: () => 70,
    trafficLevel: () => 'light',
    weatherCondition: () => 'clear',
    roadClass: () => 'interstate',
    continuousDriveMin: (second) => 28 + second * 1.1,
    timeSinceLastBreakMin: (second) => 20 + second * 1.1,
    hosDriveRemainingMin: (second) => 430 - second * 2,
    hosShiftRemainingMin: (second) => 560 - second * 2,
    idleTimeMin: () => 0,
    brakeHealthScore: () => 93,
    tirePressureAlertCount: () => 0,
    maintenanceOverdueDays: () => 0,
    fuelLevelPct: (second) => round(80 - second * 0.2, 1),
    riskOffset: 3,
  },
  {
    id: 'driver-09',
    name: 'Elon Musk',
    initials: 'AC',
    vehicleLabel: 'Truck 773',
    routeLabel: 'AZ-101 Loop / Scottsdale segment',
    startLat: 33.5806,
    startLng: -111.9044,
    bearingDeg: 88,
    bearingDriftDeg: 9,
    speedMph: (second, progress) =>
      round(56 + Math.sin(progress * Math.PI * 2.6) * 8 + (second > 30 ? 5 : 0), 1),
    speedLimitMph: (second) => (second >= 36 ? 50 : 60),
    trafficLevel: (second) => (second >= 18 ? 'heavy' : 'moderate'),
    weatherCondition: (second) => (second >= 40 ? 'rain' : 'windy'),
    roadClass: () => 'urban-arterial',
    continuousDriveMin: (second) => 110 + second * 2,
    timeSinceLastBreakMin: (second) => 102 + second * 2,
    hosDriveRemainingMin: (second) => 210 - second * 2,
    hosShiftRemainingMin: (second) => 310 - second * 2,
    idleTimeMin: (second) => (second >= 24 ? round((second - 23) * 0.4, 1) : 0),
    brakeHealthScore: (second) => round(78 - second * 0.11, 1),
    tirePressureAlertCount: () => 0,
    maintenanceOverdueDays: () => 3,
    fuelLevelPct: (second) => round(58 - second * 0.38, 1),
    riskOffset: 9,
  },
  {
    id: 'driver-10',
    name: 'Messi',
    initials: 'JO',
    vehicleLabel: 'Truck 234',
    routeLabel: 'I-19 South / Nogales freight',
    startLat: 31.9696,
    startLng: -110.2975,
    bearingDeg: 182,
    bearingDriftDeg: 4,
    speedMph: (_second, progress) => round(59 + Math.cos(progress * Math.PI * 2.3) * 3.5, 1),
    speedLimitMph: () => 65,
    trafficLevel: () => 'moderate',
    weatherCondition: () => 'clear',
    roadClass: () => 'interstate',
    continuousDriveMin: (second) => 55 + second * 1.6,
    timeSinceLastBreakMin: (second) => 48 + second * 1.6,
    hosDriveRemainingMin: (second) => 320 - second * 2,
    hosShiftRemainingMin: (second) => 420 - second * 2,
    idleTimeMin: () => 0,
    brakeHealthScore: () => 88,
    tirePressureAlertCount: () => 0,
    maintenanceOverdueDays: () => 0,
    fuelLevelPct: (second) => round(68 - second * 0.28, 1),
    riskOffset: 5,
  },
  {
    id: 'driver-11',
    name: 'Jeff Basil',
    initials: 'TB',
    vehicleLabel: 'Truck 567',
    routeLabel: 'US-93 North / Wickenburg run',
    startLat: 33.9689,
    startLng: -112.7296,
    bearingDeg: 328,
    bearingDriftDeg: 7,
    speedMph: (second, progress) =>
      round(51 + Math.sin(progress * Math.PI * 1.7) * 6 - clamp((second - 40) * 0.2, 0, 6), 1),
    speedLimitMph: (second) => (second >= 44 ? 45 : 55),
    trafficLevel: (second) => (second >= 26 ? 'heavy' : 'moderate'),
    weatherCondition: (second) => (second >= 32 ? 'fog' : 'clear'),
    roadClass: (second) => (second >= 30 ? 'urban-arterial' : 'state-highway'),
    continuousDriveMin: (second) => 125 + second * 1.9,
    timeSinceLastBreakMin: (second) => 118 + second * 1.9,
    hosDriveRemainingMin: (second) => 198 - second * 2,
    hosShiftRemainingMin: (second) => 288 - second * 2,
    idleTimeMin: (second) => (second >= 20 ? round((second - 19) * 0.45, 1) : 0),
    brakeHealthScore: (second) => round(74 - second * 0.1, 1),
    tirePressureAlertCount: () => 1,
    maintenanceOverdueDays: () => 4,
    fuelLevelPct: (second) => round(55 - second * 0.36, 1),
    riskOffset: 11,
  },
  {
    id: 'driver-12',
    name: 'Johnny Dang',
    initials: 'CN',
    vehicleLabel: 'Truck 901',
    routeLabel: 'I-10 East / Casa Grande relay',
    startLat: 32.8795,
    startLng: -111.7543,
    bearingDeg: 95,
    bearingDriftDeg: 11,
    speedMph: (second, progress) => {
      if (second < 18) {
        return round(64 + Math.sin(progress * Math.PI * 4) * 3, 1)
      }
      if (second < 44) {
        return round(58 + Math.sin(progress * Math.PI * 5) * 8, 1)
      }
      return round(40 + Math.abs(Math.sin(progress * Math.PI * 8)) * 14, 1)
    },
    speedLimitMph: (second) => {
      if (second >= 40) return 45
      if (second >= 16) return 55
      return 65
    },
    trafficLevel: (second) => (second >= 28 ? 'stop-and-go' : 'heavy'),
    weatherCondition: (second) => {
      if (second >= 48) return 'fog'
      if (second >= 22) return 'dust'
      return 'windy'
    },
    roadClass: (second) => (second >= 24 ? 'urban-arterial' : 'interstate'),
    continuousDriveMin: (second) => 168 + second * 2,
    timeSinceLastBreakMin: (second) => 155 + second * 2,
    hosDriveRemainingMin: (second) => 142 - second * 2,
    hosShiftRemainingMin: (second) => 228 - second * 2,
    idleTimeMin: (second) => (second >= 14 ? round((second - 13) * 0.65, 1) : 0),
    brakeHealthScore: (second) => round(68 - second * 0.13, 1),
    tirePressureAlertCount: (second) => (second >= 24 ? 2 : 1),
    maintenanceOverdueDays: (second) => 8 + Math.floor(second / 22),
    fuelLevelPct: (second) => round(46 - second * 0.48, 1),
    riskOffset: 14,
  },
]

function buildDriverTimeline(profile: DriverProfile): DriverTimeline {
  let currentLat = profile.startLat
  let currentLng = profile.startLng
  let totalDistanceCovered = 0

  const routePoints = routesByDriverId[profile.id]

  const snapshots = Array.from({ length: simulationMeta.playbackSeconds }, (_, second) => {
    const progress = second / (simulationMeta.playbackSeconds - 1)
    const speedMph = profile.speedMph(second, progress)
    
    if (second > 0) {
      const distanceMiles = speedMph * (simulationMeta.simulatedMinutesPerTick / 60)
      
      if (routePoints && routePoints.length > 0) {
        totalDistanceCovered += distanceMiles
        let distAccum = 0
        
        for (let i = 0; i < routePoints.length - 1; i++) {
          const segDist = distanceBetween(routePoints[i], routePoints[i + 1])
          
          if (distAccum + segDist >= totalDistanceCovered) {
             const ratio = (totalDistanceCovered - distAccum) / segDist
             currentLat = round(routePoints[i][0] + (routePoints[i + 1][0] - routePoints[i][0]) * ratio, 5)
             currentLng = round(routePoints[i][1] + (routePoints[i + 1][1] - routePoints[i][1]) * ratio, 5)
             break
          }
          distAccum += segDist
          
          // Keep at final destination if distance exceeds route
          if (i === routePoints.length - 2) {
             currentLat = routePoints[i + 1][0]
             currentLng = routePoints[i + 1][1]
          }
        }
      } else {
        // Fallback to mathematical drift if no real route geometry is found
        const bearingDeg =
          profile.bearingDeg +
          Math.sin(progress * Math.PI * 2.4) * (profile.bearingDriftDeg ?? 0)
        
        const nextPoint = movePoint(currentLat, currentLng, distanceMiles, bearingDeg)
        currentLat = nextPoint.lat
        currentLng = nextPoint.lng
      }
    }

    return buildSnapshot(profile.id, {
      second,
      lat: currentLat,
      lng: currentLng,
      speedMph,
      speedLimitMph: profile.speedLimitMph(second, progress),
      trafficLevel: profile.trafficLevel(second, progress),
      weatherCondition: profile.weatherCondition(second, progress),
      roadClass: profile.roadClass(second, progress),
      continuousDriveMin: profile.continuousDriveMin(second),
      timeSinceLastBreakMin: profile.timeSinceLastBreakMin(second),
      hosDriveRemainingMin: profile.hosDriveRemainingMin(second),
      hosShiftRemainingMin: profile.hosShiftRemainingMin(second),
      idleTimeMin: profile.idleTimeMin(second, progress),
      brakeHealthScore: profile.brakeHealthScore(second, progress),
      tirePressureAlertCount: profile.tirePressureAlertCount(second, progress),
      maintenanceOverdueDays: profile.maintenanceOverdueDays(second, progress),
      fuelLevelPct: profile.fuelLevelPct(second, progress),
      riskOffset: profile.riskOffset,
    })
  })

  const latest = snapshots[snapshots.length - 1]

  return {
    driver: {
      id: profile.id,
      name: profile.name,
      initials: profile.initials,
      vehicleLabel: profile.vehicleLabel,
      routeLabel: profile.routeLabel,
      riskBand: latest.riskBand,
      latestRiskScore: latest.riskScore,
      primaryRiskReason: latest.primaryRiskReason,
      shortExplanation: latest.shortExplanation,
    },
    snapshots,
  }
}

export const driverRiskSimulation: DriverTimeline[] = driverProfiles.map(buildDriverTimeline)

export const driverSummaries: DriverSummary[] = driverRiskSimulation.map(({ driver }) => driver)

export const driverSnapshotsById: Record<string, TimelineTick[]> = Object.fromEntries(
  driverRiskSimulation.map(({ driver, snapshots }) => [driver.id, snapshots]),
)

export function getDriverStateAtSecond(driverId: string, second: number) {
  const snapshots = driverSnapshotsById[driverId]

  if (!snapshots) {
    return undefined
  }

  return snapshots[normalizeSecond(second)]
}

export function getSimulationFrame(second: number): SimulationFrame {
  const normalizedSecond = normalizeSecond(second)

  return {
    second: normalizedSecond,
    simulatedMinute: normalizedSecond * simulationMeta.simulatedMinutesPerTick,
    timestamp: getTimestamp(normalizedSecond),
    drivers: driverRiskSimulation.map(({ snapshots }) => snapshots[normalizedSecond]),
  }
}

export const simulationFrames: SimulationFrame[] = Array.from(
  { length: simulationMeta.playbackSeconds },
  (_, second) => getSimulationFrame(second),
)

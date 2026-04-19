import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const dataDir = path.join(repoRoot, 'data')
const DEFAULT_ROW_COUNT = 10000

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const requestedRowCount = parsePositiveInt(process.argv[2] ?? process.env.ELD_RISK_ROW_COUNT, DEFAULT_ROW_COUNT)

function createRandom(seed = 42) {
  let state = seed >>> 0

  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const random = createRandom(20260419)

function pick(list) {
  return list[Math.floor(random() * list.length)]
}

function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min
}

function randFloat(min, max, precision = 2) {
  const value = min + random() * (max - min)
  return Number(value.toFixed(precision))
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function weightedPick(weightMap) {
  const total = Object.values(weightMap).reduce((sum, value) => sum + value, 0)
  let cursor = random() * total

  for (const [key, weight] of Object.entries(weightMap)) {
    cursor -= weight
    if (cursor <= 0) {
      return key
    }
  }

  return Object.keys(weightMap).at(-1)
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`
  }

  return stringValue
}

function toCsv(rows) {
  if (rows.length === 0) {
    return ''
  }

  const columns = Object.keys(rows[0])
  const lines = [columns.join(',')]

  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','))
  }

  return `${lines.join('\n')}\n`
}

function roundToNearest(value, nearest = 5) {
  return Math.round(value / nearest) * nearest
}

function getLocalDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
    month: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const map = {}
  for (const part of parts) {
    map[part.type] = part.value
  }

  return {
    dayOfWeek: map.weekday,
    localHour: Number(map.hour),
    localMonth: Number(map.month),
  }
}

const driverTerminalProfiles = [
  { homeTerminal: 'Phoenix', tenureRange: [45, 1500], scoredTripRange: [36, 310] },
  { homeTerminal: 'Tucson', tenureRange: [30, 1080], scoredTripRange: [24, 220] },
  { homeTerminal: 'Flagstaff', tenureRange: [20, 920], scoredTripRange: [14, 185] },
  { homeTerminal: 'Albuquerque', tenureRange: [25, 1320], scoredTripRange: [22, 260] },
  { homeTerminal: 'Dallas', tenureRange: [60, 1800], scoredTripRange: [50, 340] },
  { homeTerminal: 'Denver', tenureRange: [45, 1320], scoredTripRange: [28, 245] },
  { homeTerminal: 'Amarillo', tenureRange: [20, 840], scoredTripRange: [12, 170] },
  { homeTerminal: 'Bakersfield', tenureRange: [25, 1240], scoredTripRange: [18, 240] },
  { homeTerminal: 'Kansas City', tenureRange: [30, 1360], scoredTripRange: [22, 255] },
  { homeTerminal: 'El Paso', tenureRange: [20, 980], scoredTripRange: [14, 185] },
  { homeTerminal: 'Salt Lake City', tenureRange: [25, 960], scoredTripRange: [16, 210] },
]

function createDrivers(count) {
  return Array.from({ length: count }, (_, index) => {
    const profile = pick(driverTerminalProfiles)
    const coldStart = random() < 0.18
    const scoredTripCount = coldStart ? randInt(5, 29) : randInt(...profile.scoredTripRange)
    const tenureDays = coldStart
      ? randInt(14, Math.min(160, profile.tenureRange[1]))
      : randInt(...profile.tenureRange)

    return {
      driverId: `drv_${String(index + 1).padStart(4, '0')}`,
      homeTerminal: profile.homeTerminal,
      tenureDays,
      scoredTripCount,
      priorHosViolationCount30d: Number(weightedPick({ 0: 0.64, 1: 0.23, 2: 0.09, 3: 0.04 })),
    }
  })
}

const vehicleTypeProfiles = [
  {
    vehicleType: 'tractor_53ft',
    engineHoursRange: [6400, 16500],
    odometerRange: [240000, 690000],
    maintenanceRange: [0, 18],
    brakeRange: [75, 91],
  },
  {
    vehicleType: 'tractor_48ft',
    engineHoursRange: [6200, 15400],
    odometerRange: [210000, 620000],
    maintenanceRange: [0, 20],
    brakeRange: [74, 90],
  },
  {
    vehicleType: 'straight_truck',
    engineHoursRange: [3800, 9200],
    odometerRange: [120000, 310000],
    maintenanceRange: [0, 14],
    brakeRange: [79, 94],
  },
  {
    vehicleType: 'reefer',
    engineHoursRange: [5200, 12800],
    odometerRange: [180000, 470000],
    maintenanceRange: [1, 16],
    brakeRange: [78, 92],
  },
  {
    vehicleType: 'flatbed',
    engineHoursRange: [4600, 11000],
    odometerRange: [160000, 390000],
    maintenanceRange: [0, 15],
    brakeRange: [80, 94],
  },
]

function createVehicles(count) {
  return Array.from({ length: count }, (_, index) => {
    const profile = pick(vehicleTypeProfiles)

    return {
      vehicleId: `veh_${String(index + 1).padStart(4, '0')}`,
      vehicleType: profile.vehicleType,
      baseEngineHours: randInt(...profile.engineHoursRange),
      baseOdometerMiles: randInt(...profile.odometerRange),
      maintenanceBaseline: randInt(...profile.maintenanceRange),
      brakeBaseline: randInt(...profile.brakeRange),
    }
  })
}

const drivers = createDrivers(320)
const vehicles = createVehicles(180)

const scenarios = [
  {
    scenarioId: 'phoenix_urban_interstate',
    metroArea: 'Phoenix',
    stateCode: 'AZ',
    timeZone: 'America/Phoenix',
    latRange: [33.35, 33.63],
    lonRange: [-112.24, -111.86],
    roadClassWeights: { interstate: 0.45, urban_arterial: 0.4, local_road: 0.15 },
    weatherWeights: { clear: 0.54, windy: 0.12, rain: 0.06, dust: 0.1, heat: 0.18 },
    trafficWeights: { light: 0.18, moderate: 0.34, heavy: 0.26, stop_and_go: 0.22 },
  },
  {
    scenarioId: 'tucson_surface_streets',
    metroArea: 'Tucson',
    stateCode: 'AZ',
    timeZone: 'America/Phoenix',
    latRange: [32.11, 32.32],
    lonRange: [-111.08, -110.79],
    roadClassWeights: { urban_arterial: 0.45, interstate: 0.2, local_road: 0.35 },
    weatherWeights: { clear: 0.58, windy: 0.11, rain: 0.07, dust: 0.1, heat: 0.14 },
    trafficWeights: { light: 0.22, moderate: 0.34, heavy: 0.24, stop_and_go: 0.2 },
  },
  {
    scenarioId: 'flagstaff_mountain_corridor',
    metroArea: 'Flagstaff',
    stateCode: 'AZ',
    timeZone: 'America/Phoenix',
    latRange: [35.05, 35.28],
    lonRange: [-111.84, -111.48],
    roadClassWeights: { mountain_pass: 0.38, interstate: 0.45, rural_highway: 0.17 },
    weatherWeights: { clear: 0.42, windy: 0.13, rain: 0.1, snow: 0.15, fog: 0.08, dust: 0.12 },
    trafficWeights: { light: 0.34, moderate: 0.36, heavy: 0.18, stop_and_go: 0.12 },
  },
  {
    scenarioId: 'albuquerque_desert_highway',
    metroArea: 'Albuquerque',
    stateCode: 'NM',
    timeZone: 'America/Denver',
    latRange: [35.0, 35.21],
    lonRange: [-106.77, -106.46],
    roadClassWeights: { interstate: 0.35, rural_highway: 0.4, urban_arterial: 0.25 },
    weatherWeights: { clear: 0.52, windy: 0.17, rain: 0.05, dust: 0.16, heat: 0.1 },
    trafficWeights: { light: 0.28, moderate: 0.33, heavy: 0.22, stop_and_go: 0.17 },
  },
  {
    scenarioId: 'dallas_freight_ring',
    metroArea: 'Dallas',
    stateCode: 'TX',
    timeZone: 'America/Chicago',
    latRange: [32.63, 32.93],
    lonRange: [-97.14, -96.56],
    roadClassWeights: { interstate: 0.48, urban_arterial: 0.32, local_road: 0.2 },
    weatherWeights: { clear: 0.45, windy: 0.14, rain: 0.16, fog: 0.06, heat: 0.19 },
    trafficWeights: { light: 0.12, moderate: 0.28, heavy: 0.31, stop_and_go: 0.29 },
  },
  {
    scenarioId: 'denver_winter_corridor',
    metroArea: 'Denver',
    stateCode: 'CO',
    timeZone: 'America/Denver',
    latRange: [39.56, 39.92],
    lonRange: [-105.18, -104.78],
    roadClassWeights: { interstate: 0.4, mountain_pass: 0.2, urban_arterial: 0.25, rural_highway: 0.15 },
    weatherWeights: { clear: 0.35, windy: 0.12, rain: 0.08, snow: 0.27, fog: 0.08, heat: 0.1 },
    trafficWeights: { light: 0.17, moderate: 0.31, heavy: 0.27, stop_and_go: 0.25 },
  },
  {
    scenarioId: 'bakersfield_ag_corridor',
    metroArea: 'Bakersfield',
    stateCode: 'CA',
    timeZone: 'America/Los_Angeles',
    latRange: [35.18, 35.5],
    lonRange: [-119.22, -118.74],
    roadClassWeights: { rural_highway: 0.42, interstate: 0.31, local_road: 0.27 },
    weatherWeights: { clear: 0.47, windy: 0.1, rain: 0.08, fog: 0.19, dust: 0.06, heat: 0.1 },
    trafficWeights: { light: 0.25, moderate: 0.38, heavy: 0.22, stop_and_go: 0.15 },
  },
  {
    scenarioId: 'kansas_city_storm_lane',
    metroArea: 'Kansas City',
    stateCode: 'MO',
    timeZone: 'America/Chicago',
    latRange: [39.02, 39.19],
    lonRange: [-94.82, -94.42],
    roadClassWeights: { interstate: 0.37, urban_arterial: 0.28, rural_highway: 0.2, local_road: 0.15 },
    weatherWeights: { clear: 0.34, windy: 0.12, rain: 0.2, fog: 0.08, snow: 0.12, heat: 0.14 },
    trafficWeights: { light: 0.16, moderate: 0.33, heavy: 0.27, stop_and_go: 0.24 },
  },
]

const scenariosById = Object.fromEntries(scenarios.map((scenario) => [scenario.scenarioId, scenario]))

const terminalScenarioMap = {
  Phoenix: ['phoenix_urban_interstate', 'tucson_surface_streets'],
  Tucson: ['tucson_surface_streets', 'phoenix_urban_interstate'],
  Flagstaff: ['flagstaff_mountain_corridor', 'phoenix_urban_interstate', 'denver_winter_corridor'],
  Albuquerque: ['albuquerque_desert_highway', 'flagstaff_mountain_corridor', 'dallas_freight_ring'],
  Dallas: ['dallas_freight_ring', 'kansas_city_storm_lane', 'albuquerque_desert_highway'],
  Denver: ['denver_winter_corridor', 'flagstaff_mountain_corridor', 'kansas_city_storm_lane'],
  Amarillo: ['dallas_freight_ring', 'albuquerque_desert_highway', 'kansas_city_storm_lane'],
  Bakersfield: ['bakersfield_ag_corridor', 'phoenix_urban_interstate'],
  'Kansas City': ['kansas_city_storm_lane', 'dallas_freight_ring', 'denver_winter_corridor'],
  'El Paso': ['albuquerque_desert_highway', 'phoenix_urban_interstate'],
  'Salt Lake City': ['denver_winter_corridor', 'flagstaff_mountain_corridor'],
}

function pickScenarioForDriver(driver) {
  const scenarioIds = terminalScenarioMap[driver.homeTerminal] ?? scenarios.map((scenario) => scenario.scenarioId)
  return pick(scenarioIds.map((scenarioId) => scenariosById[scenarioId]))
}

const roadSurfaceByWeather = {
  clear: 'dry',
  heat: 'dry',
  windy: 'dry',
  rain: 'wet',
  snow: 'snow_packed',
  fog: 'damp',
  dust: 'dusty',
}

const speedLimitRanges = {
  interstate: [60, 75],
  rural_highway: [50, 70],
  urban_arterial: [35, 55],
  local_road: [25, 40],
  mountain_pass: [35, 60],
}

const weatherSeverity = {
  clear: 0,
  heat: 5,
  windy: 5,
  rain: 10,
  fog: 15,
  dust: 14,
  snow: 18,
}

const trafficSeverity = {
  light: 0,
  moderate: 4,
  heavy: 9,
  stop_and_go: 13,
}

const roadClassSeverity = {
  interstate: 0,
  rural_highway: 4,
  urban_arterial: 5,
  local_road: 7,
  mountain_pass: 11,
}

const featureCatalog = [
  {
    feature_name: 'row_id',
    feature_group: 'identity',
    source_layer: 'synthetic_dataset',
    available_in_standard_eld: 'n/a',
    data_type: 'string',
    description: 'Stable row key for each driver snapshot in the mock dataset.',
    example_value: 'snap_0001',
  },
  {
    feature_name: 'event_timestamp_utc',
    feature_group: 'time',
    source_layer: 'standard_eld',
    available_in_standard_eld: 'yes',
    data_type: 'datetime',
    description: 'UTC timestamp for the event or driver snapshot.',
    example_value: '2026-02-11T15:20:00.000Z',
  },
  {
    feature_name: 'local_time_zone',
    feature_group: 'time',
    source_layer: 'location_enrichment',
    available_in_standard_eld: 'no',
    data_type: 'string',
    description: 'IANA time zone used to derive local hour and day-of-week.',
    example_value: 'America/Phoenix',
  },
  {
    feature_name: 'local_hour',
    feature_group: 'time',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'number',
    description: 'Local hour derived from timestamp plus time zone.',
    example_value: '17',
  },
  {
    feature_name: 'day_of_week',
    feature_group: 'time',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'string',
    description: 'Local weekday derived from timestamp plus time zone.',
    example_value: 'Wed',
  },
  {
    feature_name: 'is_weekend',
    feature_group: 'time',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'boolean',
    description: 'Weekend flag derived from local day-of-week.',
    example_value: 'false',
  },
  {
    feature_name: 'driver_id',
    feature_group: 'identity',
    source_layer: 'standard_eld',
    available_in_standard_eld: 'yes',
    data_type: 'string',
    description: 'Driver identifier from the ELD or carrier identity system.',
    example_value: 'drv_004',
  },
  {
    feature_name: 'vehicle_id',
    feature_group: 'identity',
    source_layer: 'standard_eld',
    available_in_standard_eld: 'yes',
    data_type: 'string',
    description: 'Vehicle or power unit identifier.',
    example_value: 'veh_103',
  },
  {
    feature_name: 'trip_id',
    feature_group: 'identity',
    source_layer: 'dispatch_context',
    available_in_standard_eld: 'no',
    data_type: 'string',
    description: 'Synthetic trip grouping key for analysis across snapshots.',
    example_value: 'trip_2026_014',
  },
  {
    feature_name: 'scenario_id',
    feature_group: 'context',
    source_layer: 'synthetic_dataset',
    available_in_standard_eld: 'n/a',
    data_type: 'string',
    description: 'Scenario template used to generate a plausible freight snapshot.',
    example_value: 'flagstaff_mountain_corridor',
  },
  {
    feature_name: 'latitude',
    feature_group: 'location',
    source_layer: 'standard_eld',
    available_in_standard_eld: 'yes',
    data_type: 'number',
    description: 'Latitude captured or normalized from the location event.',
    example_value: '35.1754',
  },
  {
    feature_name: 'longitude',
    feature_group: 'location',
    source_layer: 'standard_eld',
    available_in_standard_eld: 'yes',
    data_type: 'number',
    description: 'Longitude captured or normalized from the location event.',
    example_value: '-111.6541',
  },
  {
    feature_name: 'metro_area',
    feature_group: 'location',
    source_layer: 'location_enrichment',
    available_in_standard_eld: 'no',
    data_type: 'string',
    description: 'Named metro or corridor bucket derived from coordinates.',
    example_value: 'Phoenix',
  },
  {
    feature_name: 'state_code',
    feature_group: 'location',
    source_layer: 'location_enrichment',
    available_in_standard_eld: 'no',
    data_type: 'string',
    description: 'State or region code derived from coordinates.',
    example_value: 'AZ',
  },
  {
    feature_name: 'road_class',
    feature_group: 'location',
    source_layer: 'location_enrichment',
    available_in_standard_eld: 'no',
    data_type: 'string',
    description: 'Road category such as interstate, urban arterial, or mountain pass.',
    example_value: 'interstate',
  },
  {
    feature_name: 'road_surface',
    feature_group: 'location',
    source_layer: 'location_enrichment',
    available_in_standard_eld: 'no',
    data_type: 'string',
    description: 'Road surface condition inferred from weather and corridor.',
    example_value: 'wet',
  },
  {
    feature_name: 'speed_limit_mph',
    feature_group: 'location',
    source_layer: 'location_enrichment',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Posted speed limit attached from map matching or road network data.',
    example_value: '65',
  },
  {
    feature_name: 'weather_condition',
    feature_group: 'environment',
    source_layer: 'external_weather_api',
    available_in_standard_eld: 'no',
    data_type: 'string',
    description: 'Weather bucket joined from historical or live weather data.',
    example_value: 'rain',
  },
  {
    feature_name: 'temperature_f',
    feature_group: 'environment',
    source_layer: 'external_weather_api',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Ambient temperature at the event location and time.',
    example_value: '72.4',
  },
  {
    feature_name: 'precipitation_in',
    feature_group: 'environment',
    source_layer: 'external_weather_api',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Precipitation intensity joined from the weather feed.',
    example_value: '0.12',
  },
  {
    feature_name: 'visibility_miles',
    feature_group: 'environment',
    source_layer: 'external_weather_api',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Visibility estimate at the event location and time.',
    example_value: '3.4',
  },
  {
    feature_name: 'wind_speed_mph',
    feature_group: 'environment',
    source_layer: 'external_weather_api',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Wind speed joined from the weather feed.',
    example_value: '19.6',
  },
  {
    feature_name: 'traffic_level',
    feature_group: 'environment',
    source_layer: 'traffic_api',
    available_in_standard_eld: 'no',
    data_type: 'string',
    description: 'Traffic congestion bucket derived from a traffic provider or state feed.',
    example_value: 'heavy',
  },
  {
    feature_name: 'duty_status',
    feature_group: 'driver_state',
    source_layer: 'standard_eld',
    available_in_standard_eld: 'yes',
    data_type: 'string',
    description: 'Current HOS duty status such as driving or on-duty not driving.',
    example_value: 'driving',
  },
  {
    feature_name: 'speed_mph',
    feature_group: 'driver_state',
    source_layer: 'telematics_or_ecm',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Vehicle speed from telematics, ECM, or another motion feed.',
    example_value: '67',
  },
  {
    feature_name: 'speed_over_limit_mph',
    feature_group: 'driver_state',
    source_layer: 'derived_from_joined_data',
    available_in_standard_eld: 'derived',
    data_type: 'number',
    description: 'Current speed minus joined speed limit.',
    example_value: '9',
  },
  {
    feature_name: 'time_since_last_break_min',
    feature_group: 'driver_state',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'number',
    description: 'Minutes since the last logged break or off-duty period.',
    example_value: '191',
  },
  {
    feature_name: 'continuous_drive_min',
    feature_group: 'driver_state',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'number',
    description: 'Continuous driving minutes since the last non-driving status.',
    example_value: '143',
  },
  {
    feature_name: 'hos_drive_remaining_min',
    feature_group: 'driver_state',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'number',
    description: 'Minutes remaining before the driver hits the driving limit.',
    example_value: '177',
  },
  {
    feature_name: 'hos_shift_remaining_min',
    feature_group: 'driver_state',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'number',
    description: 'Minutes remaining before the driver hits the on-duty shift limit.',
    example_value: '283',
  },
  {
    feature_name: 'hos_cycle_remaining_min',
    feature_group: 'driver_state',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'number',
    description: 'Minutes remaining in the rolling duty cycle window.',
    example_value: '1950',
  },
  {
    feature_name: 'prior_hard_brake_events_24h',
    feature_group: 'driver_state',
    source_layer: 'telematics_or_ecm',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Count of hard brake detections in the trailing 24 hours.',
    example_value: '2',
  },
  {
    feature_name: 'prior_harsh_accel_events_24h',
    feature_group: 'driver_state',
    source_layer: 'telematics_or_ecm',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Count of harsh acceleration events in the trailing 24 hours.',
    example_value: '1',
  },
  {
    feature_name: 'prior_hos_violation_count_30d',
    feature_group: 'driver_state',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'number',
    description: 'Count of recent HOS violations used as historical context.',
    example_value: '1',
  },
  {
    feature_name: 'driver_tenure_days',
    feature_group: 'driver_state',
    source_layer: 'carrier_master_data',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Days since the driver joined the carrier or program.',
    example_value: '58',
  },
  {
    feature_name: 'scored_trip_count',
    feature_group: 'driver_state',
    source_layer: 'derived_from_internal_history',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Number of previously scored trips available for calibration.',
    example_value: '18',
  },
  {
    feature_name: 'cold_start_driver',
    feature_group: 'driver_state',
    source_layer: 'derived_from_internal_history',
    available_in_standard_eld: 'no',
    data_type: 'boolean',
    description: 'True when the driver has fewer than 30 scored trips.',
    example_value: 'true',
  },
  {
    feature_name: 'engine_on',
    feature_group: 'vehicle_state',
    source_layer: 'standard_eld',
    available_in_standard_eld: 'yes',
    data_type: 'boolean',
    description: 'Engine power status from the ELD.',
    example_value: 'true',
  },
  {
    feature_name: 'engine_hours',
    feature_group: 'vehicle_state',
    source_layer: 'standard_eld',
    available_in_standard_eld: 'yes',
    data_type: 'number',
    description: 'Accumulated engine hours from the ELD or ECM.',
    example_value: '12418.7',
  },
  {
    feature_name: 'odometer_miles',
    feature_group: 'vehicle_state',
    source_layer: 'standard_eld',
    available_in_standard_eld: 'yes',
    data_type: 'number',
    description: 'Accumulated vehicle miles.',
    example_value: '522944',
  },
  {
    feature_name: 'idle_time_min',
    feature_group: 'vehicle_state',
    source_layer: 'derived_from_eld',
    available_in_standard_eld: 'derived',
    data_type: 'number',
    description: 'Estimated idle minutes in the trailing window.',
    example_value: '27',
  },
  {
    feature_name: 'fuel_level_pct',
    feature_group: 'vehicle_state',
    source_layer: 'telematics_or_ecm',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Fuel level from telematics or engine data.',
    example_value: '36',
  },
  {
    feature_name: 'tire_pressure_alert_count',
    feature_group: 'vehicle_state',
    source_layer: 'tpms_or_maintenance',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Count of active tire pressure alerts.',
    example_value: '1',
  },
  {
    feature_name: 'brake_health_score',
    feature_group: 'vehicle_state',
    source_layer: 'maintenance_system',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Maintenance score for brakes on a 0 to 100 scale.',
    example_value: '81',
  },
  {
    feature_name: 'maintenance_overdue_days',
    feature_group: 'vehicle_state',
    source_layer: 'maintenance_system',
    available_in_standard_eld: 'no',
    data_type: 'number',
    description: 'Days overdue for a maintenance interval or inspection.',
    example_value: '14',
  },
  {
    feature_name: 'check_engine_active',
    feature_group: 'vehicle_state',
    source_layer: 'telematics_or_fault_codes',
    available_in_standard_eld: 'no',
    data_type: 'boolean',
    description: 'True when a check-engine condition is active.',
    example_value: 'false',
  },
  {
    feature_name: 'abs_fault_active',
    feature_group: 'vehicle_state',
    source_layer: 'telematics_or_fault_codes',
    available_in_standard_eld: 'no',
    data_type: 'boolean',
    description: 'True when an ABS fault is active.',
    example_value: 'false',
  },
  {
    feature_name: 'risk_score',
    feature_group: 'label',
    source_layer: 'synthetic_rules_engine',
    available_in_standard_eld: 'n/a',
    data_type: 'number',
    description: 'Synthetic risk score from 0 to 100 produced for mock experimentation.',
    example_value: '68',
  },
  {
    feature_name: 'risk_band',
    feature_group: 'label',
    source_layer: 'synthetic_rules_engine',
    available_in_standard_eld: 'n/a',
    data_type: 'string',
    description: 'Bucketed version of the risk score.',
    example_value: 'high',
  },
  {
    feature_name: 'risk_event_next_2h',
    feature_group: 'label',
    source_layer: 'synthetic_rules_engine',
    available_in_standard_eld: 'n/a',
    data_type: 'boolean',
    description: 'Synthetic target flag indicating an elevated event likelihood within two hours.',
    example_value: 'true',
  },
  {
    feature_name: 'intervention_recommendation',
    feature_group: 'label',
    source_layer: 'synthetic_rules_engine',
    available_in_standard_eld: 'n/a',
    data_type: 'string',
    description: 'Plain-English intervention suggestion tied to the top risk factor.',
    example_value: 'prompt_break',
  },
  {
    feature_name: 'primary_risk_reason',
    feature_group: 'label',
    source_layer: 'synthetic_rules_engine',
    available_in_standard_eld: 'n/a',
    data_type: 'string',
    description: 'Dominant explainability reason for the risk score.',
    example_value: 'fatigue_low_hos',
  },
  {
    feature_name: 'secondary_risk_reason',
    feature_group: 'label',
    source_layer: 'synthetic_rules_engine',
    available_in_standard_eld: 'n/a',
    data_type: 'string',
    description: 'Second-most-important explainability reason for the risk score.',
    example_value: 'wet_or_low_visibility',
  },
]

function buildWeatherMetrics(weatherCondition, localMonth) {
  switch (weatherCondition) {
    case 'clear':
      return {
        temperatureF: randFloat(48, 92, 1),
        precipitationIn: 0,
        visibilityMiles: randFloat(8, 10, 1),
        windSpeedMph: randFloat(2, 16, 1),
      }
    case 'heat':
      return {
        temperatureF: randFloat(92, 108, 1),
        precipitationIn: 0,
        visibilityMiles: randFloat(7, 10, 1),
        windSpeedMph: randFloat(3, 18, 1),
      }
    case 'windy':
      return {
        temperatureF: randFloat(42, 88, 1),
        precipitationIn: 0,
        visibilityMiles: randFloat(6, 10, 1),
        windSpeedMph: randFloat(18, 34, 1),
      }
    case 'rain':
      return {
        temperatureF: randFloat(38, 74, 1),
        precipitationIn: randFloat(0.04, 0.35, 2),
        visibilityMiles: randFloat(1.5, 6.5, 1),
        windSpeedMph: randFloat(8, 24, 1),
      }
    case 'snow':
      return {
        temperatureF: randFloat(14, 33, 1),
        precipitationIn: randFloat(0.03, 0.22, 2),
        visibilityMiles: randFloat(0.5, 4.5, 1),
        windSpeedMph: randFloat(6, 22, 1),
      }
    case 'fog':
      return {
        temperatureF: randFloat(localMonth <= 3 ? 24 : 38, 58, 1),
        precipitationIn: randFloat(0, 0.03, 2),
        visibilityMiles: randFloat(0.3, 2.4, 1),
        windSpeedMph: randFloat(1, 9, 1),
      }
    case 'dust':
      return {
        temperatureF: randFloat(55, 95, 1),
        precipitationIn: 0,
        visibilityMiles: randFloat(0.8, 4.5, 1),
        windSpeedMph: randFloat(14, 30, 1),
      }
    default:
      return {
        temperatureF: randFloat(45, 75, 1),
        precipitationIn: 0,
        visibilityMiles: randFloat(6, 10, 1),
        windSpeedMph: randFloat(3, 12, 1),
      }
  }
}

function buildSpeed(driverDutyStatus, speedLimitMph, trafficLevel, roadClass) {
  if (driverDutyStatus !== 'driving') {
    return randInt(0, 12)
  }

  const trafficPenalty = {
    light: randInt(0, 5),
    moderate: randInt(3, 10),
    heavy: randInt(8, 18),
    stop_and_go: randInt(15, 26),
  }[trafficLevel]

  const roadBias = roadClass === 'local_road' ? randInt(-6, 5) : roadClass === 'mountain_pass' ? randInt(-10, 3) : randInt(-3, 8)
  const burst = random() < 0.26 ? randInt(4, 13) : randInt(-4, 5)

  return clamp(speedLimitMph - trafficPenalty + roadBias + burst, 0, 84)
}

function buildIntervention(primaryReason, riskBand) {
  if (riskBand === 'critical') {
    return 'dispatcher_call_now'
  }

  if (primaryReason === 'fatigue_low_hos') {
    return 'prompt_break'
  }

  if (primaryReason === 'vehicle_condition') {
    return 'vehicle_check'
  }

  if (primaryReason === 'wet_or_low_visibility') {
    return 'slow_for_conditions'
  }

  if (primaryReason === 'urban_congestion') {
    return 'reduce_speed_in_traffic'
  }

  if (primaryReason === 'speeding') {
    return 'coach_speed'
  }

  return riskBand === 'low' ? 'monitor_only' : 'dispatcher_review'
}

function pickRiskBand(score) {
  if (score >= 80) {
    return 'critical'
  }
  if (score >= 60) {
    return 'high'
  }
  if (score >= 35) {
    return 'medium'
  }
  return 'low'
}

function buildTripId(index) {
  const bucket = String(Math.floor(index / 6) + 1).padStart(3, '0')
  return `trip_2026_${bucket}`
}

function buildSnapshot(index) {
  const driver = pick(drivers)
  const scenario = pickScenarioForDriver(driver)
  const vehicle = pick(vehicles)

  const date = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))
  date.setUTCDate(date.getUTCDate() + randInt(0, 108))
  date.setUTCHours(randInt(0, 23), pick([0, 10, 15, 20, 30, 40, 45, 50]), 0, 0)

  const { dayOfWeek, localHour, localMonth } = getLocalDateParts(date, scenario.timeZone)
  const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun'

  const latitude = randFloat(scenario.latRange[0], scenario.latRange[1], 4)
  const longitude = randFloat(scenario.lonRange[0], scenario.lonRange[1], 4)
  const roadClass = weightedPick(scenario.roadClassWeights)
  const weatherCondition = weightedPick(scenario.weatherWeights)
  const trafficLevel = weightedPick(scenario.trafficWeights)
  const roadSurface = roadSurfaceByWeather[weatherCondition]
  const speedLimitMph = roundToNearest(randInt(...speedLimitRanges[roadClass]), 5)
  const dutyStatus = random() < 0.88 ? 'driving' : 'on_duty_not_driving'
  const speedMph = buildSpeed(dutyStatus, speedLimitMph, trafficLevel, roadClass)
  const speedOverLimitMph = clamp(speedMph - speedLimitMph, 0, 30)

  const timeSinceLastBreakMin = dutyStatus === 'driving' ? randInt(15, 510) : randInt(0, 120)
  const continuousDriveMin = dutyStatus === 'driving' ? clamp(timeSinceLastBreakMin - randInt(0, 40), 5, 490) : randInt(0, 45)
  const hosDriveRemainingMin = clamp(660 - continuousDriveMin - randInt(0, 200), 0, 660)
  const hosShiftRemainingMin = clamp(840 - timeSinceLastBreakMin - randInt(20, 260), 0, 840)
  const hosCycleRemainingMin = clamp(randInt(720, 3600) - driver.priorHosViolationCount30d * 120, 0, 4200)

  const weatherMetrics = buildWeatherMetrics(weatherCondition, localMonth)
  const priorHardBrakeEvents24h = clamp(Math.round(speedOverLimitMph / 4) + randInt(0, 3) + (trafficLevel === 'stop_and_go' ? 2 : 0), 0, 9)
  const priorHarshAccelEvents24h = clamp(Math.round(speedOverLimitMph / 5) + randInt(0, 3), 0, 7)
  const coldStartDriver = driver.scoredTripCount < 30

  const engineOn = true
  const engineHours = Number((vehicle.baseEngineHours + randFloat(0, 420, 1)).toFixed(1))
  const odometerMiles = vehicle.baseOdometerMiles + randInt(0, 6800)
  const idleTimeMin = trafficLevel === 'stop_and_go' ? randInt(18, 75) : randInt(4, 42)
  const fuelLevelPct = clamp(randInt(8, 97) - (weatherCondition === 'heat' ? 4 : 0), 5, 99)
  const tirePressureAlertCount = clamp((weatherCondition === 'heat' || weatherCondition === 'snow' ? 1 : 0) + (random() < 0.18 ? 1 : 0) + (random() < 0.04 ? 1 : 0), 0, 3)
  const brakeHealthScore = clamp(vehicle.brakeBaseline - randInt(0, 10) - priorHardBrakeEvents24h, 55, 95)
  const maintenanceOverdueDays = clamp(vehicle.maintenanceBaseline + randInt(-3, 18) + tirePressureAlertCount * 2, 0, 45)
  const checkEngineActive = random() < (maintenanceOverdueDays > 18 ? 0.22 : 0.07)
  const absFaultActive = random() < (brakeHealthScore < 78 ? 0.16 : 0.03)

  const contributions = [
    { reason: 'speeding', points: speedOverLimitMph * 1.45 },
    {
      reason: 'fatigue_low_hos',
      points:
        Math.max(0, continuousDriveMin - 240) * 0.11 +
        Math.max(0, 60 - hosDriveRemainingMin) * 0.24 +
        Math.max(0, 120 - hosShiftRemainingMin) * 0.08,
    },
    {
      reason: 'wet_or_low_visibility',
      points:
        weatherSeverity[weatherCondition] * 0.8 +
        Math.max(0, 5 - weatherMetrics.visibilityMiles) * 1.7 +
        (roadSurface === 'wet' || roadSurface === 'snow_packed' ? 3 : 0),
    },
    {
      reason: 'urban_congestion',
      points: trafficSeverity[trafficLevel] * 0.85 + roadClassSeverity[roadClass] * 0.65 + idleTimeMin * 0.03,
    },
    {
      reason: 'vehicle_condition',
      points:
        tirePressureAlertCount * 4 +
        Math.max(0, 85 - brakeHealthScore) * 0.35 +
        maintenanceOverdueDays * 0.28 +
        (checkEngineActive ? 6 : 0) +
        (absFaultActive ? 8 : 0) +
        (fuelLevelPct < 15 ? 3 : 0),
    },
    {
      reason: 'history_pattern',
      points:
        priorHardBrakeEvents24h * 1.2 +
        priorHarshAccelEvents24h * 0.9 +
        driver.priorHosViolationCount30d * 3.5,
    },
    { reason: 'nighttime', points: localHour >= 22 || localHour <= 4 ? 6 : localHour >= 5 && localHour <= 6 ? 2 : 0 },
  ]

  let riskScore = 8 + contributions.reduce((sum, item) => sum + item.points, 0)
  if (coldStartDriver) {
    riskScore += 2
  }
  if (isWeekend && trafficLevel !== 'light') {
    riskScore += 2
  }
  if (dutyStatus !== 'driving') {
    riskScore *= 0.76
  }

  riskScore = Math.round(clamp(riskScore, 4, 98))
  const riskBand = pickRiskBand(riskScore)
  const sortedReasons = [...contributions].sort((left, right) => right.points - left.points)
  const primaryRiskReason = sortedReasons[0].reason
  const secondaryRiskReason = sortedReasons[1].reason

  const eventProbability = clamp(
    0.01 + riskScore / 250 + speedOverLimitMph * 0.0025 + (weatherCondition === 'snow' || weatherCondition === 'fog' ? 0.035 : 0),
    0.01,
    0.55,
  )
  const riskEventNext2h = random() < eventProbability

  return {
    row_id: `snap_${String(index + 1).padStart(4, '0')}`,
    event_timestamp_utc: date.toISOString(),
    local_time_zone: scenario.timeZone,
    local_hour: localHour,
    day_of_week: dayOfWeek,
    is_weekend: isWeekend,
    driver_id: driver.driverId,
    vehicle_id: vehicle.vehicleId,
    trip_id: buildTripId(index),
    scenario_id: scenario.scenarioId,
    latitude,
    longitude,
    metro_area: scenario.metroArea,
    state_code: scenario.stateCode,
    road_class: roadClass,
    road_surface: roadSurface,
    speed_limit_mph: speedLimitMph,
    weather_condition: weatherCondition,
    temperature_f: weatherMetrics.temperatureF,
    precipitation_in: weatherMetrics.precipitationIn,
    visibility_miles: weatherMetrics.visibilityMiles,
    wind_speed_mph: weatherMetrics.windSpeedMph,
    traffic_level: trafficLevel,
    duty_status: dutyStatus,
    speed_mph: speedMph,
    speed_over_limit_mph: speedOverLimitMph,
    time_since_last_break_min: timeSinceLastBreakMin,
    continuous_drive_min: continuousDriveMin,
    hos_drive_remaining_min: hosDriveRemainingMin,
    hos_shift_remaining_min: hosShiftRemainingMin,
    hos_cycle_remaining_min: hosCycleRemainingMin,
    prior_hard_brake_events_24h: priorHardBrakeEvents24h,
    prior_harsh_accel_events_24h: priorHarshAccelEvents24h,
    prior_hos_violation_count_30d: driver.priorHosViolationCount30d,
    driver_tenure_days: driver.tenureDays,
    scored_trip_count: driver.scoredTripCount,
    cold_start_driver: coldStartDriver,
    engine_on: engineOn,
    engine_hours: engineHours,
    odometer_miles: odometerMiles,
    idle_time_min: idleTimeMin,
    fuel_level_pct: fuelLevelPct,
    tire_pressure_alert_count: tirePressureAlertCount,
    brake_health_score: brakeHealthScore,
    maintenance_overdue_days: maintenanceOverdueDays,
    check_engine_active: checkEngineActive,
    abs_fault_active: absFaultActive,
    risk_score: riskScore,
    risk_band: riskBand,
    risk_event_next_2h: riskEventNext2h,
    intervention_recommendation: buildIntervention(primaryRiskReason, riskBand),
    primary_risk_reason: primaryRiskReason,
    secondary_risk_reason: secondaryRiskReason,
  }
}

const datasetRows = Array.from({ length: requestedRowCount }, (_, index) => buildSnapshot(index))

await mkdir(dataDir, { recursive: true })
await writeFile(path.join(dataDir, 'eld_risk_feature_catalog.csv'), toCsv(featureCatalog))
await writeFile(path.join(dataDir, 'eld_risk_training_mock.csv'), toCsv(datasetRows))

console.log(
  `Generated ${datasetRows.length} mock driver snapshots using ${drivers.length} drivers and ${vehicles.length} vehicles in ${dataDir}`,
)

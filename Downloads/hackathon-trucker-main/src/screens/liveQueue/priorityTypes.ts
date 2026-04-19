export type PriorityStatus = 'CRITICAL' | 'ALERT' | 'SAFE'

export type PriorityEntry = {
  id: string
  name: string
  initials: string
  truckId: string
  location: string
  routeLabel: string
  hosRemaining: string
  score: number
  status: PriorityStatus
  reason: string
  speedMph: number
  speedLimitMph: number
  trafficLevel: string
  weatherCondition: string
  continuousDriveMin: number
  timeSinceLastBreakMin: number
  hosDriveRemainingMin: number
  hosShiftRemainingMin: number
  brakeHealthScore: number
  tirePressureAlertCount: number
  maintenanceOverdueDays: number
  fuelLevelPct: number
  trendScore: number
  trendDelta: number
}

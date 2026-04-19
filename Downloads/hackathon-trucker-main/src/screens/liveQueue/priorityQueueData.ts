import { normalizePlaybackSecond } from '../../mocks/driverMapPlayback'
import { driverRiskSimulation, simulationMeta } from '../../mocks/driverRiskSimulation'
import type { RiskBand } from '../../mocks/driverRiskSimulation'
import type { PriorityEntry, PriorityStatus } from './priorityTypes'

export function bandToStatus(band: RiskBand): PriorityStatus {
  if (band === 'red') return 'CRITICAL'
  if (band === 'yellow') return 'ALERT'
  return 'SAFE'
}

export function formatHOS(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}h ${m}m Rem.`
}

function buildPriorityEntriesAtSecond(second: number): PriorityEntry[] {
  const idx = normalizePlaybackSecond(second)
  return [...driverRiskSimulation]
    .map(({ driver, snapshots }) => {
      const latest = snapshots[idx]
      const prev = snapshots[Math.max(idx - 16, 0)]
      const routeShort = driver.routeLabel.split(' / ')[0] ?? driver.routeLabel
      return {
        id: driver.id,
        name: driver.name,
        initials: driver.initials,
        truckId: driver.vehicleLabel,
        location: routeShort,
        routeLabel: driver.routeLabel,
        hosRemaining: formatHOS(latest.hosDriveRemainingMin),
        score: latest.riskScore,
        status: bandToStatus(latest.riskBand),
        reason: latest.shortExplanation,
        speedMph: latest.speedMph,
        speedLimitMph: latest.speedLimitMph,
        trafficLevel: latest.trafficLevel,
        weatherCondition: latest.weatherCondition,
        continuousDriveMin: latest.continuousDriveMin,
        timeSinceLastBreakMin: latest.timeSinceLastBreakMin,
        hosDriveRemainingMin: latest.hosDriveRemainingMin,
        hosShiftRemainingMin: latest.hosShiftRemainingMin,
        brakeHealthScore: latest.brakeHealthScore,
        tirePressureAlertCount: latest.tirePressureAlertCount,
        maintenanceOverdueDays: latest.maintenanceOverdueDays,
        fuelLevelPct: latest.fuelLevelPct,
        trendScore: prev.riskScore,
        trendDelta: latest.riskScore - prev.riskScore,
      }
    })
    .sort((a, b) => b.score - a.score)
}

/** Priority rows for a given demo playback second (same timeline as the fleet map). */
export function getPriorityQueueAtSecond(second: number): PriorityEntry[] {
  return buildPriorityEntriesAtSecond(second)
}

/** End-of-playback snapshot; used where a single static ordering is enough (e.g. risk summary tiles). */
export const PRIORITY_QUEUE_DATA: PriorityEntry[] = buildPriorityEntriesAtSecond(
  simulationMeta.playbackSeconds - 1,
)

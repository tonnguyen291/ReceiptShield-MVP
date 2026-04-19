import type { ReactNode } from 'react'
import { useState } from 'react'
import { LatLngMap } from '../../components/LatLngMap'
import type { DriverMarker, RoutePin } from '../../components/LatLngMap'
import { EditIcon } from '../../components/icons/AppIcons'
import { useNotice } from '../../context/NoticeToastContext'
import { getDriverPhone } from '../../lib/driverPhones'
import { ROADMAP_NOTICE } from '../../lib/roadmap'
import { getDriverDetailUiFields } from '../../mocks/driverDetailUiFields'
import { driverTripPlansById, getDriverRoutePath } from '../../mocks/driverMapPlayback'
import { driverSnapshotsById } from '../../mocks/driverRiskSimulation'
import { formatHOS } from './priorityQueueData'
import type { PriorityEntry } from './priorityTypes'
import { STATUS_META, TRAFFIC_LABEL, WEATHER_LABEL } from './liveQueueUiConstants'
import { RiskFactorCard, RiskPieChart } from './riskUi'

type DetailTab = 'basic-info' | 'trip-history' | 'profile' | 'documents' | 'details'

function clampN(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi)
}

export function DriverDetailPage({
  entry,
  onBack,
  initialTab = 'basic-info',
  backLabel = 'Drivers',
}: {
  entry: PriorityEntry
  onBack: () => void
  /** When opening from Risk Management, land on the full risk breakdown first. */
  initialTab?: DetailTab
  /** Breadcrumb label for the back control (e.g. "Risk Management", "Drivers at risk"). */
  backLabel?: string
}) {
  const { showNotice } = useNotice()
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab)
  const snapshots = driverSnapshotsById[entry.id] ?? []

  const tripPlan = driverTripPlansById[entry.id]
  const fullRoutePath = getDriverRoutePath(entry.id)
  const completedRoutePath: [number, number][] = snapshots.map((s) => [s.lat, s.lng])

  const startPin: RoutePin | undefined = tripPlan
    ? {
        lat: tripPlan.pickupStop.lat,
        lng: tripPlan.pickupStop.lng,
        label: tripPlan.pickupStop.label,
        sublabel: tripPlan.pickupStop.cityLabel,
      }
    : undefined

  const endPin: RoutePin | undefined = tripPlan
    ? {
        lat: tripPlan.dropoffStop.lat,
        lng: tripPlan.dropoffStop.lng,
        label: tripPlan.dropoffStop.label,
        sublabel: tripPlan.dropoffStop.cityLabel,
      }
    : undefined
  const latest = snapshots[snapshots.length - 1]
  const meta = STATUS_META[entry.status]

  const driverMarker: DriverMarker[] = latest
    ? [
        {
          id: entry.id,
          lat: latest.lat,
          lng: latest.lng,
          name: entry.name,
          initials: entry.initials,
          status:
            entry.status === 'CRITICAL'
              ? 'busy'
              : entry.status === 'ALERT'
                ? 'offline'
                : 'available',
        },
      ]
    : []

  const hosRisk = Math.round(
    clampN((160 - entry.hosDriveRemainingMin) * 0.16, 0, 22) +
      clampN((220 - entry.hosShiftRemainingMin) * 0.07, 0, 10),
  )
  const fatigueRisk = Math.round(
    clampN((entry.continuousDriveMin - 90) * 0.11, 0, 16) +
      clampN((entry.timeSinceLastBreakMin - 120) * 0.07, 0, 10),
  )
  const speedRisk = Math.round(clampN((entry.speedMph - entry.speedLimitMph) * 2.3, 0, 20))
  const trafficRiskScore =
    ({ light: 0, moderate: 8, heavy: 16, 'stop-and-go': 24 } as Record<string, number>)[
      entry.trafficLevel
    ] ?? 0
  const weatherRiskScore =
    ({ clear: 0, windy: 3, rain: 8, fog: 12, dust: 10 } as Record<string, number>)[
      entry.weatherCondition
    ] ?? 0
  const vehicleRisk = Math.round(
    clampN((88 - entry.brakeHealthScore) * 0.35, 0, 12) +
      clampN(entry.tirePressureAlertCount * 4.5, 0, 9) +
      clampN(entry.maintenanceOverdueDays * 0.45, 0, 10) +
      clampN((25 - entry.fuelLevelPct) * 0.3, 0, 6),
  )

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'basic-info', label: 'Basic Info' },
    { id: 'trip-history', label: 'Trip History' },
    { id: 'profile', label: 'Profile' },
    { id: 'documents', label: 'Documents' },
    { id: 'details', label: 'Risk Details' },
  ]

  const email = `${entry.name
    .split(' ')
    .map((n) => n[0])
    .join('.')
    .toLowerCase()}@fleets.com`

  const phone = getDriverPhone(entry.id)
  const ui = getDriverDetailUiFields(entry.id)

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#f4f6fa]">
      <div className="flex items-center justify-between border-b border-[#ebeff7] bg-white px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-[#6b7794] transition-colors hover:text-[#2f3850]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[1em] w-[1em]">
            <path d="m15 6-6 6 6 6" />
          </svg>
          {backLabel}
        </button>
        <button
          type="button"
          onClick={() => showNotice(ROADMAP_NOTICE)}
          className="flex items-center gap-2 rounded-[6px] bg-[#2f6fe0] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#2562c7]"
        >
          <EditIcon />
          EDIT PROFILE
        </button>
      </div>

      <div className="border-b border-[#ebeff7] bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#e8ecf5] text-[15px] font-bold text-[#4f5c73]">
              {entry.initials}
            </div>
            <div>
              <p className="text-[18px] font-bold text-[#2f3850]">{entry.name}</p>
              <p className="text-[12px] text-[#93a4c4]">Carrier: Trucker Path</p>
            </div>
          </div>

          {(
            [
              {
                label: 'Status',
                value: (
                  <span
                    className="rounded-[4px] px-2 py-0.5 text-[12px] font-semibold"
                    style={{ backgroundColor: `${meta.dotColor}18`, color: meta.color }}
                  >
                    {entry.status === 'SAFE' ? 'Available' : meta.label}
                  </span>
                ),
              },
              {
                label: 'Owner',
                value: <span className="text-[13px] font-semibold text-[#2f3850]">Trailer Swift ASU</span>,
              },
              { label: 'Terminal', value: <span className="text-[13px] text-[#93a4c4]">--</span> },
              {
                label: 'Driver Type',
                value: <span className="text-[13px] font-semibold text-[#2f3850]">Company Driver (CM)</span>,
              },
              {
                label: 'Phone Number',
                value: <span className="text-[13px] text-[#2f3850]">{phone}</span>,
              },
              {
                label: 'Email',
                value: <span className="text-[13px] text-[#2f6fe0]">{email}</span>,
              },
              {
                label: 'Trucks',
                value: <span className="text-[13px] font-semibold text-[#2f3850]">{entry.truckId}</span>,
              },
            ] satisfies { label: string; value: ReactNode }[]
          ).map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#93a4c4]">
                {label}
              </span>
              {value}
            </div>
          ))}
        </div>
      </div>

      <div className="flex border-b border-[#ebeff7] bg-white px-6">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`relative px-4 py-3 text-[14px] font-semibold transition-colors ${
              activeTab === id ? 'text-[#2f6fe0]' : 'text-[#6b7794] hover:text-[#2f3850]'
            }`}
          >
            {label}
            {activeTab === id ? (
              <span className="absolute right-4 bottom-0 left-4 h-[3px] rounded-tl-[3px] rounded-tr-[3px] bg-[#2f6fe0]" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'basic-info' ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
              <p className="mb-3 text-[14px] font-bold text-[#2f3850]">Last Known Location</p>
              <p className="text-[13px] font-semibold text-[#4f5c73]">{entry.location}</p>
              <p className="mt-1 text-[12px] text-[#8a99b8]">{entry.routeLabel}</p>
              <p className="mt-2 text-[12px] text-[#93a4c4]">Latest Update: just now</p>
            </div>

            <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[14px] font-bold text-[#2f3850]">
                  Current Load/Trip:{' '}
                  <span className="font-normal text-[#2f6fe0]">LD-{ui.loadDigits}</span>
                </p>
                <span className="rounded-full bg-[#edfaf3] px-2.5 py-0.5 text-[11px] font-semibold text-[#22a559]">
                  En Route
                </span>
              </div>
              <div className="flex flex-col gap-1.5 text-[12px] text-[#4f5c73]">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] text-[#22a559]">⊕</span>
                  {ui.pickupLine}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[14px] text-[#e84040]">⊕</span>
                  {ui.dropoffLine}
                </span>
                <div className="mt-2 flex items-center justify-between border-t border-[#f0f3f9] pt-2">
                  <span className="text-[#8a99b8]">ETA</span>
                  <span className="font-semibold text-[#2f3850]">{ui.eta}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8a99b8]">Distance rem.</span>
                  <span className="font-semibold text-[#2f3850]">{ui.distanceRem}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
              <p className="mb-3 text-[14px] font-bold text-[#2f3850]">Fleet Payments</p>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0f3f9] text-[16px]">
                  💳
                </div>
                <p className="text-[12px] leading-[1.5] text-[#6b7794]">
                  Unlock Fleet Fuel and save money on fuel.{' '}
                  <button
                    type="button"
                    onClick={() => showNotice('More info on Fleet Fuel coming in full release.')}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[#2f6fe0] underline"
                  >
                    Learn more
                  </button>
                </p>
              </div>
              <button
                type="button"
                onClick={() => showNotice(ROADMAP_NOTICE)}
                className="mt-3 rounded-[6px] bg-[#2f6fe0] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#2562c7]"
              >
                Set Up
              </button>
            </div>

            <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[14px] font-bold text-[#2f3850]">Driver Activity</p>
                <button
                  type="button"
                  onClick={() => showNotice(ROADMAP_NOTICE)}
                  className="flex items-center gap-1 text-[12px] text-[#2f6fe0]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1em] w-[1em]">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                  LIST
                </button>
              </div>
              <div className="text-[12px] text-[#6b7794]">
                <span className="text-[#93a4c4]">Apr 19, 2026</span>
                {'  '}
                {entry.name} joined <span className="font-semibold text-[#2f3850]"># Trucker Path Fleets</span>
              </div>
            </div>

            <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[14px] font-bold text-[#2f3850]">Hours of Service</p>
                <button
                  type="button"
                  onClick={() => showNotice(ROADMAP_NOTICE)}
                  className="flex items-center gap-1 text-[12px] text-[#2f6fe0]"
                >
                  <EditIcon />
                  EDIT
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  {
                    label: 'Drive remaining',
                    v: formatHOS(entry.hosDriveRemainingMin),
                    warn: entry.hosDriveRemainingMin < 60,
                  },
                  {
                    label: 'Shift remaining',
                    v: formatHOS(entry.hosShiftRemainingMin),
                    warn: entry.hosShiftRemainingMin < 90,
                  },
                  {
                    label: 'Continuous drive',
                    v: `${Math.round(entry.continuousDriveMin)} min`,
                    warn: entry.continuousDriveMin > 120,
                  },
                  {
                    label: 'Since last break',
                    v: `${Math.round(entry.timeSinceLastBreakMin)} min`,
                    warn: entry.timeSinceLastBreakMin > 150,
                  },
                ].map(({ label, v, warn }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12px] text-[#8a99b8]">{label}</span>
                    <span className={`text-[12px] font-semibold ${warn ? 'text-[#e84040]' : 'text-[#2f3850]'}`}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[10px] border border-[#ebeff7]" style={{ height: 260 }}>
              <LatLngMap
                routePath={fullRoutePath}
                completedRoutePath={completedRoutePath}
                startPin={startPin}
                endPin={endPin}
                drivers={driverMarker}
                fillViewport
              />
            </div>
          </div>
        ) : null}

        {activeTab === 'details' ? (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-[11px] font-medium text-[#93a4c4]">
              Illustrative demo breakdown — not a validated production risk model.
            </p>
            <div
              className={`flex items-center gap-4 rounded-[10px] p-4 ${
                entry.status === 'CRITICAL'
                  ? 'bg-[#fdeaea]'
                  : entry.status === 'ALERT'
                    ? 'bg-[#fff3e0]'
                    : 'bg-[#edfaf3]'
              }`}
            >
              <div className="flex flex-col">
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                  style={{ color: meta.color }}
                >
                  Overall Risk Score
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[48px] font-bold leading-none text-[#2f3850]">{entry.score}</span>
                  <span className="text-[16px] font-bold" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
              </div>
              <div className="ml-6 flex flex-1 items-center gap-5">
                <RiskPieChart
                  size={110}
                  slices={[
                    { label: 'Driver Fatigue', value: fatigueRisk, color: '#8b5cf6' },
                    { label: 'Hours of Service', value: hosRisk, color: '#f59e0b' },
                    { label: 'Speed & Road', value: speedRisk, color: '#2f6fe0' },
                    { label: 'Traffic', value: trafficRiskScore, color: '#14b8a6' },
                    { label: 'Weather', value: weatherRiskScore, color: '#06b6d4' },
                    { label: 'Vehicle Health', value: vehicleRisk, color: '#ec4899' },
                  ]}
                />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {[
                      { label: 'Driver Fatigue', value: fatigueRisk, color: '#8b5cf6' },
                      { label: 'Hours of Service', value: hosRisk, color: '#f59e0b' },
                      { label: 'Speed & Road', value: speedRisk, color: '#2f6fe0' },
                      { label: 'Traffic', value: trafficRiskScore, color: '#14b8a6' },
                      { label: 'Weather', value: weatherRiskScore, color: '#06b6d4' },
                      { label: 'Vehicle Health', value: vehicleRisk, color: '#ec4899' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center gap-2 text-[12px] text-[#4f5c73]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
                        <span className="flex-1 truncate">{label}</span>
                        <span className="font-semibold text-[#2f3850]">{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[12px] leading-[1.5] text-[#6b7794]">{entry.reason}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[11px] text-[#93a4c4]">30 min ago</span>
                <span
                  className={`text-[14px] font-bold ${
                    entry.trendDelta < 0
                      ? 'text-[#e84040]'
                      : entry.trendDelta > 0
                        ? 'text-[#22a559]'
                        : 'text-[#93a4c4]'
                  }`}
                >
                  {entry.trendScore}{' '}
                  {entry.trendDelta > 0 ? `+${entry.trendDelta}` : entry.trendDelta === 0 ? '—' : entry.trendDelta}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <RiskFactorCard
                title="Driver Fatigue"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
                    <path d="M3 20c0-4 4-7 9-7s9 3 9 7" />
                    <path d="M8 9h.01M16 9h.01" />
                    <path d="M9 13s1 2 3 2 3-2 3-2" />
                  </svg>
                }
                riskScore={fatigueRisk}
                details={[
                  {
                    label: 'Continuous drive',
                    value: `${Math.round(entry.continuousDriveMin)} min`,
                    warn: entry.continuousDriveMin > 120,
                  },
                  {
                    label: 'Time since break',
                    value: `${Math.round(entry.timeSinceLastBreakMin)} min`,
                    warn: entry.timeSinceLastBreakMin > 150,
                  },
                  {
                    label: 'Recommended break',
                    value: entry.timeSinceLastBreakMin > 120 ? 'Overdue' : 'On schedule',
                    warn: entry.timeSinceLastBreakMin > 120,
                  },
                ]}
              />

              <RiskFactorCard
                title="Hours of Service"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                }
                riskScore={hosRisk}
                details={[
                  {
                    label: 'Drive remaining',
                    value: formatHOS(entry.hosDriveRemainingMin),
                    warn: entry.hosDriveRemainingMin < 60,
                  },
                  {
                    label: 'Shift remaining',
                    value: formatHOS(entry.hosShiftRemainingMin),
                    warn: entry.hosShiftRemainingMin < 90,
                  },
                  {
                    label: 'HOS compliance',
                    value:
                      entry.hosDriveRemainingMin < 30
                        ? 'Critical'
                        : entry.hosDriveRemainingMin < 90
                          ? 'Warning'
                          : 'OK',
                    warn: entry.hosDriveRemainingMin < 90,
                  },
                ]}
              />

              <RiskFactorCard
                title="Speed & Road"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 2a10 10 0 1 0 10 10" />
                    <path d="m12 12 4-4" />
                    <circle cx="19" cy="5" r="2" />
                  </svg>
                }
                riskScore={speedRisk}
                details={[
                  { label: 'Current speed', value: `${Math.round(entry.speedMph)} mph`, warn: entry.speedMph > entry.speedLimitMph },
                  { label: 'Speed limit', value: `${entry.speedLimitMph} mph` },
                  {
                    label: 'Over limit by',
                    value:
                      entry.speedMph > entry.speedLimitMph
                        ? `${Math.round(entry.speedMph - entry.speedLimitMph)} mph`
                        : 'None',
                    warn: entry.speedMph > entry.speedLimitMph,
                  },
                ]}
              />

              <RiskFactorCard
                title="Traffic Conditions"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 17h16M7 12h4M7 7h6" />
                  </svg>
                }
                riskScore={trafficRiskScore}
                details={[
                  {
                    label: 'Traffic level',
                    value: TRAFFIC_LABEL[entry.trafficLevel] ?? entry.trafficLevel,
                    warn: trafficRiskScore >= 16,
                  },
                  {
                    label: 'Congestion risk',
                    value: trafficRiskScore >= 16 ? 'High' : trafficRiskScore >= 8 ? 'Moderate' : 'Low',
                    warn: trafficRiskScore >= 16,
                  },
                  { label: 'Route', value: entry.location },
                ]}
              />

              <RiskFactorCard
                title="Weather"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3v1M5.3 5.3l.7.7M3 12h1M5.3 18.7l.7-.7M12 20v1M18.7 18.7l-.7-.7M21 12h-1M18.7 5.3l-.7.7" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                }
                riskScore={weatherRiskScore}
                details={[
                  {
                    label: 'Condition',
                    value: WEATHER_LABEL[entry.weatherCondition] ?? entry.weatherCondition,
                    warn: weatherRiskScore >= 8,
                  },
                  {
                    label: 'Visibility impact',
                    value:
                      weatherRiskScore >= 10
                        ? 'Severe'
                        : weatherRiskScore >= 6
                          ? 'Significant'
                          : weatherRiskScore >= 3
                            ? 'Minor'
                            : 'None',
                    warn: weatherRiskScore >= 6,
                  },
                  {
                    label: 'Advisory',
                    value: weatherRiskScore >= 8 ? 'Slow down recommended' : 'No advisory',
                    warn: weatherRiskScore >= 8,
                  },
                ]}
              />

              <RiskFactorCard
                title="Vehicle Health"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <path d="M12 15v3" />
                  </svg>
                }
                riskScore={vehicleRisk}
                details={[
                  {
                    label: 'Brake health',
                    value: `${Math.round(entry.brakeHealthScore)}%`,
                    warn: entry.brakeHealthScore < 75,
                  },
                  {
                    label: 'Tire pressure alerts',
                    value: entry.tirePressureAlertCount > 0 ? `${entry.tirePressureAlertCount} active` : 'None',
                    warn: entry.tirePressureAlertCount > 0,
                  },
                  {
                    label: 'Maintenance',
                    value: entry.maintenanceOverdueDays > 0 ? `${entry.maintenanceOverdueDays}d overdue` : 'Current',
                    warn: entry.maintenanceOverdueDays > 0,
                  },
                  {
                    label: 'Fuel level',
                    value: `${Math.round(entry.fuelLevelPct)}%`,
                    warn: entry.fuelLevelPct < 20,
                  },
                ]}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  showNotice(
                    `Demo: automated driver report for ${entry.name}. Production would run this on the backend.`,
                  )
                }
                className="flex items-center gap-2 rounded-[8px] border border-[#dfe5f0] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#4f5c73] transition-all hover:border-[#cbd4e1] hover:bg-[#f3f6fb]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1em] w-[1em]">
                  <path d="M8 4h8l4 4v12H4V4Z" />
                  <path d="M12 4v4h4M8 12h8M8 16h6" />
                </svg>
                Generate Report
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === 'trip-history' ? (
          <div className="flex flex-col gap-3">
            {[
              {
                id: 'TRP-4821',
                date: 'Apr 18, 2026',
                from: 'Phoenix Distribution Center',
                to: 'Walmart DC #6094 Buckeye',
                miles: 38.4,
                duration: '52 min',
                status: 'Completed',
                score: entry.trendScore,
              },
              {
                id: 'TRP-4798',
                date: 'Apr 17, 2026',
                from: 'Maricopa Logistics Hub',
                to: 'Phoenix Distribution Center',
                miles: 26.1,
                duration: '38 min',
                status: 'Completed',
                score: Math.max(10, entry.trendScore - 5),
              },
              {
                id: 'TRP-4755',
                date: 'Apr 16, 2026',
                from: 'Sky Harbor Cargo',
                to: 'Maricopa Logistics Hub',
                miles: 44.7,
                duration: '1h 4min',
                status: 'Completed',
                score: Math.min(95, entry.trendScore + 8),
              },
              {
                id: 'TRP-4731',
                date: 'Apr 15, 2026',
                from: 'West Valley Depot',
                to: 'Sky Harbor Cargo',
                miles: 19.3,
                duration: '28 min',
                status: 'Completed',
                score: Math.max(10, entry.trendScore - 12),
              },
              {
                id: 'TRP-4690',
                date: 'Apr 14, 2026',
                from: 'Anthem Regional Freight',
                to: 'West Valley Depot',
                miles: 52.8,
                duration: '1h 18min',
                status: 'Completed',
                score: Math.min(95, entry.trendScore + 3),
              },
            ].map((trip) => (
              <div key={trip.id} className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#2f6fe0]">{trip.id}</span>
                      <span className="rounded-full bg-[#edfaf3] px-2 py-0.5 text-[10px] font-semibold text-[#22a559]">
                        {trip.status}
                      </span>
                      <span className="text-[11px] text-[#93a4c4]">{trip.date}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-[#4f5c73]">
                      <span className="text-[#22a559]">●</span>
                      <span className="truncate">{trip.from}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-[#4f5c73]">
                      <span className="text-[#e84040]">●</span>
                      <span className="truncate">{trip.to}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[12px]">
                    <span className="text-[20px] font-bold tabular-nums text-[#2f3850]">{trip.score}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#93a4c4]">
                      Risk Score
                    </span>
                    <span className="text-[11px] text-[#8a99b8]">
                      {trip.miles} mi · {trip.duration}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'profile' ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
              <p className="mb-3 text-[14px] font-bold text-[#2f3850]">Personal Information</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Full Name', value: entry.name },
                  { label: 'Driver ID', value: entry.id.toUpperCase() },
                  { label: 'Date of Birth', value: ui.dob },
                  { label: 'CDL Number', value: ui.cdlNumber },
                  { label: 'CDL Class', value: 'Class A' },
                  { label: 'CDL Expiry', value: ui.cdlExpiry },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12px] text-[#8a99b8]">{label}</span>
                    <span className="text-[12px] font-semibold text-[#2f3850]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
              <p className="mb-3 text-[14px] font-bold text-[#2f3850]">Certifications & Endorsements</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Hazmat', value: ui.hasHazmat ? '✓ Active' : '✗ Not held', ok: ui.hasHazmat },
                  { label: 'Tanker', value: '✓ Active', ok: true },
                  {
                    label: 'Doubles/Triples',
                    value: ui.hasDoubles ? '✓ Active' : '✗ Not held',
                    ok: ui.hasDoubles,
                  },
                  { label: 'Passenger', value: '✗ Not held', ok: false },
                  { label: 'Medical Certificate', value: 'Valid · Exp Aug 2026', ok: true },
                  { label: 'Safety Training', value: 'Completed Apr 2026', ok: true },
                ].map(({ label, value, ok }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12px] text-[#8a99b8]">{label}</span>
                    <span className={`text-[12px] font-semibold ${ok ? 'text-[#22a559]' : 'text-[#93a4c4]'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
              <p className="mb-3 text-[14px] font-bold text-[#2f3850]">Employment Details</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Hire Date', value: ui.hireDate },
                  { label: 'Years of Service', value: ui.yearsService },
                  { label: 'Fleet Type', value: 'OTR – Long Haul' },
                  { label: 'Home Terminal', value: 'Phoenix, AZ' },
                  { label: 'Union Status', value: 'Non-union' },
                  { label: 'Pay Type', value: 'Per Mile ($0.58/mi)' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12px] text-[#8a99b8]">{label}</span>
                    <span className="text-[12px] font-semibold text-[#2f3850]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
              <p className="mb-3 text-[14px] font-bold text-[#2f3850]">30-Day Performance</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Trips Completed', value: ui.trips30 },
                  { label: 'Miles Driven', value: ui.miles30 },
                  { label: 'On-Time Rate', value: ui.onTimePct },
                  { label: 'Fuel Efficiency', value: ui.mpg },
                  { label: 'Idle Time', value: ui.idleHrs },
                  { label: 'Hard Braking Events', value: ui.hardBraking },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[12px] text-[#8a99b8]">{label}</span>
                    <span className="text-[12px] font-semibold text-[#2f3850]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'documents' ? (
          <div className="flex flex-col gap-3">
            {[
              { name: 'CDL License', type: 'License', date: 'Uploaded Jan 12, 2026', status: 'Verified', ext: 'PDF' },
              { name: 'Medical Certificate (DOT)', type: 'Medical', date: 'Uploaded Aug 03, 2025', status: 'Verified', ext: 'PDF' },
              {
                name: 'Hazmat Endorsement',
                type: 'Certification',
                date: ui.hazmatDocUploaded ? 'Uploaded Mar 20, 2025' : 'Not uploaded',
                status: ui.hazmatDocUploaded ? 'Verified' : 'Missing',
                ext: 'PDF',
              },
              { name: 'Drug & Alcohol Test', type: 'Compliance', date: 'Uploaded Feb 28, 2026', status: 'Verified', ext: 'PDF' },
              { name: 'Annual Vehicle Inspection', type: 'Inspection', date: 'Uploaded Nov 15, 2025', status: 'Verified', ext: 'PDF' },
              { name: 'Insurance Certificate', type: 'Insurance', date: 'Uploaded Dec 30, 2025', status: 'Verified', ext: 'PDF' },
              {
                name: 'Background Check Report',
                type: 'HR',
                date: ui.bgCheckEarlyDate ? 'Uploaded Feb 12, 2021' : 'Uploaded Jun 01, 2019',
                status: 'Archived',
                ext: 'PDF',
              },
            ].map((doc) => (
              <div
                key={doc.name}
                className="flex items-center justify-between rounded-[10px] border border-[#ebeff7] bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-[6px] bg-[#f1f4fa] text-[10px] font-bold text-[#6b7794]">
                    {doc.ext}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-[#2f3850]">{doc.name}</span>
                    <span className="text-[11px] text-[#93a4c4]">
                      {doc.type} · {doc.date}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      doc.status === 'Verified'
                        ? 'bg-[#edfaf3] text-[#22a559]'
                        : doc.status === 'Missing'
                          ? 'bg-[#fdeaea] text-[#e84040]'
                          : 'bg-[#f4f6fa] text-[#93a4c4]'
                    }`}
                  >
                    {doc.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => showNotice(`Demo: opening ${doc.name}…`)}
                    className="text-[12px] font-semibold text-[#2f6fe0] hover:underline"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

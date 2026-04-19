import { useMemo, useState } from 'react'
import { FleetMapPane } from '../components/FleetMapPane'
import type { DriverMarker } from '../components/LatLngMap'
import { PlaybackControls } from '../components/PlaybackControls'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentClockIcon,
  FilterIcon,
  InfoDot,
  SearchIcon,
} from '../components/icons/AppIcons'
import { ROUTING_STATS } from '../constants/demoReport'
import { useDemoPlayback } from '../context/DemoPlaybackContext'
import { useNotice } from '../context/NoticeToastContext'
import { ROADMAP_NOTICE } from '../lib/roadmap'
import {
  getDefaultSelectedDriverId,
  getDriverPlaybackState,
  getDriverRoutePath,
  getFleetPlaybackFrame,
  getPlaybackDriverProfiles,
  normalizePlaybackSecond,
} from '../mocks/driverMapPlayback'
import type { DriverTripPhase } from '../mocks/driverMapPlayback'
import { simulationMeta } from '../mocks/driverRiskSimulation'
import type { RiskBand } from '../mocks/driverRiskSimulation'

const RISK_BAND_CHIP_META: Record<RiskBand, { color: string; bg: string; label: string }> = {
  red: { color: '#e84040', bg: '#fdeaea', label: 'Critical' },
  yellow: { color: '#e8952a', bg: '#fff3e0', label: 'Alert' },
  green: { color: '#22a559', bg: '#edfaf3', label: 'Safe' },
}

const TRIP_PHASE_LABEL: Record<DriverTripPhase, string> = {
  'heading-to-pickup': 'Heading to pickup',
  linehaul: 'Linehaul',
  'final-approach': 'Final approach',
  completed: 'Trip complete',
}

type MapLeftTab = 'dispatch' | 'search'

export function MapScreen({ onDriverNavigate }: { onDriverNavigate?: (id: string) => void }) {
  const { showNotice } = useNotice()
  const { playbackSecond, setPlaybackSecond, isPlaying, setIsPlaying, playbackTimestamp } = useDemoPlayback()
  /** Dispatchers land here first: active OTR drivers, highest concern at the top. */
  const [leftTab, setLeftTab] = useState<MapLeftTab>('dispatch')
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(
    () => getDefaultSelectedDriverId(0) ?? null,
  )
  const effectiveSelectedDriverId = selectedDriverId ?? getDefaultSelectedDriverId(playbackSecond) ?? null

  const { profiles, fleetMarkers, routePath, selectedState } = useMemo(() => {
    const normalized = normalizePlaybackSecond(playbackSecond)
    const profiles = getPlaybackDriverProfiles(normalized)
    const fleetMarkers: DriverMarker[] = getFleetPlaybackFrame(normalized).drivers.map((d) => ({
      id: d.marker.id,
      lat: d.marker.lat,
      lng: d.marker.lng,
      name: d.marker.name,
      initials: d.marker.initials,
      status: d.marker.status,
    }))
    const routePath = effectiveSelectedDriverId ? getDriverRoutePath(effectiveSelectedDriverId) : undefined
    const selectedState = effectiveSelectedDriverId
      ? getDriverPlaybackState(effectiveSelectedDriverId, normalized)
      : undefined
    return { profiles, fleetMarkers, routePath, selectedState }
  }, [playbackSecond, effectiveSelectedDriverId])

  return (
    <div className="relative flex min-w-0 flex-1 max-[860px]:flex-col">
      <aside className="z-10 flex min-h-0 w-[344px] min-w-[344px] flex-col border-r border-[#ebeff7] bg-white max-[1100px]:w-[320px] max-[1100px]:min-w-[320px] max-[860px]:w-full max-[860px]:min-w-0 max-[860px]:border-r-0 max-[860px]:border-b">
        <div className="grid h-[46px] grid-cols-2 border-b border-[#ebeff7]">
          <button
            type="button"
            onClick={() => setLeftTab('dispatch')}
            className={`relative inline-flex h-full items-center justify-center gap-2 px-1 text-[13px] font-semibold max-[380px]:text-[12px] ${
              leftTab === 'dispatch' ? 'text-[#2f6fe0]' : 'text-[#7b869f]'
            }`}
            aria-label="Active OTR drivers, priority queue"
          >
            <span className="text-center leading-tight">Active OTR</span>
            {leftTab === 'dispatch' ? <InfoDot /> : null}
            {leftTab === 'dispatch' ? (
              <span className="absolute right-[10px] bottom-0 left-[10px] h-[3px] rounded-tl-[3px] rounded-tr-[3px] bg-[#2f6fe0]" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setLeftTab('search')}
            className={`relative inline-flex h-full items-center justify-center gap-2 px-1 text-[13px] font-semibold max-[380px]:text-[12px] ${
              leftTab === 'search' ? 'text-[#2f6fe0]' : 'text-[#7b869f]'
            }`}
            aria-label="Search locations and routing"
          >
            <span className="text-center leading-tight">Search Locations</span>
            {leftTab === 'search' ? <InfoDot /> : null}
            {leftTab === 'search' ? (
              <span className="absolute right-[10px] bottom-0 left-[10px] h-[3px] rounded-tl-[3px] rounded-tr-[3px] bg-[#2f6fe0]" />
            ) : null}
          </button>
        </div>

        {leftTab === 'search' ? (
          <>
            <div className="flex items-center justify-between gap-[10px] px-4 pt-[14px] pb-2">
              <div className="flex min-w-0 items-center gap-[10px]">
                <span className="whitespace-nowrap text-[14px] font-bold text-[#2e3644]">Routing Profile</span>
                <button
                  type="button"
                  onClick={() => showNotice(ROADMAP_NOTICE)}
                  className="inline-flex max-w-[150px] items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-semibold text-[#2f6fe0]"
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">Default Routing Pr...</span>
                  <span className="text-[14px]">
                    <ChevronDownIcon />
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => showNotice(ROADMAP_NOTICE)}
                className="inline-flex whitespace-nowrap text-[11px] font-bold tracking-[0.04em] text-[#2f6fe0]"
              >
                <span>ROUTE SETTINGS</span>
                <span className="text-[14px]">
                  <ChevronRightIcon />
                </span>
              </button>
            </div>

            <div className="mx-4 grid grid-cols-5 rounded-[6px] border border-[#eef2f8] bg-[#f4f6fa] px-1 py-[10px]">
              {ROUTING_STATS.map((stat) => (
                <div key={stat.label} className="flex min-w-0 flex-col gap-[2px] px-2">
                  <span className="text-[11px] font-medium text-[#8b97ae]">{stat.label}</span>
                  <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[#333c4d]">
                    {stat.value}
                  </strong>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => showNotice(ROADMAP_NOTICE)}
              className="mx-4 mt-[14px] mb-[14px] inline-flex h-10 items-center gap-[10px] rounded-[6px] border border-[#d4dceb] px-3 text-left text-[13px] font-medium text-[#a2aabb]"
            >
              <span className="text-[16px] text-[#8b97ae]">
                <SearchIcon />
              </span>
              <span>Search for a location to add to your trip</span>
            </button>

            <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center border-b border-[#ebeff7] px-4">
              <button
                type="button"
                onClick={() => showNotice(ROADMAP_NOTICE)}
                className="relative h-11 px-1 text-[13px] font-semibold text-[#2f6fe0]"
              >
                <span>Recent Trips</span>
                <span className="absolute right-0 bottom-0 left-0 h-[3px] rounded-tl-[3px] rounded-tr-[3px] bg-[#2f6fe0]" />
              </button>
              <button
                type="button"
                onClick={() => showNotice(ROADMAP_NOTICE)}
                className="h-11 px-1 text-[13px] font-semibold text-[#7b869f]"
              >
                Saved Routes
              </button>
              <button
                type="button"
                onClick={() => showNotice(ROADMAP_NOTICE)}
                className="h-11 px-1 text-[13px] font-semibold text-[#7b869f]"
              >
                Shared Trips
              </button>
              <button
                type="button"
                onClick={() => showNotice(ROADMAP_NOTICE)}
                className="ml-2 grid h-7 w-7 place-items-center text-[16px] text-[#6f7f9d]"
                aria-label="Filter"
              >
                <FilterIcon />
              </button>
            </div>

            <div className="grid flex-1 place-items-center gap-[10px] px-4 py-8 text-center text-[#a0abc0]">
              <div className="grid place-items-center text-[52px] text-[#d2d8e4]">
                <DocumentClockIcon />
              </div>
              <strong className="text-[13px] font-semibold text-[#9aa6bc]">No Recent Trips</strong>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-[#ebeff7] px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0 text-[12px] font-semibold text-[#2f3850]">Who needs you right now</p>
                <span className="rounded-full bg-[#f0f3f9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6b7794]">
                  OTR · {profiles.length} active
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[#93a4c4]">
                Highest concern first. Select a driver to load their live position and route on the map. Demo uses
                deterministic playback data.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {profiles.map((profile) => {
                  const chip = RISK_BAND_CHIP_META[profile.riskBand]
                  const isSelected = profile.id === effectiveSelectedDriverId
                  const etaLabel =
                    isSelected && selectedState ? selectedState.trip.etaLabel : profile.etaLabel

                  return (
                    <li key={profile.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedDriverId(profile.id)}
                        className={`w-full rounded-[8px] border px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? 'border-[#2f6fe0] bg-[#e6efff]'
                            : 'border-[#ebeff7] bg-white hover:bg-[#f8fafd]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8ecf5] text-[12px] font-bold text-[#4f5c73]">
                            {profile.initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[14px] font-semibold text-[#2f3850]">{profile.name}</span>
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                style={{ backgroundColor: chip.bg, color: chip.color }}
                              >
                                {chip.label}
                              </span>
                              <span className="text-[13px] font-bold tabular-nums text-[#2f3850]">
                                {profile.riskScore}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-[#93a4c4]">
                              <span className="font-semibold text-[#8a99b8]">OTR</span>
                              <span className="text-[#dfe5f0]"> · </span>
                              {profile.vehicleLabel}
                            </p>
                            <p className="mt-1 text-[12px] leading-snug text-[#4f5c73]">{profile.primaryRiskReason}</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-[#6b7794]">{profile.shortExplanation}</p>
                            <p className="mt-1 text-[11px] text-[#93a4c4]">
                              ETA: <span className="font-semibold text-[#2f3850]">{etaLabel}</span>
                              {isSelected && selectedState ? (
                                <>
                                  {' '}
                                  · {TRIP_PHASE_LABEL[selectedState.trip.phase] ?? selectedState.trip.phase}
                                  {selectedState.trip.phase !== 'completed' ? (
                                    <span className="text-[#93a4c4]">
                                      {' '}
                                      · {selectedState.trip.remainingMinutes} min left
                                    </span>
                                  ) : null}
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}
      </aside>

      <FleetMapPane
        drivers={fleetMarkers}
        routePath={routePath}
        defaultCenter={[33.6, -112.1]}
        defaultZoom={9}
        onDriverClick={onDriverNavigate ? (id) => onDriverNavigate(id) : undefined}
        topControls={
          <PlaybackControls
            second={playbackSecond}
            totalSeconds={simulationMeta.playbackSeconds}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((v) => !v)}
            onScrub={(s) => setPlaybackSecond(normalizePlaybackSecond(s))}
            timestamp={playbackTimestamp}
          />
        }
      />
    </div>
  )
}

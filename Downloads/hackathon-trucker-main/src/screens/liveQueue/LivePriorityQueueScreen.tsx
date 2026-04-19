import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { FleetMapPane } from '../../components/FleetMapPane'
import type { DriverMarker, RoutePin } from '../../components/LatLngMap'
import { PlaybackControls } from '../../components/PlaybackControls'
import { DEMO_PLAYBACK_TICK_MS, useDemoPlayback } from '../../context/DemoPlaybackContext'
import { getDriverPhone } from '../../lib/driverPhones'
import { driverTripPlansById, normalizePlaybackSecond } from '../../mocks/driverMapPlayback'
import { driverSnapshotsById, simulationMeta } from '../../mocks/driverRiskSimulation'
import { DriverDetailPage } from './DriverDetailPage'
import { getPriorityQueueAtSecond } from './priorityQueueData'
import { STATUS_META } from './liveQueueUiConstants'

export function LivePriorityQueueScreen({
  initialSelectedId = null,
  onDetailClosed,
}: {
  initialSelectedId?: string | null
  onDetailClosed?: () => void
}) {
  const {
    playbackSecond,
    setPlaybackSecond,
    normalizedSecond,
    isPlaying,
    setIsPlaying,
    playbackTimestamp,
  } = useDemoPlayback()
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)
  const [selectedMapDriverId, setSelectedMapDriverId] = useState<string | null>(null)

  useEffect(() => {
    if (initialSelectedId != null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(initialSelectedId)
    }
  }, [initialSelectedId])

  const priorityQueue = useMemo(() => getPriorityQueueAtSecond(playbackSecond), [playbackSecond])

  const selectedEntry = selectedId ? (priorityQueue.find((e) => e.id === selectedId) ?? null) : null

  const { fleetDriverMarkers, completedRoutePath, startPin, endPin } = useMemo(() => {
    const allMarkers: DriverMarker[] = priorityQueue.map((entry) => {
      const snaps = driverSnapshotsById[entry.id]
      const tick = snaps?.[normalizedSecond]
      return {
        id: entry.id,
        lat: tick?.lat ?? 33.4484,
        lng: tick?.lng ?? -112.074,
        name: entry.name,
        initials: entry.initials,
        status:
          entry.status === 'CRITICAL' ? 'busy' : entry.status === 'ALERT' ? 'offline' : 'available',
      }
    })

    if (!selectedMapDriverId) {
      return { fleetDriverMarkers: allMarkers, completedRoutePath: undefined, startPin: undefined, endPin: undefined }
    }

    const fleetDriverMarkers = allMarkers.filter((m) => m.id === selectedMapDriverId)

    const snaps = driverSnapshotsById[selectedMapDriverId]
    const tripPlan = driverTripPlansById[selectedMapDriverId]
    const completedRoutePath: [number, number][] | undefined = snaps
      ? snaps.slice(0, normalizedSecond + 1).map((s): [number, number] => [s.lat, s.lng])
      : undefined

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

    return { fleetDriverMarkers, completedRoutePath, startPin, endPin }
  }, [selectedMapDriverId, priorityQueue, normalizedSecond])

  if (selectedEntry) {
    return (
      <DriverDetailPage
        entry={selectedEntry}
        backLabel="Live Priority Queue"
        onBack={() => {
          setSelectedId(null)
          onDetailClosed?.()
        }}
      />
    )
  }

  return (
    <div className="relative flex min-w-0 flex-1 max-[1100px]:flex-col">
      <aside className="z-10 flex w-auto shrink-0 flex-col border-r border-[#ebeff7] bg-white max-[1100px]:w-full max-[1100px]:shrink max-[1100px]:border-r-0 max-[1100px]:border-b">
        <div className="flex items-center justify-between border-b border-[#ebeff7] px-4 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[20px] font-bold text-[#2f3850]">Live Priority Queue</h1>
            <span className="flex items-center gap-1.5 rounded-full bg-[#fdeaea] px-3 py-1 text-[12px] font-semibold text-[#e84040]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#e84040]" />
              Live
            </span>
          </div>
          <span className="max-w-[min(100%,220px)] truncate text-[12px] text-[#8a99b8]" title={playbackTimestamp}>
            Sim:{' '}
            {new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'America/Phoenix',
            }).format(new Date(playbackTimestamp))}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-max min-w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-[#f8fafd]">
              <tr className="border-b border-[#ebeff7]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#93a4c4]">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#93a4c4]">
                  Location &amp; HOS
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#2f6fe0]">
                  Priority •
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[#93a4c4]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {priorityQueue.map((entry) => {
                const meta = STATUS_META[entry.status]
                const phone = getDriverPhone(entry.id)
                const isMapSelected = entry.id === selectedMapDriverId

                function toggleRowMapSelection() {
                  setSelectedMapDriverId((prev) => (prev === entry.id ? null : entry.id))
                }

                function rowKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleRowMapSelection()
                  }
                }

                return (
                  <tr
                    key={entry.id}
                    tabIndex={0}
                    onClick={toggleRowMapSelection}
                    onKeyDown={rowKeyDown}
                    className={`cursor-pointer border-b border-[#f0f3f9] last:border-b-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fe0] focus-visible:ring-offset-2 ${
                      isMapSelected
                        ? 'bg-[#e6efff] hover:bg-[#dce8ff]'
                        : entry.status === 'CRITICAL'
                          ? 'bg-[#fff8f8] hover:bg-[#f5f8ff]'
                          : 'bg-white hover:bg-[#f5f8ff]'
                    }`}
                    aria-label={`${entry.name}, risk score ${entry.score}. Press Enter to highlight on map.`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold transition-colors"
                          style={{
                            backgroundColor: isMapSelected ? '#2f6fe0' : '#e8ecf5',
                            color: isMapSelected ? 'white' : '#4f5c73',
                          }}
                        >
                          {entry.initials}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span
                            className="whitespace-nowrap text-[14px] font-semibold transition-colors"
                            style={{ color: isMapSelected ? '#2f6fe0' : '#2f3850' }}
                          >
                            {entry.name}
                          </span>
                          <span className="text-[12px] text-[#93a4c4]">{entry.truckId}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="whitespace-nowrap text-[13px] text-[#4f5c73]">{entry.location}</span>
                        <span className="whitespace-nowrap text-[12px] text-[#93a4c4]">{entry.hosRemaining}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.dotColor }} />
                        <span className="text-[22px] font-bold leading-none text-[#2f3850]">{entry.score}</span>
                        <span className="text-[11px] font-bold" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`tel:${phone}`}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 rounded-[6px] border border-[#d0f0db] bg-[#edfaf3] px-3 py-1.5 text-[13px] font-semibold text-[#22a559] transition-colors hover:bg-[#d6f5e4]"
                          aria-label={`Call ${entry.name}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1em] w-[1em]">
                            <path d="M6.6 10.8a14.4 14.4 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2c1.1.4 2.3.6 3.6.6a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1C9.4 20 4 14.6 4 8a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.6 3.6a1 1 0 0 1-.2 1L6.6 10.8Z" />
                          </svg>
                          Call
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedId(entry.id)
                          }}
                          className="flex items-center gap-1.5 rounded-[6px] border border-[#dfe5f0] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#4f5c73] transition-colors hover:bg-[#f3f6fb]"
                          aria-label="View details"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1em] w-[1em]">
                            <circle cx="11" cy="11" r="6" />
                            <path d="m20 20-4.2-4.2M11 8v6M8 11h6" />
                          </svg>
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 items-center border-t border-[#ebeff7] bg-[#fdfdfe] px-4 py-[10px] text-[11px] font-medium text-[#7a859e]">
          <div className="flex flex-wrap items-center gap-x-[14px] gap-y-1">
            <div className="flex items-center gap-1.5 text-[#22a559]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22a559] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22a559]" />
              </span>
              Queue syncs with demo playback — advances every {DEMO_PLAYBACK_TICK_MS / 1000}s (same clock as map)
            </div>
            <span className="h-2.5 w-px bg-[#d5dceb]" />
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-[12px] w-[12px] opacity-60">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              {priorityQueue.length} drivers monitored
            </div>
          </div>
        </div>
      </aside>

      <FleetMapPane
        drivers={fleetDriverMarkers}
        completedRoutePath={completedRoutePath}
        startPin={startPin}
        endPin={endPin}
        onDriverClick={(id) => setSelectedId(id)}
        defaultCenter={[33.6, -112.1]}
        defaultZoom={9}
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

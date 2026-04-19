import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { PlaybackControls } from '../../components/PlaybackControls'
import { useDemoPlayback } from '../../context/DemoPlaybackContext'
import { normalizePlaybackSecond } from '../../mocks/driverMapPlayback'
import { simulationFrames, simulationMeta } from '../../mocks/driverRiskSimulation'
import { DriverDetailPage } from '../liveQueue/DriverDetailPage'
import { getPriorityQueueAtSecond } from '../liveQueue/priorityQueueData'
import type { PriorityEntry } from '../liveQueue/priorityTypes'
import { STATUS_META } from '../liveQueue/liveQueueUiConstants'

type RiskView = 'dashboard' | 'at-risk-list' | 'detail'

function fleetAverageRisk(second: number): number {
  const frame = simulationFrames[second]
  if (!frame.drivers.length) return 0
  return frame.drivers.reduce((s, d) => s + d.riskScore, 0) / frame.drivers.length
}

function buildTrendSeries(): { label: string; value: number }[] {
  const samples = [0, 10, 20, 30, 40, 50, 59]
  const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '19:00']
  return samples.map((s, i) => ({
    label: hours[i] ?? '—',
    value: fleetAverageRisk(s),
  }))
}

function KpiCard({
  title,
  value,
  sub,
  subTone = 'neutral' as 'neutral' | 'good' | 'bad' | 'warn',
  onClick,
  icon,
}: {
  title: string
  value: string
  sub: string
  subTone?: 'neutral' | 'good' | 'bad' | 'warn'
  onClick?: () => void
  icon?: ReactNode
}) {
  const subClass =
    subTone === 'good'
      ? 'text-[#22a559]'
      : subTone === 'bad'
        ? 'text-[#e84040]'
        : subTone === 'warn'
          ? 'text-[#e8952a]'
          : 'text-[#93a4c4]'
  const className = `relative flex flex-col rounded-none border border-[#d8dee8] bg-white p-4 text-left shadow-none transition-colors ${
    onClick ? 'cursor-pointer hover:border-[#2f6fe0] hover:bg-[#f5f8fc]' : ''
  }`
  const inner = (
    <>
      {icon ? <span className="absolute right-3 top-3 text-[#c6cfdd]">{icon}</span> : null}
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#93a4c4]">{title}</span>
      <span className="mt-1 text-[28px] font-bold tabular-nums leading-none text-[#2f3850]">{value}</span>
      <span className={`mt-1 text-[12px] font-medium ${subClass}`}>{sub}</span>
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    )
  }
  return <div className={className}>{inner}</div>
}

function FleetRiskTrendChart({ points }: { points: { label: string; value: number }[] }) {
  const w = 360
  const h = 120
  const pad = 12
  const maxV = Math.max(40, ...points.map((p) => p.value), 1)
  const minV = 0
  const innerW = w - pad * 2
  const innerH = h - pad * 2
  const coords = points.map((p, i) => {
    const x = pad + (innerW * i) / Math.max(1, points.length - 1)
    const y = pad + innerH - (innerH * (p.value - minV)) / (maxV - minV)
    return { x, y, label: p.label, v: p.value }
  })
  const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const areaD = `${lineD} L ${coords[coords.length - 1].x} ${pad + innerH} L ${coords[0].x} ${pad + innerH} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full max-w-full" role="img" aria-label="Fleet average risk trend today">
      <defs>
        <linearGradient id="riskTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e84040" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e84040" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#riskTrendFill)" />
      <path d={lineD} fill="none" stroke="#c53030" strokeWidth="2" strokeLinejoin="miter" strokeLinecap="square" />
      {coords.map((c, i) => (
        <rect key={i} x={c.x - 3} y={c.y - 3} width={6} height={6} fill="white" stroke="#e84040" strokeWidth="2" />
      ))}
    </svg>
  )
}

function FleetTrendAxisLabels({ points }: { points: { label: string }[] }) {
  return (
    <div className="mt-1 flex justify-between px-1 text-[10px] font-medium text-[#93a4c4]">
      {points.map((p) => (
        <span key={p.label}>{p.label}</span>
      ))}
    </div>
  )
}

function AlertsBreakdownBar({
  label,
  count,
  max,
  color,
}: {
  label: string
  count: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold text-[#2f3850]">{label}</span>
        <span className="tabular-nums text-[#6b7794]">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-none border border-[#e2e8f0] bg-[#eef2f8]">
        <div className="h-full rounded-none transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export function RiskManagementScreen() {
  const { playbackSecond, setPlaybackSecond, isPlaying, setIsPlaying, playbackTimestamp } = useDemoPlayback()
  const [view, setView] = useState<RiskView>('dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const priorityQueue = useMemo(() => getPriorityQueueAtSecond(playbackSecond), [playbackSecond])

  const metrics = useMemo(() => {
    const total = priorityQueue.length
    const critical = priorityQueue.filter((d) => d.status === 'CRITICAL').length
    const alert = priorityQueue.filter((d) => d.status === 'ALERT').length
    const safe = priorityQueue.filter((d) => d.status === 'SAFE').length
    const atRisk = critical + alert
    const avgRisk = priorityQueue.reduce((s, d) => s + d.score, 0) / Math.max(1, total)
    const fleetSafetyScore = Math.min(99.9, Math.max(60, 100 - avgRisk * 0.42 + safe * 3.2 - atRisk * 4.5))
    const trend = buildTrendSeries()
    const trendDelta = trend[trend.length - 1].value - trend[0].value
    return {
      total,
      critical,
      alert,
      safe,
      atRisk,
      avgRisk,
      fleetSafetyScore: fleetSafetyScore.toFixed(1),
      trend,
      trendDelta,
    }
  }, [priorityQueue])

  const selectedEntry: PriorityEntry | null = useMemo(() => {
    if (!selectedId) return null
    return priorityQueue.find((e) => e.id === selectedId) ?? null
  }, [priorityQueue, selectedId])

  const atRiskDrivers = useMemo(
    () => priorityQueue.filter((d) => d.status === 'CRITICAL' || d.status === 'ALERT'),
    [priorityQueue],
  )

  const highestScore = useMemo(
    () => (priorityQueue.length ? Math.max(...priorityQueue.map((d) => d.score)) : 0),
    [priorityQueue],
  )

  if (view === 'detail' && selectedEntry) {
    return (
      <DriverDetailPage
        key={selectedEntry.id}
        entry={selectedEntry}
        initialTab="details"
        backLabel="Drivers at risk"
        onBack={() => {
          setView('at-risk-list')
          setSelectedId(null)
        }}
      />
    )
  }

  if (view === 'at-risk-list') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-[#f4f6fa]">
        <div className="flex items-center gap-3 border-b border-[#ebeff7] bg-white px-5 py-4">
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-[#6b7794] hover:text-[#2f3850]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[1em] w-[1em]">
              <path d="m15 6-6 6 6 6" />
            </svg>
            Risk Management
          </button>
          <span className="text-[#dfe5f0]">/</span>
          <span className="text-[15px] font-bold text-[#2f3850]">Drivers at risk</span>
        </div>
        <div className="mx-auto w-full max-w-[720px] flex-1 px-5 py-6">
          <p className="m-0 text-[13px] text-[#6b7794]">
            {atRiskDrivers.length} driver{atRiskDrivers.length === 1 ? '' : 's'} in CRITICAL or ALERT. Open the full
            risk breakdown (same view as Live Priority Queue driver detail).
          </p>
          <ul className="mt-4 flex list-none flex-col gap-3 p-0">
            {atRiskDrivers.map((entry) => {
              const meta = STATUS_META[entry.status]
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(entry.id)
                      setView('detail')
                    }}
                    className="w-full rounded-none border border-[#d8dee8] bg-white px-4 py-4 text-left shadow-none transition-colors hover:border-[#2f6fe0] hover:bg-[#f5f8fc]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-none border border-[#cfd6e4] bg-[#eef2f8] text-[13px] font-bold text-[#4f5c73]">
                          {entry.initials}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[15px] font-bold text-[#2f3850]">{entry.name}</span>
                            <span
                              className="rounded-none border px-2 py-0.5 text-[10px] font-bold"
                              style={{ backgroundColor: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}44` }}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[16px] font-bold tabular-nums text-[#2f3850]">{entry.score}</span>
                          </div>
                          <p className="mt-1 text-[12px] text-[#93a4c4]">{entry.truckId}</p>
                          <p className="mt-1 text-[13px] leading-snug text-[#4f5c73]">{entry.reason}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-[#2f6fe0]">Risk detail →</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  }

  const maxBreakdown = Math.max(metrics.critical, metrics.alert, metrics.safe, 1)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-[#f4f6fa]">
      <header className="border-b border-[#ebeff7] bg-white px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 font-serif text-[26px] font-semibold tracking-tight text-[#1e293b]">Risk Management</h1>
            <p className="mt-1 text-[14px] text-[#6b7794]">
              Fleet-wide risk posture, trends, and drill-down into the same driver risk detail used in operations.
            </p>
          </div>
          <PlaybackControls
            second={playbackSecond}
            totalSeconds={simulationMeta.playbackSeconds}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((v) => !v)}
            onScrub={(s) => setPlaybackSecond(normalizePlaybackSecond(s))}
            timestamp={playbackTimestamp}
          />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1100px] flex-1 space-y-6 px-5 py-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total active drivers"
            value={String(metrics.total)}
            sub="On the road (demo fleet)"
            icon={<span className="text-[18px]">🚛</span>}
          />
          <KpiCard
            title="Drivers at risk"
            value={String(metrics.atRisk)}
            sub={`${metrics.critical} critical · ${metrics.alert} alert`}
            subTone={metrics.atRisk > 0 ? 'bad' : 'good'}
            onClick={metrics.atRisk > 0 ? () => setView('at-risk-list') : undefined}
            icon={<span className="text-[18px]">⚠️</span>}
          />
          <KpiCard
            title="Fleet safety score"
            value={metrics.fleetSafetyScore}
            sub="Composite of exposure + safe headroom (demo)"
            subTone="good"
            icon={<span className="text-[18px]">✓</span>}
          />
          <KpiCard
            title="Interventions logged (24h)"
            value="18"
            sub="Coach / call / reassignment (demo)"
            icon={<span className="text-[18px]">📋</span>}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-none border border-[#d8dee8] bg-white p-5 shadow-none">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <h2 className="m-0 text-[16px] font-bold text-[#2f3850]">Fleet risk trend (today)</h2>
                <p className="mt-0.5 text-[12px] text-[#93a4c4]">Average risk score across all drivers by time of day (demo playback).</p>
              </div>
              <span
                className={`shrink-0 text-[12px] font-bold ${metrics.trendDelta > 0 ? 'text-[#e84040]' : metrics.trendDelta < 0 ? 'text-[#22a559]' : 'text-[#93a4c4]'}`}
              >
                {metrics.trendDelta > 0 ? `↑ ${metrics.trendDelta.toFixed(0)}` : metrics.trendDelta < 0 ? `↓ ${Math.abs(metrics.trendDelta).toFixed(0)}` : '—'} vs start
              </span>
            </div>
            <FleetRiskTrendChart points={metrics.trend} />
            <FleetTrendAxisLabels points={metrics.trend} />
          </div>

          <div className="rounded-none border border-[#d8dee8] bg-white p-5 shadow-none">
            <h2 className="m-0 text-[16px] font-bold text-[#2f3850]">Alerts breakdown</h2>
            <p className="mt-0.5 text-[12px] text-[#93a4c4]">By dispatcher priority tier (current snapshot).</p>
            <div className="mt-5 flex flex-col gap-5">
              <AlertsBreakdownBar label="CRITICAL" count={metrics.critical} max={maxBreakdown} color="#e84040" />
              <AlertsBreakdownBar label="ALERT" count={metrics.alert} max={maxBreakdown} color="#e8952a" />
              <AlertsBreakdownBar label="MONITOR (safe band)" count={metrics.safe} max={maxBreakdown} color="#2f6fe0" />
            </div>
          </div>
        </section>

        <section className="rounded-none border border-[#d8dee8] bg-white p-5 shadow-none">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="m-0 text-[16px] font-bold text-[#2f3850]">Exposure mix</h2>
              <p className="mt-0.5 text-[12px] text-[#93a4c4]">
                Mean risk {metrics.avgRisk.toFixed(0)} · Highest score {highestScore}
              </p>
            </div>
            {metrics.atRisk > 0 ? (
              <button
                type="button"
                onClick={() => setView('at-risk-list')}
                className="rounded-none border border-[#2562c7] bg-[#2f6fe0] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#2562c7]"
              >
                View drivers at risk
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-none border border-[#f0d4d4] bg-[#fff8f8] px-3 py-3 text-center">
              <p className="m-0 text-[11px] font-semibold uppercase text-[#e84040]">Critical share</p>
              <p className="mt-1 text-[22px] font-bold text-[#2f3850]">
                {metrics.total ? Math.round((metrics.critical / metrics.total) * 100) : 0}%
              </p>
            </div>
            <div className="rounded-none border border-[#edd9b8] bg-[#fffaf0] px-3 py-3 text-center">
              <p className="m-0 text-[11px] font-semibold uppercase text-[#e8952a]">Alert share</p>
              <p className="mt-1 text-[22px] font-bold text-[#2f3850]">
                {metrics.total ? Math.round((metrics.alert / metrics.total) * 100) : 0}%
              </p>
            </div>
            <div className="rounded-none border border-[#c9daf5] bg-[#f0f7ff] px-3 py-3 text-center">
              <p className="m-0 text-[11px] font-semibold uppercase text-[#2f6fe0]">Stable / monitor</p>
              <p className="mt-1 text-[22px] font-bold text-[#2f3850]">
                {metrics.total ? Math.round((metrics.safe / metrics.total) * 100) : 0}%
              </p>
            </div>
          </div>
        </section>

        <p className="pb-8 text-center text-[11px] text-[#93a4c4]">
          Risk detail panels are shared with Live Priority Queue for a single source of coaching truth (demo data).
        </p>
      </div>
    </div>
  )
}

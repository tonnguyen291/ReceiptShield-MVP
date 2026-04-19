import type { ReactNode } from 'react'

export function RiskPieChart({
  slices,
  size = 120,
}: {
  slices: { label: string; value: number; color: string }[]
  size?: number
}) {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  const radius = size / 2
  const cx = radius
  const cy = radius

  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius - 1} fill="#e8ecf5" />
      </svg>
    )
  }

  const active = slices.filter((s) => s.value > 0)
  if (active.length === 1) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius - 1} fill={active[0].color} />
      </svg>
    )
  }

  const paths = slices.reduce<{ cumulative: number; paths: ReactNode[] }>(
    (acc, slice, i) => {
      const value = Math.max(0, slice.value)
      const startAngle = (acc.cumulative / total) * Math.PI * 2
      const nextCumulative = acc.cumulative + value
      const endAngle = (nextCumulative / total) * Math.PI * 2

      if (value <= 0) {
        return { cumulative: nextCumulative, paths: acc.paths }
      }

      const x1 = cx + radius * Math.sin(startAngle)
      const y1 = cy - radius * Math.cos(startAngle)
      const x2 = cx + radius * Math.sin(endAngle)
      const y2 = cy - radius * Math.cos(endAngle)
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

      return {
        cumulative: nextCumulative,
        paths: [...acc.paths, <path key={i} d={d} fill={slice.color} stroke="white" strokeWidth={1.5} />],
      }
    },
    { cumulative: 0, paths: [] },
  ).paths

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
    </svg>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function riskLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 16) return { label: 'High', color: '#e84040', bg: '#fdeaea' }
  if (score >= 8) return { label: 'Moderate', color: '#e8952a', bg: '#fff3e0' }
  if (score >= 3) return { label: 'Low', color: '#e8952a', bg: '#fff8ee' }
  return { label: 'Safe', color: '#22a559', bg: '#edfaf3' }
}

export function RiskFactorCard({
  title,
  icon,
  riskScore,
  details,
}: {
  title: string
  icon: ReactNode
  riskScore: number
  details: { label: string; value: string; warn?: boolean }[]
}) {
  const lvl = riskLevel(riskScore)
  return (
    <div className="rounded-[10px] border border-[#ebeff7] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-[#2f3850]">
          <span className="text-[18px] text-[#6b7794]">{icon}</span>
          {title}
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{ backgroundColor: lvl.bg, color: lvl.color }}
        >
          {lvl.label}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {details.map(({ label, value, warn }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[12px] text-[#8a99b8]">{label}</span>
            <span
              className={`text-[12px] font-semibold ${warn && lvl.color !== '#22a559' ? '' : 'text-[#2f3850]'}`}
              style={warn ? { color: lvl.color } : undefined}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'

export function ConvexDevBadge() {
  const tasks = useQuery(api.tasks.get)

  if (tasks === undefined) {
    return (
      <div
        className="pointer-events-none fixed bottom-3 left-3 z-[550] rounded-md border border-[#dfe5f0] bg-white/95 px-2 py-1 text-[11px] font-medium text-[#6b7794] shadow-sm backdrop-blur-sm"
        title="Loading Convex…"
      >
        Convex…
      </div>
    )
  }

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-[550] rounded-md border border-[#d4e4ff] bg-[#eef4ff]/95 px-2 py-1 text-[11px] font-medium text-[#2f4f8a] shadow-sm backdrop-blur-sm"
      title="Connected to Convex (sample tasks query)"
    >
      Convex · {tasks.length} task{tasks.length === 1 ? '' : 's'}
    </div>
  )
}

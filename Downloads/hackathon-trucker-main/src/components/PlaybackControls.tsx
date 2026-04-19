import { normalizePlaybackSecond } from '../mocks/driverMapPlayback'

type PlaybackControlsProps = {
  second: number
  totalSeconds: number
  isPlaying: boolean
  onTogglePlay: () => void
  onScrub: (s: number) => void
  timestamp: string
}

export function PlaybackControls({
  second,
  totalSeconds,
  isPlaying,
  onTogglePlay,
  onScrub,
  timestamp,
}: PlaybackControlsProps) {
  const maxIdx = totalSeconds - 1
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Phoenix',
  }).format(new Date(timestamp))

  return (
    <div className="flex max-w-[min(100%,420px)] flex-wrap items-center gap-2 rounded-none border border-[#cfd6e4] bg-white px-3 py-2 shadow-none">
      <button
        type="button"
        onClick={onTogglePlay}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-none border border-[#cfd6e4] bg-[#f8fafd] text-[#2f3850] transition-colors hover:bg-[#eef2f8]"
        aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path d="M8 5v14l11-7L8 5z" />
          </svg>
        )}
      </button>
      <span className="text-[12px] font-semibold tabular-nums text-[#353f50]">
        {String(normalizePlaybackSecond(second) + 1).padStart(2, '0')} / {totalSeconds}
      </span>
      <span className="text-[11px] text-[#6b7794]">{timeLabel}</span>
      <input
        type="range"
        min={0}
        max={maxIdx}
        value={normalizePlaybackSecond(second)}
        onChange={(e) => onScrub(Number(e.target.value))}
        className="h-1 min-w-[100px] flex-1 accent-[#2f6fe0]"
        aria-label="Playback position"
      />
    </div>
  )
}

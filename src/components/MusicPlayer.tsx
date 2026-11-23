import { ExternalLink, Pause, Play, RotateCcw } from 'lucide-react'
import type { PlaybackAvailability } from '../services/spotify/playback'

interface MusicPlayerProps {
  availability: PlaybackAvailability
  isPlaying: boolean
  positionMs: number
  durationMs: number
  /** Opens the current track in Spotify; offered when the browser can't play it. */
  externalUrl: string | null
  onToggle: () => void
  onReplay: () => void
}

const formatTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const UNAVAILABLE_REASON: Partial<Record<PlaybackAvailability, string>> = {
  'premium-required': 'Listening in Swipeify needs Spotify Premium',
  unsupported: 'Spotify doesn’t support listening in this browser',
  error: 'The Spotify player couldn’t start',
}

export function MusicPlayer({
  availability,
  isPlaying,
  positionMs,
  durationMs,
  externalUrl,
  onToggle,
  onReplay,
}: MusicPlayerProps) {
  const unavailable = UNAVAILABLE_REASON[availability]
  if (unavailable) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-3 rounded-full border border-line py-2 pr-2 pl-5 text-xs text-muted">
        <span>{unavailable}</span>
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-champagne transition-colors hover:bg-raised hover:text-cream"
          >
            Open in Spotify
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    )
  }

  const connecting = availability === 'connecting' || availability === 'idle'
  const pct = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0
  const status = connecting
    ? 'Connecting to Spotify…'
    : isPlaying || positionMs > 0
      ? 'Playing in Swipeify'
      : 'Tap play to listen'

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onToggle}
        disabled={connecting}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-cream text-ink transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
      </button>

      <div className="flex-1">
        <div className="h-[3px] overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-champagne transition-[width] duration-300 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
          <span>{formatTime(positionMs)}</span>
          <span className={connecting ? 'animate-pulse' : ''}>{status}</span>
          <span>{formatTime(durationMs)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onReplay}
        disabled={connecting}
        aria-label="Play again from the highlight"
        title="Play again from the highlight"
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-cream disabled:opacity-40"
      >
        <RotateCcw size={17} />
      </button>
    </div>
  )
}

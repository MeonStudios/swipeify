import { ExternalLink, Pause, Play, RotateCcw, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { PlaybackAvailability } from '../services/spotify/playback'

interface MusicPlayerProps {
  availability: PlaybackAvailability
  /** The song was started at least once; before that the position is where it will start. */
  hasStarted: boolean
  isPlaying: boolean
  positionMs: number
  durationMs: number
  /** 0–1. */
  volume: number
  /** Opens the current track in Spotify; offered when the browser can't play it. */
  externalUrl: string | null
  onToggle: () => void
  onReplay: () => void
  onSeek: (positionMs: number) => void
  onVolume: (volume: number) => void
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

/** Used when unmuting after the volume was dragged all the way down. */
const UNMUTE_VOLUME = 0.5

/** A slider fills with champagne up to this percentage. */
const fill = (pct: number) => ({ '--fill': `${pct}%` }) as CSSProperties

/**
 * After a mouse or touch interaction, give focus back to the page so the
 * arrow keys swipe again instead of moving the slider. Keyboard users who
 * tabbed to a slider keep its focus.
 */
const releaseFocus = (event: PointerEvent<HTMLInputElement>) => event.currentTarget.blur()

export function MusicPlayer({
  availability,
  hasStarted,
  isPlaying,
  positionMs,
  durationMs,
  volume,
  externalUrl,
  onToggle,
  onReplay,
  onSeek,
  onVolume,
}: MusicPlayerProps) {
  /** Position under the user's finger while dragging; only sent to Spotify on release. */
  const [dragMs, setDragMs] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  /** Volume to return to when unmuting. */
  const audibleVolume = useRef(volume > 0 ? volume : UNMUTE_VOLUME)

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
  const shownMs = Math.min(dragMs ?? positionMs, durationMs)
  const pct = durationMs > 0 ? Math.min(100, (shownMs / durationMs) * 100) : 0
  const status = connecting
    ? 'Connecting to Spotify…'
    : isPlaying || hasStarted
      ? 'Playing in Swipeify'
      : 'Tap play to listen'

  function drag(ms: number) {
    dragRef.current = ms
    setDragMs(ms)
  }

  function commitSeek() {
    if (dragRef.current === null) return
    onSeek(dragRef.current)
    dragRef.current = null
    setDragMs(null)
  }

  function toggleMute() {
    if (volume > 0) {
      audibleVolume.current = volume
      onVolume(0)
    } else {
      onVolume(audibleVolume.current > 0 ? audibleVolume.current : UNMUTE_VOLUME)
    }
  }

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={connecting}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-cream text-ink transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
      </button>

      <div className="min-w-0 flex-1 pl-1">
        <input
          type="range"
          aria-label="Position in song"
          aria-valuetext={`${formatTime(shownMs)} of ${formatTime(durationMs)}`}
          min={0}
          max={Math.max(1, durationMs)}
          step={1000}
          value={shownMs}
          disabled={connecting || durationMs === 0}
          onChange={(e) => drag(Number(e.target.value))}
          onPointerUp={(e) => {
            commitSeek()
            releaseFocus(e)
          }}
          onKeyUp={commitSeek}
          onBlur={commitSeek}
          className="range-slider block"
          style={fill(pct)}
        />
        <div className="mt-0.5 flex justify-between gap-2 text-[11px] tabular-nums text-muted">
          <span>{formatTime(shownMs)}</span>
          <span className={`truncate ${connecting ? 'animate-pulse' : ''}`}>{status}</span>
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

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={volume > 0 ? 'Mute' : 'Unmute'}
          title={volume > 0 ? 'Mute' : 'Unmute'}
          className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:text-cream"
        >
          <VolumeIcon size={17} />
        </button>
        <input
          type="range"
          aria-label="Volume"
          aria-valuetext={`${Math.round(volume * 100)}%`}
          min={0}
          max={100}
          step={1}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          onPointerUp={releaseFocus}
          className="range-slider hidden w-16 sm:block"
          style={fill(volume * 100)}
        />
      </div>
    </div>
  )
}

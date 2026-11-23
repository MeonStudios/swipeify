import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DoneCard } from '../components/DoneCard'
import { MusicPlayer } from '../components/MusicPlayer'
import { ProgressBar } from '../components/ProgressBar'
import { Screen } from '../components/Screen'
import { SwipeButtons } from '../components/SwipeButtons'
import { SwipeCard } from '../components/SwipeCard'
import { TrackCardFace } from '../components/TrackCardFace'
import { useTrackPlayback } from '../hooks/useTrackPlayback'
import { musicService } from '../services'
import {
  currentIndex,
  currentTrack,
  isComplete,
  nextTrack,
  sessionStats,
  type Decision,
} from '../state/swipeSession'
import { getShufflePreference } from '../state/preferences'
import { useSwipeSession } from '../state/SwipeSessionContext'

export default function Swipe() {
  const { playlistId } = useParams<{ playlistId: string }>()
  const navigate = useNavigate()
  const { state, dispatch } = useSwipeSession()
  const [error, setError] = useState<string | null>(null)
  /** 1 = keep (card flies right), -1 = skip (card flies left). */
  const [exitDirection, setExitDirection] = useState(1)
  /**
   * True only when the last swipe happened on this visit. Coming back from the
   * results screen shows the static done card instead of auto-continuing again.
   */
  const [justFinished, setJustFinished] = useState(false)
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)

  const ready = !!playlistId && state.playlist?.id === playlistId

  // Load the playlist unless this session is already running (e.g. back from results).
  useEffect(() => {
    if (!playlistId || ready) return
    let cancelled = false
    setError(null)
    setProgress(null)
    Promise.all([
      musicService.getPlaylist(playlistId),
      musicService.getPlaylistTracks(playlistId, (loaded, total) => {
        if (!cancelled) setProgress({ loaded, total })
      }),
    ])
      .then(([playlist, tracks]) => {
        if (cancelled) return
        if (!playlist) setError('This playlist could not be found.')
        else if (!playlist.readable) setError('Spotify only lets Swipeify read playlists you own or collaborate on.')
        else if (tracks.length === 0) setError('There are no playable songs in this playlist.')
        else
          dispatch({
            type: 'start',
            playlist,
            tracks,
            shuffleSeed: getShufflePreference() ? `${playlist.id}/${Date.now()}` : undefined,
          })
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Something went wrong'))
    return () => {
      cancelled = true
    }
  }, [playlistId, ready, dispatch])

  const track = ready ? currentTrack(state) : null
  const peek = ready ? nextTrack(state) : null
  const complete = ready && isComplete(state)
  const { availability, isPlaying, positionMs, durationMs, unlock, toggle, replay } = useTrackPlayback(track)

  const decide = useCallback(
    (decision: Decision) => {
      if (!track) return
      setExitDirection(decision === 'keep' ? 1 : -1)
      if (currentIndex(state) === state.tracks.length - 1) setJustFinished(true)
      unlock()
      dispatch({ type: 'decide', decision })
    },
    [track, state, unlock, dispatch],
  )

  // Keyboard: ← skip, → keep, space play/pause.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowLeft') decide('skip')
      else if (event.key === 'ArrowRight') decide('keep')
      else if (event.key === ' ') {
        event.preventDefault()
        if (!event.repeat) toggle()
      } else return
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [decide, toggle])

  const stats = sessionStats(state)

  return (
    <Screen className="gap-5">
      <header className="flex items-center justify-between gap-3">
        <Link
          to="/playlists"
          aria-label="Back to playlists"
          className="-ml-2 grid size-9 shrink-0 place-items-center rounded-full text-muted hover:text-cream"
        >
          <ChevronLeft size={20} />
        </Link>
        <p className="eyebrow truncate">{state.playlist && ready ? state.playlist.name : 'Loading'}</p>
        <button
          type="button"
          onClick={() => navigate('/results')}
          disabled={!ready || complete}
          className="shrink-0 text-xs font-medium tracking-wide text-champagne transition-opacity hover:text-cream disabled:opacity-0"
        >
          Finish
        </button>
      </header>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-serif text-2xl">{error}</p>
          <Link to="/playlists" className="mt-4 text-sm text-champagne">
            Choose another playlist
          </Link>
        </div>
      ) : !ready ? (
        <div className="flex flex-1 flex-col gap-5">
          <div className="h-px bg-line" />
          <div className="mx-auto grid aspect-[4/5] w-full max-w-[min(100%,52dvh)] place-items-center rounded-[28px] bg-surface">
            <p className="animate-pulse text-xs tabular-nums tracking-wide text-muted">
              {progress && progress.total > 0
                ? `Loading ${progress.loaded.toLocaleString()} / ${progress.total.toLocaleString()}`
                : 'Loading songs…'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <ProgressBar value={currentIndex(state)} total={state.tracks.length} />

          <div className="relative mx-auto grid w-full max-w-[min(100%,52dvh)] flex-none grid-cols-1">
            {complete && (
              <DoneCard
                kept={stats.kept}
                total={stats.total}
                autoContinue={justFinished}
                onReview={() => navigate('/results')}
                onRestart={() => {
                  setJustFinished(false)
                  dispatch({ type: 'restart' })
                }}
                onChooseAnother={() => navigate('/playlists')}
              />
            )}

            {peek && (
              <motion.div
                key={`peek-${peek.id}`}
                aria-hidden
                className="pointer-events-none z-0 min-w-0 [grid-area:1/1]"
                initial={{ opacity: 0, scale: 0.9, y: 24 }}
                animate={{ opacity: 0.55, scale: 0.94, y: 14 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <TrackCardFace track={peek} />
              </motion.div>
            )}

            <AnimatePresence custom={exitDirection}>
              {track && <SwipeCard key={track.id} track={track} onDecide={decide} />}
            </AnimatePresence>
          </div>

          <div className="mx-auto mt-auto flex w-full max-w-[min(100%,52dvh)] flex-col gap-6">
            {!complete && (
              <MusicPlayer
                availability={availability}
                isPlaying={isPlaying}
                positionMs={positionMs}
                durationMs={durationMs}
                externalUrl={track?.externalUrl ?? null}
                onToggle={toggle}
                onReplay={replay}
              />
            )}
            <SwipeButtons onDecide={decide} disabled={complete} />
            <p className="hidden text-center text-[11px] tracking-wide text-muted/70 sm:block">
              ← skip · space play/pause · keep →
            </p>
          </div>
        </>
      )}
    </Screen>
  )
}

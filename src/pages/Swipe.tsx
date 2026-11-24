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
  canUndo,
  currentIndex,
  currentTrack,
  isComplete,
  nextTrack,
  sessionStats,
  type Decision,
} from '../state/swipeSession'
import { getShufflePreference } from '../state/preferences'
import { useSwipeSession } from '../state/SwipeSessionContext'

/** Shift+arrow jumps this far through the song. */
const SEEK_STEP_MS = 10_000

export default function Swipe() {
  const { playlistId } = useParams<{ playlistId: string }>()
  const navigate = useNavigate()
  const { state, dispatch } = useSwipeSession()
  // Tagged with the playlist they belong to, so switching playlists never shows a stale one.
  const [loadError, setLoadError] = useState<{ playlistId: string; message: string } | null>(null)
  /** 1 = keep (card flies right), -1 = skip (card flies left), 0 = undo (card fades in place). */
  const [exitDirection, setExitDirection] = useState(1)
  /**
   * True once the user swiped on this visit. Finishing then auto-continues to
   * results; coming back from results shows the static done card instead.
   */
  const [swipedThisVisit, setSwipedThisVisit] = useState(false)
  const [loadProgress, setLoadProgress] = useState<{ playlistId: string; loaded: number; total: number } | null>(null)

  const ready = !!playlistId && state.playlist?.id === playlistId
  const error = loadError && !ready && loadError.playlistId === playlistId ? loadError.message : null
  const progress = loadProgress?.playlistId === playlistId ? loadProgress : null

  // Load the playlist unless this session is already running (e.g. back from results).
  useEffect(() => {
    if (!playlistId || ready) return
    let cancelled = false
    const setError = (message: string) => !cancelled && setLoadError({ playlistId, message })
    Promise.all([
      musicService.getPlaylist(playlistId),
      musicService.getPlaylistTracks(playlistId, (loaded, total) => {
        if (!cancelled) setLoadProgress({ playlistId, loaded, total })
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
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong'))
    return () => {
      cancelled = true
    }
  }, [playlistId, ready, dispatch])

  const track = ready ? currentTrack(state) : null
  const peek = ready ? nextTrack(state) : null
  const complete = ready && isComplete(state)
  const justFinished = complete && swipedThisVisit
  const { availability, isPlaying, positionMs, durationMs, volume, unlock, toggle, replay, seekTo, seekBy, setVolume } =
    useTrackPlayback(track)

  const decide = useCallback(
    (decision: Decision) => {
      if (!track) return
      setExitDirection(decision === 'keep' ? 1 : -1)
      setSwipedThisVisit(true)
      unlock()
      dispatch({ type: 'decide', decision })
    },
    [track, unlock, dispatch],
  )

  const undoable = ready && canUndo(state)
  const undo = useCallback(() => {
    if (!undoable) return
    setExitDirection(0)
    unlock()
    dispatch({ type: 'undo' })
  }, [undoable, unlock, dispatch])

  // Keyboard: ← skip, → keep, Shift+←/→ jump 10 s, space play/pause, Z or Backspace undo.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (!['arrowleft', 'arrowright', ' ', 'z', 'backspace'].includes(key)) return
      event.preventDefault()
      if (event.shiftKey && (key === 'arrowleft' || key === 'arrowright')) {
        // Holding Shift+arrow keeps scrubbing, like in most players.
        seekBy(key === 'arrowleft' ? -SEEK_STEP_MS : SEEK_STEP_MS)
        return
      }
      // Holding a key must not decide (or undo) track after track.
      if (event.repeat) return
      if (key === 'arrowleft') decide('skip')
      else if (key === 'arrowright') decide('keep')
      else if (key === ' ') toggle()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [decide, toggle, undo, seekBy])

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
                  setSwipedThisVisit(false)
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
                volume={volume}
                externalUrl={track?.externalUrl ?? null}
                onToggle={toggle}
                onReplay={replay}
                onSeek={seekTo}
                onVolume={setVolume}
              />
            )}
            <SwipeButtons onDecide={decide} onUndo={undo} disabled={complete} undoDisabled={!undoable} />
            <p className="hidden text-center text-[11px] tracking-wide text-muted/70 sm:block">
              ← skip · keep → · space play/pause · ⇧←/→ ±10s · Z undo
            </p>
          </div>
        </>
      )}
    </Screen>
  )
}

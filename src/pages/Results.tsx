import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronLeft, ExternalLink, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Screen } from '../components/Screen'
import { Wordmark } from '../components/Wordmark'
import { musicService } from '../services'
import { clearSession } from '../state/sessionStore'
import { isComplete, keptTracks, sessionStats } from '../state/swipeSession'
import { useSwipeSession } from '../state/SwipeSessionContext'
import type { CreatedPlaylist } from '../types/music'

const ease = [0.22, 1, 0.36, 1] as const

export default function Results() {
  const navigate = useNavigate()
  const { state, dispatch } = useSwipeSession()
  const [name, setName] = useState(() => (state.playlist ? `${state.playlist.name} · Swipeified` : ''))
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<CreatedPlaylist | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!state.playlist) return <Navigate to="/playlists" replace />

  const kept = keptTracks(state)
  const stats = sessionStats(state)
  const canCreate = kept.length > 0 && name.trim().length > 0 && !creating

  async function create() {
    if (!canCreate) return
    setCreating(true)
    setError(null)
    try {
      setCreated(await musicService.createPlaylist(name.trim(), kept.map((t) => t.uri)))
      // Done: a reload must not offer to create the same playlist again.
      clearSession()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the playlist')
    } finally {
      setCreating(false)
    }
  }

  function swipeAgain() {
    if (!state.playlist) return
    dispatch({ type: 'restart' })
    navigate(`/swipe/${state.playlist.id}`)
  }

  function startOver() {
    dispatch({ type: 'reset' })
    navigate('/playlists')
  }

  if (created) {
    return (
      <Screen>
        <header className="flex justify-center">
          <Wordmark />
        </header>
        <motion.section
          className="flex flex-1 flex-col items-center justify-center text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
        >
          <motion.div
            className="grid size-16 place-items-center rounded-full bg-champagne text-ink"
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }}
          >
            <Check size={28} strokeWidth={2} />
          </motion.div>
          <p className="eyebrow mt-8">Playlist created</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight font-light tracking-tight">{created.name}</h1>
          <p className="mt-3 text-sm text-muted">
            {created.trackCount} {created.trackCount === 1 ? 'track' : 'tracks'}
          </p>
          <p className="mt-6 max-w-[30ch] text-xs text-muted/80">Saved as a private playlist in your Spotify library.</p>
        </motion.section>
        <div className="flex flex-col gap-3">
          <a
            href={created.url}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-champagne py-4 text-[15px] font-medium text-ink transition-colors hover:bg-cream"
          >
            Open in Spotify
            <ExternalLink size={16} />
          </a>
          <button
            type="button"
            onClick={startOver}
            className="w-full rounded-full border border-line py-4 text-[15px] text-cream transition-colors hover:border-champagne hover:text-champagne"
          >
            Swipe another playlist
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <Link
          to={`/swipe/${state.playlist.id}`}
          aria-label="Back to swiping"
          className="-ml-2 grid size-9 place-items-center rounded-full text-muted hover:text-cream"
        >
          <ChevronLeft size={20} />
        </Link>
        <Wordmark />
        <span className="size-9" />
      </header>

      <section className="mt-10">
        <p className="eyebrow">Your selection</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight font-light tracking-tight">
          <em className="text-champagne">{kept.length}</em> {kept.length === 1 ? 'track' : 'tracks'} kept
        </h1>
        <p className="mt-2 text-sm text-muted">
          {stats.skipped} skipped
          {!isComplete(state) && stats.unseen > 0 && ` · ${stats.unseen} not reviewed`}
        </p>
      </section>

      <label className="mt-8 block">
        <span className="eyebrow">Playlist name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="mt-2 w-full border-b border-line bg-transparent pb-2 font-serif text-2xl tracking-tight text-cream outline-none transition-colors placeholder:text-muted/50 focus:border-champagne"
          placeholder="Name your playlist"
        />
      </label>

      <ul className="mt-6 flex-1">
        <AnimatePresence initial={false}>
          {kept.map((track) => (
            <motion.li
              key={track.id}
              layout
              exit={{ opacity: 0, x: -24, transition: { duration: 0.25 } }}
              transition={{ duration: 0.35, ease }}
              className="flex items-center gap-4 border-b border-line py-3"
            >
              <img
                src={track.album.images[0]?.url}
                alt=""
                className="size-12 shrink-0 rounded-lg border border-line object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-cream">{track.name}</p>
                <p className="truncate text-xs text-muted">{track.artists.map((a) => a.name).join(', ')}</p>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'removeKept', trackId: track.id })}
                aria-label={`Remove ${track.name}`}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-raised hover:text-cream"
              >
                <X size={16} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        {kept.length === 0 && (
          <li className="flex flex-col items-center gap-4 py-10 text-center text-sm text-muted">
            {isComplete(state) ? (
              <>
                <p>Nothing kept. Give it another listen, or try a different playlist.</p>
                <button type="button" onClick={swipeAgain} className="text-champagne hover:text-cream">
                  Swipe this playlist again
                </button>
                <button type="button" onClick={startOver} className="hover:text-cream">
                  Choose another playlist
                </button>
              </>
            ) : (
              <>
                <p>Nothing kept yet.</p>
                <Link to={`/swipe/${state.playlist.id}`} className="text-champagne hover:text-cream">
                  Back to swiping
                </Link>
              </>
            )}
          </li>
        )}
      </ul>

      <div className="sticky bottom-0 -mx-5 mt-6 bg-gradient-to-t from-ink via-ink to-transparent px-5 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && <p className="mb-3 text-center text-xs text-red-300">{error}</p>}
        <button
          type="button"
          onClick={create}
          disabled={!canCreate}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-champagne py-4 text-[15px] font-medium text-ink transition-colors hover:bg-cream disabled:opacity-40"
        >
          {creating && <Loader2 size={17} className="animate-spin" />}
          {creating ? 'Creating playlist…' : 'Create playlist'}
        </button>
      </div>
    </Screen>
  )
}

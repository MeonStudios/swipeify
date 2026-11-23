import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight, ExternalLink, ListOrdered, LogOut, Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Screen } from '../components/Screen'
import { Wordmark } from '../components/Wordmark'
import { useLogout } from '../hooks/useLogout'
import { playlistCover } from '../lib/coverArt'
import { musicService } from '../services'
import { useShufflePreference } from '../state/preferences'
import { useSwipeSession } from '../state/SwipeSessionContext'
import { isComplete, sessionStats } from '../state/swipeSession'
import type { Playlist } from '../types/music'

const ease = [0.22, 1, 0.36, 1] as const

const trackLabel = (count: number) => `${count.toLocaleString()} ${count === 1 ? 'track' : 'tracks'}`

function PlaylistCover({ playlist, small = false, className = '' }: { playlist: Playlist; small?: boolean; className?: string }) {
  return (
    <img
      src={playlistCover(playlist)}
      alt=""
      loading="lazy"
      className={`${small ? 'size-12' : 'size-16'} shrink-0 rounded-xl border border-line bg-raised object-cover transition-transform duration-300 ${className}`}
    />
  )
}

export default function Playlists() {
  const navigate = useNavigate()
  const { state, dispatch } = useSwipeSession()
  const saved = state.playlist ? { playlist: state.playlist, ...sessionStats(state) } : null
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const logout = useLogout()
  const [shuffle, setShuffle] = useShufflePreference()
  const readable = playlists?.filter((p) => p.readable) ?? []
  const followed = playlists?.filter((p) => !p.readable) ?? []

  useEffect(() => {
    let cancelled = false
    musicService
      .getPlaylists()
      .then((result) => !cancelled && setPlaylists(result))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Something went wrong'))
    return () => {
      cancelled = true
    }
  }, [])

  function resume() {
    if (!state.playlist) return
    navigate(isComplete(state) ? '/results' : `/swipe/${state.playlist.id}`)
  }

  function choose(playlist: Playlist) {
    if (saved && saved.playlist.id === playlist.id) return resume()
    if (
      saved &&
      saved.kept + saved.skipped > 0 &&
      !window.confirm(`Start “${playlist.name}”? Your progress on “${saved.playlist.name}” will be discarded.`)
    ) {
      return
    }
    dispatch({ type: 'reset' })
    navigate(`/swipe/${playlist.id}`)
  }

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <Link to="/" aria-label="Back" className="-ml-2 grid size-9 place-items-center rounded-full text-muted hover:text-cream">
          <ChevronLeft size={20} />
        </Link>
        <Wordmark />
        <button
          type="button"
          onClick={logout}
          aria-label="Log out of Spotify"
          title="Log out"
          className="-mr-2 grid size-9 place-items-center rounded-full text-muted hover:text-cream"
        >
          <LogOut size={17} />
        </button>
      </header>

      <section className="mt-10">
        <p className="eyebrow">Step one</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight font-light tracking-tight">
          Choose a <em className="text-champagne">playlist</em>
        </h1>
        <p className="mt-3 text-sm text-muted">Pick the one you want to clean up. Nothing changes in the original.</p>
        {saved && (
          <button
            type="button"
            onClick={resume}
            className="group mt-6 flex w-full items-center gap-4 rounded-2xl border border-champagne/40 bg-surface p-3 pr-4 text-left transition-colors hover:border-champagne"
          >
            <PlaylistCover playlist={saved.playlist} small />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-champagne">Continue where you left off</p>
              <p className="mt-1 truncate text-[15px] text-cream">{saved.playlist.name}</p>
              <p className="mt-0.5 text-xs tabular-nums text-muted">
                {saved.unseen === 0
                  ? `All ${saved.total.toLocaleString()} reviewed · ${saved.kept.toLocaleString()} kept`
                  : `${(saved.kept + saved.skipped).toLocaleString()} / ${saved.total.toLocaleString()} reviewed · ${saved.kept.toLocaleString()} kept`}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-champagne transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setShuffle(!shuffle)}
          aria-pressed={shuffle}
          title={shuffle ? 'Songs come in random order. Click for playlist order.' : 'Songs come in playlist order. Click to shuffle.'}
          className="mt-5 flex items-center gap-2 rounded-full border border-line py-1.5 pr-3.5 pl-3 text-xs text-muted transition-colors hover:border-champagne/60 hover:text-cream"
        >
          {shuffle ? <Shuffle size={13} className="text-champagne" /> : <ListOrdered size={13} />}
          {shuffle ? 'Shuffled order' : 'Playlist order'}
        </button>
      </section>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {error && <li className="py-6 text-sm text-muted">{error}</li>}

        {!playlists &&
          !error &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex animate-pulse items-center gap-4 py-4">
              <div className="size-16 rounded-xl bg-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-raised" />
                <div className="h-3 w-1/3 rounded bg-raised" />
              </div>
            </li>
          ))}

        {readable.map((playlist, i) => (
          <motion.li
            key={playlist.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: Math.min(i, 10) * 0.05, ease }}
          >
            <button
              type="button"
              onClick={() => choose(playlist)}
              disabled={playlist.trackCount === 0}
              className="group flex w-full items-center gap-4 py-4 text-left disabled:opacity-50"
            >
              <PlaylistCover playlist={playlist} className="group-hover:scale-[1.03]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-xl tracking-tight text-cream">{playlist.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {trackLabel(playlist.trackCount)}
                  {playlist.description && ` · ${playlist.description}`}
                </p>
              </div>
              <ChevronRight
                size={18}
                className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-champagne"
              />
            </button>
          </motion.li>
        ))}
      </ul>

      {followed.length > 0 && (
        <motion.section
          className="mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease }}
        >
          <p className="eyebrow">Followed</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Spotify only lets apps read playlists you own. To swipe one of these, open it in Spotify and choose{' '}
            <span className="text-cream">⋯ → Add to other playlist → New playlist</span>. The copy will appear above.
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line" aria-label="Followed playlists">
            {followed.map((playlist) => (
              <li key={playlist.id} className="flex items-center gap-4 py-3 opacity-45">
                <PlaylistCover playlist={playlist} small />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-cream">{playlist.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">By {playlist.ownerName}</p>
                </div>
                <a
                  href={playlist.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${playlist.name} in Spotify`}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-cream"
                >
                  <ExternalLink size={15} />
                </a>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </Screen>
  )
}

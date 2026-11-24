import { motion } from 'motion/react'
import { ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Screen } from '../components/Screen'
import { Wordmark } from '../components/Wordmark'
import { useLogout } from '../hooks/useLogout'
import { generateCover } from '../lib/coverArt'
import { auth, spotifyClientId } from '../services'
import { useSwipeSession } from '../state/SwipeSessionContext'
import { SPOTIFY_PERMISSIONS } from '../services/spotify/scopes'

const FAN = [
  { seed: 'home/one', rotate: -14, x: -78, y: 18 },
  { seed: 'home/two', rotate: 10, x: 78, y: 14 },
  { seed: 'home/three', rotate: -2, x: 0, y: 0 },
].map((card) => ({ ...card, url: generateCover(card.seed) }))

const ease = [0.22, 1, 0.36, 1] as const

export default function Home() {
  const navigate = useNavigate()
  const logout = useLogout()
  const loggedIn = auth.isLoggedIn()
  const { state } = useSwipeSession()
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    if (loggedIn) return navigate('/playlists')
    setRedirecting(true)
    setError(null)
    try {
      window.location.assign(await auth.beginLogin())
    } catch (e) {
      setRedirecting(false)
      setError(e instanceof Error ? e.message : 'Could not start the Spotify login.')
    }
  }

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <Wordmark />
        {loggedIn && (
          <button type="button" onClick={logout} className="eyebrow transition-colors hover:text-cream">
            Log out
          </button>
        )}
      </header>

      <div className="relative mx-auto mt-14 h-56 w-full" aria-hidden>
        {FAN.map((card, i) => (
          <motion.img
            key={card.seed}
            src={card.url}
            alt=""
            className="absolute top-0 left-1/2 size-44 -ml-22 rounded-[22px] border border-line object-cover shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)]"
            initial={{ opacity: 0, y: 40, rotate: 0, x: 0 }}
            animate={{ opacity: 1, y: card.y, rotate: card.rotate, x: card.x }}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease }}
          />
        ))}
      </div>

      <motion.section
        className="mt-12 flex flex-1 flex-col"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.35, ease }}
      >
        <p className="eyebrow">Your playlists, refined</p>
        <h1 className="mt-4 font-serif text-[2.75rem] leading-[1.05] font-light tracking-tight">
          Less scrolling.
          <br />
          More <em className="text-champagne">listening.</em>
          <br />
          Faster deciding.
        </h1>
        <p className="mt-6 max-w-[34ch] text-[15px] leading-relaxed text-muted">
          One song at a time. Swipe right to keep it, left to let it go, and turn an overgrown playlist into a
          new one in minutes.
        </p>

        <div className="mt-auto pt-10">
          {!spotifyClientId ? (
            <p className="rounded-2xl border border-line px-5 py-4 text-sm leading-relaxed text-muted">
              Add <code className="text-champagne">VITE_SPOTIFY_CLIENT_ID</code> to{' '}
              <code className="text-champagne">.env.local</code> and restart the dev server to connect Spotify.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={connect}
                disabled={redirecting}
                className="group flex w-full items-center justify-between rounded-full bg-champagne py-4 pr-4 pl-7 text-[15px] font-medium text-ink transition-colors hover:bg-cream disabled:opacity-70"
              >
                {!loggedIn ? 'Connect Spotify' : state.playlist ? 'Continue swiping' : 'Choose a playlist'}
                <span className="grid size-9 place-items-center rounded-full bg-ink text-champagne transition-transform duration-300 group-hover:translate-x-0.5">
                  {redirecting ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
                </span>
              </button>
              {error && <p className="mt-3 text-center text-xs text-red-300">{error}</p>}
              {!loggedIn && <Permissions />}
            </>
          )}
        </div>
      </motion.section>
    </Screen>
  )
}

/** Plain-language explanation of every Spotify permission, shown before connecting. */
function Permissions() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mx-auto flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-cream"
      >
        What Swipeify can access
        <ChevronDown size={14} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.4, ease }}
        className="overflow-hidden"
      >
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {SPOTIFY_PERMISSIONS.map((permission) => (
            <li key={permission.scope} className="py-3">
              <p className="text-[13px] text-cream">{permission.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{permission.why}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-muted/80">
          Everything stays in this browser. Swipeify has no server and never changes your existing playlists.
          Logging out only signs this browser out; to revoke access completely, remove Swipeify at{' '}
          <a
            href="https://www.spotify.com/account/apps/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-line underline-offset-2 hover:text-cream"
          >
            spotify.com/account/apps
          </a>
          .
        </p>
      </motion.div>
    </div>
  )
}

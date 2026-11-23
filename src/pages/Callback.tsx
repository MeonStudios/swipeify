import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Screen } from '../components/Screen'
import { Wordmark } from '../components/Wordmark'
import { auth } from '../services'

/** Spotify redirects here after login with `?code=…&state=…` (or `?error=…`). */
export default function Callback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    auth
      .completeLogin(new URLSearchParams(window.location.search))
      .then(() => !cancelled && navigate('/playlists', { replace: true }))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Spotify login failed.'))
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <Screen>
      <header className="flex justify-center">
        <Wordmark />
      </header>
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        {error ? (
          <>
            <p className="font-serif text-2xl">{error}</p>
            <Link to="/" replace className="mt-4 text-sm text-champagne hover:text-cream">
              Back to start
            </Link>
          </>
        ) : (
          <p className="eyebrow animate-pulse">Connecting to Spotify</p>
        )}
      </section>
    </Screen>
  )
}

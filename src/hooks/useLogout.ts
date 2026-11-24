import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { auth, playback } from '../services'
import { loadSession } from '../state/sessionStore'
import { useSwipeSession } from '../state/SwipeSessionContext'

/** Disconnects the player, forgets the Spotify login and the session, and returns Home. */
export function useLogout() {
  const navigate = useNavigate()
  const { dispatch } = useSwipeSession()
  return useCallback(() => {
    playback.disconnect()
    auth.logout()
    dispatch({ type: 'reset' })
    navigate('/', { replace: true })
  }, [navigate, dispatch])
}

/**
 * Follows a logout in another tab: the tokens are shared through localStorage,
 * so once they are gone this tab disconnects its player and returns Home too.
 */
export function useLogoutInOtherTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { dispatch } = useSwipeSession()

  useEffect(() => {
    // `storage` events only fire for changes made by other tabs.
    function onStorage() {
      if (auth.isLoggedIn() || pathname === '/' || pathname === '/callback') return
      playback.disconnect()
      // An explicit logout also removed the saved session; an expired login keeps it to resume later.
      if (!loadSession()) dispatch({ type: 'reset' })
      navigate('/', { replace: true })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [pathname, navigate, dispatch])
}

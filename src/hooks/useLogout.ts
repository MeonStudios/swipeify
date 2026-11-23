import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { auth, playback } from '../services'
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

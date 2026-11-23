import { useEffect, useRef } from 'react'
import { clearSession, saveSession } from './sessionStore'
import { useSwipeSession } from './SwipeSessionContext'

/**
 * Writes the swipe session to localStorage after every change, and removes it
 * when the session is deliberately ended (new playlist, log out). Mounting with
 * an empty state never deletes a saved session.
 */
export function SessionPersistence() {
  const { state } = useSwipeSession()
  const hadSession = useRef(false)
  useEffect(() => {
    if (state.playlist) {
      saveSession(state)
      hadSession.current = true
    } else if (hadSession.current) {
      clearSession()
      hadSession.current = false
    }
  }, [state])
  return null
}

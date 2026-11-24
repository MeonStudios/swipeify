import { X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { clearSession, createSessionWriter } from './sessionStore'
import { useSwipeSession } from './SwipeSessionContext'

/**
 * Whether the last save failed. `streak` increases each time saving starts
 * failing, so a dismissed warning comes back for a new problem.
 */
const saveStatus = (() => {
  let snapshot = { failing: false, streak: 0 }
  const listeners = new Set<() => void>()
  return {
    report(ok: boolean) {
      if (ok === !snapshot.failing) return
      snapshot = { failing: !ok, streak: snapshot.streak + (ok ? 0 : 1) }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get: () => snapshot,
  }
})()

/**
 * Writes the swipe session to localStorage after every change, and removes it
 * when the session is deliberately ended (new playlist, log out). Mounting with
 * an empty state never deletes a saved session.
 */
export function SessionPersistence() {
  const { state } = useSwipeSession()
  const hadSession = useRef(false)
  const [write] = useState(() => createSessionWriter())

  useEffect(() => {
    if (state.playlist) {
      saveStatus.report(write(state))
      hadSession.current = true
    } else if (hadSession.current) {
      clearSession()
      saveStatus.report(true)
      hadSession.current = false
    }
  }, [state, write])

  return <SaveWarning />
}

/** The user relies on progress surviving a reload, so a failed save must not be silent. */
function SaveWarning() {
  const { failing, streak } = useSyncExternalStore(saveStatus.subscribe, saveStatus.get)
  const [dismissedStreak, setDismissedStreak] = useState(0)

  if (!failing || dismissedStreak === streak) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex w-[min(100%-1.5rem,28rem)] items-start gap-3 rounded-2xl border border-line bg-raised px-4 py-3 text-xs leading-relaxed text-cream shadow-lg"
    >
      <p className="flex-1">
        Your progress can’t be saved in this browser (its storage may be full), so it will be lost if you reload or
        close this tab. Finish and save your playlist before leaving.
      </p>
      <button
        type="button"
        onClick={() => setDismissedStreak(streak)}
        aria-label="Dismiss warning"
        className="-mr-1 grid size-6 shrink-0 place-items-center rounded-full text-muted hover:text-cream"
      >
        <X size={14} />
      </button>
    </div>
  )
}

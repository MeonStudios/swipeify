import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { loadSession } from './sessionStore'
import { initialSwipeState, swipeReducer, type SwipeAction, type SwipeState } from './swipeSession'

interface SwipeSessionValue {
  state: SwipeState
  dispatch: Dispatch<SwipeAction>
}

const SwipeSessionContext = createContext<SwipeSessionValue | null>(null)

export function SwipeSessionProvider({ children }: { children: ReactNode }) {
  // Pick up a saved session after a reload or a closed tab.
  const [state, dispatch] = useReducer(swipeReducer, undefined, () => loadSession() ?? initialSwipeState)
  return <SwipeSessionContext value={{ state, dispatch }}>{children}</SwipeSessionContext>
}

export function useSwipeSession(): SwipeSessionValue {
  const value = useContext(SwipeSessionContext)
  if (!value) throw new Error('useSwipeSession must be used inside <SwipeSessionProvider>')
  return value
}

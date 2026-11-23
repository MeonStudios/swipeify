import { useCallback, useState } from 'react'

const SHUFFLE_KEY = 'swipeify.shuffle'

/** Swipe in random order unless the user turned it off. */
export function getShufflePreference(): boolean {
  return window.localStorage.getItem(SHUFFLE_KEY) !== 'off'
}

export function useShufflePreference() {
  const [shuffle, setShuffleState] = useState(getShufflePreference)
  const setShuffle = useCallback((value: boolean) => {
    window.localStorage.setItem(SHUFFLE_KEY, value ? 'on' : 'off')
    setShuffleState(value)
  }, [])
  return [shuffle, setShuffle] as const
}

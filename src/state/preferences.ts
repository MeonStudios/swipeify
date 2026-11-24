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

const VOLUME_KEY = 'swipeify.volume'

/** Last player volume (0–1), or undefined to use the player's default. */
export function getVolumePreference(): number | undefined {
  const saved = Number.parseFloat(window.localStorage.getItem(VOLUME_KEY) ?? '')
  return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : undefined
}

export function saveVolumePreference(volume: number): void {
  try {
    window.localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    // Not worth bothering the user about.
  }
}

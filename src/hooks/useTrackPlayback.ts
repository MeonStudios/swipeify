import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { playback } from '../services'
import type { Track } from '../types/music'

/** Start each song about a third in: past the intro, usually near the hook. */
const START_FRACTION = 0.3

export const startPosition = (track: Track) => Math.floor(track.durationMs * START_FRACTION)

/**
 * Plays the current swipe card through the Spotify Web Playback SDK.
 *
 * Nothing plays (and other Spotify devices are left alone) until the user
 * presses play or swipes once; after that each new card starts by itself.
 * When there is nothing left to swipe, or the screen closes, the player
 * disconnects so Spotify no longer lists Swipeify as the active device.
 */
export function useTrackPlayback(track: Track | null) {
  const snapshot = useSyncExternalStore(playback.subscribe, playback.getSnapshot)
  const unlockedRef = useRef(false)
  const [now, setNow] = useState(() => Date.now())

  const uri = track?.uri ?? null
  const start = track ? startPosition(track) : 0

  // Connect while there is a song to swipe (again after a reset); otherwise let go of the device.
  useEffect(() => {
    if (!uri) playback.disconnect()
    else if (snapshot.availability === 'idle') playback.init()
  }, [uri, snapshot.availability])
  useEffect(() => () => playback.disconnect(), [])

  useEffect(() => {
    if (uri && unlockedRef.current) playback.play(uri, start)
  }, [uri, start])

  const isCurrent = !!uri && snapshot.activeUri === uri
  const isPlaying = isCurrent && snapshot.isPlaying

  // Re-render a few times per second so the position moves while playing.
  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [isPlaying])

  const durationMs = isCurrent && snapshot.durationMs > 0 ? snapshot.durationMs : (track?.durationMs ?? 0)
  const positionMs = !isCurrent
    ? 0
    : Math.min(durationMs, snapshot.positionMs + (isPlaying ? Math.max(0, now - snapshot.updatedAt) : 0))

  /** Call from a user gesture (swipe, button) to allow audio from now on. */
  const unlock = useCallback(() => {
    unlockedRef.current = true
    playback.activate()
  }, [])

  const toggle = useCallback(() => {
    if (!track) return
    unlock()
    playback.toggle(track.uri, startPosition(track))
  }, [track, unlock])

  const replay = useCallback(() => {
    if (!track) return
    unlock()
    playback.restart(track.uri, startPosition(track))
  }, [track, unlock])

  return {
    availability: snapshot.availability,
    isPlaying,
    positionMs,
    durationMs,
    unlock,
    toggle,
    replay,
  }
}

// Saves the swipe session in localStorage so a reload, closed tab or expired
// login never loses progress.

import type { Playlist, Track } from '../types/music'
import type { DecisionEntry, SwipeState } from './swipeSession'

const SESSION_KEY = 'swipeify.session'
const VERSION = 1

interface SavedSession {
  version: number
  savedAt: number
  playlist: Playlist
  /** Source order. */
  sourceTracks: Track[]
  /** Swipe order as track ids (avoids storing every track twice). */
  order: string[]
  decisions: DecisionEntry[]
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function saveSession(state: SwipeState, storage: KeyValueStorage = window.localStorage): void {
  if (!state.playlist) return
  const sourceTracks = state.sourceTracks?.length ? state.sourceTracks : state.tracks
  const saved: SavedSession = {
    version: VERSION,
    savedAt: Date.now(),
    playlist: state.playlist,
    sourceTracks,
    order: state.tracks.map((t) => t.id),
    decisions: state.decisions,
  }
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(saved))
  } catch (error) {
    console.warn('[session] could not save progress', error)
  }
}

export function loadSession(storage: KeyValueStorage = window.localStorage): SwipeState | null {
  try {
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedSession
    if (saved.version !== VERSION || !saved.playlist || !Array.isArray(saved.sourceTracks)) return null
    const byId = new Map(saved.sourceTracks.map((t) => [t.id, t]))
    const tracks = saved.order.map((id) => byId.get(id)).filter((t): t is Track => !!t)
    if (tracks.length !== saved.order.length) return null
    return { playlist: saved.playlist, tracks, sourceTracks: saved.sourceTracks, decisions: saved.decisions }
  } catch {
    return null
  }
}

export function clearSession(storage: KeyValueStorage = window.localStorage): void {
  storage.removeItem(SESSION_KEY)
}

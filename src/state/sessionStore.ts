// Saves the swipe session in localStorage so a reload, closed tab or expired
// login never loses progress.
//
// Two keys keep swiping cheap: the tracks are written once when a session
// starts (or after a reload), and every swipe only rewrites a tiny record of
// the decisions, one character per reviewed track.

import type { Playlist, Track } from '../types/music'
import type { DecisionEntry, SwipeState } from './swipeSession'

const SESSION_KEY = 'swipeify.session'
const DECISIONS_KEY = 'swipeify.session.decisions'
const VERSION = 2

interface SavedSession {
  version: typeof VERSION
  /** Ties the decisions record to this exact track list. */
  id: number
  playlist: Playlist
  /** Source order. */
  sourceTracks: Track[]
  /** Swipe order as track ids (avoids storing every track twice). */
  order: string[]
}

interface SavedDecisions {
  id: number
  /** Character i is the decision for the i-th track in swipe order: k = keep, s = skip. */
  decisions: string
}

/** Version 1 stored everything under one key and was rewritten on every swipe. */
interface SavedSessionV1 {
  version: 1
  playlist: Playlist
  sourceTracks: Track[]
  order: string[]
  decisions: DecisionEntry[]
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Only the images the UI shows: the largest (card) and the smallest (lists). */
function slimTrack(track: Track): Track {
  const { images } = track.album
  const kept = images.length > 2 ? [images[0], images[images.length - 1]] : images
  return { ...track, album: { ...track.album, images: kept } }
}

/**
 * Returns a function that saves `state` and reports whether that worked
 * (false when the browser's storage is full or unavailable).
 */
export function createSessionWriter(storage: KeyValueStorage = window.localStorage) {
  /** What the session key currently holds, to skip rewriting the tracks on every swipe. */
  let written: { playlist: Playlist; tracks: Track[]; id: number } | null = null

  return function write(state: SwipeState): boolean {
    if (!state.playlist) return true
    try {
      if (!written || written.playlist !== state.playlist || written.tracks !== state.tracks) {
        const sourceTracks = state.sourceTracks?.length ? state.sourceTracks : state.tracks
        const id = Date.now()
        const session: SavedSession = {
          version: VERSION,
          id,
          playlist: state.playlist,
          sourceTracks: sourceTracks.map(slimTrack),
          order: state.tracks.map((t) => t.id),
        }
        // Drop the old decisions first so they can never be read against the new tracks.
        storage.removeItem(DECISIONS_KEY)
        storage.setItem(SESSION_KEY, JSON.stringify(session))
        written = { playlist: state.playlist, tracks: state.tracks, id }
      }
      const decisions: SavedDecisions = {
        id: written.id,
        decisions: state.decisions.map((entry) => (entry.decision === 'keep' ? 'k' : 's')).join(''),
      }
      storage.setItem(DECISIONS_KEY, JSON.stringify(decisions))
      return true
    } catch (error) {
      console.warn('[session] could not save progress', error)
      // Try the full write again next time.
      written = null
      return false
    }
  }
}

/** One-off save; see `createSessionWriter` for saving repeatedly. */
export function saveSession(state: SwipeState, storage: KeyValueStorage = window.localStorage): boolean {
  return createSessionWriter(storage)(state)
}

export function loadSession(storage: KeyValueStorage = window.localStorage): SwipeState | null {
  try {
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedSession | SavedSessionV1 | null
    if (!saved?.playlist || !Array.isArray(saved.sourceTracks) || !Array.isArray(saved.order)) return null
    const byId = new Map(saved.sourceTracks.map((t) => [t.id, t]))
    const tracks = saved.order.map((id) => byId.get(id)).filter((t): t is Track => !!t)
    if (tracks.length !== saved.order.length) return null

    let decisions: DecisionEntry[]
    if (saved.version === 1) {
      if (!Array.isArray(saved.decisions)) return null
      decisions = saved.decisions
    } else if (saved.version === VERSION) {
      decisions = readDecisions(storage, saved.id, tracks)
    } else {
      return null
    }

    // Decision i belongs to tracks[i]; anything else is corrupt.
    const consistent =
      decisions.length <= tracks.length &&
      decisions.every(
        (entry, i) => entry?.trackId === tracks[i].id && (entry.decision === 'keep' || entry.decision === 'skip'),
      )
    if (!consistent) return null
    return { playlist: saved.playlist, tracks, sourceTracks: saved.sourceTracks, decisions }
  } catch {
    return null
  }
}

/** The saved decisions for session `id`; none if they are missing or belong to another session. */
function readDecisions(storage: KeyValueStorage, id: number, tracks: Track[]): DecisionEntry[] {
  const saved = JSON.parse(storage.getItem(DECISIONS_KEY) ?? 'null') as SavedDecisions | null
  if (saved?.id !== id || typeof saved.decisions !== 'string' || !/^[ks]*$/.test(saved.decisions)) return []
  if (saved.decisions.length > tracks.length) return []
  return [...saved.decisions].map((char, i) => ({
    trackId: tracks[i].id,
    decision: char === 'k' ? 'keep' : 'skip',
  }))
}

export function clearSession(storage: KeyValueStorage = window.localStorage): void {
  storage.removeItem(SESSION_KEY)
  storage.removeItem(DECISIONS_KEY)
}

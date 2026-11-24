import { shuffled } from '../lib/random'
import type { Playlist, Track } from '../types/music'

export type Decision = 'keep' | 'skip'

export interface DecisionEntry {
  trackId: string
  decision: Decision
}

export interface SwipeState {
  playlist: Playlist | null
  /** Tracks in swipe order (shuffled or not). */
  tracks: Track[]
  /** Tracks in the source playlist's order; the new playlist keeps this order. */
  sourceTracks: Track[]
  /** Ordered: entry i is the decision for tracks[i]. */
  decisions: DecisionEntry[]
}

export type SwipeAction =
  /** `shuffleSeed` swipes the tracks in a random (seeded, so reproducible) order. */
  | { type: 'start'; playlist: Playlist; tracks: Track[]; shuffleSeed?: string }
  | { type: 'decide'; decision: Decision }
  /** Takes back the last decision; that track becomes the current one again. */
  | { type: 'undo' }
  /** Flips the decision for an already reviewed track (drop a keeper, rescue a skipped one). */
  | { type: 'changeDecision'; trackId: string; decision: Decision }
  | { type: 'restart' }
  | { type: 'reset' }

export const initialSwipeState: SwipeState = {
  playlist: null,
  tracks: [],
  sourceTracks: [],
  decisions: [],
}

export function swipeReducer(state: SwipeState, action: SwipeAction): SwipeState {
  switch (action.type) {
    case 'start':
      return {
        playlist: action.playlist,
        tracks: action.shuffleSeed ? shuffled(action.tracks, action.shuffleSeed) : action.tracks,
        sourceTracks: action.tracks,
        decisions: [],
      }

    case 'decide': {
      const track = currentTrack(state)
      if (!track) return state
      return {
        ...state,
        decisions: [...state.decisions, { trackId: track.id, decision: action.decision }],
      }
    }

    case 'undo':
      if (state.decisions.length === 0) return state
      return { ...state, decisions: state.decisions.slice(0, -1) }

    case 'changeDecision':
      return {
        ...state,
        decisions: state.decisions.map((entry) =>
          entry.trackId === action.trackId ? { ...entry, decision: action.decision } : entry,
        ),
      }

    case 'restart':
      return { ...state, decisions: [] }

    case 'reset':
      return initialSwipeState
  }
}

// ── Selectors ────────────────────────────────────────────────────────────────

export const currentIndex = (state: SwipeState) => state.decisions.length

export const currentTrack = (state: SwipeState): Track | null =>
  state.tracks[currentIndex(state)] ?? null

export const nextTrack = (state: SwipeState): Track | null =>
  state.tracks[currentIndex(state) + 1] ?? null

export const isComplete = (state: SwipeState) =>
  state.tracks.length > 0 && currentIndex(state) >= state.tracks.length

export const canUndo = (state: SwipeState) => state.decisions.length > 0

function tracksWith(state: SwipeState, decision: Decision): Track[] {
  const ids = new Set(state.decisions.filter((entry) => entry.decision === decision).map((entry) => entry.trackId))
  return state.sourceTracks.filter((track) => ids.has(track.id))
}

/** Kept tracks, in the source playlist's order (even when swiped shuffled). */
export const keptTracks = (state: SwipeState): Track[] => tracksWith(state, 'keep')

/** Skipped tracks, in the source playlist's order. */
export const skippedTracks = (state: SwipeState): Track[] => tracksWith(state, 'skip')

export function sessionStats(state: SwipeState) {
  const kept = state.decisions.filter((entry) => entry.decision === 'keep').length
  return {
    kept,
    skipped: state.decisions.length - kept,
    unseen: state.tracks.length - state.decisions.length,
    total: state.tracks.length,
  }
}

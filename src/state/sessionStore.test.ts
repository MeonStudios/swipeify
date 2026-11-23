import { describe, expect, it } from 'vitest'
import type { Playlist, Track } from '../types/music'
import { clearSession, loadSession, saveSession } from './sessionStore'
import { initialSwipeState, swipeReducer, type SwipeAction, type SwipeState } from './swipeSession'

const track = (id: string): Track => ({
  id,
  uri: `spotify:track:${id}`,
  name: id,
  artists: [],
  album: { id: 'al', name: 'Album', images: [] },
  durationMs: 1000,
  externalUrl: `https://open.spotify.com/track/${id}`,
})

const playlist: Playlist = {
  id: 'p1',
  uri: 'spotify:playlist:p1',
  name: 'Mix',
  description: '',
  images: [],
  ownerName: 'You',
  trackCount: 6,
  readable: true,
  externalUrl: 'https://open.spotify.com/playlist/p1',
}

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const run = (...actions: SwipeAction[]): SwipeState => actions.reduce(swipeReducer, initialSwipeState)
const tracks = ['a', 'b', 'c', 'd', 'e', 'f'].map(track)

describe('session store', () => {
  it('restores a shuffled session exactly, including decisions', () => {
    const storage = memoryStorage()
    const state = run(
      { type: 'start', playlist, tracks, shuffleSeed: 'seed' },
      { type: 'decide', decision: 'keep' },
      { type: 'decide', decision: 'skip' },
    )
    saveSession(state, storage)
    expect(loadSession(storage)).toEqual(state)
  })

  it('does not save an empty session', () => {
    const storage = memoryStorage()
    saveSession(initialSwipeState, storage)
    expect(storage.data.size).toBe(0)
  })

  it('returns null for missing, corrupt or inconsistent data', () => {
    const storage = memoryStorage()
    expect(loadSession(storage)).toBeNull()
    storage.setItem('swipeify.session', '{nope')
    expect(loadSession(storage)).toBeNull()
    storage.setItem(
      'swipeify.session',
      JSON.stringify({ version: 1, playlist, sourceTracks: [track('a')], order: ['a', 'missing'], decisions: [] }),
    )
    expect(loadSession(storage)).toBeNull()
  })

  it('clears a saved session', () => {
    const storage = memoryStorage()
    saveSession(run({ type: 'start', playlist, tracks }), storage)
    clearSession(storage)
    expect(loadSession(storage)).toBeNull()
  })
})

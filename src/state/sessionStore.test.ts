import { describe, expect, it } from 'vitest'
import type { Playlist, Track } from '../types/music'
import { clearSession, createSessionWriter, loadSession, saveSession } from './sessionStore'
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

  it('writes the tracks once and only the small decisions record on each swipe', () => {
    const storage = memoryStorage()
    const writes: string[] = []
    const spy = { ...storage, setItem: (k: string, v: string) => (writes.push(k), storage.setItem(k, v)) }
    const write = createSessionWriter(spy)
    let state = run({ type: 'start', playlist, tracks })
    write(state)
    for (let i = 0; i < 3; i++) {
      state = swipeReducer(state, { type: 'decide', decision: i === 1 ? 'skip' : 'keep' })
      write(state)
    }
    expect(writes.filter((k) => k === 'swipeify.session')).toHaveLength(1)
    expect(writes.filter((k) => k === 'swipeify.session.decisions')).toHaveLength(4)
    expect(JSON.parse(storage.data.get('swipeify.session.decisions')!).decisions).toBe('ksk')
    expect(loadSession(storage)).toEqual(state)
  })

  it('stores only the largest and smallest album image', () => {
    const storage = memoryStorage()
    const images = [640, 300, 64].map((size) => ({ url: `https://i.scdn.co/${size}`, width: size, height: size }))
    const withArt = { ...track('a'), album: { id: 'al', name: 'Album', images } }
    saveSession(run({ type: 'start', playlist, tracks: [withArt] }), storage)
    expect(loadSession(storage)!.tracks[0].album.images.map((i) => i.width)).toEqual([640, 64])
  })

  it('ignores decisions that belong to a different session', () => {
    const storage = memoryStorage()
    saveSession(run({ type: 'start', playlist, tracks }, { type: 'decide', decision: 'keep' }), storage)
    storage.setItem('swipeify.session.decisions', JSON.stringify({ id: -1, decisions: 'kkk' }))
    expect(loadSession(storage)!.decisions).toEqual([])
  })

  it('reports a failed save instead of throwing', () => {
    const storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    }
    expect(saveSession(run({ type: 'start', playlist, tracks }), storage)).toBe(false)
  })

  it('still loads a session saved by the previous version', () => {
    const storage = memoryStorage()
    storage.setItem(
      'swipeify.session',
      JSON.stringify({
        version: 1,
        playlist,
        sourceTracks: tracks,
        order: tracks.map((t) => t.id),
        decisions: [{ trackId: 'a', decision: 'keep' }],
      }),
    )
    expect(loadSession(storage)?.decisions).toEqual([{ trackId: 'a', decision: 'keep' }])
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
    storage.setItem('swipeify.session', JSON.stringify({ version: 1, playlist, sourceTracks: [track('a')] }))
    expect(loadSession(storage)).toBeNull()
    storage.setItem(
      'swipeify.session',
      JSON.stringify({
        version: 1,
        playlist,
        sourceTracks: [track('a')],
        order: ['a'],
        decisions: [{ trackId: 'a', decision: 'keep' }, { trackId: 'b', decision: 'keep' }],
      }),
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

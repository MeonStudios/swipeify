import { describe, expect, it } from 'vitest'
import type { Playlist, Track } from '../types/music'
import {
  currentTrack,
  initialSwipeState,
  isComplete,
  keptTracks,
  nextTrack,
  sessionStats,
  swipeReducer,
  type SwipeAction,
  type SwipeState,
} from './swipeSession'

const track = (id: string): Track => ({
  id,
  uri: `spotify:track:${id}`,
  name: `Track ${id}`,
  artists: [{ id: 'a', name: 'Artist' }],
  album: { id: 'al', name: 'Album', images: [] },
  durationMs: 180_000,
  externalUrl: `https://open.spotify.com/track/${id}`,
})

const playlist: Playlist = {
  id: 'p1',
  uri: 'spotify:playlist:p1',
  name: 'Test',
  description: '',
  images: [],
  ownerName: 'You',
  trackCount: 3,
  readable: true,
  externalUrl: 'https://open.spotify.com/playlist/p1',
}

const tracks = [track('t1'), track('t2'), track('t3')]

const run = (...actions: SwipeAction[]): SwipeState =>
  actions.reduce(swipeReducer, initialSwipeState)

const start: SwipeAction = { type: 'start', playlist, tracks }
const keep: SwipeAction = { type: 'decide', decision: 'keep' }
const skip: SwipeAction = { type: 'decide', decision: 'skip' }

describe('swipeReducer', () => {
  it('starts a session on the first track', () => {
    const state = run(start)
    expect(currentTrack(state)?.id).toBe('t1')
    expect(nextTrack(state)?.id).toBe('t2')
    expect(isComplete(state)).toBe(false)
  })

  it('is not complete before any tracks are loaded', () => {
    expect(isComplete(initialSwipeState)).toBe(false)
    expect(currentTrack(initialSwipeState)).toBeNull()
  })

  it('advances one track per decision', () => {
    const state = run(start, keep)
    expect(currentTrack(state)?.id).toBe('t2')
    expect(nextTrack(state)?.id).toBe('t3')
  })

  it('has no next track on the last card', () => {
    const state = run(start, keep, skip)
    expect(currentTrack(state)?.id).toBe('t3')
    expect(nextTrack(state)).toBeNull()
  })

  it('completes after deciding on every track', () => {
    const state = run(start, keep, skip, keep)
    expect(isComplete(state)).toBe(true)
    expect(currentTrack(state)).toBeNull()
  })

  it('ignores decisions once complete', () => {
    const done = run(start, keep, skip, keep)
    expect(swipeReducer(done, skip)).toBe(done)
  })

  it('returns kept tracks in playlist order', () => {
    const state = run(start, keep, skip, keep)
    expect(keptTracks(state).map((t) => t.id)).toEqual(['t1', 't3'])
  })

  it('counts kept, skipped and unseen tracks', () => {
    const state = run(start, keep, skip)
    expect(sessionStats(state)).toEqual({ kept: 1, skipped: 1, unseen: 1, total: 3 })
  })

  it('removes a track from the kept list during review', () => {
    const state = run(start, keep, keep, { type: 'removeKept', trackId: 't1' })
    expect(keptTracks(state).map((t) => t.id)).toEqual(['t2'])
    expect(sessionStats(state)).toMatchObject({ kept: 1, skipped: 1 })
    // Removing during review must not move the swipe position.
    expect(currentTrack(state)?.id).toBe('t3')
  })

  it('restarts cleanly when a new session starts', () => {
    const state = run(start, keep, keep, start)
    expect(currentTrack(state)?.id).toBe('t1')
    expect(keptTracks(state)).toEqual([])
  })

  it('restarts the same playlist from the first track', () => {
    const state = run(start, skip, skip, skip, { type: 'restart' })
    expect(state.playlist).toBe(playlist)
    expect(currentTrack(state)?.id).toBe('t1')
    expect(isComplete(state)).toBe(false)
    expect(sessionStats(state)).toEqual({ kept: 0, skipped: 0, unseen: 3, total: 3 })
  })

  it('shuffles the swipe order with a seed, reproducibly', () => {
    const many = Array.from({ length: 20 }, (_, i) => track(`t${i}`))
    const shuffledStart: SwipeAction = { type: 'start', playlist, tracks: many, shuffleSeed: 'seed-1' }
    const a = run(shuffledStart)
    expect(a.tracks.map((t) => t.id)).not.toEqual(many.map((t) => t.id))
    expect([...a.tracks].map((t) => t.id).sort()).toEqual(many.map((t) => t.id).sort())
    expect(run(shuffledStart).tracks).toEqual(a.tracks)
  })

  it('keeps the source order for kept tracks after a shuffled swipe', () => {
    const many = Array.from({ length: 10 }, (_, i) => track(`t${i}`))
    const state = run({ type: 'start', playlist, tracks: many, shuffleSeed: 'seed-2' }, ...many.map(() => keep))
    expect(keptTracks(state).map((t) => t.id)).toEqual(many.map((t) => t.id))
  })

  it('keeps the shuffled order when restarting', () => {
    const shuffledStart: SwipeAction = { type: 'start', playlist, tracks, shuffleSeed: 'seed-3' }
    const before = run(shuffledStart).tracks
    expect(run(shuffledStart, keep, { type: 'restart' }).tracks).toEqual(before)
  })

  it('resets to the initial state', () => {
    expect(run(start, keep, { type: 'reset' })).toEqual(initialSwipeState)
  })
})

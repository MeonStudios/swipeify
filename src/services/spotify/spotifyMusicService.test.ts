import { describe, expect, it, vi } from 'vitest'
import { LIKED_SONGS_ID } from '../../types/music'
import { createSpotifyClient } from './client'
import { createSpotifyMusicService } from './spotifyMusicService'
import { json, scriptedFetch } from './testUtils'

function setup(...responses: Response[]) {
  const http = scriptedFetch(...responses)
  const auth = { getAccessToken: vi.fn(async () => 't'), forceRefresh: vi.fn(async () => 't') }
  const service = createSpotifyMusicService(createSpotifyClient({ auth, fetch: http.fetch }))
  return { service, http }
}

const playlist = (id: string, ownerId: string) => ({
  id,
  uri: `spotify:playlist:${id}`,
  name: id,
  images: [],
  owner: { id: ownerId, display_name: ownerId },
  items: { total: 3 },
})

const track = (id: string) => ({ type: 'track', id, uri: `spotify:track:${id}`, name: id, duration_ms: 1000 })

describe('spotify music service', () => {
  it('lists Liked Songs first, then readable playlists, then followed ones', async () => {
    // Promise.all fires /me, /me/tracks and /me/playlists in that order.
    const { service } = setup(
      json(200, { id: 'me' }),
      json(200, { items: [], total: 1234, next: null }),
      json(200, {
        items: [playlist('followed', 'qmusic'), null, playlist('mine', 'me')],
        total: 3,
        next: null,
      }),
    )
    const playlists = await service.getPlaylists()
    expect(playlists.map((p) => [p.id, p.readable])).toEqual([
      [LIKED_SONGS_ID, true],
      ['mine', true],
      ['followed', false],
    ])
    expect(playlists[0].trackCount).toBe(1234)
  })

  it('loads every page of a playlist from the new /items endpoint, filtered and deduped', async () => {
    const { service, http } = setup(
      json(200, {
        items: [{ item: track('a') }, { item: { ...track('ep'), type: 'episode' } }],
        total: 4,
        next: 'https://api.spotify.com/v1/next-page',
      }),
      json(200, { items: [{ item: track('b') }, { item: track('a') }], total: 4, next: null }),
    )
    const onProgress = vi.fn()
    const tracks = await service.getPlaylistTracks('p1', onProgress)
    expect(tracks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(http.call(0).url).toBe('https://api.spotify.com/v1/playlists/p1/items?limit=50&market=from_token')
    expect(onProgress).toHaveBeenLastCalledWith(4, 4)
  })

  it('reads Liked Songs from the saved-tracks endpoint', async () => {
    const { service, http } = setup(json(200, { items: [{ track: track('a') }], total: 1, next: null }))
    expect((await service.getPlaylistTracks(LIKED_SONGS_ID)).map((t) => t.id)).toEqual(['a'])
    expect(http.call(0).url).toBe('https://api.spotify.com/v1/me/tracks?limit=50&market=from_token')
  })

  it('creates a private playlist and adds tracks in batches of 100', async () => {
    const uris = Array.from({ length: 205 }, (_, i) => `spotify:track:${i}`)
    const { service, http } = setup(
      json(201, { id: 'new', name: 'Fresh', external_urls: { spotify: 'https://open.spotify.com/playlist/new' } }),
      json(201, { snapshot_id: '1' }),
      json(201, { snapshot_id: '2' }),
      json(201, { snapshot_id: '3' }),
    )
    const created = await service.createPlaylist('Fresh', uris)

    expect(created).toEqual({ id: 'new', name: 'Fresh', trackCount: 205, url: 'https://open.spotify.com/playlist/new' })
    expect(http.call(0)).toMatchObject({ url: 'https://api.spotify.com/v1/me/playlists', method: 'POST' })
    expect(JSON.parse(String(http.call(0).body))).toMatchObject({ name: 'Fresh', public: false })
    const batches = [1, 2, 3].map((i) => JSON.parse(String(http.call(i).body)).uris.length)
    expect(batches).toEqual([100, 100, 5])
    expect(http.call(1).url).toBe('https://api.spotify.com/v1/playlists/new/items')
  })
})

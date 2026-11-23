import { describe, expect, it } from 'vitest'
import { cleanDescription, mapPlaylist, toPlayableTracks, type RawEntry, type RawPlaylist, type RawTrack } from './mapping'

const rawTrack = (id: string, extra: Partial<RawTrack> = {}): RawTrack => ({
  type: 'track',
  id,
  uri: `spotify:track:${id}`,
  name: `Song ${id}`,
  duration_ms: 200_000,
  artists: [{ id: 'ar1', name: 'Artist' }],
  album: { id: 'al1', name: 'Album', images: [{ url: 'https://img/1', width: 640, height: 640 }] },
  external_urls: { spotify: `https://open.spotify.com/track/${id}` },
  ...extra,
})

const rawPlaylist = (extra: Partial<RawPlaylist> = {}): RawPlaylist => ({
  id: 'p1',
  uri: 'spotify:playlist:p1',
  name: 'Mix',
  description: 'Songs &amp; more',
  images: null,
  owner: { id: 'me', display_name: 'Me' },
  collaborative: false,
  items: { total: 12 },
  ...extra,
})

describe('mapPlaylist', () => {
  it('marks own playlists readable and reads the new `items.total` field', () => {
    const playlist = mapPlaylist(rawPlaylist(), 'me')
    expect(playlist).toMatchObject({ readable: true, ownerName: 'You', trackCount: 12, images: [] })
    expect(playlist.description).toBe('Songs & more')
    expect(playlist.externalUrl).toBe('https://open.spotify.com/playlist/p1')
  })

  it('marks followed playlists unreadable and collaborative ones readable', () => {
    const owner = { id: 'qmusic', display_name: 'Qmusic' }
    expect(mapPlaylist(rawPlaylist({ owner }), 'me')).toMatchObject({ readable: false, ownerName: 'Qmusic' })
    expect(mapPlaylist(rawPlaylist({ owner, collaborative: true }), 'me').readable).toBe(true)
  })

  it('falls back to the legacy `tracks.total` field', () => {
    expect(mapPlaylist(rawPlaylist({ items: undefined, tracks: { total: 7 } }), 'me').trackCount).toBe(7)
  })
})

describe('cleanDescription', () => {
  it('strips HTML tags and decodes entities', () => {
    expect(cleanDescription('Best of <a href="x">2026</a> &#x27;n&#39; more&nbsp;&quot;hits&quot;')).toBe(
      `Best of 2026 'n' more "hits"`,
    )
    expect(cleanDescription(null)).toBe('')
  })
})

describe('toPlayableTracks', () => {
  it('maps tracks from both `item` (new) and `track` (legacy) entries', () => {
    const tracks = toPlayableTracks([{ item: rawTrack('a') }, { track: rawTrack('b') }])
    expect(tracks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(tracks[0]).toEqual({
      id: 'a',
      uri: 'spotify:track:a',
      name: 'Song a',
      artists: [{ id: 'ar1', name: 'Artist' }],
      album: { id: 'al1', name: 'Album', images: [{ url: 'https://img/1', width: 640, height: 640 }] },
      durationMs: 200_000,
      externalUrl: 'https://open.spotify.com/track/a',
    })
  })

  it('drops episodes, local files, unavailable tracks and empty entries', () => {
    const entries: RawEntry[] = [
      { item: rawTrack('keep') },
      { item: rawTrack('ep', { type: 'episode' }) },
      { is_local: true, item: rawTrack('local1') },
      { item: rawTrack('local2', { is_local: true }) },
      { item: rawTrack('gone', { is_playable: false }) },
      { item: { ...rawTrack('x'), id: null } },
      { item: null },
    ]
    expect(toPlayableTracks(entries).map((t) => t.id)).toEqual(['keep'])
  })

  it('keeps only the first occurrence of duplicates', () => {
    const entries = [rawTrack('a'), rawTrack('b'), rawTrack('a', { name: 'Again' })].map((item) => ({ item }))
    const tracks = toPlayableTracks(entries)
    expect(tracks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(tracks[0].name).toBe('Song a')
  })
})

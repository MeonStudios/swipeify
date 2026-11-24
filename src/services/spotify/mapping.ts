// Maps raw Spotify Web API JSON to Swipeify's domain types.
//
// Since February 2026 Spotify renamed a playlist's `tracks` to `items` (and each
// entry's `track` to `item`). Both spellings are accepted so the mapping keeps
// working for responses in either format.

import { LIKED_SONGS_ID, type Image, type Playlist, type Track } from '../../types/music'

export interface RawImage {
  url: string
  width?: number | null
  height?: number | null
}

export interface RawPlaylist {
  id: string
  uri: string
  name: string
  description?: string | null
  images?: RawImage[] | null
  owner: { id: string; display_name?: string | null }
  collaborative?: boolean
  external_urls?: { spotify?: string }
  items?: { total?: number } | null
  tracks?: { total?: number } | null
}

export interface RawTrack {
  type?: string
  id: string | null
  uri: string
  name: string
  duration_ms: number
  is_local?: boolean
  is_playable?: boolean
  artists?: { id: string | null; name: string }[]
  album?: { id: string | null; name: string; images?: RawImage[] | null }
  external_urls?: { spotify?: string }
}

/** One entry of a playlist's items or of the saved-tracks list. */
export interface RawEntry {
  is_local?: boolean
  item?: RawTrack | null
  track?: RawTrack | null
}

const mapImages = (images: RawImage[] | null | undefined): Image[] =>
  (images ?? []).map((image) => ({ url: image.url, width: image.width ?? null, height: image.height ?? null }))

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Playlist descriptions come back as HTML: strip tags and decode entities. */
export function cleanDescription(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
        return Number.isFinite(n) ? String.fromCodePoint(n) : match
      }
      return ENTITIES[code.toLowerCase()] ?? match
    })
    .trim()
}

export function mapPlaylist(raw: RawPlaylist, currentUserId: string): Playlist {
  const own = raw.owner.id === currentUserId
  return {
    id: raw.id,
    uri: raw.uri,
    name: raw.name,
    description: cleanDescription(raw.description),
    images: mapImages(raw.images),
    ownerName: own ? 'You' : (raw.owner.display_name ?? raw.owner.id),
    trackCount: raw.items?.total ?? raw.tracks?.total ?? 0,
    readable: own || !!raw.collaborative,
    externalUrl: spotifyLink(raw.external_urls?.spotify, `playlist/${raw.id}`),
  }
}

/** Links from the API end up in `href`s: only accept ones that point at open.spotify.com. */
export function spotifyLink(url: string | undefined, fallbackPath: string): string {
  if (url?.startsWith('https://open.spotify.com/')) return url
  return `https://open.spotify.com/${fallbackPath.split('/').map(encodeURIComponent).join('/')}`
}

export function likedSongsPlaylist(trackCount: number): Playlist {
  return {
    id: LIKED_SONGS_ID,
    uri: 'spotify:collection:tracks',
    name: 'Liked Songs',
    description: 'Every song you have saved',
    images: [],
    ownerName: 'You',
    trackCount,
    readable: true,
    externalUrl: 'https://open.spotify.com/collection/tracks',
  }
}

export function mapTrack(raw: RawTrack & { id: string }): Track {
  return {
    id: raw.id,
    uri: raw.uri,
    name: raw.name,
    artists: (raw.artists ?? []).map((artist) => ({ id: artist.id ?? '', name: artist.name })),
    album: {
      id: raw.album?.id ?? '',
      name: raw.album?.name ?? '',
      images: mapImages(raw.album?.images),
    },
    durationMs: raw.duration_ms,
    externalUrl: spotifyLink(raw.external_urls?.spotify, `track/${raw.id}`),
  }
}

const isPlayableTrack = (raw: RawTrack | null | undefined): raw is RawTrack & { id: string } =>
  !!raw &&
  (raw.type ?? 'track') === 'track' &&
  !!raw.id &&
  !raw.is_local &&
  raw.is_playable !== false

/**
 * Turns playlist entries into swipeable tracks: drops podcast episodes, local
 * files and tracks that are unavailable in the user's market, and keeps only
 * the first occurrence of each track.
 */
export function toPlayableTracks(entries: RawEntry[]): Track[] {
  const seen = new Set<string>()
  const tracks: Track[] = []
  for (const entry of entries) {
    if (entry.is_local) continue
    const raw = entry.item ?? entry.track
    if (!isPlayableTrack(raw) || seen.has(raw.id)) continue
    seen.add(raw.id)
    tracks.push(mapTrack(raw))
  }
  return tracks
}

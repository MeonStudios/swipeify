import { LIKED_SONGS_ID, type Playlist } from '../../types/music'
import { PlaylistSaveError, type MusicService } from '../musicService'
import type { SpotifyClient } from './client'
import { likedSongsPlaylist, mapPlaylist, toPlayableTracks, type RawEntry, type RawPlaylist } from './mapping'

/** Largest page size Spotify allows for playlist items and saved tracks. */
const PAGE_SIZE = 50
/** Spotify accepts at most 100 URIs per "add items" request. */
const ADD_BATCH_SIZE = 100

export function createSpotifyMusicService(client: SpotifyClient): MusicService {
  let currentUserId: Promise<string> | null = null
  const userId = () => {
    currentUserId ??= client.request<{ id: string }>('/me').then((me) => me.id)
    currentUserId.catch(() => (currentUserId = null))
    return currentUserId
  }

  const likedSongs = async (): Promise<Playlist> => {
    const page = await client.request<{ total: number }>('/me/tracks?limit=1')
    return likedSongsPlaylist(page.total)
  }

  return {
    async getPlaylists() {
      const [me, liked, raw] = await Promise.all([
        userId(),
        likedSongs(),
        client.getAll<RawPlaylist | null>(`/me/playlists?limit=${PAGE_SIZE}`),
      ])
      const playlists = raw.filter((p): p is RawPlaylist => !!p).map((p) => mapPlaylist(p, me))
      return [liked, ...playlists.filter((p) => p.readable), ...playlists.filter((p) => !p.readable)]
    },

    async getPlaylist(playlistId) {
      if (playlistId === LIKED_SONGS_ID) return likedSongs()
      const [me, raw] = await Promise.all([
        userId(),
        client.request<RawPlaylist>(`/playlists/${encodeURIComponent(playlistId)}`),
      ])
      return mapPlaylist(raw, me)
    },

    async getPlaylistTracks(playlistId, onProgress) {
      // `market=from_token` makes Spotify mark tracks unavailable in the user's country.
      const path =
        playlistId === LIKED_SONGS_ID
          ? `/me/tracks?limit=${PAGE_SIZE}&market=from_token`
          : `/playlists/${encodeURIComponent(playlistId)}/items?limit=${PAGE_SIZE}&market=from_token`
      const entries = await client.getAll<RawEntry>(path, onProgress)
      return toPlayableTracks(entries)
    },

    async createPlaylist(name, trackUris, resume) {
      let playlist = resume?.playlist
      if (!playlist) {
        const created = await client.request<RawPlaylist>('/me/playlists', {
          method: 'POST',
          body: { name, public: false, description: 'Made with Swipeify' },
        })
        playlist = {
          id: created.id,
          name: created.name,
          trackCount: 0,
          url: created.external_urls?.spotify ?? `https://open.spotify.com/playlist/${created.id}`,
        }
      }

      // From here on the playlist exists: a failure must say how far it got so a retry can resume.
      let added = resume?.added ?? 0
      try {
        while (added < trackUris.length) {
          const batch = trackUris.slice(added, added + ADD_BATCH_SIZE)
          await client.request(`/playlists/${encodeURIComponent(playlist.id)}/items`, {
            method: 'POST',
            body: { uris: batch },
          })
          added += batch.length
        }
      } catch (error) {
        throw new PlaylistSaveError(error, { playlist: { ...playlist, trackCount: added }, added })
      }
      return { ...playlist, trackCount: trackUris.length }
    },
  }
}

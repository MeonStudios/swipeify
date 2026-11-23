import type { CreatedPlaylist, Playlist, Track } from '../types/music'

/** Reports loading progress for long track lists: `total` may grow as pages arrive. */
export type ProgressCallback = (loaded: number, total: number) => void

/**
 * Everything the screens need from a music provider. Pages depend on this
 * interface only, never on Spotify directly.
 */
export interface MusicService {
  /** Liked Songs first, then the user's playlists (readable ones before followed ones). */
  getPlaylists(): Promise<Playlist[]>
  getPlaylist(playlistId: string): Promise<Playlist | null>
  /** All playable tracks, without episodes, local files, unavailable tracks or duplicates. */
  getPlaylistTracks(playlistId: string, onProgress?: ProgressCallback): Promise<Track[]>
  createPlaylist(name: string, trackUris: string[]): Promise<CreatedPlaylist>
}

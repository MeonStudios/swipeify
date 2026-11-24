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
  /**
   * Creates a private playlist with `trackUris`. Pass the `progress` of a
   * failed attempt (from `PlaylistSaveError`) to add only the missing tracks
   * to the playlist that attempt already created, instead of making a duplicate.
   */
  createPlaylist(name: string, trackUris: string[], resume?: SaveProgress): Promise<CreatedPlaylist>
}

/** How far a playlist save got before it failed. */
export interface SaveProgress {
  playlist: CreatedPlaylist
  /** The first `added` URIs are in the playlist. */
  added: number
}

/** Saving failed after the playlist was created; `progress` resumes it. */
export class PlaylistSaveError extends Error {
  readonly progress: SaveProgress

  constructor(cause: unknown, progress: SaveProgress) {
    super(cause instanceof Error ? cause.message : 'Could not add all tracks to the playlist.', { cause })
    this.name = 'PlaylistSaveError'
    this.progress = progress
  }
}

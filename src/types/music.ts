// Domain types for music data. They mirror the shape of the Spotify Web API
// (camelCased) so the Spotify service only needs a thin mapping layer.

export interface Image {
  url: string
  width: number | null
  height: number | null
}

export interface Artist {
  id: string
  name: string
}

export interface Album {
  id: string
  name: string
  images: Image[]
}

export interface Track {
  id: string
  /** Spotify URI, e.g. `spotify:track:...`; used for playback and when adding tracks to a playlist. */
  uri: string
  name: string
  artists: Artist[]
  album: Album
  durationMs: number
  /** Link that opens the track in Spotify. */
  externalUrl: string
}

/** Id of the pseudo-playlist that stands for the user's Liked Songs. */
export const LIKED_SONGS_ID = 'liked-songs'

export interface Playlist {
  id: string
  uri: string
  name: string
  description: string
  images: Image[]
  ownerName: string
  trackCount: number
  /**
   * Whether Swipeify may read the tracks. Spotify only exposes the contents of
   * playlists the user owns or collaborates on (and Liked Songs).
   */
  readable: boolean
  /** Link that opens the playlist in Spotify. */
  externalUrl: string
}

export interface CreatedPlaylist {
  id: string
  name: string
  trackCount: number
  /** Link to open the playlist in Spotify. */
  url: string
}

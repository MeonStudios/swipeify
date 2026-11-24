import type { MusicService } from './musicService'
import { createSpotifyAuth } from './spotify/auth'
import { createSpotifyClient } from './spotify/client'
import { createPlaybackController } from './spotify/playback'
import { SPOTIFY_SCOPES } from './spotify/scopes'
import { createSpotifyMusicService } from './spotify/spotifyMusicService'
import { getVolumePreference } from '../state/preferences'

/** Empty when `.env.local` is missing; the Home screen explains how to fix that. */
export const spotifyClientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() ?? ''

// Spotify only accepts loopback IPs (not `localhost`) as http redirect URIs.
// BASE_URL is `/` locally and `/swipeify/` on GitHub Pages.
const redirectUri =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim() || `${window.location.origin}${import.meta.env.BASE_URL}callback`

const fetchFn: typeof fetch = (...args) => window.fetch(...args)

export const auth = createSpotifyAuth({
  clientId: spotifyClientId,
  redirectUri,
  scopes: SPOTIFY_SCOPES,
  storage: window.localStorage,
  fetch: fetchFn,
})

const client = createSpotifyClient({ auth, fetch: fetchFn })

export const musicService: MusicService = createSpotifyMusicService(client)

export const playback = createPlaybackController({
  client,
  getAccessToken: auth.getAccessToken,
  initialVolume: getVolumePreference(),
})

export type { MusicService }

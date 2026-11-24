// Minimal typings for the parts of the Spotify Web Playback SDK Swipeify uses.
// https://developer.spotify.com/documentation/web-playback-sdk/reference

declare namespace Spotify {
  interface PlayerInit {
    name: string
    getOAuthToken: (callback: (token: string) => void) => void
    volume?: number
  }

  interface WebPlaybackError {
    message: string
  }

  interface WebPlaybackInstance {
    device_id: string
  }

  interface PlaybackState {
    paused: boolean
    position: number
    duration: number
    timestamp: number
    track_window: {
      current_track: { uri: string; id: string | null; linked_from?: { uri: string | null } } | null
    }
  }

  type ErrorEvent = 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error'

  class Player {
    constructor(init: PlayerInit)
    connect(): Promise<boolean>
    disconnect(): void
    activateElement(): Promise<void>
    getCurrentState(): Promise<PlaybackState | null>
    pause(): Promise<void>
    resume(): Promise<void>
    togglePlay(): Promise<void>
    seek(positionMs: number): Promise<void>
    /** 0–1. */
    setVolume(volume: number): Promise<void>
    addListener(event: 'ready' | 'not_ready', callback: (instance: WebPlaybackInstance) => void): boolean
    addListener(event: 'player_state_changed', callback: (state: PlaybackState | null) => void): boolean
    addListener(event: ErrorEvent, callback: (error: WebPlaybackError) => void): boolean
  }
}

interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void
  Spotify?: typeof Spotify
}

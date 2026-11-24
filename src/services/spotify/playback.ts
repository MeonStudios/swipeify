// In-browser playback through the Spotify Web Playback SDK. Swipeify becomes a
// Spotify Connect device; songs are started on it through the Web API.
//
// Fast swiping produces bursts of "play" requests. Overlapping requests can
// leave the SDK paused or on the wrong position, so only the latest request
// is sent, one at a time, and player events for other tracks are ignored.
//
// Framework-agnostic: React subscribes via `subscribe`/`getSnapshot`.

import { SpotifyApiError, type SpotifyClient } from './client'

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js'
/** If the player is not ready by then, treat browser playback as unavailable. */
const READY_TIMEOUT_MS = 12_000
/** Wait this long after a play request; a newer one (fast swiping) replaces it. */
export const PLAY_DEBOUNCE_MS = 150

export type PlaybackAvailability =
  | 'idle'
  | 'connecting'
  | 'ready'
  /** Spotify only allows browser playback for Premium accounts. */
  | 'premium-required'
  /** Spotify does not support the SDK in mobile browsers. */
  | 'unsupported'
  | 'error'

export interface PlaybackSnapshot {
  availability: PlaybackAvailability
  /** URI Swipeify last asked to play; null when nothing was started yet. */
  activeUri: string | null
  /** Playback state below describes `activeUri` only once the player has loaded it. */
  isPlaying: boolean
  /** Position at `updatedAt`; extrapolate while playing. */
  positionMs: number
  durationMs: number
  updatedAt: number
}

export interface PlaybackController {
  subscribe(listener: () => void): () => void
  getSnapshot(): PlaybackSnapshot
  /** Loads the SDK and connects the player. Idempotent. */
  init(): void
  /** Must run inside a user gesture so browsers allow audio. */
  activate(): void
  /** Starts `uri` at `positionMs`. Rapid calls collapse into the last one. */
  play(uri: string, positionMs: number): void
  /** Pauses/resumes `uri`, or starts it at `startMs` if it isn't the loaded track. */
  toggle(uri: string, startMs: number): void
  /** Jumps back to `positionMs` and plays, loading `uri` first if needed. */
  restart(uri: string, positionMs: number): void
  pause(): void
  disconnect(): void
}

export interface PlaybackConfig {
  client: Pick<SpotifyClient, 'request'>
  getAccessToken: () => Promise<string>
  /** Resolves with the SDK's Player class. Injected in tests. */
  loadPlayerClass?: () => Promise<typeof Spotify.Player>
  isSupportedBrowser?: () => boolean
}

const INITIAL: PlaybackSnapshot = {
  availability: 'idle',
  activeUri: null,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  updatedAt: 0,
}

let sdkLoading: Promise<typeof Spotify.Player> | null = null
function loadSdkPlayerClass(): Promise<typeof Spotify.Player> {
  sdkLoading ??= new Promise<typeof Spotify.Player>((resolve, reject) => {
    if (window.Spotify) return resolve(window.Spotify.Player)
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify!.Player)
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.addEventListener(
      'error',
      () => {
        sdkLoading = null
        reject(new Error('Could not load the Spotify player'))
      },
      { once: true },
    )
    document.body.appendChild(script)
  })
  return sdkLoading
}

// The SDK player can't be swapped live: a second player in the same tab never
// becomes ready. Reload the page instead (the swipe session is saved).
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())

const isDesktopBrowser = () => !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

export function createPlaybackController(config: PlaybackConfig): PlaybackController {
  const loadPlayerClass = config.loadPlayerClass ?? loadSdkPlayerClass
  const isSupportedBrowser = config.isSupportedBrowser ?? isDesktopBrowser

  let snapshot = INITIAL
  const listeners = new Set<() => void>()
  let player: Spotify.Player | null = null
  let deviceId: string | null = null
  let readyWaiters: { resolve: () => void; reject: (e: Error) => void }[] = []

  /** Track the SDK reports as loaded (after relinking is resolved to what we asked for). */
  let loadedUri: string | null = null
  /** Latest play request not yet sent to Spotify. */
  let pending: { uri: string; positionMs: number } | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let sending = false
  /**
   * Bumped by `disconnect()`. Async work started before a disconnect (a play
   * request in flight, a 404 retry) checks it and stops instead of touching
   * the next session.
   */
  let session = 0
  /** Bumped on every connect attempt and on disconnect; stale attempts, timers and listeners bail out. */
  let attempt = 0

  function update(patch: Partial<PlaybackSnapshot>) {
    snapshot = { ...snapshot, ...patch }
    listeners.forEach((listener) => listener())
  }

  function fail(availability: PlaybackAvailability) {
    update({ availability, isPlaying: false })
    pending = null
    const waiters = readyWaiters
    readyWaiters = []
    waiters.forEach((w) => w.reject(new Error(`Playback unavailable: ${availability}`)))
  }

  function whenReady(): Promise<void> {
    if (snapshot.availability === 'ready' && deviceId) return Promise.resolve()
    if (snapshot.availability !== 'connecting') return Promise.reject(new Error('Playback unavailable'))
    return new Promise((resolve, reject) => readyWaiters.push({ resolve, reject }))
  }

  /** Drops the current player and connects a fresh one, keeping any pending request. */
  function reconnect() {
    player?.disconnect()
    player = null
    deviceId = null
    loadedUri = null
    update({ availability: 'connecting', isPlaying: false })
    void connect()
  }

  /** Sends the latest pending request; never two at once. */
  async function flush() {
    if (sending || !pending) return
    sending = true
    const mySession = session
    try {
      while (pending) {
        const request = pending
        pending = null
        try {
          await whenReady()
          if (mySession !== session) return
          // Starting playback on our device also transfers it away from other devices.
          await config.client.request(`/me/player/play?device_id=${encodeURIComponent(deviceId!)}`, {
            method: 'PUT',
            body: { uris: [request.uri], position_ms: Math.max(0, Math.round(request.positionMs)) },
          })
          if (mySession !== session) return
        } catch (error) {
          // Disconnected meanwhile (left the screen, logged out): don't fail or reconnect anything.
          if (mySession !== session) return
          if (error instanceof SpotifyApiError && error.status === 403) fail('premium-required')
          else if (error instanceof SpotifyApiError && error.status === 404) {
            // Spotify no longer knows our device: reconnect and retry unless a newer song was requested.
            pending ??= request
            reconnect()
            return
          } else if (error instanceof SpotifyApiError) console.warn('[playback]', error.message)
          else return
        }
      }
    } finally {
      // After a disconnect, `sending` already belongs to the next session.
      if (mySession === session) sending = false
    }
  }

  function play(uri: string, positionMs: number) {
    pending = { uri, positionMs }
    // Silence the previous song right away instead of after the debounce.
    if (loadedUri && loadedUri !== uri) player?.pause().catch(() => {})
    // Until the player reports the new track, nothing is playing for it.
    update({ activeUri: uri, isPlaying: false, positionMs, durationMs: 0, updatedAt: Date.now() })
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void flush()
    }, PLAY_DEBOUNCE_MS)
  }

  /** The player has `uri` loaded and no newer request is waiting. */
  const isLoaded = (uri: string) => loadedUri === uri && snapshot.activeUri === uri && !pending

  function onStateChanged(state: Spotify.PlaybackState | null) {
    if (!state) {
      loadedUri = null
      return update({ isPlaying: false })
    }
    const current = state.track_window.current_track
    const reported = [current?.uri, current?.linked_from?.uri]
    loadedUri = snapshot.activeUri && reported.includes(snapshot.activeUri) ? snapshot.activeUri : (current?.uri ?? null)
    // Late events for a previous track must not look like the current one playing.
    if (loadedUri !== snapshot.activeUri) return
    update({
      isPlaying: !state.paused,
      positionMs: state.position,
      durationMs: state.duration,
      updatedAt: Date.now(),
    })
  }

  async function connect() {
    const myAttempt = ++attempt
    const isCurrent = () => myAttempt === attempt
    if (!isSupportedBrowser()) return fail('unsupported')
    const timeout = setTimeout(() => {
      if (isCurrent() && snapshot.availability === 'connecting') fail('unsupported')
    }, READY_TIMEOUT_MS)

    let PlayerClass: typeof Spotify.Player
    try {
      PlayerClass = await loadPlayerClass()
    } catch {
      clearTimeout(timeout)
      if (isCurrent()) fail('error')
      return
    }
    // A newer attempt or a disconnect happened while the SDK loaded (e.g. StrictMode's init → disconnect → init).
    if (!isCurrent() || snapshot.availability !== 'connecting') return clearTimeout(timeout)

    const instance = new PlayerClass({
      name: 'Swipeify',
      volume: 0.8,
      getOAuthToken: (callback) => {
        config.getAccessToken().then(callback, () => {
          if (player === instance) fail('error')
        })
      },
    })
    player = instance
    /** Fails the current attempt, unless this instance has been replaced. */
    const failIfCurrent = (availability: PlaybackAvailability) => {
      clearTimeout(timeout)
      if (player === instance) fail(availability)
    }

    instance.addListener('ready', ({ device_id }) => {
      if (player !== instance) return
      clearTimeout(timeout)
      deviceId = device_id
      update({ availability: 'ready' })
      const waiters = readyWaiters
      readyWaiters = []
      waiters.forEach((w) => w.resolve())
      // A request may have been parked while reconnecting.
      if (pending && !debounceTimer) void flush()
    })
    instance.addListener('not_ready', () => {
      // The SDK usually comes back by itself with a new device id; if not, start over.
      if (player !== instance) return
      deviceId = null
      update({ availability: 'connecting', isPlaying: false })
      setTimeout(() => {
        if (player === instance && snapshot.availability === 'connecting') reconnect()
      }, READY_TIMEOUT_MS)
    })
    instance.addListener('initialization_error', () => failIfCurrent('unsupported'))
    instance.addListener('account_error', () => failIfCurrent('premium-required'))
    instance.addListener('authentication_error', () => failIfCurrent('error'))
    instance.addListener('playback_error', (error) => console.warn('[playback]', error.message))
    instance.addListener('player_state_changed', onStateChanged)

    const connected = await instance.connect()
    if (!connected) failIfCurrent('unsupported')
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    getSnapshot: () => snapshot,

    init() {
      if (snapshot.availability !== 'idle') return
      // Closing the tab should not leave Swipeify listed as the active Spotify device.
      if (typeof window !== 'undefined') window.addEventListener('pagehide', () => player?.disconnect(), { once: true })
      update({ availability: 'connecting' })
      void connect()
    },

    activate() {
      player?.activateElement().catch(() => {})
    },

    play,

    toggle(uri, startMs) {
      if (pending?.uri === uri) {
        // Pressed pause before the song even started: cancel it.
        pending = null
        if (debounceTimer) clearTimeout(debounceTimer)
        return
      }
      if (isLoaded(uri)) player?.togglePlay().catch(() => {})
      else play(uri, startMs)
    },

    restart(uri, positionMs) {
      if (!isLoaded(uri)) return play(uri, positionMs)
      player?.seek(Math.max(0, Math.round(positionMs))).catch(() => {})
      if (!snapshot.isPlaying) player?.resume().catch(() => {})
    },

    pause() {
      pending = null
      if (debounceTimer) clearTimeout(debounceTimer)
      player?.pause().catch(() => {})
    },

    disconnect() {
      if (snapshot === INITIAL && !player) return
      session++
      attempt++
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = null
      player?.disconnect()
      player = null
      deviceId = null
      loadedUri = null
      pending = null
      sending = false
      // Settle anything waiting for the old player; otherwise a waiting flush never finishes.
      const waiters = readyWaiters
      readyWaiters = []
      waiters.forEach((w) => w.reject(new Error('Playback disconnected')))
      snapshot = INITIAL
      listeners.forEach((listener) => listener())
    },
  }
}

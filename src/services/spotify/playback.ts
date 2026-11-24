// In-browser playback through the Spotify Web Playback SDK. Swipeify becomes a
// Spotify Connect device; songs are started on it through the Web API.
//
// Fast swiping produces bursts of "play" requests. Overlapping requests can
// leave the SDK paused or on the wrong position, so only the latest request
// is sent, one at a time, and player events for other tracks are ignored.
// The previous song is muted, not paused, while the next one loads: Spotify
// accepts a play request before the device has loaded the song, so a pause
// could arrive after the new song started and stop it.
//
// Framework-agnostic: React subscribes via `subscribe`/`getSnapshot`.

import { SpotifyApiError, type SpotifyClient } from './client'

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js'
/** If the player is not ready by then, treat browser playback as unavailable. */
const READY_TIMEOUT_MS = 12_000
/** Wait this long after a play request; a newer one (fast swiping) replaces it. */
export const PLAY_DEBOUNCE_MS = 150
const DEFAULT_VOLUME = 0.8
/** If the next song still hasn't loaded after this long, stop the muted previous one. */
export const MUTE_TIMEOUT_MS = 8000
/**
 * Waits before each retry when Spotify answers 404 ("device not found"). A
 * freshly connected device can take a moment before the Web API knows it, so
 * reconnecting right away would only make a new unknown device, again and again.
 */
export const DEVICE_RETRY_DELAYS_MS = [500, 1000, 2000, 4000]
/** At this retry the player reconnects instead of waiting for the same device. */
const RECONNECT_AT_RETRY = 2

const clampVolume = (volume: number) => (Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_VOLUME)

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
  /** 0–1; kept across reconnects. */
  volume: number
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
  /** Jumps to `positionMs` in `uri`, starting it there if it isn't the loaded track. */
  seek(uri: string, positionMs: number): void
  /** 0–1. Applies to the current player and any later one. */
  setVolume(volume: number): void
  pause(): void
  disconnect(): void
}

export interface PlaybackConfig {
  client: Pick<SpotifyClient, 'request'>
  getAccessToken: () => Promise<string>
  /** Resolves with the SDK's Player class. Injected in tests. */
  loadPlayerClass?: () => Promise<typeof Spotify.Player>
  isSupportedBrowser?: () => boolean
  /** 0–1; defaults to 0.8. */
  initialVolume?: number
}

const INITIAL: PlaybackSnapshot = {
  availability: 'idle',
  activeUri: null,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  updatedAt: 0,
  volume: DEFAULT_VOLUME,
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

interface PlayRequest {
  uri: string
  positionMs: number
  /** How often Spotify already answered 404 for this request. */
  deviceRetries?: number
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function createPlaybackController(config: PlaybackConfig): PlaybackController {
  const loadPlayerClass = config.loadPlayerClass ?? loadSdkPlayerClass
  const isSupportedBrowser = config.isSupportedBrowser ?? isDesktopBrowser

  const initial: PlaybackSnapshot = { ...INITIAL, volume: clampVolume(config.initialVolume ?? DEFAULT_VOLUME) }
  let snapshot = initial
  const listeners = new Set<() => void>()
  /**
   * The tab's one SDK player, kept across disconnects: a second player in the
   * same tab never becomes ready, so leaving a playlist and starting another
   * must connect this one again instead of building a new one.
   */
  let instance: Spotify.Player | null = null
  /** `instance` while it is connected (or connecting); null after `disconnect()`. */
  let player: Spotify.Player | null = null
  /** Volume last sent to `instance`. */
  let appliedVolume = 0
  /** Fails a connect attempt that doesn't become ready in time. */
  let readyTimer: ReturnType<typeof setTimeout> | null = null
  let deviceId: string | null = null
  let readyWaiters: { resolve: () => void; reject: (e: Error) => void }[] = []

  /** Track the SDK reports as loaded (after relinking is resolved to what we asked for). */
  let loadedUri: string | null = null
  /** Latest play request not yet sent to Spotify. */
  let pending: PlayRequest | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let sending = false
  /** The previous song is muted while the next one loads (see the note at the top). */
  let muted = false
  let muteTimer: ReturnType<typeof setTimeout> | null = null
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

  function mute() {
    if (muteTimer) clearTimeout(muteTimer)
    muteTimer = setTimeout(() => {
      muteTimer = null
      // The next song never came: stop the old one, then make the volume normal again.
      if (muted) stopAndUnmute()
    }, MUTE_TIMEOUT_MS)
    if (muted) return
    muted = true
    applyVolume(0)
  }

  function unmute() {
    if (muteTimer) clearTimeout(muteTimer)
    muteTimer = null
    if (!muted) return
    muted = false
    applyVolume(snapshot.volume)
  }

  /** Pauses whatever is playing; only safe when no play request follows. */
  function stopAndUnmute() {
    const current = player
    if (!current || !muted) return unmute()
    current.pause().catch(() => {}).finally(() => {
      if (player === current) unmute()
    })
  }

  function fail(availability: PlaybackAvailability) {
    unmute()
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

  /** Disconnects the player and connects it again, keeping any pending request. */
  function reconnect() {
    player?.disconnect()
    player = null
    deviceId = null
    loadedUri = null
    // Nothing plays after reconnecting; the volume is restored once it's ready.
    muted = false
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
        const request: PlayRequest = pending
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
            // Spotify doesn't know our device (yet, or any more). Retry a few times, unless a newer song was requested.
            const retries = request.deviceRetries ?? 0
            if (retries >= DEVICE_RETRY_DELAYS_MS.length) {
              console.warn('[playback] Spotify keeps answering "device not found"; giving up')
              fail('error')
              return
            }
            const retry: PlayRequest = { ...request, deviceRetries: retries + 1 }
            if (retries === RECONNECT_AT_RETRY) {
              console.warn('[playback] Spotify does not know this device; reconnecting')
              pending ??= retry
              reconnect()
              return
            }
            await wait(DEVICE_RETRY_DELAYS_MS[retries])
            if (mySession !== session) return
            pending ??= retry
          } else if (error instanceof SpotifyApiError) {
            console.warn('[playback]', error.message)
            if (!pending) stopAndUnmute()
          } else {
            if (!pending) stopAndUnmute()
            return
          }
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
    if (loadedUri && loadedUri !== uri) mute()
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
    // The new song has loaded: let it be heard.
    if (!pending) unmute()
    update({
      isPlaying: !state.paused,
      positionMs: state.position,
      durationMs: state.duration,
      updatedAt: Date.now(),
    })
  }

  function clearReadyTimer() {
    if (readyTimer) clearTimeout(readyTimer)
    readyTimer = null
  }

  function applyVolume(volume: number) {
    if (!player) return
    appliedVolume = volume
    player.setVolume(volume).catch(() => {})
  }

  /** Builds the tab's one SDK player. Its events count only while it is the connected `player`. */
  function createPlayer(PlayerClass: typeof Spotify.Player): Spotify.Player {
    const created = new PlayerClass({
      name: 'Swipeify',
      volume: snapshot.volume,
      getOAuthToken: (callback) => {
        config.getAccessToken().then(callback, () => {
          if (player === created) fail('error')
        })
      },
    })
    appliedVolume = snapshot.volume
    const failIfConnected = (availability: PlaybackAvailability) => {
      if (player !== created) return
      clearReadyTimer()
      fail(availability)
    }

    created.addListener('ready', ({ device_id }) => {
      if (player !== created) return
      clearReadyTimer()
      deviceId = device_id
      // The volume may have changed (or been left muted) while the player was disconnected.
      if (!muted && appliedVolume !== snapshot.volume) applyVolume(snapshot.volume)
      update({ availability: 'ready' })
      const waiters = readyWaiters
      readyWaiters = []
      waiters.forEach((w) => w.resolve())
      // A request may have been parked while reconnecting.
      if (pending && !debounceTimer) void flush()
    })
    created.addListener('not_ready', () => {
      // The SDK usually comes back by itself with a new device id; if not, start over.
      if (player !== created) return
      deviceId = null
      update({ availability: 'connecting', isPlaying: false })
      const myAttempt = attempt
      setTimeout(() => {
        if (myAttempt === attempt && player === created && snapshot.availability === 'connecting') reconnect()
      }, READY_TIMEOUT_MS)
    })
    created.addListener('initialization_error', () => failIfConnected('unsupported'))
    created.addListener('account_error', () => failIfConnected('premium-required'))
    created.addListener('authentication_error', () => failIfConnected('error'))
    created.addListener('playback_error', (error) => {
      if (player === created) console.warn('[playback]', error.message)
    })
    created.addListener('player_state_changed', (state) => {
      if (player === created) onStateChanged(state)
    })
    return created
  }

  async function connect() {
    const myAttempt = ++attempt
    const isCurrent = () => myAttempt === attempt
    if (!isSupportedBrowser()) return fail('unsupported')
    clearReadyTimer()
    readyTimer = setTimeout(() => {
      readyTimer = null
      if (isCurrent() && snapshot.availability === 'connecting') fail('unsupported')
    }, READY_TIMEOUT_MS)

    let PlayerClass: typeof Spotify.Player
    try {
      PlayerClass = await loadPlayerClass()
    } catch {
      if (!isCurrent()) return
      clearReadyTimer()
      return fail('error')
    }
    // A newer attempt or a disconnect happened while the SDK loaded (e.g. StrictMode's init → disconnect → init).
    if (!isCurrent() || snapshot.availability !== 'connecting') return

    // Reuse the tab's player: a second one never becomes ready.
    instance ??= createPlayer(PlayerClass)
    player = instance
    const connected = await instance.connect()
    if (!connected && isCurrent() && player === instance) {
      clearReadyTimer()
      fail('unsupported')
    }
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
        if (!sending) stopAndUnmute()
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

    seek(uri, positionMs) {
      const target = Math.max(0, Math.round(positionMs))
      if (!isLoaded(uri)) return play(uri, target)
      player?.seek(target).catch(() => {})
      // Show the new position right away; the SDK confirms it with a state event.
      update({ positionMs: target, updatedAt: Date.now() })
    },

    setVolume(volume) {
      const next = clampVolume(volume)
      if (next === snapshot.volume) return
      update({ volume: next })
      // While muted, the new volume applies once the next song is heard.
      if (!muted) applyVolume(next)
    },

    pause() {
      pending = null
      if (debounceTimer) clearTimeout(debounceTimer)
      player?.pause().catch(() => {})
      unmute()
    },

    disconnect() {
      if (!player && snapshot.availability === 'idle' && snapshot.activeUri === null) return
      session++
      attempt++
      clearReadyTimer()
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = null
      player?.disconnect()
      player = null
      deviceId = null
      loadedUri = null
      pending = null
      muted = false
      if (muteTimer) clearTimeout(muteTimer)
      muteTimer = null
      sending = false
      // Settle anything waiting for the old player; otherwise a waiting flush never finishes.
      const waiters = readyWaiters
      readyWaiters = []
      waiters.forEach((w) => w.reject(new Error('Playback disconnected')))
      snapshot = { ...initial, volume: snapshot.volume }
      listeners.forEach((listener) => listener())
    },
  }
}

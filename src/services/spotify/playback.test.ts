import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlaybackController, PLAY_DEBOUNCE_MS } from './playback'

type Listener = (arg: unknown) => void

/** Stand-in for the SDK's Player: records calls and lets tests emit events. */
class FakePlayer {
  static last: FakePlayer
  listeners = new Map<string, Listener>()
  calls: string[] = []
  constructor() {
    FakePlayer.last = this
  }
  addListener(event: string, callback: Listener) {
    this.listeners.set(event, callback)
    return true
  }
  emit(event: string, arg: unknown) {
    this.listeners.get(event)?.(arg)
  }
  async connect() {
    queueMicrotask(() => this.emit('ready', { device_id: 'dev-1' }))
    return true
  }
  disconnect() {}
  async activateElement() {}
  async getCurrentState() {
    return null
  }
  pause = vi.fn(async () => void this.calls.push('pause'))
  resume = vi.fn(async () => void this.calls.push('resume'))
  togglePlay = vi.fn(async () => void this.calls.push('togglePlay'))
  seek = vi.fn(async (ms: number) => void this.calls.push(`seek:${ms}`))
}

const state = (uri: string, position: number, paused = false) => ({
  paused,
  position,
  duration: 200_000,
  timestamp: 0,
  track_window: { current_track: { uri, id: uri } },
})

async function setup() {
  const request = vi.fn(async (_path: string, _options?: unknown) => undefined)
  const controller = createPlaybackController({
    client: { request: request as never },
    getAccessToken: async () => 'token',
    loadPlayerClass: async () => FakePlayer as unknown as typeof Spotify.Player,
    isSupportedBrowser: () => true,
  })
  controller.init()
  await vi.advanceTimersByTimeAsync(0)
  expect(controller.getSnapshot().availability).toBe('ready')
  const playedUris = () => request.mock.calls.map(([, options]) => (options as { body: { uris: string[] } }).body.uris[0])
  return { controller, request, player: FakePlayer.last, playedUris }
}

describe('playback controller', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('collapses a burst of fast swipes into a single play request for the last track', async () => {
    const { controller, playedUris, request } = await setup()
    controller.play('spotify:track:a', 1000)
    controller.play('spotify:track:b', 2000)
    controller.play('spotify:track:c', 3000)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)

    expect(playedUris()).toEqual(['spotify:track:c'])
    expect(request.mock.calls[0][0]).toBe('/me/player/play?device_id=dev-1')
    expect((request.mock.calls[0][1] as { body: unknown }).body).toEqual({ uris: ['spotify:track:c'], position_ms: 3000 })
  })

  it('never sends two play requests at once and ends on the latest track', async () => {
    const { controller, request, playedUris } = await setup()
    let finishFirst!: () => void
    request.mockImplementationOnce(() => new Promise<undefined>((resolve) => (finishFirst = () => resolve(undefined))))

    controller.play('spotify:track:a', 0)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    controller.play('spotify:track:b', 0)
    controller.play('spotify:track:c', 0)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    expect(playedUris()).toEqual(['spotify:track:a']) // still waiting for the first

    finishFirst()
    await vi.advanceTimersByTimeAsync(0)
    expect(playedUris()).toEqual(['spotify:track:a', 'spotify:track:c'])
  })

  it('ignores late player events for the previous track', async () => {
    const { controller, player } = await setup()
    controller.play('spotify:track:a', 0)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    player.emit('player_state_changed', state('spotify:track:a', 60_000))
    expect(controller.getSnapshot().isPlaying).toBe(true)

    controller.play('spotify:track:b', 50_000)
    player.emit('player_state_changed', state('spotify:track:a', 61_000)) // stale
    expect(controller.getSnapshot()).toMatchObject({ activeUri: 'spotify:track:b', isPlaying: false, positionMs: 50_000 })
  })

  it('pressing play when the player still holds another track starts the current one at its start point', async () => {
    const { controller, player, playedUris } = await setup()
    controller.play('spotify:track:a', 0)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    player.emit('player_state_changed', state('spotify:track:a', 1000, true))

    // The current card is b, but the player only ever loaded a (e.g. a request got lost).
    controller.toggle('spotify:track:b', 60_000)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    expect(player.togglePlay).not.toHaveBeenCalled()
    expect(playedUris()).toEqual(['spotify:track:a', 'spotify:track:b'])
  })

  it('toggles pause/resume when the current track is loaded', async () => {
    const { controller, player, request } = await setup()
    controller.play('spotify:track:a', 0)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    player.emit('player_state_changed', state('spotify:track:a', 1000))

    controller.toggle('spotify:track:a', 60_000)
    expect(player.togglePlay).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('pressing pause before a requested song starts cancels it', async () => {
    const { controller, request } = await setup()
    controller.play('spotify:track:a', 0)
    controller.toggle('spotify:track:a', 0)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    expect(request).not.toHaveBeenCalled()
  })

  it('restart seeks within the loaded track and resumes if paused', async () => {
    const { controller, player } = await setup()
    controller.play('spotify:track:a', 0)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    player.emit('player_state_changed', state('spotify:track:a', 90_000, true))

    controller.restart('spotify:track:a', 60_000)
    expect(player.calls).toEqual(['seek:60000', 'resume'])
  })

  it('accepts relinked tracks reported via linked_from', async () => {
    const { controller, player } = await setup()
    controller.play('spotify:track:asked', 0)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    player.emit('player_state_changed', {
      ...state('spotify:track:relinked', 5000),
      track_window: { current_track: { uri: 'spotify:track:relinked', id: 'relinked', linked_from: { uri: 'spotify:track:asked' } } },
    })
    expect(controller.getSnapshot()).toMatchObject({ isPlaying: true, positionMs: 5000 })
  })
})

describe('playback controller recovery', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reconnects and retries when Spotify no longer knows the device', async () => {
    const { controller, request, playedUris } = await setup()
    const first = FakePlayer.last
    const { SpotifyApiError } = await import('./client')
    request.mockRejectedValueOnce(new SpotifyApiError(404, 'Device not found'))

    controller.play('spotify:track:a', 1000)
    await vi.advanceTimersByTimeAsync(PLAY_DEBOUNCE_MS)
    await vi.advanceTimersByTimeAsync(0)

    expect(FakePlayer.last).not.toBe(first)
    expect(controller.getSnapshot().availability).toBe('ready')
    expect(playedUris()).toEqual(['spotify:track:a', 'spotify:track:a'])
  })

  it('shows connecting while the SDK reports not_ready and recovers on ready', async () => {
    const { controller, player } = await setup()
    player.emit('not_ready', { device_id: 'dev-1' })
    expect(controller.getSnapshot().availability).toBe('connecting')
    player.emit('ready', { device_id: 'dev-2' })
    expect(controller.getSnapshot().availability).toBe('ready')
  })
})

describe('playback controller release', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('disconnect releases the device and init connects a fresh player', async () => {
    const { controller, player } = await setup()
    const disconnect = vi.spyOn(player, 'disconnect')
    controller.disconnect()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().availability).toBe('idle')

    controller.init()
    await vi.advanceTimersByTimeAsync(0)
    expect(FakePlayer.last).not.toBe(player)
    expect(controller.getSnapshot().availability).toBe('ready')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createSpotifyClient, SpotifyApiError } from './client'
import { json, scriptedFetch } from './testUtils'

function setup(...responses: Response[]) {
  const http = scriptedFetch(...responses)
  const auth = {
    getAccessToken: vi.fn(async () => 'token-1'),
    forceRefresh: vi.fn(async () => 'token-2'),
  }
  const sleep = vi.fn(async (_ms: number) => {})
  const client = createSpotifyClient({ auth, fetch: http.fetch, sleep })
  return { client, http, auth, sleep }
}

describe('spotify client', () => {
  it('sends authenticated JSON requests to the API root', async () => {
    const { client, http } = setup(json(201, { id: 'new' }))
    expect(await client.request('/me/playlists', { method: 'POST', body: { name: 'x' } })).toEqual({ id: 'new' })
    expect(http.call(0)).toMatchObject({
      url: 'https://api.spotify.com/v1/me/playlists',
      method: 'POST',
      headers: { Authorization: 'Bearer token-1', 'Content-Type': 'application/json' },
      body: '{"name":"x"}',
    })
  })

  it('handles empty success responses', async () => {
    const { client } = setup(new Response(null, { status: 204 }), new Response('', { status: 202 }))
    expect(await client.request('/me/player/play', { method: 'PUT' })).toBeUndefined()
    expect(await client.request('/me/player/play', { method: 'PUT' })).toBeUndefined()
  })

  it('refreshes the token and retries once after a 401', async () => {
    const { client, http, auth } = setup(json(401, { error: { message: 'expired' } }), json(200, { id: 'me' }))
    expect(await client.request('/me')).toEqual({ id: 'me' })
    expect(auth.forceRefresh).toHaveBeenCalledTimes(1)
    expect(http.call(1).headers.Authorization).toBe('Bearer token-2')
  })

  it('does not loop on repeated 401s', async () => {
    const { client } = setup(json(401, {}), json(401, { error: { message: 'Invalid token' } }))
    await expect(client.request('/me')).rejects.toMatchObject({ status: 401 })
  })

  it('waits for Retry-After on 429 and retries', async () => {
    const { client, sleep } = setup(json(429, {}, { 'Retry-After': '3' }), json(429, {}), json(200, { ok: true }))
    expect(await client.request('/me')).toEqual({ ok: true })
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([3000, 2000])
  })

  it('gives up after three rate-limit retries', async () => {
    const { client, sleep } = setup(json(429, {}), json(429, {}), json(429, {}), json(429, {}))
    await expect(client.request('/me')).rejects.toMatchObject({ status: 429 })
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it('turns a 403 into an explanation about the dashboard user list', async () => {
    const { client } = setup(json(403, { error: { status: 403, message: 'User not registered' } }))
    const error = await client.request('/me').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SpotifyApiError)
    expect((error as Error).message).toMatch(/user list.*User not registered/s)
  })

  it('follows `next` links and reports progress', async () => {
    const { client, http } = setup(
      json(200, { items: [1, 2], total: 5, next: 'https://api.spotify.com/v1/me/tracks?offset=2' }),
      json(200, { items: [3, 4], total: 5, next: 'https://api.spotify.com/v1/me/tracks?offset=4' }),
      json(200, { items: [5], total: 5, next: null }),
    )
    const progress: [number, number][] = []
    const items = await client.getAll<number>('/me/tracks?limit=2', (loaded, total) => progress.push([loaded, total]))
    expect(items).toEqual([1, 2, 3, 4, 5])
    expect(progress).toEqual([
      [2, 5],
      [4, 5],
      [5, 5],
    ])
    expect(http.call(1).url).toBe('https://api.spotify.com/v1/me/tracks?offset=2')
  })
})

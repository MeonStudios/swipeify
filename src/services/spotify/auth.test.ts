import { describe, expect, it } from 'vitest'
import { createSpotifyAuth, SpotifyAuthError } from './auth'
import { json, memoryStorage, scriptedFetch } from './testUtils'

const TOKENS_KEY = 'swipeify.spotify.tokens'

function setup(...responses: Response[]) {
  const storage = memoryStorage()
  const http = scriptedFetch(...responses)
  let time = 1_000_000
  const auth = createSpotifyAuth({
    clientId: 'client-123',
    redirectUri: 'http://127.0.0.1:5173/callback',
    scopes: ['playlist-read-private', 'streaming'],
    storage,
    fetch: http.fetch,
    now: () => time,
  })
  return { auth, storage, http, advance: (ms: number) => (time += ms) }
}

const tokenResponse = (access: string, refresh?: string) =>
  json(200, { access_token: access, ...(refresh && { refresh_token: refresh }), expires_in: 3600 })

async function login(ctx: ReturnType<typeof setup>) {
  const url = new URL(await ctx.auth.beginLogin())
  const state = url.searchParams.get('state')!
  await ctx.auth.completeLogin(new URLSearchParams({ code: 'the-code', state }))
  return url
}

describe('spotify auth', () => {
  it('builds a PKCE authorize URL with all scopes', async () => {
    const { auth } = setup()
    const url = new URL(await auth.beginLogin())
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'client-123',
      response_type: 'code',
      redirect_uri: 'http://127.0.0.1:5173/callback',
      scope: 'playlist-read-private streaming',
      code_challenge_method: 'S256',
    })
    expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
  })

  it('exchanges the code for tokens once, even when the callback runs twice', async () => {
    const ctx = setup(tokenResponse('access-1', 'refresh-1'))
    const url = new URL(await ctx.auth.beginLogin())
    const params = new URLSearchParams({ code: 'the-code', state: url.searchParams.get('state')! })
    await Promise.all([ctx.auth.completeLogin(params), ctx.auth.completeLogin(params)])

    expect(ctx.http.mock).toHaveBeenCalledTimes(1)
    const body = new URLSearchParams(String(ctx.http.call(0).body))
    expect(Object.fromEntries(body)).toMatchObject({
      grant_type: 'authorization_code',
      code: 'the-code',
      client_id: 'client-123',
      redirect_uri: 'http://127.0.0.1:5173/callback',
    })
    expect(body.get('code_verifier')).toMatch(/^[\w\-.~]{64}$/)
    expect(ctx.auth.isLoggedIn()).toBe(true)
    expect(await ctx.auth.getAccessToken()).toBe('access-1')
  })

  it('rejects a callback whose state does not match', async () => {
    const { auth } = setup()
    await auth.beginLogin()
    await expect(auth.completeLogin(new URLSearchParams({ code: 'c', state: 'forged' }))).rejects.toBeInstanceOf(
      SpotifyAuthError,
    )
  })

  it('explains a cancelled login', async () => {
    const { auth } = setup()
    await expect(auth.completeLogin(new URLSearchParams({ error: 'access_denied' }))).rejects.toThrow(/cancelled/)
  })

  it('refreshes an expiring token once for concurrent callers and keeps the old refresh token', async () => {
    const ctx = setup(tokenResponse('access-1', 'refresh-1'), tokenResponse('access-2'))
    await login(ctx)
    ctx.advance(3600_000 - 30_000) // inside the 60s safety margin

    const [a, b] = await Promise.all([ctx.auth.getAccessToken(), ctx.auth.getAccessToken()])
    expect([a, b]).toEqual(['access-2', 'access-2'])
    expect(ctx.http.mock).toHaveBeenCalledTimes(2)
    expect(new URLSearchParams(String(ctx.http.call(1).body)).get('refresh_token')).toBe('refresh-1')
    expect(JSON.parse(ctx.storage.data.get(TOKENS_KEY)!).refreshToken).toBe('refresh-1')
  })

  it('logs out when the refresh token is revoked', async () => {
    const ctx = setup(tokenResponse('access-1', 'refresh-1'), json(400, { error: 'invalid_grant' }))
    await login(ctx)
    await expect(ctx.auth.forceRefresh()).rejects.toThrow(/expired/)
    expect(ctx.auth.isLoggedIn()).toBe(false)
  })

  it('stays logged in when the token endpoint is temporarily unavailable', async () => {
    const ctx = setup(tokenResponse('access-1', 'refresh-1'), json(503, {}), json(429, {}))
    await login(ctx)
    await expect(ctx.auth.forceRefresh()).rejects.toThrow(/trouble/)
    await expect(ctx.auth.forceRefresh()).rejects.not.toBeInstanceOf(SpotifyAuthError)
    expect(ctx.auth.isLoggedIn()).toBe(true)
  })

  it('forgets the pending login after a failed callback, so the same state cannot be reused', async () => {
    const ctx = setup(tokenResponse('access-1', 'refresh-1'))
    const url = new URL(await ctx.auth.beginLogin())
    const state = url.searchParams.get('state')!
    await expect(ctx.auth.completeLogin(new URLSearchParams({ code: 'c1', state: 'forged' }))).rejects.toThrow()
    await expect(ctx.auth.completeLogin(new URLSearchParams({ code: 'c2', state }))).rejects.toThrow(/no longer valid/)
    expect(ctx.http.mock).not.toHaveBeenCalled()
  })

  it('rejects a login that was started too long ago', async () => {
    const ctx = setup(tokenResponse('access-1', 'refresh-1'))
    const url = new URL(await ctx.auth.beginLogin())
    ctx.advance(11 * 60_000)
    const params = new URLSearchParams({ code: 'c', state: url.searchParams.get('state')! })
    await expect(ctx.auth.completeLogin(params)).rejects.toThrow(/no longer valid/)
  })

  it('does not show text from the callback URL in its error message', async () => {
    const { auth } = setup()
    const error = await auth.completeLogin(new URLSearchParams({ error: 'Call 555-0100 for help' })).catch((e: Error) => e)
    expect((error as Error).message).not.toContain('555')
  })

  it('treats malformed stored tokens as logged out', () => {
    const ctx = setup()
    ctx.storage.setItem(TOKENS_KEY, JSON.stringify({ accessToken: 1 }))
    expect(ctx.auth.isLoggedIn()).toBe(false)
  })

  it('logout forgets the tokens', async () => {
    const ctx = setup(tokenResponse('access-1', 'refresh-1'))
    await login(ctx)
    ctx.auth.logout()
    expect(ctx.auth.isLoggedIn()).toBe(false)
    await expect(ctx.auth.getAccessToken()).rejects.toBeInstanceOf(SpotifyAuthError)
  })
})

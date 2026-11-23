// Spotify OAuth 2.0 Authorization Code flow with PKCE. No client secret: the
// app runs entirely in the browser.

import { codeChallenge, randomString } from './pkce'

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

const TOKENS_KEY = 'swipeify.spotify.tokens'
const PENDING_KEY = 'swipeify.spotify.pending-login'

/** Refresh this long before the access token actually expires. */
const EXPIRY_MARGIN_MS = 60_000

export interface TokenSet {
  accessToken: string
  refreshToken: string
  /** Epoch ms. */
  expiresAt: number
}

/** The login has expired or was revoked; the user has to connect again. */
export class SpotifyAuthError extends Error {
  constructor(message = 'Your Spotify session has expired. Please connect again.') {
    super(message)
    this.name = 'SpotifyAuthError'
  }
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface AuthConfig {
  clientId: string
  redirectUri: string
  scopes: readonly string[]
  storage: KeyValueStorage
  fetch: typeof fetch
  now?: () => number
}

export interface SpotifyAuth {
  isLoggedIn(): boolean
  /** Builds the Spotify authorize URL and remembers the PKCE verifier for the callback. */
  beginLogin(): Promise<string>
  /** Handles the `/callback` query string. Safe to call twice for the same code. */
  completeLogin(params: URLSearchParams): Promise<void>
  /** A valid access token, refreshed when it is about to expire. */
  getAccessToken(): Promise<string>
  /** Refreshes even if the current token looks valid (e.g. after a 401). */
  forceRefresh(): Promise<string>
  logout(): void
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

export function createSpotifyAuth(config: AuthConfig): SpotifyAuth {
  const { clientId, redirectUri, scopes, storage } = config
  const now = config.now ?? Date.now
  let refreshing: Promise<string> | null = null
  const completing = new Map<string, Promise<void>>()

  function readTokens(): TokenSet | null {
    const raw = storage.getItem(TOKENS_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as TokenSet
    } catch {
      return null
    }
  }

  function saveTokens(response: TokenResponse, previousRefreshToken?: string): TokenSet {
    const tokens: TokenSet = {
      accessToken: response.access_token,
      // Spotify may or may not rotate the refresh token.
      refreshToken: response.refresh_token ?? previousRefreshToken ?? '',
      expiresAt: now() + response.expires_in * 1000,
    }
    storage.setItem(TOKENS_KEY, JSON.stringify(tokens))
    return tokens
  }

  async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
    const response = await config.fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, ...body }),
    })
    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as { error?: string } | null
      throw new SpotifyAuthError(
        response.status === 400 && details?.error === 'invalid_grant'
          ? undefined
          : `Spotify login failed (${response.status}${details?.error ? `: ${details.error}` : ''}).`,
      )
    }
    return (await response.json()) as TokenResponse
  }

  function refresh(): Promise<string> {
    refreshing ??= (async () => {
      const tokens = readTokens()
      if (!tokens?.refreshToken) throw new SpotifyAuthError()
      try {
        const response = await requestToken({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken })
        return saveTokens(response, tokens.refreshToken).accessToken
      } catch (error) {
        if (error instanceof SpotifyAuthError) storage.removeItem(TOKENS_KEY)
        throw error
      }
    })().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  return {
    isLoggedIn: () => readTokens() !== null,

    async beginLogin() {
      const verifier = randomString(64)
      const state = randomString(16)
      storage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }))
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        code_challenge_method: 'S256',
        code_challenge: await codeChallenge(verifier),
        state,
      })
      return `${AUTHORIZE_URL}?${params}`
    },

    completeLogin(params) {
      const code = params.get('code') ?? ''
      // React StrictMode runs effects twice; a code can only be exchanged once.
      const existing = completing.get(code)
      if (existing) return existing

      const promise = (async () => {
        const error = params.get('error')
        if (error) {
          throw new SpotifyAuthError(
            error === 'access_denied' ? 'You cancelled the Spotify login.' : `Spotify login failed: ${error}.`,
          )
        }
        const pending = JSON.parse(storage.getItem(PENDING_KEY) ?? 'null') as {
          verifier: string
          state: string
        } | null
        if (!code || !pending || pending.state !== params.get('state')) {
          throw new SpotifyAuthError('This login link is no longer valid. Please connect again.')
        }
        const response = await requestToken({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: pending.verifier,
        })
        saveTokens(response)
        storage.removeItem(PENDING_KEY)
      })()
      completing.set(code, promise)
      return promise
    },

    async getAccessToken() {
      const tokens = readTokens()
      if (!tokens) throw new SpotifyAuthError('You are not connected to Spotify.')
      if (tokens.expiresAt - EXPIRY_MARGIN_MS > now()) return tokens.accessToken
      return refresh()
    },

    forceRefresh: refresh,

    logout() {
      storage.removeItem(TOKENS_KEY)
      storage.removeItem(PENDING_KEY)
    },
  }
}

// Thin, authenticated wrapper around the Spotify Web API.

import type { SpotifyAuth } from './auth'

const BASE_URL = 'https://api.spotify.com/v1'

/** Retries for 429 Too Many Requests before giving up. */
const MAX_RATE_LIMIT_RETRIES = 3
/** Used when a 429 response has no Retry-After header. */
const DEFAULT_RETRY_AFTER_S = 2

export class SpotifyApiError extends Error {
  readonly status: number

  constructor(status: number, spotifyMessage: string | undefined) {
    super(friendlyMessage(status, spotifyMessage))
    this.name = 'SpotifyApiError'
    this.status = status
  }
}

function friendlyMessage(status: number, spotifyMessage: string | undefined): string {
  if (status === 403) {
    return (
      'Spotify refused this request. If your account is not on this app’s user list in the ' +
      'Spotify Developer Dashboard, ask the app owner to add it.' +
      (spotifyMessage ? ` (Spotify: ${spotifyMessage})` : '')
    )
  }
  if (status === 404) return 'Spotify could not find this. It may have been deleted or made private.'
  if (status === 429) return 'Spotify is busy right now. Please try again in a minute.'
  if (status >= 500) return 'Spotify is having trouble right now. Please try again in a moment.'
  return spotifyMessage ? `Spotify: ${spotifyMessage}` : `Spotify request failed (${status}).`
}

export interface Page<T> {
  items: T[]
  total: number
  next: string | null
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

export interface SpotifyClient {
  /** `path` is relative to the API root (`/me`) or an absolute `next` URL from a page. */
  request<T>(path: string, options?: RequestOptions): Promise<T>
  /** Follows `next` links until every item is loaded. */
  getAll<T>(path: string, onPage?: (loaded: number, total: number) => void): Promise<T[]>
}

export interface ClientConfig {
  auth: Pick<SpotifyAuth, 'getAccessToken' | 'forceRefresh'>
  fetch: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function createSpotifyClient({ auth, fetch: fetchFn, sleep = defaultSleep }: ClientConfig): SpotifyClient {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = path.startsWith('https://') ? path : `${BASE_URL}${path}`
    let token = await auth.getAccessToken()
    let refreshedAfter401 = false
    let rateLimitRetries = 0

    for (;;) {
      const response = await fetchFn(url, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })

      if (response.status === 401 && !refreshedAfter401) {
        refreshedAfter401 = true
        token = await auth.forceRefresh()
        continue
      }

      if (response.status === 429 && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
        rateLimitRetries++
        const retryAfter = Number(response.headers.get('Retry-After'))
        await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : DEFAULT_RETRY_AFTER_S) * 1000)
        continue
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new SpotifyApiError(response.status, body?.error?.message)
      }

      if (response.status === 204) return undefined as T
      const text = await response.text()
      return (text ? JSON.parse(text) : undefined) as T
    }
  }

  async function getAll<T>(path: string, onPage?: (loaded: number, total: number) => void): Promise<T[]> {
    const items: T[] = []
    let next: string | null = path
    while (next) {
      const page: Page<T> = await request<Page<T>>(next)
      items.push(...page.items)
      onPage?.(items.length, Math.max(page.total, items.length))
      next = page.next
    }
    return items
  }

  return { request, getAll }
}

// Helpers for testing the Spotify layer with a scripted fetch.
import { vi } from 'vitest'

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

/** A fetch mock that answers calls in order and records each request. */
export function scriptedFetch(...responses: Response[]) {
  const queue = [...responses]
  const fn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const next = queue.shift()
    if (!next) throw new Error('Unexpected fetch call')
    return next
  })
  const call = (i: number) => {
    const [input, init] = fn.mock.calls[i]
    return {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
    }
  }
  return { fetch: fn as unknown as typeof fetch, mock: fn, call }
}

export function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

// PKCE helpers (RFC 7636) for the Spotify Authorization Code flow.

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

/** Cryptographically random string of unreserved URL characters (43–128 chars for a verifier). */
export function randomString(length = 64): string {
  // Rejection sampling: only bytes below the largest multiple of 66 map evenly onto the alphabet.
  const limit = 256 - (256 % UNRESERVED.length)
  let out = ''
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte < limit && out.length < length) out += UNRESERVED[byte % UNRESERVED.length]
    }
  }
  return out
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** S256 code challenge: base64url(sha256(verifier)). */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

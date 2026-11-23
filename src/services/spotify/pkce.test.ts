import { describe, expect, it } from 'vitest'
import { codeChallenge, randomString } from './pkce'

describe('pkce', () => {
  it('derives the S256 challenge from the RFC 7636 example verifier', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('generates random verifiers of unreserved characters', () => {
    const a = randomString(64)
    expect(a).toMatch(/^[A-Za-z0-9\-._~]{64}$/)
    expect(randomString(64)).not.toBe(a)
  })
})

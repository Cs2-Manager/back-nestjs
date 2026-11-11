import jwt from 'jsonwebtoken'

import { AuthError } from '../../src/auth/auth.types'
import { JwtVerifierService } from '../../src/auth/jwt-verifier.service'
import { JWT_SECRET, baseConfig } from '../helpers/fixtures'

function token(
  payload: Record<string, unknown>,
  options: jwt.SignOptions = {},
): string {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', ...options })
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sub: '42',
    username: 'alice',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }
}

describe('JwtVerifierService', () => {
  const verifier = new JwtVerifierService(baseConfig())

  it('accepts a valid Flask-style token', () => {
    expect(verifier.verify(token(claims()))).toEqual({
      id: 42,
      username: 'alice',
      tokenExpiresAt: expect.any(Number),
    })
  })

  it('rejects invalid signatures and wrong algorithms', () => {
    const invalid = jwt.sign(claims(), 'another-secret-long-enough', {
      algorithm: 'HS256',
    })
    expect(() => verifier.verify(invalid)).toThrow(AuthError)
    try {
      verifier.verify(invalid)
    } catch (error) {
      expect((error as AuthError).code).toBe('AUTH_INVALID')
    }

    const wrongAlgorithm = jwt.sign(claims(), JWT_SECRET, {
      algorithm: 'HS512',
    })
    expect(() => verifier.verify(wrongAlgorithm)).toThrow(AuthError)
  })

  it('rejects expired tokens with a specific code', () => {
    const expired = token(
      claims({
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
      }),
    )
    try {
      verifier.verify(expired)
      throw new Error('expected rejection')
    } catch (error) {
      expect((error as AuthError).code).toBe('AUTH_EXPIRED')
    }
  })

  it('rejects missing or malformed claims', () => {
    const missingExp = claims()
    delete missingExp.exp
    const missingIat = claims()
    delete missingIat.iat
    const missingSub = claims()
    delete missingSub.sub
    const missingUsername = claims()
    delete missingUsername.username

    for (const payload of [
      missingSub,
      claims({ sub: 'abc' }),
      missingUsername,
      missingExp,
      claims({ exp: 1, iat: 2 }),
    ]) {
      expect(() => verifier.verify(token(payload))).toThrow(AuthError)
    }
    expect(() =>
      verifier.verify(token(missingIat, { noTimestamp: true })),
    ).toThrow(AuthError)
  })

  it('ignores a user_id sent by the client', () => {
    const verified = verifier.verify(
      token(claims({ user_id: 999, sub: '7' })),
    )
    expect(verified.id).toBe(7)
  })
})

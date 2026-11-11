import { AuthError, type AuthenticatedUser } from './auth.types'

function subjectId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,15}$/.test(value)) {
    throw new AuthError('AUTH_INVALID', 'Invalid token subject')
  }
  return Number(value)
}

function username(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 80) {
    throw new AuthError('AUTH_INVALID', 'Invalid token username')
  }
  return value
}

function timestamp(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AuthError('AUTH_INVALID', message)
  }
  return value
}

function expiration(claims: Record<string, unknown>): number {
  const exp = timestamp(claims.exp, 'Token expiration missing')
  const iat = timestamp(claims.iat, 'Token issued-at missing')
  if (exp <= iat) throw new AuthError('AUTH_INVALID', 'Invalid token lifetime')
  return exp * 1000
}

/** Claim validation is separate from cryptographic JWT verification. */
export function authenticatedClaims(payload: unknown): AuthenticatedUser {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AuthError('AUTH_INVALID', 'Invalid token payload')
  }
  const claims = payload as Record<string, unknown>
  return {
    id: subjectId(claims.sub),
    username: username(claims.username),
    tokenExpiresAt: expiration(claims),
  }
}

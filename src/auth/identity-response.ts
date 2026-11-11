import { AuthError, type AuthenticatedUser, type IdentityInfo } from './auth.types'

function teamId(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new AuthError('AUTH_FORBIDDEN', 'Invalid team membership')
  }
  return value
}

function role(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.length < 1 || value.length > 20) {
    throw new AuthError('AUTH_FORBIDDEN', 'Invalid team role')
  }
  return value
}

/** Validate untrusted Flask data independently of HTTP and cache policy. */
export function identityResponse(payload: unknown, user: AuthenticatedUser): IdentityInfo {
  const data = payload as Record<string, unknown> | null
  if (!data || data.user_id !== user.id || data.active !== true || data.username !== user.username) {
    throw new AuthError('AUTH_FORBIDDEN', 'User is not authorized')
  }
  return { teamId: teamId(data.team_id), role: role(data.role) }
}

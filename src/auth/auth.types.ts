export type AuthErrorCode =
  | 'AUTH_MISSING_TOKEN'
  | 'AUTH_INVALID'
  | 'AUTH_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_UNAVAILABLE'
  | 'CONNECTION_LIMIT'

export interface AuthenticatedUser {
  id: number
  username: string
  tokenExpiresAt: number
}

/**
 * Datos de membresía que Flask devuelve junto a la verificación de identidad.
 * Son la única fuente para asignar rooms `team:<id>` y presencia; el cliente
 * nunca puede enviarlos.
 */
export interface IdentityInfo {
  teamId: number | null
  role: string | null
}

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

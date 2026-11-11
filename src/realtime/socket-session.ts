import type { Socket } from 'socket.io'
import { AuthError, type AuthenticatedUser, type IdentityInfo } from '../auth/auth.types'

export interface SocketData {
  user?: AuthenticatedUser
  ip?: string
  identity?: IdentityInfo
}

function forwardedIp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.split(',').at(-1)?.trim()
}

/** Trust only nginx-normalized headers; the service port must not be public. */
export function clientIp(socket: Socket): string {
  const realIp = socket.handshake.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()
  return forwardedIp(socket.handshake.headers['x-forwarded-for']) || socket.handshake.address || 'unknown'
}

export function sessionToken(socket: Socket): string {
  if (socket.handshake.query?.token !== undefined) {
    throw new AuthError('AUTH_INVALID', 'Token in query string is not allowed')
  }
  return handshakeToken(socket.handshake.auth?.token, socket.handshake.headers.authorization)
}

function handshakeToken(token: unknown, header: unknown): string {
  if (typeof token === 'string' && token.length > 0) return token
  return bearerToken(header)
}

function bearerToken(header: unknown): string {
  if (typeof header === 'string' && header.startsWith('Bearer ') && header.length > 7) return header.slice(7)
  throw new AuthError('AUTH_MISSING_TOKEN', 'Authentication token required')
}

export function socketError(error: AuthError): Error & { data: { code: string } } {
  const result = new Error(error.message) as Error & { data: { code: string } }
  result.data = { code: error.code }
  return result
}

/** The handshake never extends a session past JWT expiration. */
export function expireSession(socket: Socket, expiresAt: number): void {
  let timer: NodeJS.Timeout
  const check = () => {
    const remaining = expiresAt - Date.now()
    if (remaining <= 0) {
      socket.disconnect(true)
      return
    }
    timer = setTimeout(check, Math.min(remaining, 2_147_483_647))
    timer.unref()
  }
  socket.once('disconnect', () => clearTimeout(timer))
  check()
}

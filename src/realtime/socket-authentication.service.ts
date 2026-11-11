import { Injectable, Logger } from '@nestjs/common'
import type { Server, Socket } from 'socket.io'
import { AuthError } from '../auth/auth.types'
import { IdentityVerifierService } from '../auth/identity-verifier.service'
import { JwtVerifierService } from '../auth/jwt-verifier.service'
import { ConnectionLimiterService } from './connection-limiter.service'
import { clientIp, expireSession, sessionToken, socketError, type SocketData } from './socket-session'

/** Handshake authentication and the security lifetime of an accepted socket. */
@Injectable()
export class SocketAuthenticationService {
  private readonly logger = new Logger(SocketAuthenticationService.name)

  constructor(
    private readonly jwtVerifier: JwtVerifierService,
    private readonly identityVerifier: IdentityVerifierService,
    private readonly limiter: ConnectionLimiterService,
  ) {}

  install(server: Server): void {
    server.use((socket, next) => {
      void this.authenticate(socket).then(() => next()).catch((error: unknown) => {
        if (error instanceof AuthError) return next(socketError(error))
        this.logger.warn('Socket authentication failed')
        next(socketError(new AuthError('AUTH_INVALID', 'Authentication failed')))
      })
    })
  }

  async authenticate(socket: Socket): Promise<void> {
    const ip = clientIp(socket)
    if (!this.limiter.allowAttempt(ip)) throw new AuthError('CONNECTION_LIMIT', 'Too many connection attempts')
    const user = this.jwtVerifier.verify(sessionToken(socket))
    const identity = await this.identityVerifier.verify(user)
    if (!this.limiter.allowConnection(user.id, ip)) throw new AuthError('CONNECTION_LIMIT', 'Too many active connections')
    Object.assign(socket.data as SocketData, { user, ip, identity })
  }

  protect(socket: Socket, expiresAt: number): void {
    expireSession(socket, expiresAt)
    socket.onAny(() => {
      if (!this.limiter.allowMessage(socket.id)) {
        this.logger.warn('Socket message rate limit exceeded')
        socket.disconnect(true)
      }
    })
  }

  forget(socketId: string): void {
    this.limiter.forgetSocket(socketId)
  }
}

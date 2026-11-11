import { Inject, Injectable } from '@nestjs/common'
import { TokenExpiredError, verify } from 'jsonwebtoken'

import { REALTIME_CONFIG, type RealtimeConfig } from '../config/realtime-config'
import { AuthError, type AuthenticatedUser } from './auth.types'
import { authenticatedClaims } from './jwt-claims'

/**
 * Valida localmente el JWT que emite Flask. No replica usuarios ni roles:
 * solo comprueba firma, algoritmo permitido, expiración y claims mínimos.
 */
@Injectable()
export class JwtVerifierService {
  constructor(
    @Inject(REALTIME_CONFIG) private readonly config: RealtimeConfig,
  ) {}

  verify(token: string): AuthenticatedUser {
    if (!token || typeof token !== 'string') {
      throw new AuthError('AUTH_MISSING_TOKEN', 'Authentication token required')
    }
    return authenticatedClaims(this.verifySignature(token))
  }

  private verifySignature(token: string): unknown {
    try {
      return verify(token, this.config.jwtSecret, {
        algorithms: [this.config.jwtAlgorithm],
        clockTolerance: 5,
      })
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new AuthError('AUTH_EXPIRED', 'Token has expired')
      }
      throw new AuthError('AUTH_INVALID', 'Invalid token')
    }

  }
}

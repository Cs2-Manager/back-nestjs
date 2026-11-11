import { randomUUID } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { signHmac } from '../common/hmac'
import { REALTIME_CONFIG, type RealtimeConfig } from '../config/realtime-config'
import { AuthError, type AuthenticatedUser, type IdentityInfo } from './auth.types'
import { identityResponse } from './identity-response'

@Injectable()
export class FlaskIdentityClient {
  private readonly logger = new Logger(FlaskIdentityClient.name)

  constructor(@Inject(REALTIME_CONFIG) private readonly config: RealtimeConfig) {}

  /** Null means explicit fail-open, never a verified/cacheable membership. */
  async lookup(user: AuthenticatedUser, invalidated: AbortSignal): Promise<IdentityInfo | null> {
    let response: Response
    try {
      response = await this.request(user.id, invalidated)
    } catch {
      if (invalidated.aborted) throw new AuthError('AUTH_FORBIDDEN', 'Membership changed during authentication')
      return this.unavailable()
    }
    if (response.status === 404 || response.status === 403) {
      throw new AuthError('AUTH_FORBIDDEN', 'User is not authorized')
    }
    if (!response.ok) return this.unavailable()
    return identityResponse(await this.readBody(response), user)
  }

  private request(userId: number, invalidated: AbortSignal): Promise<Response> {
    const body = JSON.stringify({ user_id: userId })
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = randomUUID()
    return fetch(this.config.flaskIdentityUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Realtime-Timestamp': timestamp,
        'X-Realtime-Nonce': nonce,
        'X-Realtime-Signature': signHmac(this.config.hmacSecret, timestamp, nonce, body),
      },
      body,
      signal: AbortSignal.any([invalidated, AbortSignal.timeout(this.config.identityTimeoutMs)]),
    })
  }

  private async readBody(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      throw new AuthError('AUTH_UNAVAILABLE', 'Invalid identity response')
    }
  }

  private unavailable(): null {
    this.logger.warn('Flask identity check unavailable')
    if (this.config.identityVerifyFailOpen) return null
    throw new AuthError('AUTH_UNAVAILABLE', 'Identity service unavailable')
  }
}

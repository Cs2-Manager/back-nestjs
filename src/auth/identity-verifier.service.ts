import { Inject, Injectable } from '@nestjs/common'

import { REALTIME_CONFIG, type RealtimeConfig } from '../config/realtime-config'
import { AuthError, type AuthenticatedUser, type IdentityInfo } from './auth.types'
import { FlaskIdentityClient } from './flask-identity.client'

interface CacheEntry extends IdentityInfo {
  expiresAt: number
  username: string
}

const EMPTY_IDENTITY: IdentityInfo = { teamId: null, role: null }

/** Owns cache lifetime AND in-flight invalidation as a single consistency boundary. */
@Injectable()
export class IdentityVerifierService {
  private readonly cache = new Map<number, CacheEntry>()
  private readonly pending = new Map<number, Set<AbortController>>()

  constructor(
    @Inject(REALTIME_CONFIG) private readonly config: RealtimeConfig,
    private readonly client: FlaskIdentityClient,
  ) {}

  async verify(user: AuthenticatedUser): Promise<IdentityInfo> {
    if (!this.config.identityVerifyEnabled) return EMPTY_IDENTITY
    const cached = this.cachedIdentity(user)
    if (cached) return cached
    return this.lookup(user)
  }

  private cachedIdentity(user: AuthenticatedUser): IdentityInfo | null {
    const cached = this.cache.get(user.id)
    if (!cached || cached.expiresAt <= Date.now() || cached.username !== user.username) return null
    return { teamId: cached.teamId, role: cached.role }
  }

  private async lookup(user: AuthenticatedUser): Promise<IdentityInfo> {
    const controller = new AbortController()
    const requests = this.pending.get(user.id) ?? new Set<AbortController>()
    requests.add(controller)
    this.pending.set(user.id, requests)
    try {
      const identity = await this.client.lookup(user, controller.signal)
      // Check even for fail-open: an invalidation must never authorize a stale session.
      if (controller.signal.aborted) throw new AuthError('AUTH_FORBIDDEN', 'Membership changed during authentication')
      if (!identity) return EMPTY_IDENTITY
      this.cache.set(user.id, {
        ...identity,
        expiresAt: Date.now() + this.config.identityCacheTtlSeconds * 1000,
        username: user.username,
      })
      return identity
    } finally {
      requests.delete(controller)
      if (requests.size === 0) this.pending.delete(user.id)
    }
  }

  invalidate(userId: number): void {
    this.cache.delete(userId)
    for (const controller of this.pending.get(userId) ?? []) controller.abort()
  }
}

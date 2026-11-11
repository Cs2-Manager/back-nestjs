import { randomUUID } from 'node:crypto'
import { signHmac } from '../../src/common/hmac'
import type { RealtimeConfig } from '../../src/config/realtime-config'
import type { InternalEvent } from '../../src/events/event.types'

export const JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
export const HMAC_SECRET = 'test-hmac-secret-at-least-32-characters-long'

export function baseConfig(
  overrides: Partial<RealtimeConfig> = {},
): RealtimeConfig {
  return {
    port: 0,
    nodeEnv: 'test',
    jwtSecret: JWT_SECRET,
    jwtAlgorithm: 'HS256',
    hmacSecret: HMAC_SECRET,
    wsPath: '/realtime/socket.io',
    eventMaxAgeSeconds: 300,
    eventFutureSkewSeconds: 30,
    nonceTtlSeconds: 900,
    eventIdTtlSeconds: 3600,
    allowedOrigins: [],
    allowMissingOrigin: true,
    identityVerifyEnabled: false,
    identityVerifyFailOpen: false,
    flaskIdentityUrl: 'http://backend:5000/internal/realtime/identity',
    identityTimeoutMs: 1000,
    identityCacheTtlSeconds: 30,
    maxConnectionsPerUser: 5,
    maxConnectionsPerIp: 25,
    maxConnectionAttemptsPerMinute: 30,
    wsMaxBufferBytes: 16384,
    wsMessagesPerMinute: 20,
    presenceGraceSeconds: 0,
    ...overrides,
  }
}

export function team(id = 3, name = 'Alpha Wolves', tag: string | null = 'AW') {
  return { id, name, tag }
}

export function user(id = 1, username = 'alice') {
  return { user_id: id, username }
}

export function invitationCreatedEvent(
  overrides: Partial<InternalEvent> = {},
): InternalEvent {
  return {
    event_id: randomUUID(),
    event_type: 'team.invitation.created',
    occurred_at: new Date().toISOString(),
    version: 1,
    resource_id: 12,
    team_id: 3,
    actor: user(5, 'captain'),
    recipients: [7],
    payload: {
      invitation_id: 12,
      team: team(),
      role: 'PLAYER',
      invited_by: user(5, 'captain'),
    },
    ...overrides,
  } as InternalEvent
}

export function invitationAcceptedEvent(): InternalEvent {
  return {
    event_id: randomUUID(),
    event_type: 'team.invitation.accepted',
    occurred_at: new Date().toISOString(),
    version: 1,
    resource_id: 12,
    team_id: 3,
    actor: user(7, 'bob'),
    recipients: [5],
    payload: {
      invitation_id: 12,
      team: team(),
      member: user(7, 'bob'),
      role: 'PLAYER',
    },
  }
}

export function invitationRejectedEvent(): InternalEvent {
  return {
    event_id: randomUUID(),
    event_type: 'team.invitation.rejected',
    occurred_at: new Date().toISOString(),
    version: 1,
    resource_id: 12,
    team_id: 3,
    actor: user(7, 'bob'),
    recipients: [5],
    payload: {
      invitation_id: 12,
      team: team(),
      user: user(7, 'bob'),
    },
  }
}

export function proposalCreatedEvent(): InternalEvent {
  return {
    event_id: randomUUID(),
    event_type: 'grenade.proposal.created',
    occurred_at: new Date().toISOString(),
    version: 1,
    resource_id: 44,
    team_id: 3,
    actor: user(7, 'bob'),
    recipients: [5],
    payload: {
      proposal_id: 44,
      team: team(),
      map: { id: 2, name: 'Mirage' },
      lineup: { id: 90, title: 'Smoke A', type: 'SMOKE' },
      author: user(7, 'bob'),
    },
  }
}

export function proposalApprovedEvent(): InternalEvent {
  return {
    event_id: randomUUID(),
    event_type: 'grenade.proposal.approved',
    occurred_at: new Date().toISOString(),
    version: 1,
    resource_id: 44,
    team_id: 3,
    actor: user(5, 'captain'),
    recipients: [7],
    payload: {
      proposal_id: 44,
      team: team(),
      map: { id: 2, name: 'Mirage' },
      lineup: { id: 90, title: 'Smoke A', type: 'SMOKE' },
      approved_lineup_id: 91,
    },
  }
}

export function proposalRejectedEvent(): InternalEvent {
  return {
    event_id: randomUUID(),
    event_type: 'grenade.proposal.rejected',
    occurred_at: new Date().toISOString(),
    version: 1,
    resource_id: 44,
    team_id: 3,
    actor: user(5, 'captain'),
    recipients: [7],
    payload: {
      proposal_id: 44,
      team: team(),
      map: { id: 2, name: 'Mirage' },
      lineup: { id: 90, title: 'Smoke A', type: 'SMOKE' },
    },
  }
}

export function teamActivityEvent(
  overrides: Partial<InternalEvent> = {},
  payloadOverrides: Record<string, unknown> = {},
): InternalEvent {
  const actor = user(7, 'bob')
  return {
    event_id: randomUUID(),
    event_type: 'team.activity',
    occurred_at: new Date().toISOString(),
    version: 1,
    resource_id: 501,
    team_id: 3,
    actor,
    recipients: [5, 7],
    payload: {
      activity_id: 501,
      activity_type: 'member.joined',
      description: 'bob se unió al equipo.',
      actor,
      team: team(),
      resource_type: 'team',
      resource_id: 3,
      path: '/teams/3',
      created_at: new Date().toISOString(),
      metadata: { role: 'PLAYER' },
      ...payloadOverrides,
    },
    ...overrides,
  } as InternalEvent
}

export function signedBody(
  body: unknown,
  options: { timestamp?: number; nonce?: string; secret?: string } = {},
): { raw: string; headers: Record<string, string> } {
  const raw = JSON.stringify(body)
  const timestamp = String(
    options.timestamp ?? Math.floor(Date.now() / 1000),
  )
  const nonce = options.nonce ?? randomUUID()
  const signature = signHmac(
    options.secret ?? HMAC_SECRET,
    timestamp,
    nonce,
    Buffer.from(raw, 'utf8'),
  )
  return {
    raw,
    headers: {
      'Content-Type': 'application/json',
      'X-Realtime-Timestamp': timestamp,
      'X-Realtime-Nonce': nonce,
      'X-Realtime-Signature': signature,
    },
  }
}

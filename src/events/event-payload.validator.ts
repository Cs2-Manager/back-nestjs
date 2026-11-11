import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import type { RealtimeConfig } from '../config/realtime-config'
import { InternalEventDto } from './event.dto'
import {
  EventValidationError,
  type ActorRef,
  type InternalEvent,
  type LineupRef,
  type MapRef,
  type TeamRef,
  type UserRef,
} from './event.types'

type JsonObject = Record<string, unknown>

function isPlainObject(value: unknown): value is JsonObject {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function fail(message: string): never {
  throw new EventValidationError(message)
}

function exactKeys(
  value: unknown,
  name: string,
  required: string[],
  optional: string[] = [],
): JsonObject {
  if (!isPlainObject(value)) fail(`${name} must be an object`)
  const allowed = new Set([...required, ...optional])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${name}.${key} is not allowed`)
  }
  for (const key of required) {
    if (!(key in value)) fail(`${name}.${key} is required`)
  }
  return value
}

function text(
  value: unknown,
  name: string,
  options: { min?: number; max: number },
): string {
  const min = options.min ?? 0
  if (
    typeof value !== 'string' ||
    value.length < min ||
    value.length > options.max
  ) {
    fail(`${name} must be a string between ${min} and ${options.max} chars`)
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    fail(`${name} contains control characters`)
  }
  return value
}

function positiveInt(value: unknown, name: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    fail(`${name} must be a positive integer`)
  }
  return value
}

function userRef(value: unknown, name: string): UserRef {
  const obj = exactKeys(value, name, ['user_id', 'username'])
  return {
    user_id: positiveInt(obj.user_id, `${name}.user_id`),
    username: text(obj.username, `${name}.username`, { min: 1, max: 80 }),
  }
}

function teamRef(value: unknown, name: string): TeamRef {
  const obj = exactKeys(value, name, ['id', 'name', 'tag'])
  if (obj.tag !== null && typeof obj.tag !== 'string') {
    fail(`${name}.tag must be a string or null`)
  }
  return {
    id: positiveInt(obj.id, `${name}.id`),
    name: text(obj.name, `${name}.name`, { min: 1, max: 80 }),
    tag:
      obj.tag === null ? null : text(obj.tag, `${name}.tag`, { max: 10 }),
  }
}

function mapRef(value: unknown, name: string): MapRef {
  const obj = exactKeys(value, name, ['id', 'name'])
  return {
    id: positiveInt(obj.id, `${name}.id`),
    name: text(obj.name, `${name}.name`, { min: 1, max: 80 }),
  }
}

function lineupRef(value: unknown, name: string): LineupRef {
  const obj = exactKeys(value, name, ['id', 'title', 'type'])
  return {
    id: positiveInt(obj.id, `${name}.id`),
    title: text(obj.title, `${name}.title`, { min: 1, max: 160 }),
    type: text(obj.type, `${name}.type`, { min: 1, max: 20 }),
  }
}

function internalPath(value: unknown, name: string): string {
  const path = text(value, name, { min: 1, max: 300 })
  if (!path.startsWith('/') || path.startsWith('//')) {
    fail(`${name} must be an internal absolute path`)
  }
  return path
}

function metadataObject(
  value: unknown,
  name: string,
): Record<string, unknown> {
  if (!isPlainObject(value)) fail(`${name} must be an object`)
  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch {
    fail(`${name} must be JSON serializable`)
  }
  if (serialized.length > 4000) fail(`${name} is too large`)
  return value
}

function validatePayload(
  eventType: string,
  payload: unknown,
): InternalEvent['payload'] {
  switch (eventType) {
    case 'team.invitation.created': {
      const obj = exactKeys(payload, 'payload', [
        'invitation_id',
        'team',
        'role',
        'invited_by',
      ])
      return {
        invitation_id: positiveInt(obj.invitation_id, 'payload.invitation_id'),
        team: teamRef(obj.team, 'payload.team'),
        role: text(obj.role, 'payload.role', { min: 1, max: 10 }),
        invited_by: userRef(obj.invited_by, 'payload.invited_by'),
      }
    }
    case 'team.invitation.accepted': {
      const obj = exactKeys(payload, 'payload', [
        'invitation_id',
        'team',
        'member',
        'role',
      ])
      return {
        invitation_id: positiveInt(obj.invitation_id, 'payload.invitation_id'),
        team: teamRef(obj.team, 'payload.team'),
        member: userRef(obj.member, 'payload.member'),
        role: text(obj.role, 'payload.role', { min: 1, max: 10 }),
      }
    }
    case 'team.invitation.rejected': {
      const obj = exactKeys(payload, 'payload', [
        'invitation_id',
        'team',
        'user',
      ])
      return {
        invitation_id: positiveInt(obj.invitation_id, 'payload.invitation_id'),
        team: teamRef(obj.team, 'payload.team'),
        user: userRef(obj.user, 'payload.user'),
      }
    }
    case 'grenade.proposal.created': {
      const obj = exactKeys(payload, 'payload', [
        'proposal_id',
        'team',
        'map',
        'lineup',
        'author',
      ])
      return {
        proposal_id: positiveInt(obj.proposal_id, 'payload.proposal_id'),
        team: teamRef(obj.team, 'payload.team'),
        map: mapRef(obj.map, 'payload.map'),
        lineup: lineupRef(obj.lineup, 'payload.lineup'),
        author: userRef(obj.author, 'payload.author'),
      }
    }
    case 'grenade.proposal.approved': {
      const obj = exactKeys(payload, 'payload', [
        'proposal_id',
        'team',
        'map',
        'lineup',
        'approved_lineup_id',
      ])
      return {
        proposal_id: positiveInt(obj.proposal_id, 'payload.proposal_id'),
        team: teamRef(obj.team, 'payload.team'),
        map: mapRef(obj.map, 'payload.map'),
        lineup: lineupRef(obj.lineup, 'payload.lineup'),
        approved_lineup_id: positiveInt(
          obj.approved_lineup_id,
          'payload.approved_lineup_id',
        ),
      }
    }
    case 'grenade.proposal.rejected': {
      const obj = exactKeys(payload, 'payload', [
        'proposal_id',
        'team',
        'map',
        'lineup',
      ])
      return {
        proposal_id: positiveInt(obj.proposal_id, 'payload.proposal_id'),
        team: teamRef(obj.team, 'payload.team'),
        map: mapRef(obj.map, 'payload.map'),
        lineup: lineupRef(obj.lineup, 'payload.lineup'),
      }
    }
    case 'team.activity': {
      const obj = exactKeys(payload, 'payload', [
        'activity_id',
        'activity_type',
        'description',
        'actor',
        'team',
        'resource_type',
        'resource_id',
        'path',
        'created_at',
        'metadata',
      ])
      const createdAt = text(obj.created_at, 'payload.created_at', {
        min: 1,
        max: 40,
      })
      if (!Number.isFinite(Date.parse(createdAt))) {
        fail('payload.created_at is not a valid date')
      }
      return {
        activity_id: positiveInt(obj.activity_id, 'payload.activity_id'),
        activity_type: text(obj.activity_type, 'payload.activity_type', {
          min: 1,
          max: 60,
        }),
        description: text(obj.description, 'payload.description', {
          min: 1,
          max: 500,
        }),
        actor: userRef(obj.actor, 'payload.actor'),
        team: teamRef(obj.team, 'payload.team'),
        resource_type: text(obj.resource_type, 'payload.resource_type', {
          min: 1,
          max: 40,
        }),
        resource_id: positiveInt(obj.resource_id, 'payload.resource_id'),
        path: internalPath(obj.path, 'payload.path'),
        created_at: createdAt,
        metadata: metadataObject(obj.metadata, 'payload.metadata'),
      }
    }
    default:
      return fail('Unsupported event_type')
  }
}

/**
 * Valida el sobre con class-validator y el payload con un catálogo cerrado.
 * Rechaza campos desconocidos, tipos incorrectos, IDs incoherentes y
 * timestamps fuera de la ventana permitida.
 */
async function validateEnvelope(raw: unknown): Promise<InternalEventDto> {
  const dto = plainToInstance(InternalEventDto, raw)
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  })
  if (errors.length > 0) {
    const first = errors[0]
    const constraint = first.constraints
      ? Object.values(first.constraints)[0]
      : 'invalid value'
    fail(`Invalid event envelope: ${first.property}: ${constraint}`)
  }

  return dto
}

function validateEventTime(occurredAt: string, config: RealtimeConfig, nowMs: number): void {
  const occurredAtMs = Date.parse(occurredAt)
  if (!Number.isFinite(occurredAtMs)) fail('occurred_at is not a valid date')
  const ageSeconds = (nowMs - occurredAtMs) / 1000
  if (ageSeconds > config.eventMaxAgeSeconds) {
    fail('occurred_at is too old')
  }
  if (ageSeconds < -config.eventFutureSkewSeconds) {
    fail('occurred_at is in the future')
  }
}

function validateRecipients(dto: InternalEventDto): number[] {
  const recipients = [...dto.recipients]
  if (new Set(recipients).size !== recipients.length) {
    fail('recipients must not contain duplicates')
  }
  if (dto.event_type === 'team.activity' && dto.notification_id !== undefined) {
    fail('notification_id is not allowed for team.activity')
  }
  return recipients
}

function resourceId(payload: InternalEvent['payload']): number {
  if ('activity_id' in payload) return payload.activity_id
  if ('invitation_id' in payload) return payload.invitation_id
  return payload.proposal_id
}

function validateConsistency(dto: InternalEventDto, payload: InternalEvent['payload']): void {
  if (resourceId(payload) !== dto.resource_id) {
    fail('resource_id does not match payload')
  }
  if (payload.team.id !== dto.team_id) {
    fail('team_id does not match payload.team.id')
  }
  if (
    'actor' in payload &&
    payload.actor.user_id !== dto.actor.user_id
  ) {
    fail('actor does not match payload.actor')
  }
}

export async function validateInternalEvent(
  raw: unknown,
  config: RealtimeConfig,
  nowMs = Date.now(),
): Promise<InternalEvent> {
  const dto = await validateEnvelope(raw)
  validateEventTime(dto.occurred_at, config, nowMs)
  const recipients = validateRecipients(dto)
  const payload = validatePayload(dto.event_type, dto.payload)
  validateConsistency(dto, payload)
  const actor: ActorRef = {
    user_id: dto.actor.user_id,
    username: dto.actor.username,
  }

  return {
    event_id: dto.event_id,
    event_type: dto.event_type,
    occurred_at: dto.occurred_at,
    version: 1,
    resource_id: dto.resource_id,
    team_id: dto.team_id,
    actor,
    recipients,
    notification_id: dto.notification_id,
    payload,
  } as InternalEvent
}

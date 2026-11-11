import { Injectable } from '@nestjs/common'

import type { InternalEvent, TeamActivityPayload } from '../events/event.types'
import { NotificationFactory } from '../notifications/notification.factory'
import {
  RealtimeGateway,
  type TeamActivityMessage,
} from '../realtime/realtime.gateway'

function stringMetadata(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function intMetadata(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null
}

@Injectable()
export class EventsService {
  constructor(
    private readonly notifications: NotificationFactory,
    private readonly gateway: RealtimeGateway,
  ) {}

  /**
   * La lista de destinatarios viene firmada por Flask. NestJS solo entrega a
   * rooms privadas y no acepta destinatarios ni team_id desde el navegador.
   *
   * `team.activity` se difunde a la room `team:<id>` (nunca a rooms de usuario
   * sueltas) después de sincronizar la membresía de los afectados. Así un
   * integrante recién unido recibe la actividad y uno que sale deja de verla
   * antes de la emisión.
   */
  dispatch(event: InternalEvent): number {
    if (event.event_type === 'team.activity') {
      return this.dispatchActivity(event, event.payload)
    }

    const notification = this.notifications.build(event)
    let delivered = 0
    for (const userId of event.recipients) {
      delivered += this.gateway.emitToUser(userId, notification)
    }
    return delivered
  }

  private dispatchActivity(
    event: InternalEvent,
    payload: TeamActivityPayload,
  ): number {
    this.applyMembershipChange(payload)

    const message: TeamActivityMessage = {
      id: event.event_id,
      event_id: event.event_id,
      event_type: 'team.activity',
      team_id: event.team_id,
      occurred_at: event.occurred_at,
      activity_id: payload.activity_id,
      activity_type: payload.activity_type,
      description: payload.description,
      actor: payload.actor,
      team: payload.team,
      resource_type: payload.resource_type,
      resource_id: payload.resource_id,
      path: payload.path,
      created_at: payload.created_at,
      metadata: payload.metadata,
    }
    return this.gateway.emitTeamActivity(event.team_id, message)
  }

  private applyMembershipChange(payload: TeamActivityPayload): void {
    switch (payload.activity_type) {
      case 'member.joined':
        this.gateway.syncTeamMembership(
          payload.actor.user_id,
          payload.team.id,
          stringMetadata(payload.metadata.role),
        )
        break
      case 'member.role_changed': {
        const userId = intMetadata(payload.metadata.user_id)
        if (userId !== null) {
          this.gateway.syncTeamMembership(
            userId,
            payload.team.id,
            stringMetadata(payload.metadata.role),
          )
        }
        break
      }
      case 'member.left':
        this.gateway.removeUserFromTeam(
          payload.actor.user_id,
          payload.team.id,
        )
        break
      case 'member.removed': {
        const userId = intMetadata(payload.metadata.removed_user_id)
        if (userId !== null) {
          this.gateway.removeUserFromTeam(userId, payload.team.id)
        }
        break
      }
      default:
        break
    }
  }
}

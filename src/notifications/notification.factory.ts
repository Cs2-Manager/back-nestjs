import { Injectable } from '@nestjs/common'

import type { InternalEvent } from '../events/event.types'
import type { NotificationPayload } from './notification.types'

const GRENADE_TYPE_LABELS: Record<string, string> = {
  SMOKE: 'humo',
  FLASH: 'flash',
  MOLOTOV: 'molotov',
  INCENDIARY: 'incendiaria',
  HE: 'HE',
  DECOY: 'señuelo',
}

const ROLE_LABELS: Record<string, string> = {
  CAPTAIN: 'capitán',
  COACH: 'entrenador',
  PLAYER: 'jugador',
}

function grenadeType(value: string): string {
  return GRENADE_TYPE_LABELS[value.toUpperCase()] || value
}

function role(value: string): string {
  return ROLE_LABELS[value.toUpperCase()] || value
}

/**
 * Convierte un evento validado en una notificación de solo datos. El cliente
 * React nunca recibe HTML ni rutas absolutas externas.
 */
@Injectable()
export class NotificationFactory {
  build(event: InternalEvent): NotificationPayload {
    const common = {
      id: event.event_id,
      event_id: event.event_id,
      notification_id: event.notification_id,
      event_type: event.event_type,
      created_at: event.occurred_at,
    }

    switch (event.event_type) {
      case 'team.invitation.created': {
        const { team, role: invitationRole, invited_by } = event.payload
        return {
          ...common,
          title: 'Invitación recibida',
          message: `${invited_by.username} te invitó a ${team.name} como ${role(invitationRole)}.`,
          resource: {
            type: 'invitation',
            id: event.payload.invitation_id,
            team_id: team.id,
            path: '/invitations',
          },
          metadata: {
            team_name: team.name,
            team_tag: team.tag,
            actor_username: invited_by.username,
            role: invitationRole,
          },
        }
      }

      case 'team.invitation.accepted': {
        const { team, member, role: memberRole } = event.payload
        return {
          ...common,
          title: 'Invitación aceptada',
          message: `${member.username} aceptó la invitación a ${team.name}.`,
          resource: {
            type: 'team',
            id: team.id,
            team_id: team.id,
            path: `/teams/${team.id}`,
          },
          metadata: {
            team_name: team.name,
            team_tag: team.tag,
            actor_username: member.username,
            role: memberRole,
          },
        }
      }

      case 'team.invitation.rejected': {
        const { team, user } = event.payload
        return {
          ...common,
          title: 'Invitación rechazada',
          message: `${user.username} rechazó la invitación a ${team.name}.`,
          resource: {
            type: 'team',
            id: team.id,
            team_id: team.id,
            path: `/teams/${team.id}`,
          },
          metadata: {
            team_name: team.name,
            team_tag: team.tag,
            actor_username: user.username,
          },
        }
      }

      case 'grenade.proposal.created': {
        const { team, map, lineup, author, proposal_id } = event.payload
        return {
          ...common,
          title: 'Nueva propuesta de granada',
          message: `${author.username} propuso "${lineup.title}" (${map.name}, ${grenadeType(lineup.type)}) en ${team.name}.`,
          resource: {
            type: 'grenade_proposal',
            id: proposal_id,
            team_id: team.id,
            path: `/teams/${team.id}`,
          },
          metadata: {
            team_name: team.name,
            team_tag: team.tag,
            actor_username: author.username,
            map_name: map.name,
            lineup_type: lineup.type,
            lineup_title: lineup.title,
          },
        }
      }

      case 'grenade.proposal.approved': {
        const { team, map, lineup, approved_lineup_id } = event.payload
        return {
          ...common,
          title: 'Propuesta aprobada',
          message: `Tu propuesta "${lineup.title}" (${map.name}) fue aprobada en ${team.name}.`,
          resource: {
            type: 'team_lineup',
            id: approved_lineup_id,
            team_id: team.id,
            path: `/teams/${team.id}/lineups/${approved_lineup_id}`,
          },
          metadata: {
            team_name: team.name,
            team_tag: team.tag,
            actor_username: event.actor.username,
            map_name: map.name,
            lineup_type: lineup.type,
            lineup_title: lineup.title,
          },
        }
      }

      case 'grenade.proposal.rejected': {
        const { team, map, lineup, proposal_id } = event.payload
        return {
          ...common,
          title: 'Propuesta rechazada',
          message: `Tu propuesta "${lineup.title}" (${map.name}) fue rechazada en ${team.name}.`,
          resource: {
            type: 'grenade_proposal',
            id: proposal_id,
            team_id: team.id,
            path: `/teams/${team.id}`,
          },
          metadata: {
            team_name: team.name,
            team_tag: team.tag,
            actor_username: event.actor.username,
            map_name: map.name,
            lineup_type: lineup.type,
            lineup_title: lineup.title,
          },
        }
      }

      case 'team.activity':
        // La actividad de equipo no genera notificación persistente ni
        // campanita; se entrega por la room de equipo en EventsService.
        throw new Error('team.activity does not generate a notification')
    }
  }
}

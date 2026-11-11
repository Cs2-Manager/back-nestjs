import { EventsService } from '../../src/events/events.service'
import type { NotificationFactory } from '../../src/notifications/notification.factory'
import type { NotificationPayload } from '../../src/notifications/notification.types'
import type { RealtimeGateway } from '../../src/realtime/realtime.gateway'
import {
  invitationCreatedEvent,
  teamActivityEvent,
} from '../helpers/fixtures'

function build() {
  const gateway = {
    emitToUser: jest.fn().mockReturnValue(1),
    emitTeamActivity: jest.fn().mockReturnValue(2),
    syncTeamMembership: jest.fn(),
    removeUserFromTeam: jest.fn(),
  }
  const notifications = {
    build: jest.fn().mockReturnValue({
      id: 'n1',
    } as unknown as NotificationPayload),
  }
  const service = new EventsService(
    notifications as unknown as NotificationFactory,
    gateway as unknown as RealtimeGateway,
  )
  return { service, gateway, notifications }
}

describe('EventsService', () => {
  it('delivers notifications only to the signed recipients', () => {
    const { service, gateway, notifications } = build()
    const event = invitationCreatedEvent({ recipients: [5, 7] } as never)

    expect(service.dispatch(event)).toBe(2)
    expect(notifications.build).toHaveBeenCalledWith(event)
    expect(gateway.emitToUser).toHaveBeenNthCalledWith(1, 5, { id: 'n1' })
    expect(gateway.emitToUser).toHaveBeenNthCalledWith(2, 7, { id: 'n1' })
  })

  it('broadcasts team.activity to the team room without a notification', () => {
    const { service, gateway, notifications } = build()
    const event = teamActivityEvent()

    expect(service.dispatch(event)).toBe(2)
    expect(notifications.build).not.toHaveBeenCalled()
    expect(gateway.syncTeamMembership).toHaveBeenCalledWith(7, 3, 'PLAYER')
    expect(gateway.emitTeamActivity).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        event_id: event.event_id,
        activity_id: 501,
        activity_type: 'member.joined',
        path: '/teams/3',
      }),
    )
  })

  it('removes a leaving member before emitting the activity', () => {
    const { service, gateway } = build()
    const event = teamActivityEvent(
      {},
      {
        activity_type: 'member.left',
        actor: { user_id: 7, username: 'bob' },
        metadata: {},
      },
    )

    service.dispatch(event)
    expect(gateway.removeUserFromTeam).toHaveBeenCalledWith(7, 3)
    expect(gateway.syncTeamMembership).not.toHaveBeenCalled()
    expect(gateway.removeUserFromTeam.mock.invocationCallOrder[0]).toBeLessThan(
      gateway.emitTeamActivity.mock.invocationCallOrder[0],
    )
  })

  it('removes an expelled member using the signed metadata', () => {
    const { service, gateway } = build()
    const event = teamActivityEvent(
      {},
      {
        activity_type: 'member.removed',
        actor: { user_id: 5, username: 'captain' },
        metadata: { removed_user_id: 7 },
      },
    )

    service.dispatch(event)
    expect(gateway.removeUserFromTeam).toHaveBeenCalledWith(7, 3)
    expect(gateway.removeUserFromTeam.mock.invocationCallOrder[0]).toBeLessThan(
      gateway.emitTeamActivity.mock.invocationCallOrder[0],
    )
  })

  it('updates the target user on a role change', () => {
    const { service, gateway } = build()
    const event = teamActivityEvent(
      {},
      {
        activity_type: 'member.role_changed',
        actor: { user_id: 5, username: 'captain' },
        metadata: { role: 'COACH', previous_role: 'PLAYER', user_id: 7 },
      },
    )

    service.dispatch(event)
    expect(gateway.syncTeamMembership).toHaveBeenCalledWith(7, 3, 'COACH')
  })
})

import { NotificationFactory } from '../../src/notifications/notification.factory'
import {
  invitationAcceptedEvent,
  invitationCreatedEvent,
  invitationRejectedEvent,
  proposalApprovedEvent,
  proposalCreatedEvent,
  proposalRejectedEvent,
} from '../helpers/fixtures'

describe('NotificationFactory', () => {
  const factory = new NotificationFactory()

  it('builds a safe invitation notification', () => {
    const event = invitationCreatedEvent()
    const notification = factory.build(event)
    expect(notification.id).toBe(event.event_id)
    expect(notification.title).toBe('Invitación recibida')
    expect(notification.message).toContain('Alpha Wolves')
    expect(notification.message).toContain('jugador')
    expect(notification.resource.path).toBe('/invitations')
    expect(notification.resource.team_id).toBe(3)
  })

  it('never emits HTML or external navigation paths', () => {
    const event = invitationCreatedEvent()
    const raw = {
      ...event,
      payload: {
        ...event.payload,
        team: {
          ...event.payload.team,
          name: '<img src=x onerror=alert(1)>',
        },
      },
    }
    const notification = factory.build(raw as typeof event)
    expect(notification.message).toContain('<img')
    for (const built of [
      factory.build(invitationCreatedEvent()),
      factory.build(invitationAcceptedEvent()),
      factory.build(invitationRejectedEvent()),
      factory.build(proposalCreatedEvent()),
      factory.build(proposalApprovedEvent()),
      factory.build(proposalRejectedEvent()),
      notification,
    ]) {
      expect(built.resource.path.startsWith('/')).toBe(true)
      expect(built.resource.path.startsWith('//')).toBe(false)
      expect(built.message).not.toMatch(/https?:\/\//)
    }
  })

  it('uses the approved team lineup for navigation', () => {
    const notification = factory.build(proposalApprovedEvent())
    expect(notification.resource.type).toBe('team_lineup')
    expect(notification.resource.path).toBe('/teams/3/lineups/91')
    expect(notification.title).toBe('Propuesta aprobada')
  })

  it('includes map and grenade type only in authorized proposal notifications', () => {
    const notification = factory.build(proposalCreatedEvent())
    expect(notification.metadata.map_name).toBe('Mirage')
    expect(notification.metadata.lineup_type).toBe('SMOKE')
    expect(notification.message).toContain('humo')
    expect(notification.resource.path).toBe('/teams/3')
  })

  it('builds rejection notifications without leaking the reason', () => {
    const notification = factory.build(proposalRejectedEvent())
    expect(notification.title).toBe('Propuesta rechazada')
    expect(notification.message).not.toContain('reason')
    expect(notification.metadata.lineup_title).toBe('Smoke A')
  })
})

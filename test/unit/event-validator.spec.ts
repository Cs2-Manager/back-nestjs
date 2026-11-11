import { randomUUID } from 'node:crypto'

import { baseConfig } from '../helpers/fixtures'
import {
  invitationAcceptedEvent,
  invitationCreatedEvent,
  invitationRejectedEvent,
  proposalApprovedEvent,
  proposalCreatedEvent,
  proposalRejectedEvent,
  teamActivityEvent,
} from '../helpers/fixtures'
import { validateInternalEvent } from '../../src/events/event-payload.validator'

const config = baseConfig()

describe('validateInternalEvent', () => {
  it.each([
    ['team.invitation.created', invitationCreatedEvent()],
    ['team.invitation.accepted', invitationAcceptedEvent()],
    ['team.invitation.rejected', invitationRejectedEvent()],
    ['grenade.proposal.created', proposalCreatedEvent()],
    ['grenade.proposal.approved', proposalApprovedEvent()],
    ['grenade.proposal.rejected', proposalRejectedEvent()],
    ['team.activity', teamActivityEvent()],
  ])('accepts a valid %s event', async (eventType, event) => {
    const validated = await validateInternalEvent(event, config)
    expect(validated.event_type).toBe(eventType)
    expect(validated.recipients.length).toBeGreaterThan(0)
  })

  it('rejects unknown event types', async () => {
    const event = { ...invitationCreatedEvent(), event_type: 'user.hacked' }
    await expect(validateInternalEvent(event, config)).rejects.toThrow(
      'event_type',
    )
  })

  it('rejects unknown payload fields', async () => {
    const event = invitationCreatedEvent()
    const raw = {
      ...event,
      payload: { ...event.payload, secret: 'leak' },
    }
    await expect(validateInternalEvent(raw, config)).rejects.toThrow(
      'payload.secret is not allowed',
    )
  })

  it('rejects mismatched resource and team ids', async () => {
    await expect(
      validateInternalEvent(
        { ...proposalCreatedEvent(), resource_id: 999 },
        config,
      ),
    ).rejects.toThrow('resource_id does not match payload')
    await expect(
      validateInternalEvent({ ...proposalCreatedEvent(), team_id: 999 }, config),
    ).rejects.toThrow('team_id does not match payload.team.id')
  })

  it('rejects stale and future timestamps', async () => {
    const now = Date.now()
    await expect(
      validateInternalEvent(
        {
          ...invitationCreatedEvent(),
          occurred_at: new Date(now - 10 * 60_000).toISOString(),
        },
        config,
        now,
      ),
    ).rejects.toThrow('occurred_at is too old')
    await expect(
      validateInternalEvent(
        {
          ...invitationCreatedEvent(),
          occurred_at: new Date(now + 5 * 60_000).toISOString(),
        },
        config,
        now,
      ),
    ).rejects.toThrow('occurred_at is in the future')
  })

  it('rejects duplicated recipients and malformed envelopes', async () => {
    await expect(
      validateInternalEvent(
        { ...invitationCreatedEvent(), recipients: [7, 7] },
        config,
      ),
    ).rejects.toThrow('recipients must not contain duplicates')
    await expect(
      validateInternalEvent(
        { ...invitationCreatedEvent(), event_id: 'not-a-uuid' },
        config,
      ),
    ).rejects.toThrow('Invalid event envelope')
    await expect(
      validateInternalEvent(
        { ...invitationCreatedEvent(), extra: true },
        config,
      ),
    ).rejects.toThrow('Invalid event envelope')
  })

  it('rejects oversized or unsafe strings', async () => {
    const event = invitationCreatedEvent()
    const raw = {
      ...event,
      payload: {
        ...event.payload,
        team: { ...event.payload.team, name: 'x'.repeat(200) },
      },
    }
    await expect(validateInternalEvent(raw, config)).rejects.toThrow(
      'payload.team.name must be a string',
    )
  })

  it('does not require a v4 uuid for other fields but does for event_id', async () => {
    const event = { ...invitationCreatedEvent(), event_id: randomUUID() }
    await expect(validateInternalEvent(event, config)).resolves.toBeTruthy()
  })

  it('validates team.activity resource, path, actor and metadata', async () => {
    await expect(
      validateInternalEvent(teamActivityEvent({ resource_id: 999 }), config),
    ).rejects.toThrow('resource_id does not match payload')
    await expect(
      validateInternalEvent(
        teamActivityEvent({}, { path: 'https://evil.example' }),
        config,
      ),
    ).rejects.toThrow('payload.path must be an internal absolute path')
    await expect(
      validateInternalEvent(
        teamActivityEvent({}, { metadata: 'nope' }),
        config,
      ),
    ).rejects.toThrow('payload.metadata must be an object')
    await expect(
      validateInternalEvent(
        teamActivityEvent({}, { metadata: { blob: 'x'.repeat(5000) } }),
        config,
      ),
    ).rejects.toThrow('payload.metadata is too large')
    await expect(
      validateInternalEvent(
        teamActivityEvent(
          {},
          { actor: { user_id: 9, username: 'eve' } },
        ),
        config,
      ),
    ).rejects.toThrow('actor does not match payload.actor')
  })
})

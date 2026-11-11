export const EVENT_TYPES = [
  'team.invitation.created',
  'team.invitation.accepted',
  'team.invitation.rejected',
  'grenade.proposal.created',
  'grenade.proposal.approved',
  'grenade.proposal.rejected',
  'team.activity',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export interface ActorRef {
  user_id: number
  username: string
}

export interface UserRef {
  user_id: number
  username: string
}

export interface TeamRef {
  id: number
  name: string
  tag: string | null
}

export interface MapRef {
  id: number
  name: string
}

export interface LineupRef {
  id: number
  title: string
  type: string
}

export interface InvitationCreatedPayload {
  invitation_id: number
  team: TeamRef
  role: string
  invited_by: UserRef
}

export interface InvitationAcceptedPayload {
  invitation_id: number
  team: TeamRef
  member: UserRef
  role: string
}

export interface InvitationRejectedPayload {
  invitation_id: number
  team: TeamRef
  user: UserRef
}

export interface ProposalCreatedPayload {
  proposal_id: number
  team: TeamRef
  map: MapRef
  lineup: LineupRef
  author: UserRef
}

export interface ProposalApprovedPayload {
  proposal_id: number
  team: TeamRef
  map: MapRef
  lineup: LineupRef
  approved_lineup_id: number
}

export interface ProposalRejectedPayload {
  proposal_id: number
  team: TeamRef
  map: MapRef
  lineup: LineupRef
}

export interface TeamActivityPayload {
  activity_id: number
  activity_type: string
  description: string
  actor: UserRef
  team: TeamRef
  resource_type: string
  resource_id: number
  path: string
  created_at: string
  metadata: Record<string, unknown>
}

export interface EventEnvelope {
  event_id: string
  occurred_at: string
  version: 1
  resource_id: number
  team_id: number
  actor: ActorRef
  recipients: number[]
  notification_id?: number
}

export type InternalEvent = EventEnvelope &
  (
    | { event_type: 'team.invitation.created'; payload: InvitationCreatedPayload }
    | { event_type: 'team.invitation.accepted'; payload: InvitationAcceptedPayload }
    | { event_type: 'team.invitation.rejected'; payload: InvitationRejectedPayload }
    | { event_type: 'grenade.proposal.created'; payload: ProposalCreatedPayload }
    | { event_type: 'grenade.proposal.approved'; payload: ProposalApprovedPayload }
    | { event_type: 'grenade.proposal.rejected'; payload: ProposalRejectedPayload }
    | { event_type: 'team.activity'; payload: TeamActivityPayload }
  )

export class EventValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EventValidationError'
  }
}

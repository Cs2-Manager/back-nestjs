import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'

import { IdentityVerifierService } from '../auth/identity-verifier.service'
import type { NotificationPayload } from '../notifications/notification.types'
import { PresenceService, type PresenceMessage } from './presence.service'
import { SocketAuthenticationService } from './socket-authentication.service'
import { SocketRegistryService, teamRoom, userRoom } from './socket-registry.service'
import type { SocketData } from './socket-session'

export type { PresenceMessage } from './presence.service'

export interface TeamActivityMessage {
  id: string
  event_id: string
  event_type: 'team.activity'
  team_id: number
  occurred_at: string
  activity_id: number
  activity_type: string
  description: string
  actor: { user_id: number; username: string }
  team: { id: number; name: string; tag: string | null }
  resource_type: string
  resource_id: number
  path: string
  created_at: string
  metadata: Record<string, unknown>
}

/** Socket.IO transport and synchronous room/registry membership coordination. */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server

  constructor(
    private readonly authentication: SocketAuthenticationService,
    private readonly identityVerifier: IdentityVerifierService,
    private readonly registry: SocketRegistryService,
    private readonly presence: PresenceService,
  ) {}

  afterInit(server: Server): void {
    this.authentication.install(server)
    this.presence.attach(server)
  }

  handleConnection(client: Socket): void {
    const { user, ip, identity = { teamId: null, role: null } } = client.data as SocketData
    if (!user || !ip || user.tokenExpiresAt <= Date.now()) {
      client.disconnect(true)
      return
    }
    this.registry.register(client.id, user.id, ip, identity.teamId, identity.role, user.username)
    void client.join(userRoom(user.id))
    this.authentication.protect(client, user.tokenExpiresAt)
    client.emit('session.ready', {
      user_id: user.id, socket_id: client.id, team_id: identity.teamId, connected_at: new Date().toISOString(),
    })
    this.welcomeTeam(client, identity.teamId)
  }

  private welcomeTeam(client: Socket, teamId: number | null): void {
    if (teamId === null) return
    void client.join(teamRoom(teamId))
    client.emit('presence.snapshot', this.presence.snapshot(teamId))
    this.presence.schedule(teamId)
  }

  handleDisconnect(client: Socket): void {
    const state = this.registry.unregister(client.id)
    this.authentication.forget(client.id)
    if (state?.teamId !== null && state?.teamId !== undefined) this.presence.schedule(state.teamId)
  }

  emitToUser(userId: number, notification: NotificationPayload): number {
    if (!this.registry.isUserConnected(userId)) return 0
    this.server.to(userRoom(userId)).emit('notification', notification)
    return 1
  }

  emitTeamActivity(teamId: number, activity: TeamActivityMessage): number {
    this.server.to(teamRoom(teamId)).emit('team.activity', activity)
    return this.registry.onlineMembers(teamId).length
  }

  syncTeamMembership(userId: number, teamId: number, role: string | null): void {
    const { previousTeamId } = this.registry.updateTeamForUser(userId, teamId, role)
    this.identityVerifier.invalidate(userId)
    this.moveUserRooms(userId, previousTeamId, teamId)
    if (previousTeamId !== null && previousTeamId !== teamId) this.presence.schedule(previousTeamId)
    this.presence.schedule(teamId)
  }

  /** Leave before joining/emitting so the previous team remains private. */
  private moveUserRooms(userId: number, previousTeamId: number | null, teamId: number | null): void {
    for (const socketId of this.registry.socketIdsForUser(userId)) {
      const socket = this.server.sockets.sockets.get(socketId)
      if (!socket) continue
      if (previousTeamId !== null && previousTeamId !== teamId) void socket.leave(teamRoom(previousTeamId))
      if (teamId !== null) void socket.join(teamRoom(teamId))
    }
  }

  removeUserFromTeam(userId: number, teamId: number): void {
    this.registry.updateTeamForUser(userId, null, null)
    this.identityVerifier.invalidate(userId)
    this.moveUserRooms(userId, teamId, null)
    this.presence.schedule(teamId)
  }

  presenceMessage(teamId: number): PresenceMessage {
    return this.presence.snapshot(teamId)
  }
}

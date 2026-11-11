import { Injectable } from '@nestjs/common'
import { SocketIndex } from './socket-index'

export function userRoom(userId: number): string {
  return `user:${userId}`
}

export function teamRoom(teamId: number): string {
  return `team:${teamId}`
}

export interface ConnectionState {
  userId: number
  username: string
  ip: string
  teamId: number | null
  role: string | null
}

export interface TeamPresence {
  user_id: number
  username: string
  role: string | null
}

function membershipChange(states: ConnectionState[], teamId: number | null, role: string | null) {
  return {
    previousTeamId: states.find(state => state.teamId !== null)?.teamId ?? null,
    changed: states.some(state => state.teamId !== teamId || state.role !== role),
  }
}

/**
 * Registro de conexiones activas.
 *
 * - `user:<id>`: room privada para notificaciones personales.
 * - `team:<id>`: room de presencia/actividad, asignada SOLO con el `team_id`
 *   que devuelve Flask en la verificación de identidad. El navegador nunca
 *   elige ni recibe el nombre de una room ajena.
 *
 * La presencia se deriva de los sockets autenticados. Varias pestañas del
 * mismo usuario cuentan como una sola presencia ONLINE.
 */
@Injectable()
export class SocketRegistryService {
  private readonly sockets = new Map<string, ConnectionState>()
  private readonly byUser = new SocketIndex<number>()
  private readonly byIp = new SocketIndex<string>()

  register(
    socketId: string,
    userId: number,
    ip: string,
    teamId: number | null = null,
    role: string | null = null,
    username = '',
  ): void {
    this.unregister(socketId)
    this.sockets.set(socketId, {
      userId,
      username,
      ip,
      teamId,
      role,
    })
    this.byUser.add(userId, socketId)
    this.byIp.add(ip, socketId)
  }

  unregister(socketId: string): ConnectionState | undefined {
    const state = this.sockets.get(socketId)
    if (!state) return undefined
    this.sockets.delete(socketId)
    this.byUser.remove(state.userId, socketId)
    this.byIp.remove(state.ip, socketId)
    return state
  }

  stateFor(socketId: string): ConnectionState | undefined {
    return this.sockets.get(socketId)
  }

  socketIdsForUser(userId: number): string[] {
    return this.byUser.ids(userId)
  }

  connectionsForUser(userId: number): number {
    return this.byUser.count(userId)
  }

  connectionsForIp(ip: string): number {
    return this.byIp.count(ip)
  }

  isUserConnected(userId: number): boolean {
    return this.connectionsForUser(userId) > 0
  }

  teamIdForUser(userId: number): number | null {
    for (const socketId of this.byUser.ids(userId)) {
      const state = this.sockets.get(socketId)
      if (state?.teamId) return state.teamId
    }
    return null
  }

  roleForUser(userId: number): string | null {
    for (const socketId of this.byUser.ids(userId)) {
      const state = this.sockets.get(socketId)
      if (state) return state.role
    }
    return null
  }

  /** Integrantes con al menos un socket, deduplicados por usuario. */
  onlineMembers(teamId: number): TeamPresence[] {
    const seen = new Map<number, TeamPresence>()
    for (const state of this.sockets.values()) {
      if (state.teamId !== teamId) continue
      if (seen.has(state.userId)) continue
      seen.set(state.userId, {
        user_id: state.userId,
        username: state.username,
        role: state.role,
      })
    }
    return [...seen.values()].sort((a, b) => a.user_id - b.user_id)
  }

  teamConnections(teamId: number): number {
    let total = 0
    for (const state of this.sockets.values()) {
      if (state.teamId === teamId) total += 1
    }
    return total
  }

  /** Reasigna la room de equipo de todos los sockets de un usuario. */
  updateTeamForUser(
    userId: number,
    teamId: number | null,
    role: string | null,
  ): { previousTeamId: number | null; changed: boolean } {
    const states = this.statesForUser(userId)
    const change = membershipChange(states, teamId, role)
    for (const state of states) {
      state.teamId = teamId
      state.role = role
    }
    return change
  }

  totalConnections(): number {
    return this.sockets.size
  }

  totalUsers(): number {
    return this.byUser.size()
  }

  private statesForUser(userId: number): ConnectionState[] {
    const states: ConnectionState[] = []
    for (const socketId of this.byUser.ids(userId)) {
      const state = this.sockets.get(socketId)
      if (state) states.push(state)
    }
    return states
  }
}

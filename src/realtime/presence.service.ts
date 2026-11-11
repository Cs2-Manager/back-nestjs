import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common'
import type { Server } from 'socket.io'
import { REALTIME_CONFIG, type RealtimeConfig } from '../config/realtime-config'
import { SocketRegistryService, teamRoom, type TeamPresence } from './socket-registry.service'

export interface PresenceMessage {
  team_id: number
  members: TeamPresence[]
  generated_at: string
}

/** Presence snapshots and debounce lifecycle; no authentication or membership writes. */
@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly timers = new Map<number, NodeJS.Timeout>()
  private server?: Server

  constructor(
    private readonly registry: SocketRegistryService,
    @Inject(REALTIME_CONFIG) private readonly config: RealtimeConfig,
  ) {}

  attach(server: Server): void {
    this.server = server
  }

  snapshot(teamId: number): PresenceMessage {
    return { team_id: teamId, members: this.registry.onlineMembers(teamId), generated_at: new Date().toISOString() }
  }

  schedule(teamId: number): void {
    if (this.config.presenceGraceSeconds <= 0) return this.broadcast(teamId)
    const existing = this.timers.get(teamId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.timers.delete(teamId)
      this.broadcast(teamId)
    }, this.config.presenceGraceSeconds * 1000)
    timer.unref()
    this.timers.set(teamId, timer)
  }

  private broadcast(teamId: number): void {
    if (!this.server) return
    this.server.to(teamRoom(teamId)).emit('presence.updated', this.snapshot(teamId))
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }
}

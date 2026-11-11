import { Inject, Injectable } from '@nestjs/common'

import { REALTIME_CONFIG, type RealtimeConfig } from '../config/realtime-config'
import { SocketRegistryService } from './socket-registry.service'

const ATTEMPT_WINDOW_MS = 60_000

/**
 * Límites de conexión por usuario/IP y de mensajes por socket. Los contadores
 * viven en memoria: el servicio está pensado para una única instancia.
 */
@Injectable()
export class ConnectionLimiterService {
  private readonly attempts = new Map<string, number[]>()
  private readonly messages = new Map<string, number[]>()

  constructor(
    @Inject(REALTIME_CONFIG) private readonly config: RealtimeConfig,
    private readonly registry: SocketRegistryService,
  ) {}

  /** Debe llamarse antes de validar el JWT para frenar floods de handshakes. */
  allowAttempt(ip: string, nowMs = Date.now()): boolean {
    const recent = (this.attempts.get(ip) ?? []).filter(
      (time) => nowMs - time < ATTEMPT_WINDOW_MS,
    )
    if (recent.length >= this.config.maxConnectionAttemptsPerMinute) {
      this.attempts.set(ip, recent)
      return false
    }
    recent.push(nowMs)
    this.attempts.set(ip, recent)
    return true
  }

  allowConnection(userId: number, ip: string): boolean {
    return (
      this.registry.connectionsForUser(userId) <
        this.config.maxConnectionsPerUser &&
      this.registry.connectionsForIp(ip) < this.config.maxConnectionsPerIp
    )
  }

  allowMessage(socketId: string, nowMs = Date.now()): boolean {
    const recent = (this.messages.get(socketId) ?? []).filter(
      (time) => nowMs - time < ATTEMPT_WINDOW_MS,
    )
    if (recent.length >= this.config.wsMessagesPerMinute) {
      this.messages.set(socketId, recent)
      return false
    }
    recent.push(nowMs)
    this.messages.set(socketId, recent)
    return true
  }

  forgetSocket(socketId: string): void {
    this.messages.delete(socketId)
  }
}

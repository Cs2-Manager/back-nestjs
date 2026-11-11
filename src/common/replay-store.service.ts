import { Injectable, ServiceUnavailableException } from '@nestjs/common'

const MAX_ENTRIES = 20000

/**
 * Cache en memoria para nonces y event_id ya procesados. El servicio no
 * persiste historial: reiniciar NestJS reinicia esta ventana, por eso los
 * timestamps firmados siguen limitando la reutilización a pocos minutos.
 */
@Injectable()
export class ReplayStoreService {
  private readonly entries = new Map<string, number>()

  /** Devuelve true la primera vez y false si la clave sigue vigente. */
  remember(key: string, ttlSeconds: number, nowMs = Date.now()): boolean {
    this.prune(nowMs)
    const expiresAt = this.entries.get(key)
    if (expiresAt !== undefined && expiresAt > nowMs) return false
    // No expulsar nonces vigentes: hacerlo habilitaría replay bajo carga.
    if (this.entries.size >= MAX_ENTRIES) {
      throw new ServiceUnavailableException('Replay protection capacity reached')
    }
    this.entries.set(key, nowMs + ttlSeconds * 1000)
    return true
  }

  has(key: string, nowMs = Date.now()): boolean {
    this.prune(nowMs)
    return this.entries.has(key)
  }

  clear(): void {
    this.entries.clear()
  }

  private prune(nowMs: number): void {
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= nowMs) this.entries.delete(key)
    }
  }
}

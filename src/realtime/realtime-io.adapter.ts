import type { INestApplicationContext } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { ServerOptions } from 'socket.io'
import type { Server } from 'socket.io'
import type { IncomingMessage } from 'node:http'

import type { RealtimeConfig } from '../config/realtime-config'

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length > 0) return value[0]
  return undefined
}

/**
 * Adaptador Socket.IO con path estable detrás de nginx, validación de Origin
 * y límites de tamaño de mensaje. La autenticación JWT ocurre en el gateway.
 */
export class RealtimeIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly config: RealtimeConfig,
  ) {
    super(app)
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      path: this.config.wsPath,
      maxHttpBufferSize: this.config.wsMaxBufferBytes,
      pingInterval: 25_000,
      pingTimeout: 20_000,
      allowRequest: (
        req: IncomingMessage,
        callback: (err: string | null, success: boolean) => void,
      ) => {
        const allowed = this.originAllowed(req)
        callback(allowed ? null : 'Origin not allowed', allowed)
      },
    }) as Server
  }

  private originAllowed(req: IncomingMessage): boolean {
    const origin = header(req, 'origin')
    if (!origin) return this.config.allowMissingOrigin
    if (this.config.allowedOrigins.includes(origin)) return true

    const host = header(req, 'x-forwarded-host') || header(req, 'host')
    if (!host) return false
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
}

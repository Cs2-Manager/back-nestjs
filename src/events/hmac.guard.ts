import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'

import { verifyHmac } from '../common/hmac'
import { ReplayStoreService } from '../common/replay-store.service'
import { REALTIME_CONFIG, type RealtimeConfig } from '../config/realtime-config'

const TIMESTAMP_HEADER = 'x-realtime-timestamp'
const NONCE_HEADER = 'x-realtime-nonce'
const SIGNATURE_HEADER = 'x-realtime-signature'
const NONCE_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/

function headerValue(request: Request, name: string): string | null {
  const value = request.headers[name]
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length === 1) return value[0]
  return null
}

interface SignedHeaders {
  timestamp: string
  nonce: string
  signature: string
}

function requiredHeader(request: Request, name: string): string {
  const value = headerValue(request, name)
  if (!value) throw new UnauthorizedException('Missing internal authentication headers')
  return value
}

function signedHeaders(request: Request): SignedHeaders {
  const timestamp = requiredHeader(request, TIMESTAMP_HEADER)
  const nonce = requiredHeader(request, NONCE_HEADER)
  const signature = requiredHeader(request, SIGNATURE_HEADER)
  if (!/^[0-9]{10}$/.test(timestamp)) throw new UnauthorizedException('Invalid internal timestamp')
  if (!NONCE_PATTERN.test(nonce)) throw new UnauthorizedException('Invalid internal nonce')
  return { timestamp, nonce, signature }
}

function verifyTimestamp(timestamp: string, maxAgeSeconds: number): void {
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - Number(timestamp)) > maxAgeSeconds) {
    throw new UnauthorizedException('Internal request timestamp expired')
  }
}

function verifyRequestBody(request: RawBodyRequest<Request>, headers: SignedHeaders, secret: string): void {
  const body = request.rawBody
  if (!body || body.length === 0) throw new UnauthorizedException('Internal request body is required')
  if (!verifyHmac(secret, headers.timestamp, headers.nonce, body, headers.signature)) {
    throw new UnauthorizedException('Invalid internal signature')
  }
}

/**
 * Autenticación servicio-a-servicio. Verifica timestamp, nonce de un solo uso,
 * firma HMAC-SHA256 sobre el cuerpo exacto y comparación de tiempo constante.
 */
@Injectable()
export class HmacGuard implements CanActivate {
  constructor(
    @Inject(REALTIME_CONFIG) private readonly config: RealtimeConfig,
    private readonly replayStore: ReplayStoreService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>()

    const headers = signedHeaders(request)
    verifyTimestamp(headers.timestamp, this.config.eventMaxAgeSeconds)
    verifyRequestBody(request, headers, this.config.hmacSecret)
    // Consume only after authenticating the exact body; retain fail-closed capacity.
    if (!this.replayStore.remember(`nonce:${headers.nonce}`, this.config.nonceTtlSeconds)) {
      throw new UnauthorizedException('Internal request replayed')
    }

    return true
  }
}

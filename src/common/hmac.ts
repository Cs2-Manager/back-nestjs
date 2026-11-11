import { createHmac, timingSafeEqual } from 'node:crypto'

export type HmacBody = Buffer | string

function payloadBuffer(timestamp: string, nonce: string, body: HmacBody): Buffer {
  const prefix = Buffer.from(`${timestamp}.${nonce}.`, 'utf8')
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8')
  return Buffer.concat([prefix, bodyBuffer])
}

/**
 * Firma canónica compartida con Flask:
 *   HMAC-SHA256(secret, `${timestamp}.${nonce}.` + raw_body)
 * Se firma el cuerpo exacto en bytes, no una reserialización JSON.
 */
export function signHmac(
  secret: string,
  timestamp: string,
  nonce: string,
  body: HmacBody,
): string {
  return createHmac('sha256', secret)
    .update(payloadBuffer(timestamp, nonce, body))
    .digest('hex')
}

export function verifyHmac(
  secret: string,
  timestamp: string,
  nonce: string,
  body: HmacBody,
  signature: string,
): boolean {
  if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false
  const expected = Buffer.from(
    signHmac(secret, timestamp, nonce, body),
    'hex',
  )
  const received = Buffer.from(signature, 'hex')
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}

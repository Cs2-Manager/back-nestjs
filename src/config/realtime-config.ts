import { readFileSync } from 'node:fs'

export interface RealtimeConfig {
  port: number
  nodeEnv: string
  jwtSecret: string
  jwtAlgorithm: 'HS256'
  hmacSecret: string
  wsPath: string
  eventMaxAgeSeconds: number
  eventFutureSkewSeconds: number
  nonceTtlSeconds: number
  eventIdTtlSeconds: number
  allowedOrigins: string[]
  allowMissingOrigin: boolean
  identityVerifyEnabled: boolean
  identityVerifyFailOpen: boolean
  flaskIdentityUrl: string
  identityTimeoutMs: number
  identityCacheTtlSeconds: number
  maxConnectionsPerUser: number
  maxConnectionsPerIp: number
  maxConnectionAttemptsPerMinute: number
  wsMaxBufferBytes: number
  wsMessagesPerMinute: number
  presenceGraceSeconds: number
}

export const REALTIME_CONFIG = Symbol('REALTIME_CONFIG')

function readSecret(env: NodeJS.ProcessEnv, valueName: string, fileName: string): string {
  const direct = (env[valueName] || '').trim()
  if (direct) return direct

  const path = (env[fileName] || '').trim()
  if (!path) return ''
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return ''
  }
}

function asInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Invalid integer environment setting')
  }
  return parsed
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function requiredSecret(name: string, value: string): string {
  if (!value) {
    throw new Error(
      `${name} is required (set the environment variable or its *_FILE counterpart)`,
    )
  }
  if (value.length < 16) {
    throw new Error(`${name} must be at least 16 characters long`)
  }
  return value
}

/**
 * Carga y valida la configuración del servicio. No imprime ni devuelve
 * secretos en los mensajes de error.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): RealtimeConfig {
  const jwtAlgorithm = (env.REALTIME_JWT_ALGORITHM || 'HS256').trim().toUpperCase()
  if (jwtAlgorithm !== 'HS256') {
    throw new Error('REALTIME_JWT_ALGORITHM must be HS256')
  }

  const allowedOrigins = (env.REALTIME_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)

  const eventMaxAgeSeconds = asInt(env.REALTIME_EVENT_MAX_AGE_SECONDS, 300)
  const nonceTtlSeconds = asInt(env.REALTIME_NONCE_TTL_SECONDS, 900)
  // El timestamp puede llegar adelantado hasta maxAge. Debe recordarse hasta
  // que también termine su ventana pasada, incluido el segundo del límite.
  if (nonceTtlSeconds <= 2 * eventMaxAgeSeconds) {
    throw new Error('REALTIME_NONCE_TTL_SECONDS must exceed twice REALTIME_EVENT_MAX_AGE_SECONDS')
  }

  return {
    port: asInt(env.PORT || env.REALTIME_PORT, 3000),
    nodeEnv: env.NODE_ENV || 'development',
    jwtSecret: requiredSecret(
      'REALTIME_JWT_SECRET',
      readSecret(env, 'REALTIME_JWT_SECRET', 'REALTIME_JWT_SECRET_FILE'),
    ),
    jwtAlgorithm: 'HS256',
    hmacSecret: requiredSecret(
      'REALTIME_HMAC_SECRET',
      readSecret(env, 'REALTIME_HMAC_SECRET', 'REALTIME_HMAC_SECRET_FILE'),
    ),
    wsPath: (env.REALTIME_SOCKET_PATH || '/realtime/socket.io').trim(),
    eventMaxAgeSeconds,
    eventFutureSkewSeconds: asInt(env.REALTIME_EVENT_FUTURE_SKEW_SECONDS, 30),
    nonceTtlSeconds,
    eventIdTtlSeconds: asInt(env.REALTIME_EVENT_ID_TTL_SECONDS, 3600),
    allowedOrigins,
    allowMissingOrigin: asBool(env.REALTIME_ALLOW_MISSING_ORIGIN, false),
    identityVerifyEnabled: asBool(env.REALTIME_IDENTITY_VERIFY, false),
    identityVerifyFailOpen: asBool(env.REALTIME_IDENTITY_FAIL_OPEN, false),
    flaskIdentityUrl: (
      env.REALTIME_FLASK_IDENTITY_URL ||
      'http://backend:5000/internal/realtime/identity'
    ).trim(),
    identityTimeoutMs: asInt(env.REALTIME_IDENTITY_TIMEOUT_MS, 2000),
    identityCacheTtlSeconds: asInt(env.REALTIME_IDENTITY_CACHE_TTL_SECONDS, 30),
    maxConnectionsPerUser: asInt(env.REALTIME_MAX_CONNECTIONS_PER_USER, 5),
    maxConnectionsPerIp: asInt(env.REALTIME_MAX_CONNECTIONS_PER_IP, 25),
    maxConnectionAttemptsPerMinute: asInt(
      env.REALTIME_MAX_CONNECTION_ATTEMPTS_PER_MINUTE,
      30,
    ),
    wsMaxBufferBytes: asInt(env.REALTIME_WS_MAX_BUFFER_BYTES, 16384),
    wsMessagesPerMinute: asInt(env.REALTIME_WS_MESSAGES_PER_MINUTE, 20),
    // Tolerancia a desconexiones breves (recarga, cambio de red, reconexión
    // del socket). La presencia se publica tras este margen para evitar
    // parpadeos ONLINE/OFFLINE. 0 desactiva el debounce.
    presenceGraceSeconds: asInt(env.REALTIME_PRESENCE_GRACE_SECONDS, 15),
  }
}

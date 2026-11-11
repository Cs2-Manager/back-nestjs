import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadConfig } from '../../src/config/realtime-config'

const JWT = 'jwt-secret-with-enough-length-123456'
const HMAC = 'hmac-secret-with-enough-length-12345'

describe('loadConfig', () => {
  it('loads required values from environment', () => {
    const config = loadConfig({
      REALTIME_JWT_SECRET: JWT,
      REALTIME_HMAC_SECRET: HMAC,
      REALTIME_ALLOWED_ORIGINS: 'http://localhost, http://127.0.0.1/',
      REALTIME_IDENTITY_VERIFY: 'true',
    } as NodeJS.ProcessEnv)

    expect(config.jwtSecret).toBe(JWT)
    expect(config.hmacSecret).toBe(HMAC)
    expect(config.jwtAlgorithm).toBe('HS256')
    expect(config.allowedOrigins).toEqual([
      'http://localhost',
      'http://127.0.0.1',
    ])
    expect(config.identityVerifyEnabled).toBe(true)
  })

  it('reads secrets from files without exposing them in errors', () => {
    const dir = mkdtempSync(join(tmpdir(), 'realtime-config-'))
    const jwtFile = join(dir, 'jwt')
    const hmacFile = join(dir, 'hmac')
    writeFileSync(jwtFile, `${JWT}\n`)
    writeFileSync(hmacFile, HMAC)
    try {
      const config = loadConfig({
        REALTIME_JWT_SECRET_FILE: jwtFile,
        REALTIME_HMAC_SECRET_FILE: hmacFile,
      } as NodeJS.ProcessEnv)
      expect(config.jwtSecret).toBe(JWT)
      expect(config.hmacSecret).toBe(HMAC)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects missing or weak secrets', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(
      'REALTIME_JWT_SECRET is required',
    )
    expect(() =>
      loadConfig({
        REALTIME_JWT_SECRET: 'short',
        REALTIME_HMAC_SECRET: HMAC,
      } as NodeJS.ProcessEnv),
    ).toThrow('REALTIME_JWT_SECRET must be at least 16 characters')
  })

  it('only allows HS256', () => {
    expect(() =>
      loadConfig({
        REALTIME_JWT_SECRET: JWT,
        REALTIME_HMAC_SECRET: HMAC,
        REALTIME_JWT_ALGORITHM: 'HS512',
      } as NodeJS.ProcessEnv),
    ).toThrow('REALTIME_JWT_ALGORITHM must be HS256')
  })

  it('does not echo invalid configuration values in errors', () => {
    const privateValue = 'do-not-log-this-value'
    let message = ''
    try {
      loadConfig({ REALTIME_JWT_SECRET: JWT, REALTIME_HMAC_SECRET: HMAC, PORT: privateValue })
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('Invalid integer environment setting')
    expect(message).not.toContain(privateValue)
  })

  it('keeps nonces through the entire signed timestamp validity window', () => {
    expect(() => loadConfig({
      REALTIME_JWT_SECRET: JWT, REALTIME_HMAC_SECRET: HMAC,
      REALTIME_EVENT_MAX_AGE_SECONDS: '300', REALTIME_NONCE_TTL_SECONDS: '600',
    })).toThrow('REALTIME_NONCE_TTL_SECONDS must exceed twice REALTIME_EVENT_MAX_AGE_SECONDS')
    expect(loadConfig({
      REALTIME_JWT_SECRET: JWT, REALTIME_HMAC_SECRET: HMAC,
      REALTIME_EVENT_MAX_AGE_SECONDS: '300', REALTIME_NONCE_TTL_SECONDS: '601',
    }).nonceTtlSeconds).toBe(601)
  })
})

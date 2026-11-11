import type { Server, Socket } from 'socket.io'
import { AuthError } from '../../src/auth/auth.types'
import { JwtVerifierService } from '../../src/auth/jwt-verifier.service'
import { IdentityVerifierService } from '../../src/auth/identity-verifier.service'
import { ConnectionLimiterService } from '../../src/realtime/connection-limiter.service'
import { SocketAuthenticationService } from '../../src/realtime/socket-authentication.service'
import { clientIp, expireSession, sessionToken } from '../../src/realtime/socket-session'

function build() {
  const jwt = { verify: jest.fn().mockReturnValue({ id: 7, username: 'bob', tokenExpiresAt: Date.now() + 10000 }) }
  const identity = { verify: jest.fn().mockResolvedValue({ teamId: 3, role: 'PLAYER' }) }
  const limiter = { allowAttempt: jest.fn().mockReturnValue(true), allowConnection: jest.fn().mockReturnValue(true), allowMessage: jest.fn().mockReturnValue(false), forgetSocket: jest.fn() }
  const service = new SocketAuthenticationService(
    jwt as unknown as JwtVerifierService,
    identity as unknown as IdentityVerifierService,
    limiter as unknown as ConnectionLimiterService,
  )
  const socket = {
    id: 'tab', data: {}, handshake: { headers: {}, auth: { token: 'signed-token' }, query: {}, address: 'local' },
    onAny: jest.fn(), once: jest.fn(), disconnect: jest.fn(),
  } as unknown as Socket
  return { service, jwt, identity, limiter, socket }
}

describe('socket security policies', () => {
  afterEach(() => jest.restoreAllMocks())

  it('rejects excessive attempts before verifying JWT', async () => {
    const { service, limiter, jwt, socket } = build()
    limiter.allowAttempt.mockReturnValue(false)
    await expect(service.authenticate(socket)).rejects.toMatchObject({ code: 'CONNECTION_LIMIT' })
    expect(jwt.verify).not.toHaveBeenCalled()
  })

  it('checks active limits after identity lookup', async () => {
    const { service, limiter, identity, socket } = build()
    limiter.allowConnection.mockReturnValue(false)
    await expect(service.authenticate(socket)).rejects.toMatchObject({ code: 'CONNECTION_LIMIT' })
    expect(identity.verify).toHaveBeenCalled()
    expect(socket.data).toEqual({})
  })

  it('sanitizes unexpected middleware errors', async () => {
    const { service, jwt, socket } = build()
    jwt.verify.mockImplementation(() => { throw new Error('private upstream details') })
    const use = jest.fn()
    service.install({ use } as unknown as Server)
    const next = jest.fn()
    use.mock.calls[0][0](socket, next)
    await new Promise(resolve => setImmediate(resolve))
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authentication failed', data: { code: 'AUTH_INVALID' } }))
  })

  it('disconnects a message flood and forgets its counters', () => {
    jest.useFakeTimers()
    try {
      const { service, limiter, socket } = build()
      service.protect(socket, Date.now() + 10000)
      jest.mocked(socket.onAny).mock.calls[0][0]('untrusted-message')
      expect(socket.disconnect).toHaveBeenCalledWith(true)
      service.forget(socket.id)
      expect(limiter.forgetSocket).toHaveBeenCalledWith('tab')
      jest.clearAllTimers()
    } finally {
      jest.useRealTimers()
    }
  })

  it('uses the last proxy IP rather than a forged first entry', () => {
    const { socket } = build()
    socket.handshake.headers['x-forwarded-for'] = 'forged, 10.0.0.7'
    expect(clientIp(socket)).toBe('10.0.0.7')
    socket.handshake.headers['x-real-ip'] = ' 10.0.0.8 '
    expect(clientIp(socket)).toBe('10.0.0.8')
  })

  it('accepts bearer fallback but never a query token', () => {
    const { socket } = build()
    socket.handshake.auth = {}
    socket.handshake.headers.authorization = 'Bearer signed-token'
    expect(sessionToken(socket)).toBe('signed-token')
    socket.handshake.query.token = 'other-token'
    expect(() => sessionToken(socket)).toThrow(AuthError)
  })
})

describe('JWT socket timer', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('handles long JWT lifetimes without Node timer overflow', () => {
    const { socket } = build()
    expireSession(socket, Date.now() + 2_147_483_647 + 1000)
    jest.advanceTimersByTime(2_147_483_647)
    expect(socket.disconnect).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1000)
    expect(socket.disconnect).toHaveBeenCalledWith(true)
  })

  it('cleans its timer on disconnect', () => {
    const { socket } = build()
    expireSession(socket, Date.now() + 10000)
    jest.mocked(socket.once).mock.calls[0][1]('disconnect')
    expect(jest.getTimerCount()).toBe(0)
  })
})

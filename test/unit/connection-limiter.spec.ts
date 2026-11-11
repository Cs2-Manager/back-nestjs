import { ConnectionLimiterService } from '../../src/realtime/connection-limiter.service'
import { SocketRegistryService } from '../../src/realtime/socket-registry.service'
import { baseConfig } from '../helpers/fixtures'

describe('ConnectionLimiterService', () => {
  function build(overrides = {}) {
    const registry = new SocketRegistryService()
    const limiter = new ConnectionLimiterService(
      baseConfig(overrides),
      registry,
    )
    return { registry, limiter }
  }

  it('limits connection attempts per IP within a minute', () => {
    const { limiter } = build({ maxConnectionAttemptsPerMinute: 2 })
    const now = 1_000_000
    expect(limiter.allowAttempt('1.1.1.1', now)).toBe(true)
    expect(limiter.allowAttempt('1.1.1.1', now + 1)).toBe(true)
    expect(limiter.allowAttempt('1.1.1.1', now + 2)).toBe(false)
    expect(limiter.allowAttempt('2.2.2.2', now + 2)).toBe(true)
    expect(limiter.allowAttempt('1.1.1.1', now + 61_000)).toBe(true)
  })

  it('limits active connections per user and per IP', () => {
    const { registry, limiter } = build({
      maxConnectionsPerUser: 2,
      maxConnectionsPerIp: 3,
    })
    expect(limiter.allowConnection(7, '1.1.1.1')).toBe(true)
    registry.register('a', 7, '1.1.1.1')
    registry.register('b', 7, '1.1.1.1')
    expect(limiter.allowConnection(7, '1.1.1.1')).toBe(false)
    registry.register('c', 8, '1.1.1.1')
    expect(limiter.allowConnection(9, '1.1.1.1')).toBe(false)
    expect(limiter.allowConnection(9, '2.2.2.2')).toBe(true)
  })

  it('limits messages per socket and forgets state on disconnect', () => {
    const { limiter } = build({ wsMessagesPerMinute: 2 })
    const now = 1_000_000
    expect(limiter.allowMessage('socket', now)).toBe(true)
    expect(limiter.allowMessage('socket', now + 1)).toBe(true)
    expect(limiter.allowMessage('socket', now + 2)).toBe(false)
    limiter.forgetSocket('socket')
    expect(limiter.allowMessage('socket', now + 3)).toBe(true)
  })

  it('unregisters sockets from both indexes', () => {
    const registry = new SocketRegistryService()
    registry.register('a', 7, '1.1.1.1')
    expect(registry.connectionsForUser(7)).toBe(1)
    expect(registry.connectionsForIp('1.1.1.1')).toBe(1)
    registry.unregister('a')
    expect(registry.connectionsForUser(7)).toBe(0)
    expect(registry.connectionsForIp('1.1.1.1')).toBe(0)
    expect(registry.totalConnections()).toBe(0)
  })
})

import type { Server } from 'socket.io'
import { PresenceService } from '../../src/realtime/presence.service'
import { SocketRegistryService } from '../../src/realtime/socket-registry.service'
import { baseConfig } from '../helpers/fixtures'

describe('PresenceService debounce lifecycle', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('coalesces team updates and uses the current registry snapshot', () => {
    const registry = new SocketRegistryService()
    const service = new PresenceService(registry, baseConfig({ presenceGraceSeconds: 2 }))
    const emit = jest.fn()
    const to = jest.fn().mockReturnValue({ emit })
    service.attach({ to } as unknown as Server)
    service.schedule(3)
    jest.advanceTimersByTime(1000)
    service.schedule(3)
    registry.register('tab', 7, 'local', 3, 'PLAYER', 'bob')
    jest.advanceTimersByTime(1000)
    expect(emit).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1000)
    expect(to).toHaveBeenCalledWith('team:3')
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('presence.updated', expect.objectContaining({
      members: [{ user_id: 7, username: 'bob', role: 'PLAYER' }],
    }))
  })

  it('cancels pending updates on module destruction', () => {
    const service = new PresenceService(new SocketRegistryService(), baseConfig({ presenceGraceSeconds: 2 }))
    const to = jest.fn()
    service.attach({ to } as unknown as Server)
    service.schedule(3)
    service.onModuleDestroy()
    jest.runAllTimers()
    expect(to).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })
})

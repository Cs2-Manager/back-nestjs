import {
  SocketRegistryService,
  teamRoom,
  userRoom,
} from '../../src/realtime/socket-registry.service'

describe('SocketRegistryService', () => {
  it('re-registers a socket atomically across user and IP indexes', () => {
    const registry = new SocketRegistryService()
    registry.register('tab', 7, 'old', 3, 'PLAYER', 'bob')
    registry.register('tab', 8, 'new', 4, 'COACH', 'carol')
    expect(registry.connectionsForUser(7)).toBe(0)
    expect(registry.connectionsForIp('old')).toBe(0)
    expect(registry.socketIdsForUser(8)).toEqual(['tab'])
    expect(registry.totalConnections()).toBe(1)
    expect(registry.totalUsers()).toBe(1)
    expect(registry.onlineMembers(3)).toEqual([])
    expect(registry.stateFor('tab')?.teamId).toBe(4)
    registry.unregister('tab')
    expect(registry.connectionsForIp('new')).toBe(0)
    expect(registry.totalUsers()).toBe(0)
    expect(registry.unregister('tab')).toBeUndefined()
  })

  it('updates all tabs while preserving other users and detects unchanged memberships', () => {
    const registry = new SocketRegistryService()
    registry.register('a', 7, 'shared', 3, 'PLAYER', 'bob')
    registry.register('b', 7, 'shared', 3, 'PLAYER', 'bob')
    registry.register('c', 8, 'shared', 3, 'COACH', 'carol')
    expect(registry.updateTeamForUser(7, 4, 'CAPTAIN')).toEqual({ previousTeamId: 3, changed: true })
    expect(registry.stateFor('b')?.role).toBe('CAPTAIN')
    expect(registry.updateTeamForUser(7, 4, 'CAPTAIN')).toEqual({ previousTeamId: 4, changed: false })
    registry.unregister('a')
    expect(registry.connectionsForUser(7)).toBe(1)
    expect(registry.connectionsForIp('shared')).toBe(2)
    expect(registry.onlineMembers(3)).toEqual([{ user_id: 8, username: 'carol', role: 'COACH' }])
  })

  it('exposes private user and team room names', () => {
    expect(userRoom(7)).toBe('user:7')
    expect(teamRoom(3)).toBe('team:3')
  })

  it('deduplicates presence by user across multiple tabs', () => {
    const registry = new SocketRegistryService()
    registry.register('s1', 7, '1.1.1.1', 3, 'PLAYER', 'bob')
    registry.register('s2', 7, '1.1.1.2', 3, 'PLAYER', 'bob')
    registry.register('s3', 8, '1.1.1.3', 3, 'COACH', 'carol')

    expect(registry.connectionsForUser(7)).toBe(2)
    expect(registry.onlineMembers(3)).toEqual([
      { user_id: 7, username: 'bob', role: 'PLAYER' },
      { user_id: 8, username: 'carol', role: 'COACH' },
    ])
    expect(registry.teamConnections(3)).toBe(3)
  })

  it('keeps teams isolated and reports the previous team on change', () => {
    const registry = new SocketRegistryService()
    registry.register('s1', 7, '1.1.1.1', 3, 'PLAYER', 'bob')
    registry.register('s2', 8, '1.1.1.2', 4, 'CAPTAIN', 'eve')

    expect(registry.onlineMembers(3)).toHaveLength(1)
    expect(registry.onlineMembers(4)).toHaveLength(1)

    const result = registry.updateTeamForUser(7, 4, 'COACH')
    expect(result).toEqual({ previousTeamId: 3, changed: true })
    expect(registry.onlineMembers(3)).toHaveLength(0)
    expect(registry.onlineMembers(4)).toEqual([
      { user_id: 7, username: 'bob', role: 'COACH' },
      { user_id: 8, username: 'eve', role: 'CAPTAIN' },
    ])
  })

  it('removes presence when the last socket disconnects', () => {
    const registry = new SocketRegistryService()
    registry.register('s1', 7, '1.1.1.1', 3, 'PLAYER', 'bob')
    expect(registry.unregister('s1')).toMatchObject({ userId: 7, teamId: 3 })
    expect(registry.isUserConnected(7)).toBe(false)
    expect(registry.onlineMembers(3)).toEqual([])
    expect(registry.unregister('missing')).toBeUndefined()
  })

  it('never reports a team for a user without a confirmed membership', () => {
    const registry = new SocketRegistryService()
    registry.register('s1', 7, '1.1.1.1', null, null, 'bob')
    expect(registry.teamIdForUser(7)).toBeNull()
    expect(registry.onlineMembers(3)).toEqual([])
  })
})

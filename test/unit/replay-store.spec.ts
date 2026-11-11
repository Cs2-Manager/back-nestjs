import { ReplayStoreService } from '../../src/common/replay-store.service'

describe('ReplayStoreService', () => {
  it('rejects duplicated keys until the TTL expires', () => {
    const store = new ReplayStoreService()
    const now = 1_000_000
    expect(store.remember('nonce:1', 10, now)).toBe(true)
    expect(store.remember('nonce:1', 10, now + 5_000)).toBe(false)
    expect(store.remember('nonce:1', 10, now + 11_000)).toBe(true)
  })

  it('prunes expired entries and can be cleared', () => {
    const store = new ReplayStoreService()
    expect(store.remember('a', 1, 1_000)).toBe(true)
    expect(store.has('a', 3_000)).toBe(false)
    store.remember('b', 60, 3_000)
    store.clear()
    expect(store.has('b', 3_000)).toBe(false)
  })

  it('fails closed at capacity without forgetting live nonces', () => {
    const store = new ReplayStoreService()
    const now = 1_000_000
    store.remember('nonce:original', 600, now)
    const entries = Reflect.get(store, 'entries') as Map<string, number>
    for (let i = 1; i < 20_000; i++) entries.set(`nonce:${i}`, now + 600_000)

    expect(() => store.remember('nonce:overflow', 600, now)).toThrow(
      'Replay protection capacity reached',
    )
    expect(store.remember('nonce:original', 600, now)).toBe(false)
    expect(store.remember('nonce:after-expiry', 600, now + 601_000)).toBe(true)
  })
})

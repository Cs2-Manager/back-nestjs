import { AuthError } from '../../src/auth/auth.types'
import { IdentityVerifierService } from '../../src/auth/identity-verifier.service'
import { FlaskIdentityClient } from '../../src/auth/flask-identity.client'
import type { RealtimeConfig } from '../../src/config/realtime-config'
import { baseConfig } from '../helpers/fixtures'

const USER = { id: 7, username: 'bob', tokenExpiresAt: Date.now() + 60_000 }

function verifier(config: RealtimeConfig): IdentityVerifierService {
  return new IdentityVerifierService(config, new FlaskIdentityClient(config))
}

function mockFetch(response: Partial<Response> | Error) {
  return jest.spyOn(global, 'fetch').mockImplementation(() => {
    if (response instanceof Error) return Promise.reject(response)
    return Promise.resolve(response as Response)
  })
}

describe('IdentityVerifierService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does nothing when identity verification is disabled', async () => {
    const spy = mockFetch(new Error('must not be called'))
    const service = verifier(
      baseConfig({ identityVerifyEnabled: false }),
    )
    await expect(service.verify(USER)).resolves.toEqual({
      teamId: null,
      role: null,
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('verifies the user against Flask and caches the result', async () => {
    const spy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        user_id: 7,
        username: 'bob',
        active: true,
        team_id: 3,
        role: 'PLAYER',
      }),
    } as Response)
    const service = verifier(
      baseConfig({ identityVerifyEnabled: true }),
    )
    await expect(service.verify(USER)).resolves.toEqual({
      teamId: 3,
      role: 'PLAYER',
    })
    await service.verify(USER)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('invalidates the cached membership after a team change', async () => {
    const spy = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        user_id: 7,
        username: 'bob',
        active: true,
        team_id: null,
        role: null,
      }),
    } as Response)
    const service = verifier(
      baseConfig({ identityVerifyEnabled: true }),
    )
    await service.verify(USER)
    service.invalidate(USER.id)
    await service.verify(USER)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid team membership values from Flask', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        user_id: 7,
        username: 'bob',
        active: true,
        team_id: '3',
        role: 'PLAYER',
      }),
    } as Response)
    const service = verifier(
      baseConfig({ identityVerifyEnabled: true }),
    )
    await expect(service.verify(USER)).rejects.toMatchObject({
      code: 'AUTH_FORBIDDEN',
    })
  })

  it('rejects inactive or mismatched users', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ user_id: 7, username: 'bob', active: false }),
    } as Response)
    const service = verifier(
      baseConfig({ identityVerifyEnabled: true }),
    )
    await expect(service.verify(USER)).rejects.toMatchObject({
      code: 'AUTH_FORBIDDEN',
    })
  })

  it('fails closed by default when Flask is unavailable', async () => {
    mockFetch(new Error('network down'))
    const service = verifier(
      baseConfig({ identityVerifyEnabled: true }),
    )
    await expect(service.verify(USER)).rejects.toBeInstanceOf(AuthError)
  })

  it('can fail open when explicitly configured', async () => {
    mockFetch(new Error('network down'))
    const service = verifier(
      baseConfig({
        identityVerifyEnabled: true,
        identityVerifyFailOpen: true,
      }),
    )
    await expect(service.verify(USER)).resolves.toEqual({
      teamId: null,
      role: null,
    })
  })

  it('rejects an in-flight identity invalidated by a membership change', async () => {
    let resolveBody!: (value: unknown) => void
    const body = new Promise(resolve => { resolveBody = resolve })
    const spy = mockFetch({ ok: true, status: 200, json: () => body } as Response)
    const service = verifier(baseConfig({
      identityVerifyEnabled: true, identityVerifyFailOpen: true,
    }))
    const pending = service.verify(USER)
    const rejected = expect(pending).rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' })
    await Promise.resolve()
    service.invalidate(USER.id)
    resolveBody({ user_id: 7, username: 'bob', active: true, team_id: 3, role: 'PLAYER' })
    await rejected

    spy.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ user_id: 7, username: 'bob', active: true, team_id: null, role: null }),
    } as Response)
    await expect(service.verify(USER)).resolves.toEqual({ teamId: null, role: null })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('invalidates every pending tab, including fail-open responses', async () => {
    let resolveFetch!: (value: Response) => void
    const response = new Promise<Response>(resolve => { resolveFetch = resolve })
    jest.spyOn(global, 'fetch').mockReturnValue(response)
    const service = verifier(baseConfig({ identityVerifyEnabled: true, identityVerifyFailOpen: true }))
    const first = expect(service.verify(USER)).rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' })
    const second = expect(service.verify(USER)).rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' })
    service.invalidate(USER.id)
    resolveFetch({ ok: false, status: 503 } as Response)
    await Promise.all([first, second])
  })

  it('does not cache fail-open results', async () => {
    const spy = mockFetch({ ok: false, status: 503 } as Response)
    const service = verifier(baseConfig({ identityVerifyEnabled: true, identityVerifyFailOpen: true }))
    await service.verify(USER)
    await service.verify(USER)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it.each([403, 404])('never fails open on HTTP %s', async status => {
    mockFetch({ ok: false, status } as Response)
    const service = verifier(baseConfig({ identityVerifyEnabled: true, identityVerifyFailOpen: true }))
    await expect(service.verify(USER)).rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' })
  })

  it('rejects malformed JSON even with fail-open enabled', async () => {
    mockFetch({ ok: true, status: 200, json: async () => { throw new Error('private upstream detail') } })
    const service = verifier(baseConfig({ identityVerifyEnabled: true, identityVerifyFailOpen: true }))
    await expect(service.verify(USER)).rejects.toThrow('Invalid identity response')
  })

  it.each([
    { team_id: 0 }, { team_id: Number.MAX_SAFE_INTEGER + 1 },
    { role: '' }, { role: 'x'.repeat(21) }, { role: 3 },
  ])('rejects invalid membership data %o', async fields => {
    mockFetch({ ok: true, status: 200, json: async () => ({ user_id: 7, username: 'bob', active: true, ...fields }) })
    await expect(verifier(baseConfig({ identityVerifyEnabled: true })).verify(USER))
      .rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' })
  })
})

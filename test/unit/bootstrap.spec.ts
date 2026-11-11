import { Logger } from '@nestjs/common'

import { createApplication } from '../../src/app.factory'
import { bootstrap } from '../../src/main'
import { baseConfig, JWT_SECRET, HMAC_SECRET } from '../helpers/fixtures'

jest.mock('../../src/app.factory', () => ({ createApplication: jest.fn() }))

describe('bootstrap operational logging', () => {
  afterEach(() => jest.restoreAllMocks())

  it('uses the Nest logger without exposing JWT or HMAC keys', async () => {
    const listen = jest.fn().mockResolvedValue(undefined)
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.mocked(createApplication).mockResolvedValue({
      app: { listen } as never,
      config: baseConfig({ port: 3000 }),
    })

    await bootstrap()

    expect(listen).toHaveBeenCalledWith(3000, '0.0.0.0')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('listening on port 3000'))
    expect(JSON.stringify(log.mock.calls)).not.toContain(JWT_SECRET)
    expect(JSON.stringify(log.mock.calls)).not.toContain(HMAC_SECRET)
  })

  it('warns about an existing short key without changing it', async () => {
    const config = baseConfig({ jwtSecret: 'existing-short-key' })
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.mocked(createApplication).mockResolvedValue({
      app: { listen: jest.fn().mockResolvedValue(undefined) } as never,
      config,
    })

    await bootstrap()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('fewer than 32 bytes'))
    expect(JSON.stringify(warn.mock.calls)).not.toContain(config.jwtSecret)
    expect(config.jwtSecret).toBe('existing-short-key')
  })
})

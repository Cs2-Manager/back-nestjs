import 'reflect-metadata'
import { Logger } from '@nestjs/common'

import { createApplication } from './app.factory'

export async function bootstrap(): Promise<void> {
  const { app, config } = await createApplication()
  await app.listen(config.port, '0.0.0.0')
  // Log mínimo y sin secretos: no se imprimen tokens ni firmas.
  const logger = new Logger('Bootstrap')
  logger.log(
    `cs2-manager-realtime listening on port ${config.port} (identity_check=${config.identityVerifyEnabled ? 'on' : 'off'})`,
  )
  if (Buffer.byteLength(config.jwtSecret, 'utf8') < 32) {
    logger.warn('JWT signing key has fewer than 32 bytes; coordinate a secure key rotation with Flask')
  }
}

if (require.main === module) {
  void bootstrap().catch(() => {
    Logger.error('Realtime startup failed; check service configuration', 'Bootstrap')
    process.exitCode = 1
  })
}

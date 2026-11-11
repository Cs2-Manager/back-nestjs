import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { loadConfig } from './config/realtime-config'
import { RealtimeIoAdapter } from './realtime/realtime-io.adapter'

/**
 * Fábrica compartida por `main.ts` y las pruebas e2e: mismas opciones de
 * rawBody, validación, adaptador Socket.IO y cierre ordenado.
 */
export async function createApplication() {
  const config = loadConfig()
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
  })

  app.useLogger(new Logger('Realtime'))
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  app.useWebSocketAdapter(new RealtimeIoAdapter(app, config))
  app.enableShutdownHooks()
  return { app, config }
}

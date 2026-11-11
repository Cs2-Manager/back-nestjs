import { Global, Module } from '@nestjs/common'

import { loadConfig, REALTIME_CONFIG } from './realtime-config'

@Global()
@Module({
  providers: [
    {
      provide: REALTIME_CONFIG,
      useFactory: () => loadConfig(),
    },
  ],
  exports: [REALTIME_CONFIG],
})
export class RealtimeConfigModule {}

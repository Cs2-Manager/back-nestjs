import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ConnectionLimiterService } from './connection-limiter.service'
import { RealtimeGateway } from './realtime.gateway'
import { SocketRegistryService } from './socket-registry.service'
import { SocketAuthenticationService } from './socket-authentication.service'
import { PresenceService } from './presence.service'

@Module({
  imports: [AuthModule],
  providers: [
    RealtimeGateway,
    SocketRegistryService,
    ConnectionLimiterService,
    SocketAuthenticationService,
    PresenceService,
  ],
  exports: [
    RealtimeGateway,
    SocketRegistryService,
    ConnectionLimiterService,
  ],
})
export class RealtimeModule {}

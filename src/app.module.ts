import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module'
import { CommonModule } from './common/common.module'
import { RealtimeConfigModule } from './config/config.module'
import { EventsModule } from './events/events.module'
import { HealthModule } from './health/health.module'
import { NotificationsModule } from './notifications/notifications.module'
import { RealtimeModule } from './realtime/realtime.module'

@Module({
  imports: [
    RealtimeConfigModule,
    CommonModule,
    AuthModule,
    NotificationsModule,
    RealtimeModule,
    EventsModule,
    HealthModule,
  ],
})
export class AppModule {}

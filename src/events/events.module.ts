import { Module } from '@nestjs/common'

import { NotificationsModule } from '../notifications/notifications.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'

@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}

import { Module } from '@nestjs/common'

import { NotificationFactory } from './notification.factory'

@Module({
  providers: [NotificationFactory],
  exports: [NotificationFactory],
})
export class NotificationsModule {}

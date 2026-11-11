import { Global, Module } from '@nestjs/common'

import { ReplayStoreService } from './replay-store.service'

@Global()
@Module({
  providers: [ReplayStoreService],
  exports: [ReplayStoreService],
})
export class CommonModule {}

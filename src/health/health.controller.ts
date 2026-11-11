import { Controller, Get } from '@nestjs/common'

import { SocketRegistryService } from '../realtime/socket-registry.service'

@Controller()
export class HealthController {
  constructor(private readonly registry: SocketRegistryService) {}

  @Get('health')
  health(): Record<string, unknown> {
    return {
      status: 'ok',
      service: 'cs2-manager-realtime',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      connections: this.registry.totalConnections(),
      connected_users: this.registry.totalUsers(),
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'

import { ReplayStoreService } from '../common/replay-store.service'
import { REALTIME_CONFIG, type RealtimeConfig } from '../config/realtime-config'
import { EventsService } from './events.service'
import { HmacGuard } from './hmac.guard'
import { validateInternalEvent } from './event-payload.validator'
import { EventValidationError, type InternalEvent } from './event.types'

@Controller('internal')
@UseGuards(HmacGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly replayStore: ReplayStoreService,
    @Inject(REALTIME_CONFIG) private readonly config: RealtimeConfig,
  ) {}

  @Post('events')
  @HttpCode(200)
  async receive(
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ accepted: true; event_id: string; delivered_to: number }> {
    const rawBody = request.rawBody
    if (!rawBody) {
      throw new BadRequestException('Raw body unavailable')
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody.toString('utf8'))
    } catch {
      throw new BadRequestException('Invalid JSON body')
    }

    let event: InternalEvent
    try {
      event = await validateInternalEvent(body, this.config)
    } catch (error) {
      if (error instanceof EventValidationError) {
        throw new BadRequestException(error.message)
      }
      throw error
    }

    if (
      !this.replayStore.remember(
        `event:${event.event_id}`,
        this.config.eventIdTtlSeconds,
      )
    ) {
      throw new ConflictException('Duplicate event_id')
    }

    const deliveredTo = this.eventsService.dispatch(event)
    return {
      accepted: true,
      event_id: event.event_id,
      delivered_to: deliveredTo,
    }
  }
}

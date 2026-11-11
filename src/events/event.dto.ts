import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

import { EVENT_TYPES, type EventType } from './event.types'

export class ActorDto {
  @IsInt()
  @Min(1)
  user_id!: number

  @IsString()
  username!: string
}

/**
 * DTO del sobre del evento. Los payloads específicos se validan con un
 * catálogo estricto en `event-payload.validator.ts`.
 */
export class InternalEventDto {
  @IsUUID('4')
  event_id!: string

  @IsIn(EVENT_TYPES)
  event_type!: EventType

  @IsISO8601({ strict: true })
  occurred_at!: string

  @Equals(1)
  version!: 1

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  resource_id!: number

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  team_id!: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  notification_id?: number

  @IsObject()
  @ValidateNested()
  @Type(() => ActorDto)
  actor!: ActorDto

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  recipients!: number[]

  @IsObject()
  payload!: Record<string, unknown>
}

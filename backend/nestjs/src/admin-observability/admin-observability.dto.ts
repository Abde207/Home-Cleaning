import { Transform } from 'class-transformer';
import { IsISO8601, IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { ListQueryDto } from '../core/core.dto.js';

const deliveryStatuses = ['PENDING', 'SENDING', 'SENT', 'FAILED'] as const;
const freshnessValues = ['FRESH', 'STALE', 'NEVER_REPORTED'] as const;
const locationAvailabilityValues = ['AVAILABLE', 'MISSING'] as const;
const teamStatuses = ['AVAILABLE', 'BUSY', 'OFFLINE', 'PAUSED'] as const;

function trim(value: unknown) { return typeof value === 'string' ? value.trim() : value; }

export class AdminNotificationDeliveryQueryDto extends ListQueryDto {
  constructor() { super(); this.limit = 50; }
  @IsOptional() @IsIn(deliveryStatuses) status?: typeof deliveryStatuses[number];
  @IsOptional() @Transform(({ value }) => trim(value)) @IsString() @Length(1, 80) @Matches(/^[A-Za-z0-9:_-]+$/) type?: string;
  @IsOptional() @Transform(({ value }) => trim(value)) @IsString() @Length(1, 40) @Matches(/^[A-Za-z0-9:_-]+$/) category?: string;
  @IsOptional() @IsUUID('4') userId?: string;
  @IsOptional() @Transform(({ value }) => trim(value)) @IsString() @Length(1, 60) @Matches(/^[A-Za-z0-9:_-]+$/) referenceType?: string;
  @IsOptional() @Transform(({ value }) => trim(value)) @IsString() @Length(1, 160) referenceId?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) createdFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) createdTo?: string;
}

export class AdminLocationsQueryDto extends ListQueryDto {
  constructor() { super(); this.limit = 50; }
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsUUID('4') teamId?: string;
  @IsOptional() @IsIn(teamStatuses) teamStatus?: typeof teamStatuses[number];
  @IsOptional() @IsIn(freshnessValues) freshness?: typeof freshnessValues[number];
  @IsOptional() @IsIn(locationAvailabilityValues) locationAvailability?: typeof locationAvailabilityValues[number];
}

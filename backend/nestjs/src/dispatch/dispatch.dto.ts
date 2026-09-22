import { IsBoolean, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class ManualDispatchDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') teamId!: string;
  @IsString() @Length(1, 500) @Matches(/\S/) reason!: string;
  @IsOptional() @IsBoolean() overrideAvailabilityAndArea?: boolean;
}

/** Compatibility input: slot and expiry remain explicit, while Dispatch owns eligibility. */
export class LegacyManualAssignmentDto extends ManualDispatchDto {
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) startsAt!: string;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) endsAt!: string;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) expiresAt!: string;
}

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const providerAssignmentStatuses = ['OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED'] as const;
export const providerAssignmentViews = ['PENDING', 'ACTIVE', 'HISTORY'] as const;

export class ProviderAssignmentListDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 100;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
  @IsOptional() @IsIn(providerAssignmentStatuses) status?: (typeof providerAssignmentStatuses)[number];
  @IsOptional() @IsIn(providerAssignmentViews) view?: (typeof providerAssignmentViews)[number];
}

export class ProviderCashWorklistDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 100;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
  @IsOptional() @IsIn(['EXPECTED', 'COLLECTED', 'RECONCILED']) state?: 'EXPECTED' | 'COLLECTED' | 'RECONCILED';
}

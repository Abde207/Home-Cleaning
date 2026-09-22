import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsUUID, Max, Min, ValidateNested, IsIn, Matches, ValidateIf, IsBoolean, IsISO8601, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

export class PricingExtraInputDto {
  @IsUUID('4') serviceExtraId!: string;
  @IsInt() @Min(1) @Max(100) quantity!: number;
}

export class QuoteRequestDto {
  @ValidateIf((_o, v) => v !== undefined) @Matches(/^[A-Z0-9_-]{1,40}$/) promotionCode?: string;
  @IsUUID('4') serviceId!: string;
  @IsUUID('4') propertyId!: string;
  @IsUUID('4') addressId!: string;
  @IsArray() @ArrayMaxSize(50) @ArrayUnique(item => item.serviceExtraId) @ValidateNested({ each: true }) @Type(() => PricingExtraInputDto) extras: PricingExtraInputDto[] = [];
}

/** A finite declarative rule language; no expressions or executable scripts. */
export class RuleDefinitionDto {
  @IsIn(['ADJUSTMENT', 'FEE']) kind!: 'ADJUSTMENT' | 'FEE';
  @IsIn(['FIXED', 'PER_SIZE', 'PER_ROOM', 'PER_BATHROOM', 'PER_MINUTE', 'PERCENT_SUBTOTAL']) basis!: 'FIXED' | 'PER_SIZE' | 'PER_ROOM' | 'PER_BATHROOM' | 'PER_MINUTE' | 'PERCENT_SUBTOTAL';
  @Matches(/^-?\d{1,10}(\.\d{1,2})?$/) amount!: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID('4') serviceId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsIn(['APARTMENT', 'HOUSE', 'VILLA', 'OFFICE']) propertyType?: string;
  @ValidateIf((_o, v) => v !== undefined) @Matches(/^\d{1,8}(\.\d{1,2})?$/) minSize?: string;
  @ValidateIf((_o, v) => v !== undefined) @Matches(/^\d{1,8}(\.\d{1,2})?$/) maxSize?: string;
}

export class PublishRuleDto {
  @Matches(/^[A-Z][A-Z0-9_-]{0,79}$/) name!: string;
  @IsInt() @Min(1) @Max(2147483647) version!: number;
  @IsDefined() @ValidateNested() @Type(() => RuleDefinitionDto) definition!: RuleDefinitionDto;
  @IsBoolean() active!: boolean;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) startsAt!: string;
  @ValidateIf((_o, v) => v !== undefined) @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) endsAt?: string;
}

export class PublishPromotionDto {
  @Matches(/^[A-Z0-9_-]{1,40}$/) code!: string;
  @Matches(/^\d{1,10}(\.\d{1,2})?$/) discount!: string;
  @Matches(/^\d{1,10}(\.\d{1,2})?$/) minTotal!: string;
  @ValidateIf((_o, v) => v !== undefined) @IsInt() @Min(1) @Max(2147483647) maxUses?: number;
  @IsBoolean() active!: boolean;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) startsAt!: string;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) endsAt!: string;
}

export class PricingActivationDto {
  @IsBoolean() active!: boolean;
}

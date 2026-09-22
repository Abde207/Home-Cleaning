import { ArrayMaxSize, ArrayUnique, IsArray, IsISO8601, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class BookingExtraInputDto {
  @IsUUID('4') serviceExtraId!: string;
  @IsInt() @Min(1) @Max(100) quantity!: number;
}

export class CreateBookingDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID('4') quoteId?: string;
  @ValidateIf((_o, v) => v !== undefined) @Matches(/^[A-Z0-9_-]{1,40}$/) promotionCode?: string;
  @IsUUID('4') serviceId!: string;
  @IsUUID('4') propertyId!: string;
  @IsUUID('4') addressId!: string;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) scheduledAt!: string;
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
  @IsArray() @ArrayMaxSize(50) @ArrayUnique(item => item.serviceExtraId) @ValidateNested({ each: true }) @Type(() => BookingExtraInputDto) extras: BookingExtraInputDto[] = [];
}

export class CancelBookingDto {
  @IsOptional() @IsString() @Length(1, 500) reason?: string;
}

/** Privileged validation of an already stored snapshot. Customer handoff uses quoteId. */
export class QuoteConfirmationDto {
  @IsString() @Length(1, 80) pricingVersion!: string;
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) basePrice!: string;
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) extrasTotal!: string;
  @IsString() @Matches(/^-?\d+(\.\d{1,2})?$/) adjustments!: string;
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) fees!: string;
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) discount!: string;
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) total!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsObject() breakdown!: Record<string, unknown>;
}

/** Trusted handoff from a payment provider adapter. */
export class PaymentConfirmationDto {
  @IsString() @Length(1, 80) provider!: string;
  @IsString() @Length(1, 160) eventId!: string;
  @IsString() @Length(1, 160) transactionReference!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/i) payloadHash!: string;
}

export class AssignmentDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') teamId!: string;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) startsAt!: string;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) endsAt!: string;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) expiresAt!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class CompletionProofDto {
  @IsString() @Length(1, 500) storageKey!: string;
  @IsString() @Length(1, 80) mimeType!: string;
  @IsInt() @Min(1) byteSize!: number;
}

export class CashCollectionDto {
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) amount!: string;
}

export class RefundDto {
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) amount!: string;
  @IsString() @Length(1, 500) reason!: string;
}

export class RefundCompletionDto {
  @IsString() @Length(1, 160) reference!: string;
  @IsString() @Length(1, 80) provider!: string;
  @IsString() @Length(1, 160) eventId!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/i) payloadHash!: string;
}

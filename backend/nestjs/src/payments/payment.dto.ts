import { IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

const money = /^\d+(\.\d{1,2})?$/;

export class CreatePaymentDto {
  @IsUUID('4') bookingId!: string;
}

export class PaymentRefundDto {
  @Matches(money) amount!: string;
  @IsString() @Length(1, 500) reason!: string;
}

export class CreateSettlementDto {
  @IsUUID('4') companyId!: string;
  @IsISO8601({ strict: true }) periodStart!: string;
  @IsISO8601({ strict: true }) periodEnd!: string;
}

export class SettlementPaymentDto {
  @Matches(money) amount!: string;
  @IsString() @Matches(/^(TO_PROVIDER|TO_PLATFORM)$/) direction!: 'TO_PROVIDER' | 'TO_PLATFORM';
  @IsString() @Length(1, 160) reference!: string;
  @IsOptional() @IsISO8601({ strict: true }) paidAt?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class SettlementCommandDto {
  @IsOptional() @IsString() @Length(1, 500) reason?: string;
}

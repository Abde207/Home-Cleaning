import { IsIn, IsISO8601, IsOptional, IsUUID, IsString, Length, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ListQueryDto } from '../core/core.dto.js';

const bool = ({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value;

export class AdminPaymentQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'FAILED', 'CASH_SELECTED', 'CASH_COLLECTED', 'RECONCILED', 'PARTIALLY_REFUNDED', 'REFUNDED']) status?: string;
  @IsOptional() @IsIn(['ONLINE', 'CASH']) method?: string;
  @IsOptional() @IsUUID('4') bookingId?: string;
  @IsOptional() @IsString() @Length(1, 40) bookingNumber?: string;
  @IsOptional() @IsUUID('4') customerId?: string;
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsISO8601({ strict: true }) createdFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) createdTo?: string;
  @IsOptional() @Transform(bool) hasRefund?: boolean;
  @IsOptional() @IsIn(['EXPECTED', 'COLLECTED', 'RECONCILED']) cashState?: string;
}

export class AdminRefundQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(['PENDING', 'SUCCEEDED', 'FAILED']) status?: string;
  @IsOptional() @IsUUID('4') paymentId?: string;
  @IsOptional() @IsUUID('4') bookingId?: string;
  @IsOptional() @IsUUID('4') customerId?: string;
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsISO8601({ strict: true }) createdFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) createdTo?: string;
}

export class AdminCashQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(['EXPECTED', 'COLLECTED', 'RECONCILED', 'EXCEPTION']) state?: string;
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsUUID('4') teamId?: string;
  @IsOptional() @IsUUID('4') bookingId?: string;
  @IsOptional() @IsISO8601({ strict: true }) scheduledFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) scheduledTo?: string;
}

export class AdminSettlementQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(['DRAFT', 'CALCULATED', 'READY_FOR_REVIEW', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'RECONCILED', 'CLOSED', 'CANCELLED', 'REVERSED']) status?: string;
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsISO8601({ strict: true }) periodFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) periodTo?: string;
  @IsOptional() @IsIn(['MATCHED', 'DISCREPANCY']) reconciliationStatus?: string;
}

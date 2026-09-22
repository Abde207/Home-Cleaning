import { Transform, Type } from 'class-transformer';
import { IsISO8601, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import type { Prisma } from '@prisma/client';
import { ListQueryDto } from '../core/core.dto.js';

const bookingStatuses = [
  'REQUESTED', 'PRICE_CONFIRMED', 'PAYMENT_PENDING', 'CASH_SELECTED', 'PAYMENT_CONFIRMED',
  'SEARCHING_FOR_TEAM', 'TEAM_ASSIGNED', 'TEAM_ACCEPTED', 'TEAM_ON_THE_WAY', 'CLEANING_STARTED',
  'CLEANING_COMPLETED', 'PAYMENT_RECONCILIATION', 'COMPLETED', 'CANCELLED', 'NO_TEAM_AVAILABLE',
  'REJECTED', 'TEAM_NO_SHOW', 'CUSTOMER_NO_SHOW', 'REFUND_PENDING', 'REFUNDED',
] as const;

const paymentMethods = ['ONLINE', 'CASH'] as const;

function trim(value: unknown) { return typeof value === 'string' ? value.trim() : value; }

export class AdminDashboardQueryDto {
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) to?: string;
}

export class AdminBookingListQueryDto extends ListQueryDto {
  constructor() { super(); this.limit = 50; }
  @IsOptional() @IsIn(bookingStatuses) status?: typeof bookingStatuses[number];
  @IsOptional() @IsIn(paymentMethods) paymentMethod?: typeof paymentMethods[number];
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsUUID('4') teamId?: string;
  @IsOptional() @IsUUID('4') customerId?: string;
  @IsOptional() @IsUUID('4') serviceId?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) scheduledFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) scheduledTo?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) createdFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) createdTo?: string;
  @IsOptional() @Transform(({ value }) => trim(value)) @IsString() @Length(1, 40) @Matches(/^[A-Za-z0-9-]+$/) bookingNumber?: string;
}

export class AuditLogQueryDto extends ListQueryDto {
  constructor() { super(); this.limit = 50; }
  @IsOptional() @IsUUID('4') actorUserId?: string;
  @IsOptional() @Transform(({ value }) => trim(value)) @IsString() @Length(1, 100) @Matches(/^[A-Za-z0-9:_-]+$/) action?: string;
  @IsOptional() @Transform(({ value }) => trim(value)) @IsString() @Length(1, 80) @Matches(/^[A-Za-z0-9:_-]+$/) resourceType?: string;
  @IsOptional() @Transform(({ value }) => trim(value)) @IsString() @Length(1, 160) resourceId?: string;
  @IsOptional() @Transform(({ value }) => trim(value)) @IsString() @Length(1, 80) @Matches(/^[A-Za-z0-9._:-]+$/) requestId?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) createdFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) createdTo?: string;
}

export const adminBookingSummarySelect = {
  id: true,
  bookingNumber: true,
  status: true,
  paymentMethod: true,
  price: true,
  currency: true,
  scheduledAt: true,
  estimatedEndAt: true,
  createdAt: true,
  customer: { select: { id: true, user: { select: { name: true, phone: true, status: true } } } },
  service: { select: { id: true, name: true, nameAr: true } },
  assignments: {
    take: 1,
    orderBy: [{ assignedAt: 'desc' as const }, { id: 'desc' as const }],
    select: { id: true, status: true, expiresAt: true, company: { select: { id: true, name: true } }, team: { select: { id: true, name: true } } },
  },
  payments: {
    take: 1,
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    select: { id: true, method: true, status: true },
  },
} satisfies Prisma.BookingSelect;

/** Admin-only investigation projection. Keep this separate from bookingSelect so
 * customer/provider booking responses never gain platform-wide identity or
 * dispatch detail. */
export const adminBookingDetailSelect = {
  id: true,
  bookingNumber: true,
  customerId: true,
  serviceId: true,
  propertyId: true,
  addressId: true,
  status: true,
  paymentMethod: true,
  price: true,
  currency: true,
  scheduledAt: true,
  estimatedEndAt: true,
  instructions: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  addressSnapshot: true,
  propertySnapshot: true,
  serviceSnapshot: true,
  locationLatitude: true,
  locationLongitude: true,
  customer: { select: { id: true, user: { select: { id: true, name: true, phone: true, status: true } } } },
  service: { select: { id: true, name: true, nameAr: true } },
  extras: { select: { id: true, serviceExtraId: true, name: true, quantity: true, price: true }, orderBy: { id: 'asc' as const } },
  priceSnapshot: { select: { pricingVersion: true, basePrice: true, extrasTotal: true, adjustments: true, fees: true, discount: true, total: true, currency: true, breakdown: true } },
  history: { select: { id: true, previousStatus: true, newStatus: true, changedByUserId: true, changedByRole: true, reason: true, metadata: true, createdAt: true }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
  assignments: {
    select: {
      id: true, companyId: true, teamId: true, status: true, startsAt: true, endsAt: true, assignedAt: true, expiresAt: true, acceptedAt: true, reason: true,
      company: { select: { id: true, name: true, status: true } },
      team: { select: { id: true, name: true, status: true, active: true } },
      events: { select: { id: true, type: true, metadata: true, createdAt: true }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
      proofs: { select: { id: true, storageKey: true, mimeType: true, byteSize: true, createdAt: true }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
    },
    orderBy: [{ assignedAt: 'asc' as const }, { id: 'asc' as const }],
  },
  dispatchAttempts: { select: { id: true, sequence: true, outcome: true, reason: true, candidates: true, createdAt: true }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
  payments: {
    select: {
      id: true, method: true, status: true, amount: true, currency: true, provider: true, transactionReference: true, createdAt: true, updatedAt: true,
      transactions: { select: { id: true, type: true, amount: true, reference: true, createdAt: true }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
      refunds: { select: { id: true, amount: true, status: true, reference: true, reason: true, createdAt: true, updatedAt: true }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
      cashCollection: { select: { id: true, amount: true, collectedByUserId: true, collectedAt: true, reconciledAt: true, collectorCompanyId: true, collectorTeamId: true } },
    },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.BookingSelect;

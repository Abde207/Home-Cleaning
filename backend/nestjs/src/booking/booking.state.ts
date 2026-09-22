import { ConflictException } from '@nestjs/common';
import type { BookingStatus } from '@prisma/client';

export const bookingTransitions: Record<BookingStatus, readonly BookingStatus[]> = {
  REQUESTED: ['PRICE_CONFIRMED', 'CANCELLED'],
  PRICE_CONFIRMED: ['PAYMENT_PENDING', 'CASH_SELECTED', 'CANCELLED'],
  PAYMENT_PENDING: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  CASH_SELECTED: ['PAYMENT_CONFIRMED'],
  PAYMENT_CONFIRMED: ['SEARCHING_FOR_TEAM'],
  SEARCHING_FOR_TEAM: ['TEAM_ASSIGNED', 'NO_TEAM_AVAILABLE'],
  TEAM_ASSIGNED: ['TEAM_ACCEPTED', 'REJECTED', 'CANCELLED'],
  TEAM_ACCEPTED: ['TEAM_ON_THE_WAY'],
  TEAM_ON_THE_WAY: ['CLEANING_STARTED', 'TEAM_NO_SHOW'],
  CLEANING_STARTED: ['CLEANING_COMPLETED', 'CUSTOMER_NO_SHOW'],
  CLEANING_COMPLETED: ['PAYMENT_RECONCILIATION'],
  PAYMENT_RECONCILIATION: ['COMPLETED', 'REFUND_PENDING'],
  COMPLETED: [],
  CANCELLED: [],
  NO_TEAM_AVAILABLE: [],
  REJECTED: ['SEARCHING_FOR_TEAM'],
  TEAM_NO_SHOW: ['SEARCHING_FOR_TEAM'],
  CUSTOMER_NO_SHOW: [],
  REFUND_PENDING: ['REFUNDED'],
  REFUNDED: [],
};

export function assertBookingTransition(current: BookingStatus, next: BookingStatus) {
  if (!bookingTransitions[current].includes(next)) {
    throw new ConflictException({
      code: 'BOOKING_INVALID_TRANSITION',
      message: `Booking cannot transition from ${current} to ${next}.`,
    });
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBookingTransition, bookingTransitions } from '../../dist/booking/booking.state.js';

test('booking state machine permits only documented command transitions', () => {
  assert.doesNotThrow(() => assertBookingTransition('REQUESTED', 'PRICE_CONFIRMED'));
  assert.doesNotThrow(() => assertBookingTransition('TEAM_NO_SHOW', 'SEARCHING_FOR_TEAM'));
  assert.throws(() => assertBookingTransition('REQUESTED', 'CASH_SELECTED'), error => error.getStatus?.() === 409);
  assert.throws(() => assertBookingTransition('COMPLETED', 'REQUESTED'), error => error.getStatus?.() === 409);
  assert.deepEqual(bookingTransitions.CLEANING_STARTED, ['CLEANING_COMPLETED', 'CUSTOMER_NO_SHOW']);
});

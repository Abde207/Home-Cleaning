import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { MockPaymentProvider } from '../../dist/payments/payment.provider.js';

const secret = 'unit-payment-webhook-secret';
const provider = new MockPaymentProvider(secret);

test('payment provider creates a checkout reference without treating it as success', async () => {
  const result = await provider.createPayment({ paymentId: 'p', attemptId: 'a', amount: '25.00', currency: 'JOD', bookingNumber: 'HC-1', customerPhone: '+962790000000' });
  assert.match(result.providerReference, /^mock-pay-/);
  assert.match(result.checkoutUrl, /checkout/);
});

test('payment provider verifies signed success webhooks and hashes the raw body', () => {
  const raw = Buffer.from(JSON.stringify({ eventId: 'evt-1', type: 'SUCCEEDED', paymentReference: 'mock-pay-1', transactionReference: 'capture-1', amount: '25.00', currency: 'JOD' }));
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
  const event = provider.verifyWebhook(raw, signature);
  assert.equal(event.type, 'SUCCEEDED');
  assert.equal(event.providerReference, 'mock-pay-1');
  assert.equal(event.amount, '25.00');
  assert.equal(event.payloadHash.length, 64);
});

test('payment provider rejects invalid webhook signatures', () => {
  const raw = Buffer.from('{}');
  assert.throws(() => provider.verifyWebhook(raw, '0'.repeat(64)), /Invalid webhook signature/);
});

test('payment provider rejects unsigned and malformed events', () => {
  const raw = Buffer.from(JSON.stringify({ eventId: 'evt-2', type: 'UNKNOWN', paymentReference: 'p', amount: '1.00', currency: 'JOD' }));
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
  assert.throws(() => provider.verifyWebhook(raw, signature), /Invalid webhook event type/);
});

test('payment provider refund result has distinct provider and capture references', async () => {
  const result = await provider.refund({ paymentId: 'p', refundId: 'r', amount: '5.00', currency: 'JOD', providerReference: 'mock-pay-1' });
  assert.match(result.providerReference, /^mock-refund-/);
  assert.match(result.transactionReference, /^mock-refund-txn-/);
  assert.equal(result.payloadHash.length, 64);
});

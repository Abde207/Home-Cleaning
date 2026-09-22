import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { TwilioVerifyProvider } from '../../dist/auth/otp-sender.js';
import { TapPaymentProvider } from '../../dist/payments/payment.provider.js';
import { FcmPushNotificationProvider, InvalidPushTokenError } from '../../dist/notifications/notification.provider.js';

test('Twilio Verify sends and checks through the Verify service without exposing the code in URLs', async () => {
  const calls = [];
  const provider = new TwilioVerifyProvider('VA' + 'a'.repeat(32), 'AC' + 'b'.repeat(32), 'placeholder',
    async (url, options) => { calls.push({ url, options }); return Response.json({ status: url.endsWith('VerificationCheck') ? 'approved' : 'pending' }); });
  await provider.send(randomUUID(), '+962790000000', '123456', new Date());
  assert.equal(await provider.verify('+962790000000', '123456'), true);
  assert.equal(calls.length, 2);
  assert.match(String(calls[0].options.body), /Channel=sms/);
  assert.match(String(calls[1].options.body), /Code=123456/);
  assert.ok(!calls[1].url.includes('123456'));
});

test('Twilio Verify rejects invalid codes and provider timeouts without granting a session', async () => {
  const invalid = new TwilioVerifyProvider('service', 'account', 'placeholder', async () => Response.json({ status: 'pending' }));
  assert.equal(await invalid.verify('+962790000000', '000000'), false);
  const timeout = new TwilioVerifyProvider('service', 'account', 'placeholder', async () => { throw new Error('network secret'); });
  await assert.rejects(timeout.send('id', '+962790000000', '123456', new Date()), /Service Unavailable/);
});

test('Tap creates a hosted JOD charge with provider idempotency reference', async () => {
  let body;
  const tap = new TapPaymentProvider('sk_test_placeholder', 'https://example.test/webhook', 'https://example.test/return',
    async (_url, options) => { body = JSON.parse(options.body); return Response.json({ id: 'chg_example', amount: body.amount, currency: body.currency,
      reference: { idempotent: body.reference.idempotent }, transaction: { url: 'https://checkout.example.test/go' } }); });
  const result = await tap.createPayment({ paymentId: randomUUID(), attemptId: 'attempt-1', amount: '12.50', currency: 'JOD', bookingNumber: 'B-1' });
  assert.equal(result.providerReference, 'chg_example');
  assert.equal(body.reference.idempotent, 'attempt-1');
  assert.equal(body.currency, 'JOD');
});

test('Tap webhook verifies hash, JOD amount and attempt reference', () => {
  const key = 'sk_test_placeholder';
  const tap = new TapPaymentProvider(key, 'https://example.test/webhook', 'https://example.test/return');
  const body = { object: 'charge', id: 'chg_example', status: 'CAPTURED', amount: 12.5, currency: 'JOD',
    transaction: { created: '1234567890000' }, reference: { gateway: 'gateway-1', payment: 'pay-1', idempotent: 'attempt-1' } };
  const signed = 'x_idchg_examplex_amount12.500x_currencyJODx_gateway_referencegateway-1x_payment_referencepay-1x_statusCAPTUREDx_created1234567890000';
  const hash = createHmac('sha256', key).update(signed).digest('hex');
  const event = tap.verifyWebhook(Buffer.from(JSON.stringify(body)), hash);
  assert.equal(event.amount, '12.500');
  assert.equal(event.attemptId, 'attempt-1');
  assert.throws(() => tap.verifyWebhook(Buffer.from(JSON.stringify({ ...body, amount: 100 })), hash));
  assert.throws(() => tap.verifyWebhook(Buffer.from(JSON.stringify({ ...body, currency: 'USD' })), hash));
});

test('Tap timeouts and unconfirmed refunds fail without financial success', async () => {
  const input = { paymentId: randomUUID(), attemptId: randomUUID(), amount: '12.50', currency: 'JOD', bookingNumber: 'B-2' };
  const unavailable = new TapPaymentProvider('sk_test_placeholder', 'https://example.test/webhook', 'https://example.test/return',
    async () => { throw new Error('network details'); });
  await assert.rejects(unavailable.createPayment(input), /TAP_PROVIDER_UNAVAILABLE/);
  const pending = new TapPaymentProvider('sk_test_placeholder', 'https://example.test/webhook', 'https://example.test/return',
    async () => Response.json({ id: 're_example', status: 'PENDING' }));
  await assert.rejects(pending.refund({ paymentId: input.paymentId, refundId: randomUUID(), amount: '12.50', currency: 'JOD', providerReference: 'chg_example' }),
    /TAP_REFUND_PENDING_OR_FAILED/);
});

test('FCM classifies invalid registrations without leaking tokens', async () => {
  const keyPair = (await import('node:crypto')).generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKey = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const fcm = new FcmPushNotificationProvider('test-project', 'test@example.test', privateKey,
    async (url) => url.includes('oauth2') ? Response.json({ access_token: 'fake-access', expires_in: 3600 }) : new Response('', { status: 404 }));
  await assert.rejects(fcm.send({ token: 'fake-registration', title: 'Test', body: 'Test', data: {}, deliveryId: randomUUID() }), InvalidPushTokenError);
});

test('FCM sends one bounded event payload and surfaces retryable provider failure', async () => {
  const keyPair = (await import('node:crypto')).generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKey = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  let sent;
  const fcm = new FcmPushNotificationProvider('test-project', 'test@example.test', privateKey,
    async (url, options) => {
      if (url.includes('oauth2')) return Response.json({ access_token: 'fake-access', expires_in: 3600 });
      sent = JSON.parse(options.body);
      return Response.json({ name: 'projects/test-project/messages/test-message' });
    });
  const result = await fcm.send({ token: 'test-registration', title: 'Booking update', body: 'Status changed',
    data: { eventId: 'event-1' }, deliveryId: randomUUID() });
  assert.equal(result.providerReference, 'projects/test-project/messages/test-message');
  assert.equal(sent.message.data.eventId, 'event-1');
  assert.ok(!JSON.stringify(sent).includes('address'));
  const failure = new FcmPushNotificationProvider('test-project', 'test@example.test', privateKey,
    async (url) => url.includes('oauth2') ? Response.json({ access_token: 'fake-access' }) : new Response('', { status: 503 }));
  await assert.rejects(failure.send({ token: 'test-registration', title: 'Update', body: '', data: {} }), /PUSH_PROVIDER_REJECTED/);
});

import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Pricing rules, promotions, durable quotes and Booking handoff preserve financial history under concurrency', { timeout: 60000 }, async t => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function identity(roleName: 'CUSTOMER' | 'HOME_CLEAN_ADMIN' | 'DISPATCHER') {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
      const user = await db.user.create({ data: { phone: `+price-${randomUUID()}`.slice(0, 20), customer: { create: {} }, roles: { create: { roleId: role.id } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 600000), expiresAt: new Date(Date.now() + 1200000) } });
      return { token, user, customer: await db.customer.findUniqueOrThrow({ where: { userId: user.id } }) };
    }
    async function request(method: string, path: string, token: string, body?: unknown, key?: string) {
      const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
      const json = await response.json() as any;
      return { status: response.status, data: json.data, error: json.error };
    }
    const admin = await identity('HOME_CLEAN_ADMIN'), customer = await identity('CUSTOMER'), other = await identity('CUSTOMER'), dispatcher = await identity('DISPATCHER');
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const service = await db.service.create({ data: { code: `PRICE_${suffix}`, name: 'Quoted service', nameAr: 'خدمة', description: 'Pricing acceptance', basePrice: '10', durationMinutes: 60, active: true } });
    const extra = await db.serviceExtra.create({ data: { serviceId: service.id, code: 'WINDOWS', name: 'Windows', nameAr: 'نوافذ', price: '2.5', active: true } });
    const address = await db.address.create({ data: { customerId: customer.customer.id, label: 'Home', addressText: 'Quoted address', latitude: 31.95, longitude: 35.91 } });
    const property = await db.property.create({ data: { customerId: customer.customer.id, type: 'APARTMENT', size: '80', rooms: 2, bathrooms: 1 } });
    const inputs = { serviceId: service.id, propertyId: property.id, addressId: address.id, extras: [{ serviceExtraId: extra.id, quantity: 2 }] };
    const startsAt = new Date(Date.now() - 60000).toISOString(), endsAt = new Date(Date.now() + 3600000).toISOString();
    const ruleDto = { name: `SIZE_${suffix}`, version: 1, definition: { kind: 'ADJUSTMENT', basis: 'PER_SIZE', amount: '0.10', serviceId: service.id }, active: true, startsAt, endsAt };
    const promoDto = { code: `SAVE_${suffix}`, discount: '3', minTotal: '20', maxUses: 1, active: true, startsAt, endsAt };
    const quote = (body: object = inputs, key?: string) => request('POST', '/bookings/quote', customer.token, body, key);
    const book = (quoteId: string, key: string, additions: object = {}) => request('POST', '/bookings', customer.token, { ...inputs, quoteId, scheduledAt: '2027-06-01T10:00:00Z', ...additions }, key);
    let ruleId = '', promoId = '', pricedQuote: any, pricedQuote2: any, created: any;

    await t.test('catalog compatibility, durable ownership and strict request validation', async () => {
      const result = await quote(); assert.equal(result.status, 201); assert.equal(result.data.total, '15');
      assert.equal((await db.pricingQuote.findUniqueOrThrow({ where: { id: result.data.quoteId } })).customerId, customer.customer.id);
      assert.deepEqual((await request('GET', `/bookings/quotes/${result.data.quoteId}`, customer.token)).data, result.data);
      assert.equal((await request('GET', `/bookings/quotes/${result.data.quoteId}`, other.token)).status, 404);
      for (const body of [{ ...inputs, total: '0' }, { ...inputs, customerId: other.customer.id }, { ...inputs, extras: [...inputs.extras, ...inputs.extras] }, { ...inputs, promotionCode: null }]) assert.equal((await quote(body)).status, 400);
      assert.equal((await request('POST', '/bookings/quote', other.token, inputs)).status, 404);
      assert.equal((await request('POST', '/bookings/quote', '', inputs)).status, 401);
    });
    await t.test('rule publishing is authorized, versioned, audited and idempotent', async () => {
      for (const token of [customer.token, dispatcher.token]) assert.equal((await request('POST', '/admin/pricing/rules', token, ruleDto, 'denied')).status, 403);
      assert.equal((await request('POST', '/admin/pricing/rules', admin.token, ruleDto)).status, 400);
      assert.equal((await request('POST', '/admin/pricing/rules', admin.token, { ...ruleDto, definition: { ...ruleDto.definition, execute: 'anything' } }, 'invalid')).status, 400);
      const results = await Promise.all([1, 2].map(() => request('POST', '/admin/pricing/rules', admin.token, ruleDto, 'rule-publish')));
      assert.deepEqual(results.map(r => r.status), [201, 201]); assert.equal(results[0].data.id, results[1].data.id); ruleId = results[0].data.id;
      assert.equal((await request('POST', '/admin/pricing/rules', admin.token, { ...ruleDto, version: 2 }, 'rule-publish')).status, 409);
      assert.equal((await request('POST', '/admin/pricing/rules', admin.token, ruleDto, 'duplicate-version')).status, 409);
      assert.equal(await db.auditLog.count({ where: { action: 'PRICING_RULE_PUBLISHED', resourceId: ruleId } }), 1);
      const fee = await request('POST', '/admin/pricing/rules', admin.token, { ...ruleDto, name: `FEE_${suffix}`, definition: { kind: 'FEE', basis: 'PERCENT_SUBTOTAL', amount: '10', serviceId: service.id } }, 'fee'); assert.equal(fee.status, 201);
      assert.equal((await quote()).data.total, '24.5');
      const future = await request('POST', '/admin/pricing/rules', admin.token, { ...ruleDto, version: 2, startsAt: endsAt, endsAt: new Date(Date.now() + 7200000).toISOString(), definition: { ...ruleDto.definition, amount: '9' } }, 'future'); assert.equal(future.status, 201);
      assert.equal((await quote()).data.total, '24.5');
      assert.equal((await request('GET', '/admin/pricing/rules?limit=1', admin.token)).data.length, 1);
    });
    await t.test('promotions enforce eligibility; quoting does not consume limited uses', async () => {
      assert.equal((await request('POST', '/admin/promotions', customer.token, promoDto, 'denied')).status, 403);
      const promo = await request('POST', '/admin/promotions', admin.token, promoDto, 'promotion'); assert.equal(promo.status, 201); promoId = promo.data.id;
      assert.equal((await request('POST', '/admin/promotions', admin.token, promoDto, 'promotion')).data.id, promoId);
      assert.equal((await quote({ ...inputs, promotionCode: 'UNKNOWN' })).status, 409);
      const ineligible = await request('POST', '/admin/promotions', admin.token, { ...promoDto, code: `MIN_${suffix}`, minTotal: '100' }, 'min'); assert.equal(ineligible.status, 201);
      assert.equal((await quote({ ...inputs, promotionCode: ineligible.data.code })).status, 409);
      const expired = await request('POST', '/admin/promotions', admin.token, { ...promoDto, code: `OLD_${suffix}`, startsAt: new Date(Date.now() - 120000).toISOString(), endsAt: new Date(Date.now() - 60000).toISOString() }, 'expired'); assert.equal(expired.status, 201);
      assert.equal((await quote({ ...inputs, promotionCode: expired.data.code })).status, 409);
      const results = await Promise.all([1, 2].map(() => quote({ ...inputs, promotionCode: promoDto.code }, 'quote-idempotent')));
      assert.deepEqual(results.map(r => r.status), [201, 201]); assert.equal(results[0].data.quoteId, results[1].data.quoteId);
      pricedQuote = results[0].data; pricedQuote2 = (await quote({ ...inputs, promotionCode: promoDto.code })).data;
      assert.equal(pricedQuote.total, '21.5'); assert.equal(pricedQuote.discount, '3');
      assert.equal((await db.promotion.findUniqueOrThrow({ where: { id: promoId } })).uses, 0);
      assert.equal((await quote(inputs, 'quote-idempotent')).status, 409);
    });
    await t.test('quote payload, published rule and promotion terms are immutable in PostgreSQL', async () => {
      await assert.rejects(db.pricingQuote.update({ where: { id: pricedQuote.quoteId }, data: { snapshot: {} } }));
      await assert.rejects(db.pricingQuote.delete({ where: { id: pricedQuote.quoteId } }));
      await assert.rejects(db.pricingRule.update({ where: { id: ruleId }, data: { definition: {} } }));
      await assert.rejects(db.promotion.update({ where: { id: promoId }, data: { discount: '99' } }));
    });
    await t.test('new versions and catalog edits leave quoted values and historical extras intact', async () => {
      const next = await request('POST', '/admin/pricing/rules', admin.token, { ...ruleDto, version: 3, definition: { ...ruleDto.definition, amount: '0.20' } }, 'version3'); assert.equal(next.status, 201);
      await db.service.update({ where: { id: service.id }, data: { basePrice: '20', durationMinutes: 90 } });
      await db.serviceExtra.update({ where: { id: extra.id }, data: { price: '9' } });
      await db.address.update({ where: { id: address.id }, data: { addressText: 'Changed address' } });
      assert.equal((await quote()).data.total, '57.8');
      assert.equal((await request('GET', `/bookings/quotes/${pricedQuote.quoteId}`, customer.token)).data.total, '21.5');
      assert.equal((await book(pricedQuote.quoteId, 'tamper', { total: '1', promotionCode: promoDto.code })).status, 400);
      assert.equal((await book(pricedQuote.quoteId, 'mismatch', { extras: [], promotionCode: promoDto.code })).error.code, 'QUOTE_INPUT_MISMATCH');
      const races = await Promise.all([book(pricedQuote.quoteId, 'redeem-one', { promotionCode: promoDto.code }), book(pricedQuote2.quoteId, 'redeem-two', { promotionCode: promoDto.code })]);
      assert.deepEqual(races.map(r => r.status).sort(), [201, 409]); created = races.find(r => r.status === 201)!.data;
      assert.equal(created.price, '21.5'); assert.equal(created.priceSnapshot.adjustments, '8'); assert.equal(created.extras[0].price, '2.5'); assert.equal(created.serviceSnapshot.durationMinutes, 60); assert.equal(created.addressSnapshot.addressText, 'Quoted address');
      assert.equal(created.status, 'REQUESTED'); assert.equal(created.payments.length, 0);
      assert.equal((await db.promotion.findUniqueOrThrow({ where: { id: promoId } })).uses, 1);
      const winner = races[0].status === 201 ? [pricedQuote.quoteId, 'redeem-one'] : [pricedQuote2.quoteId, 'redeem-two'];
      assert.equal((await book(winner[0], winner[1], { promotionCode: promoDto.code })).data.id, created.id);
      assert.equal((await book(winner[0], 'used-again', { promotionCode: promoDto.code })).error.code, 'QUOTE_ALREADY_USED');
      assert.equal((await request('POST', `/bookings/${created.id}/confirm`, customer.token, undefined, 'confirm')).data.status, 'PRICE_CONFIRMED');
      assert.equal((await request('POST', `/bookings/${created.id}/select-cash`, customer.token, undefined, 'cash')).data.status, 'CASH_SELECTED');
      assert.equal((await db.payment.findFirstOrThrow({ where: { bookingId: created.id } })).amount.toString(), '21.5');
      assert.equal(await db.quoteConsumption.count({ where: { bookingId: created.id } }), 1);
      await assert.rejects(db.quoteConsumption.delete({ where: { bookingId: created.id } }));
      await assert.rejects(db.bookingPriceSnapshot.update({ where: { bookingId: created.id }, data: { total: '0' } }));
    });
    await t.test('one quote cannot produce two bookings; same-key concurrent retries replay once', async () => {
      const q = (await quote()).data;
      const results = await Promise.all([book(q.quoteId, 'same-create'), book(q.quoteId, 'same-create')]);
      assert.deepEqual(results.map(r => r.status), [201, 201]); assert.equal(results[0].data.id, results[1].data.id);
      const q2 = (await quote()).data;
      const different = await Promise.all([book(q2.quoteId, 'different-a'), book(q2.quoteId, 'different-b')]);
      assert.deepEqual(different.map(r => r.status).sort(), [201, 409]);
      const foreign = await request('POST', '/bookings', other.token, { ...inputs, quoteId: q.quoteId, scheduledAt: '2027-06-01T10:00:00Z' }, 'foreign'); assert.equal(foreign.status, 404);
    });
    await t.test('expired quotes and revoked promotions reject consumption without booking or usage writes', async () => {
      const q = (await quote()).data;
      const saved = await db.pricingQuote.findUniqueOrThrow({ where: { id: q.quoteId } });
      // Insert a historical fixture; never disable immutable-history protections.
      const expired = await db.pricingQuote.create({ data: { customerId: saved.customerId, snapshot: saved.snapshot as any, createdAt: new Date(Date.now() - 600000), expiresAt: new Date(Date.now() - 300000) } });
      assert.equal((await book(expired.id, 'expired-quote')).error.code, 'QUOTE_EXPIRED');
      assert.equal(await db.quoteConsumption.count({ where: { quoteId: expired.id } }), 0);
      const promo = await request('POST', '/admin/promotions', admin.token, { ...promoDto, code: `REVOKE_${suffix}`, maxUses: 2, discount: '999' }, 'revoke-promo'); assert.equal(promo.status, 201);
      const capped = await quote({ ...inputs, promotionCode: promo.data.code }); assert.equal(capped.data.total, '0');
      assert.equal((await request('POST', `/admin/promotions/${promo.data.id}/activation`, admin.token, { active: false }, 'deactivate')).status, 200);
      assert.equal((await book(capped.data.quoteId, 'revoked', { promotionCode: promo.data.code })).error.code, 'PROMOTION_UNAVAILABLE');
      assert.equal((await db.promotion.findUniqueOrThrow({ where: { id: promo.data.id } })).uses, 0);
    });
    await t.test('omitting quoteId still evaluates current rules, and inactive sources fail closed', async () => {
      const result = await request('POST', '/bookings', customer.token, { ...inputs, scheduledAt: '2027-06-02T10:00:00Z' }, 'no-quote'); assert.equal(result.status, 201); assert.equal(result.data.price, '57.8');
      const q = (await quote()).data;
      await db.serviceExtra.update({ where: { id: extra.id }, data: { active: false } });
      assert.equal((await quote()).status, 404); assert.equal((await book(q.quoteId, 'inactive')).status, 404);
      assert.equal(await db.quoteConsumption.count({ where: { quoteId: q.quoteId } }), 0);
      await db.serviceExtra.update({ where: { id: extra.id }, data: { active: true } });
    });
    await t.test('activation, expired rules and racing version publication preserve deterministic selection', async () => {
      const version3 = await db.pricingRule.findUniqueOrThrow({ where: { name_version: { name: ruleDto.name, version: 3 } } });
      assert.equal((await request('POST', `/admin/pricing/rules/${version3.id}/activation`, admin.token, { active: false }, 'rule-disable')).status, 200);
      assert.equal((await quote()).data.total, '49.8');
      assert.equal((await request('POST', `/admin/pricing/rules/${version3.id}/activation`, admin.token, { active: true }, 'rule-enable')).status, 200);
      const expiredRule = { ...ruleDto, name: `EXPIRED_${suffix}`, startsAt: new Date(Date.now() - 120000).toISOString(), endsAt: new Date(Date.now() - 60000).toISOString() };
      assert.equal((await request('POST', '/admin/pricing/rules', admin.token, expiredRule, 'expired-rule')).status, 201);
      const racingDto = { ...ruleDto, name: `RACE_${suffix}`, definition: { ...ruleDto.definition, amount: '0' } };
      const results = await Promise.all(['rule-a', 'rule-b'].map(key => request('POST', '/admin/pricing/rules', admin.token, racingDto, key)));
      assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
      assert.equal((await quote()).data.total, '57.8');
      assert.equal((await request('GET', '/admin/promotions?limit=1', admin.token)).data.length, 1);
      assert.equal((await request('GET', '/admin/promotions', dispatcher.token)).status, 403);
    });
    await t.test('a failure after redemption rolls back booking, usage, consumption, history and idempotency', async () => {
      const promo = await request('POST', '/admin/promotions', admin.token, { ...promoDto, code: `ROLLBACK_${suffix}`, maxUses: 2 }, 'rollback-promo'); assert.equal(promo.status, 201);
      const q = (await quote({ ...inputs, promotionCode: promo.data.code })).data;
      const bookingsBefore = await db.booking.count({ where: { customerId: customer.customer.id } });
      const auditBefore = await db.auditLog.count({ where: { action: 'PROMOTION_REDEEMED', resourceId: promo.data.id } });
      // Fault only this test customer's final audit insert. Always remove the injected trigger.
      assert.match(new URL(process.env.DATABASE_URL!).searchParams.get('schema')!, /^test_[a-f0-9]{32}$/);
      await db.$executeRawUnsafe(`CREATE FUNCTION pricing_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'BOOKING_CREATED' AND NEW."actorUserId" = '${customer.user.id}'::uuid THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END; $$;`);
      try {
        await db.$executeRawUnsafe('CREATE TRIGGER pricing_test_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION pricing_test_audit_failure()');
        const failed = await book(q.quoteId, 'rollback-book', { promotionCode: promo.data.code }); assert.equal(failed.status, 500);
      } finally {
        await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS pricing_test_audit_failure ON "AuditLog"');
        await db.$executeRawUnsafe('DROP FUNCTION pricing_test_audit_failure()');
      }
      assert.equal((await db.promotion.findUniqueOrThrow({ where: { id: promo.data.id } })).uses, 0);
      assert.equal(await db.quoteConsumption.count({ where: { quoteId: q.quoteId } }), 0);
      assert.equal(await db.booking.count({ where: { customerId: customer.customer.id } }), bookingsBefore);
      assert.equal(await db.auditLog.count({ where: { action: 'PROMOTION_REDEEMED', resourceId: promo.data.id } }), auditBefore);
      assert.equal(await db.idempotencyKey.count({ where: { userId: customer.user.id, operation: 'BOOKING_CREATE', key: 'rollback-book' } }), 0);
      assert.equal((await book(q.quoteId, 'rollback-book', { promotionCode: promo.data.code })).status, 201);
      assert.equal((await db.promotion.findUniqueOrThrow({ where: { id: promo.data.id } })).uses, 1);
    });
    await t.test('inline concurrent promotion redemption and full-length idempotency keys work', async () => {
      const promo = await request('POST', '/admin/promotions', admin.token, { ...promoDto, code: `INLINE_${suffix}` }, 'inline-promo'); assert.equal(promo.status, 201);
      const results = await Promise.all(['inline-a', 'inline-b'].map(key => request('POST', '/bookings', customer.token, { ...inputs, promotionCode: promo.data.code, scheduledAt: '2027-06-03T10:00:00Z' }, key)));
      assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
      const q = (await quote()).data;
      assert.equal((await book(q.quoteId, 'x'.repeat(128))).status, 201);
      assert.equal((await book(q.quoteId, 'x'.repeat(128))).status, 201);
    });
  } finally { await app.close(); }
});

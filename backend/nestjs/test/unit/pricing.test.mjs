import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { calculateCatalogQuote } from '../../dist/pricing/pricing.calculation.js';
import 'reflect-metadata';
import { evaluateRules, validateRule } from '../../dist/pricing/pricing.rules.js';

const property = { type: 'APARTMENT', size: '80', rooms: 2, bathrooms: 1 };
const catalog = () => calculateCatalogQuote({ id: '00000000-0000-4000-8000-000000000001', basePrice: '10' }, [{ id: 'extra', name: 'Extra', price: '2.5', quantity: 2 }]);
const rule = (basis, amount, overrides = {}) => ({ id: basis, name: basis, version: 1, definition: { kind: 'ADJUSTMENT', basis, amount, ...overrides } });

test('all rule bases use decimal arithmetic and round each line half up', () => {
  const result = evaluateRules(catalog(), property, 60, [rule('FIXED', '1'), rule('PER_SIZE', '0.10'), rule('PER_ROOM', '2'), rule('PER_BATHROOM', '3'), rule('PER_MINUTE', '0.01'), rule('PERCENT_SUBTOTAL', '2.5', { kind: 'FEE' })]);
  assert.equal(result.adjustments.toString(), '16.6');
  assert.equal(result.fees.toString(), '0.38');
  assert.equal(result.subtotal.toString(), '31.98');
});

test('rule ordering is deterministic, only latest version applies, percentages never compound', () => {
  const old = rule('FIXED', '99');
  const next = { ...rule('FIXED', '-1'), version: 2 };
  const pct = rule('PERCENT_SUBTOTAL', '10', { kind: 'FEE' });
  const a = evaluateRules(catalog(), property, 60, [old, next, pct]);
  const b = evaluateRules(catalog(), property, 60, [pct, next, old]);
  assert.equal(a.subtotal.toString(), '15.5');
  assert.equal(a.pricingVersion, b.pricingVersion);
  assert.deepEqual(a.lines, b.lines);
});

test('property/service predicates and inclusive size bounds filter rules', () => {
  assert.equal(evaluateRules(catalog(), property, 60, [rule('FIXED', '2', { minSize: '80', maxSize: '80' })]).subtotal.toString(), '17');
  for (const condition of [{ propertyType: 'VILLA' }, { minSize: '81' }, { maxSize: '79' }, { serviceId: '00000000-0000-4000-8000-000000000002' }]) {
    assert.equal(evaluateRules(catalog(), property, 60, [rule('FIXED', '2', condition)]).subtotal.toString(), '15');
  }
});

test('invalid rule definitions, negative fees and unsafe totals fail closed', () => {
  for (const definition of [null, [], {}, { ...rule('FIXED', '1').definition, expression: 'process.exit()' }, rule('FIXED', '-1', { kind: 'FEE' }).definition, rule('FIXED', '1', { minSize: '20', maxSize: '10' }).definition, rule('FIXED', 'NaN').definition]) {
    assert.throws(() => validateRule(definition), error => error.getStatus?.() === 400);
  }
  for (const amount of ['-100', '9999999999.99']) assert.throws(() => evaluateRules(catalog(), property, 60, [rule('FIXED', amount)]), error => error.getStatus?.() === 400);
});

test('catalog pricing is deterministic and follows the documented formula', () => {
  const quote = calculateCatalogQuote(
    { id: 'service-1', basePrice: '10.00' },
    [{ id: 'extra-1', name: 'Windows', price: '2.50', quantity: 2 }],
  );
  assert.equal(quote.pricingVersion, 'catalog-v1');
  assert.equal(quote.basePrice.toString(), '10');
  assert.equal(quote.extrasTotal.toString(), '5');
  assert.equal(quote.total.toString(), '15');
  assert.equal(quote.breakdown.extras[0].lineTotal, '5');
  assert.equal(new Prisma.Decimal(quote.total).toString(), '15');
});

test('catalog pricing has zero adjustment, fee and discount until versioned rules are active', () => {
  const quote = calculateCatalogQuote({ id: 'service-1', basePrice: '10.00' }, []);
  assert.deepEqual({ adjustments: quote.adjustments.toString(), fees: quote.fees.toString(), discount: quote.discount.toString() }, { adjustments: '0', fees: '0', discount: '0' });
});

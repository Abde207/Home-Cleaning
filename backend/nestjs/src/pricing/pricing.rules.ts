import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { createHash } from 'node:crypto';
import { RuleDefinitionDto } from './pricing.dto.js';
import { calculateCatalogQuote } from './pricing.calculation.js';

type Rule = { id: string; name: string; version: number; definition: unknown };
export function validateRule(value: unknown): RuleDefinitionDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException({ code: 'PRICING_RULE_INVALID' });
  const definition = plainToInstance(RuleDefinitionDto, value);
  if (validateSync(definition, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException({ code: 'PRICING_RULE_INVALID' });
  if ((definition.kind === 'FEE' && new Prisma.Decimal(definition.amount).isNegative()) ||
    (definition.minSize !== undefined && definition.maxSize !== undefined && new Prisma.Decimal(definition.maxSize).lt(definition.minSize))) {
    throw new BadRequestException({ code: 'PRICING_RULE_INVALID' });
  }
  return definition;
}

export function boundedMoney(value: Prisma.Decimal, signed = false) {
  if (!value.isFinite() || (!signed && value.lt(0)) || value.abs().gt('9999999999.99')) throw new BadRequestException({ code: 'PRICING_AMOUNT_OUT_OF_RANGE' });
  return value;
}

/** Highest currently active version per name wins, then predicates are applied.
 * Each line rounds HALF_UP to the schema's two decimal places. Percentage rules
 * use base + extras; they never compound with other rules or depend on order. */
export function evaluateRules(catalog: ReturnType<typeof calculateCatalogQuote>, property: { type: string; size: string; rooms: number; bathrooms: number }, durationMinutes: number, rules: Rule[]) {
  boundedMoney(catalog.basePrice); boundedMoney(catalog.extrasTotal);
  const latest = new Map<string, Rule>();
  for (const rule of rules) if (!latest.has(rule.name) || latest.get(rule.name)!.version < rule.version) latest.set(rule.name, rule);
  const lines: { id: string; name: string; version: number; definition: RuleDefinitionDto; amount: string }[] = [];
  let adjustments = new Prisma.Decimal(0), fees = new Prisma.Decimal(0);
  for (const rule of [...latest.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const d = validateRule(rule.definition);
    if ((d.serviceId && d.serviceId !== catalog.breakdown.serviceId) || (d.propertyType && d.propertyType !== property.type) ||
      (d.minSize !== undefined && new Prisma.Decimal(property.size).lt(d.minSize)) || (d.maxSize !== undefined && new Prisma.Decimal(property.size).gt(d.maxSize))) continue;
    const factor = { FIXED: new Prisma.Decimal(1), PER_SIZE: new Prisma.Decimal(property.size), PER_ROOM: new Prisma.Decimal(property.rooms), PER_BATHROOM: new Prisma.Decimal(property.bathrooms), PER_MINUTE: new Prisma.Decimal(durationMinutes), PERCENT_SUBTOTAL: catalog.basePrice.add(catalog.extrasTotal).div(100) }[d.basis];
    const amount = boundedMoney(new Prisma.Decimal(d.amount).mul(factor).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP), d.kind === 'ADJUSTMENT');
    if (d.kind === 'ADJUSTMENT') adjustments = adjustments.add(amount); else fees = fees.add(amount);
    lines.push({ id: rule.id, name: rule.name, version: rule.version, definition: d, amount: amount.toString() });
  }
  boundedMoney(adjustments, true); boundedMoney(fees);
  const subtotal = boundedMoney(catalog.basePrice.add(catalog.extrasTotal).add(adjustments).add(fees));
  const pricingVersion = lines.length ? `rules-v1:${createHash('sha256').update(JSON.stringify(lines)).digest('hex')}` : catalog.pricingVersion;
  return { adjustments, fees, subtotal, lines, pricingVersion };
}

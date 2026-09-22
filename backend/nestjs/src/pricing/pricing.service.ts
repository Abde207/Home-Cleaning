import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PricingQuote } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import { audit, auditJson, type CoreContext } from '../core/core.policy.js';
import type { QuoteRequestDto } from './pricing.dto.js';
import { calculateCatalogQuote } from './pricing.calculation.js';
import { boundedMoney, evaluateRules } from './pricing.rules.js';
import { canonical, pricingWrite } from './pricing.transaction.js';

export type QuoteSnapshot = {
  inputs: { serviceId: string; propertyId: string; addressId: string; extras: { serviceExtraId: string; quantity: number }[]; promotionCode?: string };
  service: { id: string; code: string; name: string; nameAr: string; description: string | null; basePrice: string; durationMinutes: number };
  property: { id: string; type: string; size: string; rooms: number; bathrooms: number };
  address: { id: string; label: string; addressText: string; latitude: string; longitude: string };
  extras: { serviceExtraId: string; name: string; quantity: number; price: string }[];
  price: { pricingVersion: string; basePrice: string; extrasTotal: string; adjustments: string; fees: string; discount: string; total: string; currency: string; breakdown: Prisma.InputJsonObject };
  lines: ReturnType<typeof evaluateRules>['lines'];
  promotion: { id: string; code: string; discount: string; minTotal: string } | null;
};

const normalizedInputs = (dto: QuoteRequestDto) => ({ serviceId: dto.serviceId, propertyId: dto.propertyId, addressId: dto.addressId, extras: [...dto.extras].sort((a, b) => a.serviceExtraId.localeCompare(b.serviceExtraId)), ...(dto.promotionCode ? { promotionCode: dto.promotionCode } : {}) });

@Injectable()
export class PricingService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async customerId(tx: Prisma.TransactionClient, userId: string) {
    const customer = await tx.customer.findUnique({ where: { userId }, select: { id: true } });
    if (!customer) throw new NotFoundException();
    return customer.id;
  }
  private async sources(tx: Prisma.TransactionClient, customerId: string, dto: QuoteRequestDto) {
    await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${dto.serviceId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${dto.propertyId}::uuid AND "customerId" = ${customerId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "Address" WHERE id = ${dto.addressId}::uuid AND "customerId" = ${customerId}::uuid FOR SHARE`;
    for (const extra of normalizedInputs(dto).extras) await tx.$queryRaw`SELECT id FROM "ServiceExtra" WHERE id = ${extra.serviceExtraId}::uuid AND "serviceId" = ${dto.serviceId}::uuid FOR SHARE`;
    const service = await tx.service.findFirst({ where: { id: dto.serviceId, active: true }, select: { id: true, code: true, name: true, nameAr: true, description: true, basePrice: true, durationMinutes: true } });
    const property = await tx.property.findFirst({ where: { id: dto.propertyId, customerId, archivedAt: null }, select: { id: true, type: true, size: true, rooms: true, bathrooms: true } });
    const address = await tx.address.findFirst({ where: { id: dto.addressId, customerId, archivedAt: null }, select: { id: true, label: true, addressText: true, latitude: true, longitude: true } });
    const ids = dto.extras.map(e => e.serviceExtraId);
    const extras = await tx.serviceExtra.findMany({ where: { id: { in: ids }, serviceId: dto.serviceId, active: true }, select: { id: true, name: true, price: true } });
    if (!service || !property || !address || extras.length !== ids.length) throw new NotFoundException();
    return { service, property, address, extras };
  }
  quote(req: CoreContext, dto: QuoteRequestDto, key?: string) {
    return pricingWrite(this.db, req, key, 'PRICING_QUOTE', normalizedInputs(dto), async tx => {
      const customerId = await this.customerId(tx, req.actor.userId);
      return this.response(await this.issue(tx, req, customerId, dto));
    }, true);
  }
  async detail(req: CoreContext, id: string) {
    const quote = await this.db.pricingQuote.findFirst({ where: { id, customer: { userId: req.actor.userId } } });
    if (!quote) throw new NotFoundException();
    return this.response(quote);
  }
  response(quote: PricingQuote) {
    const s = quote.snapshot as unknown as QuoteSnapshot;
    return {
      quoteId: quote.id, pricingVersion: s.price.pricingVersion, basePrice: s.price.basePrice, extrasTotal: s.price.extrasTotal,
      extras: s.extras.map(e => ({ serviceExtraId: e.serviceExtraId, name: e.name, quantity: e.quantity, unitPrice: e.price, lineTotal: new Prisma.Decimal(e.price).mul(e.quantity).toString() })),
      adjustments: s.lines.filter(l => l.definition.kind === 'ADJUSTMENT').map(l => ({ name: l.name, version: l.version, amount: l.amount })),
      fees: s.lines.filter(l => l.definition.kind === 'FEE').map(l => ({ name: l.name, version: l.version, amount: l.amount })),
      discount: s.price.discount, total: s.price.total, currency: s.price.currency, promotion: s.promotion ? { code: s.promotion.code, discount: s.price.discount } : null,
      createdAt: quote.createdAt, expiresAt: quote.expiresAt, inputs: s.inputs,
    };
  }
  async issue(tx: Prisma.TransactionClient, req: CoreContext, customerId: string, dto: QuoteRequestDto) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext('pricing-config'))`;
    const source = await this.sources(tx, customerId, dto);
    const inputs = normalizedInputs(dto);
    const byId = new Map(source.extras.map(e => [e.id, e]));
    const catalog = calculateCatalogQuote(source.service, inputs.extras.map(e => ({ ...byId.get(e.serviceExtraId)!, quantity: e.quantity })));
    const now = new Date();
    const rules = await tx.pricingRule.findMany({ where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } });
    const evaluated = evaluateRules(catalog, { ...source.property, size: source.property.size.toString() }, source.service.durationMinutes, rules);
    let discount = new Prisma.Decimal(0);
    let promotion: QuoteSnapshot['promotion'] = null;
    let expiresAt = new Date(now.getTime() + 5 * 60_000);
    if (dto.promotionCode) {
      await tx.$queryRaw`SELECT id FROM "Promotion" WHERE code = ${dto.promotionCode} FOR UPDATE`;
      const p = await tx.promotion.findUnique({ where: { code: dto.promotionCode } });
      if (!p || !p.active || p.startsAt > now || p.endsAt <= now || (p.maxUses !== null && p.uses >= p.maxUses) || evaluated.subtotal.lt(p.minTotal)) throw new ConflictException({ code: 'PROMOTION_UNAVAILABLE' });
      discount = Prisma.Decimal.min(p.discount, evaluated.subtotal);
      promotion = { id: p.id, code: p.code, discount: p.discount.toString(), minTotal: p.minTotal.toString() };
      if (p.endsAt < expiresAt) expiresAt = p.endsAt;
    }
    const snapshot: QuoteSnapshot = {
      inputs,
      service: { ...source.service, basePrice: source.service.basePrice.toString() },
      property: { ...source.property, size: source.property.size.toString() },
      address: { ...source.address, latitude: source.address.latitude.toString(), longitude: source.address.longitude.toString() },
      extras: catalog.bookingExtras.map(e => ({ serviceExtraId: e.serviceExtraId, name: e.name, quantity: e.quantity, price: new Prisma.Decimal(e.price).toString() })),
      price: { pricingVersion: evaluated.pricingVersion, basePrice: catalog.basePrice.toString(), extrasTotal: catalog.extrasTotal.toString(), adjustments: evaluated.adjustments.toString(), fees: evaluated.fees.toString(), discount: discount.toString(), total: boundedMoney(evaluated.subtotal.sub(discount)).toString(), currency: catalog.currency, breakdown: auditJson({ ...catalog.breakdown, rules: evaluated.lines, promotion, rounding: 'HALF_UP_2DP', percentageBasis: 'BASE_PLUS_EXTRAS' }) },
      lines: evaluated.lines, promotion,
    };
    const quote = await tx.pricingQuote.create({ data: { customerId, promotionId: promotion?.id, snapshot: auditJson(snapshot), createdAt: now, expiresAt } });
    await audit(tx, req, 'PRICING_QUOTE_ISSUED', 'PricingQuote', quote.id, { pricingVersion: snapshot.price.pricingVersion, total: snapshot.price.total, expiresAt });
    return quote;
  }
  /** Called inside Booking's idempotent transaction; never changes Booking state. */
  async forBooking(tx: Prisma.TransactionClient, req: CoreContext, customerId: string, dto: QuoteRequestDto & { quoteId?: string }) {
    const quote = dto.quoteId
      ? await (async () => {
        await tx.$queryRaw`SELECT id FROM "PricingQuote" WHERE id = ${dto.quoteId}::uuid AND "customerId" = ${customerId}::uuid FOR UPDATE`;
        const saved = await tx.pricingQuote.findFirst({ where: { id: dto.quoteId, customerId } });
        if (!saved) throw new NotFoundException();
        await this.sources(tx, customerId, dto);
        return saved;
      })()
      : await this.issue(tx, req, customerId, dto);
    const snapshot = quote.snapshot as unknown as QuoteSnapshot;
    if (canonical(snapshot.inputs) !== canonical(normalizedInputs(dto))) throw new ConflictException({ code: 'QUOTE_INPUT_MISMATCH' });
    if (await tx.quoteConsumption.findUnique({ where: { quoteId: quote.id } })) throw new ConflictException({ code: 'QUOTE_ALREADY_USED' });
    if (quote.promotionId) {
      await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${quote.promotionId}::uuid FOR UPDATE`;
      const p = await tx.promotion.findUniqueOrThrow({ where: { id: quote.promotionId } });
      const now = new Date();
      if (!p.active || p.startsAt > now || p.endsAt <= now || (p.maxUses !== null && p.uses >= p.maxUses)) throw new ConflictException({ code: 'PROMOTION_UNAVAILABLE' });
      await tx.promotion.update({ where: { id: p.id }, data: { uses: { increment: 1 } } });
      await audit(tx, req, 'PROMOTION_REDEEMED', 'Promotion', p.id, { uses: p.uses + 1, quoteId: quote.id }, { uses: p.uses });
    }
    if (quote.expiresAt <= new Date()) throw new ConflictException({ code: 'QUOTE_EXPIRED' });
    return { quote, snapshot };
  }
}

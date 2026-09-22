import { Prisma } from '@prisma/client';

export type CatalogPricingService = { id: string; basePrice: Prisma.Decimal | string };
export type CatalogPricingExtra = { id: string; name: string; price: Prisma.Decimal | string; quantity: number };

/**
 * Catalog baseline reused by the rule evaluator. Money stays in Decimal;
 * versioned adjustments, fees and promotions are applied after this step.
 */
export function calculateCatalogQuote(service: CatalogPricingService, extras: CatalogPricingExtra[]) {
  const basePrice = new Prisma.Decimal(service.basePrice);
  let extrasTotal = new Prisma.Decimal(0);
  const bookingExtras = extras.map(extra => {
    const unitPrice = new Prisma.Decimal(extra.price);
    const lineTotal = unitPrice.mul(extra.quantity);
    extrasTotal = extrasTotal.add(lineTotal);
    return { serviceExtraId: extra.id, name: extra.name, quantity: extra.quantity, price: extra.price, unitPrice, lineTotal };
  });
  const adjustments = new Prisma.Decimal(0);
  const fees = new Prisma.Decimal(0);
  const discount = new Prisma.Decimal(0);
  const total = basePrice.add(extrasTotal).add(adjustments).add(fees).sub(discount);
  const breakdown = {
    source: 'catalog',
    serviceId: service.id,
    extras: bookingExtras.map(extra => ({ serviceExtraId: extra.serviceExtraId, quantity: extra.quantity, unitPrice: new Prisma.Decimal(extra.unitPrice).toString(), lineTotal: extra.lineTotal.toString() })),
  };
  return { pricingVersion: 'catalog-v1', basePrice, extrasTotal, adjustments, fees, discount, total, currency: 'JOD', bookingExtras, breakdown };
}

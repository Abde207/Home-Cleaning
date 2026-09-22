import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/database.module.js';
import { audit, auditJson, type CoreContext } from '../core/core.policy.js';
import type { ListQueryDto } from '../core/core.dto.js';
import type { PublishPromotionDto, PublishRuleDto } from './pricing.dto.js';
import { validateRule } from './pricing.rules.js';
import { pricingWrite } from './pricing.transaction.js';

@Injectable()
export class PricingAdminService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  rules(page: ListQueryDto) { return this.db.pricingRule.findMany({ orderBy: [{ name: 'asc' }, { version: 'desc' }], take: page.limit, skip: page.offset }); }
  promotions(page: ListQueryDto) { return this.db.promotion.findMany({ orderBy: { code: 'asc' }, take: page.limit, skip: page.offset }); }
  publishRule(req: CoreContext, dto: PublishRuleDto, key?: string) {
    const definition = validateRule(dto.definition);
    const startsAt = new Date(dto.startsAt), endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt <= startsAt) throw new BadRequestException({ code: 'PRICING_WINDOW_INVALID' });
    return pricingWrite(this.db, req, key, 'PRICING_RULE_PUBLISH', dto, async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pricing-config'))`;
      const latest = await tx.pricingRule.findFirst({ where: { name: dto.name }, orderBy: { version: 'desc' } });
      if (latest && latest.version >= dto.version) throw new ConflictException({ code: 'PRICING_VERSION_NOT_INCREASING' });
      if (definition.serviceId) await tx.service.findUniqueOrThrow({ where: { id: definition.serviceId } });
      const rule = await tx.pricingRule.create({ data: { name: dto.name, version: dto.version, definition: auditJson(definition), active: dto.active, startsAt, endsAt } });
      await audit(tx, req, 'PRICING_RULE_PUBLISHED', 'PricingRule', rule.id, rule);
      return rule;
    });
  }
  publishPromotion(req: CoreContext, dto: PublishPromotionDto, key?: string) {
    const startsAt = new Date(dto.startsAt), endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException({ code: 'PRICING_WINDOW_INVALID' });
    return pricingWrite(this.db, req, key, 'PROMOTION_PUBLISH', dto, async tx => {
      const promotion = await tx.promotion.create({ data: { ...dto, startsAt, endsAt } });
      await audit(tx, req, 'PROMOTION_PUBLISHED', 'Promotion', promotion.id, promotion);
      return promotion;
    });
  }
  activation(req: CoreContext, id: string, active: boolean, kind: 'rule' | 'promotion', key?: string) {
    return pricingWrite(this.db, req, key, `PRICING_${kind}_ACTIVATION`, { id, active }, async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pricing-config'))`;
      if (kind === 'rule') {
        await tx.$queryRaw`SELECT id FROM "PricingRule" WHERE id = ${id}::uuid FOR UPDATE`;
        const before = await tx.pricingRule.findUniqueOrThrow({ where: { id } });
        if (active) validateRule(before.definition);
        const after = await tx.pricingRule.update({ where: { id }, data: { active } });
        await audit(tx, req, 'PRICING_RULE_ACTIVATION', 'PricingRule', id, after, before);
        return after;
      }
      await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.promotion.findUniqueOrThrow({ where: { id } });
      const after = await tx.promotion.update({ where: { id }, data: { active } });
      await audit(tx, req, 'PROMOTION_ACTIVATION', 'Promotion', id, after, before);
      return after;
    });
  }
}

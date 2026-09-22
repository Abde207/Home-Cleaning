import { ListQueryDto } from './core.dto.js';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/database.module.js';
import type { ServiceDto, ServiceExtraDto } from './core.dto.js';
import { audit, type CoreContext } from './core.policy.js';
import { serviceSelect, extraSelect } from './core.projections.js';

@Injectable()
export class AdminCatalogService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  list(page: ListQueryDto = new ListQueryDto()) { return this.db.service.findMany({ select: serviceSelect, take: page.limit, skip: page.offset, orderBy: { code: 'asc' } }); }
  async extras(id: string, page: ListQueryDto = new ListQueryDto()) {
    await this.db.service.findUniqueOrThrow({ where: { id }, select: { id: true } });
    return this.db.serviceExtra.findMany({ where: { serviceId: id }, select: extraSelect, take: page.limit, skip: page.offset, orderBy: { code: 'asc' } });
  }
  create(dto: ServiceDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      const service = await tx.service.create({ data: dto, select: serviceSelect });
      await audit(tx, req, 'SERVICE_CREATED', 'Service', service.id, service);
      return service;
    });
  }
  update(id: string, dto: ServiceDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.service.findUniqueOrThrow({ where: { id }, select: serviceSelect });
      const service = await tx.service.update({ where: { id }, data: dto, select: serviceSelect });
      await audit(tx, req, 'SERVICE_UPDATED', 'Service', id, service, before);
      return service;
    });
  }
  extra(id: string, dto: ServiceExtraDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      const extra = await tx.serviceExtra.create({ data: { ...dto, serviceId: id }, select: extraSelect });
      await audit(tx, req, 'SERVICE_EXTRA_CREATED', 'ServiceExtra', extra.id, { serviceId: id, ...extra });
      return extra;
    });
  }
  updateExtra(id: string, extraId: string, dto: ServiceExtraDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ServiceExtra" WHERE id = ${extraId}::uuid AND "serviceId" = ${id}::uuid FOR UPDATE`;
      const before = await tx.serviceExtra.findUniqueOrThrow({ where: { id: extraId, serviceId: id }, select: extraSelect });
      const extra = await tx.serviceExtra.update({ where: { id: extraId, serviceId: id }, data: dto, select: extraSelect });
      await audit(tx, req, 'SERVICE_EXTRA_UPDATED', 'ServiceExtra', extraId, { serviceId: id, ...extra }, before);
      return extra;
    });
  }
}

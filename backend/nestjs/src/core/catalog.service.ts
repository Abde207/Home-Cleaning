import { ListQueryDto } from './core.dto.js';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/database.module.js';
const projection = { id: true, code: true, name: true, nameAr: true, description: true, basePrice: true, durationMinutes: true, extras: { where: { active: true }, select: { id: true, name: true, nameAr: true, price: true } } } as const;
@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  list(page: ListQueryDto = new ListQueryDto()) { return this.db.service.findMany({ where: { active: true }, select: projection, orderBy: { code: 'asc' }, take: page.limit, skip: page.offset }); }
  async detail(id: string) {
    const service = await this.db.service.findFirst({ where: { id, active: true }, select: projection });
    if (!service) throw new NotFoundException();
    return service;
  }
}

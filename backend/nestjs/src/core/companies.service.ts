import { AdminCompanyQueryDto, ListQueryDto } from './core.dto.js';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import type { CompanyDto, CompanyProfileDto, ServiceAreaDto } from './core.dto.js';
import { audit, type CoreContext } from './core.policy.js';
import { adminCompanyDetailSelect, areaSelect, companySelect, providerCompanySelect } from './core.projections.js';

@Injectable()
export class CompaniesService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  list(page: AdminCompanyQueryDto = new AdminCompanyQueryDto()) {
    const query = page.query?.trim();
    return this.db.company.findMany({
      where: { ...(page.status ? { status: page.status } : {}), ...(query ? { OR: [{ internalCode: { contains: query, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }] } : {}) },
      select: companySelect, take: page.limit, skip: page.offset, orderBy: [{ internalCode: 'asc' }, { id: 'asc' }],
    });
  }
  async detail(id: string) {
    const company = await this.db.company.findUnique({ where: { id }, select: adminCompanyDetailSelect });
    if (!company) throw new NotFoundException();
    const [teams, activeTeams, activeManagers, openAssignments, unsettledPayables] = await Promise.all([
      this.db.team.count({ where: { companyId: id } }),
      this.db.team.count({ where: { companyId: id, active: true } }),
      this.db.userRole.count({ where: { companyId: id, teamId: null, role: { name: 'COMPANY_MANAGER' }, user: { status: 'ACTIVE' } } }),
      this.db.assignment.count({ where: { companyId: id, status: { in: ['OFFERED', 'ACCEPTED'] } } }),
      this.db.providerPayable.count({ where: { companyId: id, settlementItem: null } }),
    ]);
    return { ...company, counts: { teams, activeTeams, activeManagers, openAssignments, unsettledPayables } };
  }
  private scope(actor: Actor): Prisma.CompanyWhereInput {
    if (actor.scopes.some(s => s.permissions.includes('company:manage') || s.permissions.includes('company:read'))) return {};
    const ids = actor.scopes.filter(s => s.role === 'COMPANY_MANAGER' && s.companyId && s.permissions.includes('company:own')).map(s => s.companyId!);
    if (!ids.length) throw new ForbiddenException();
    return { id: { in: ids } };
  }
  visible(actor: Actor, page: ListQueryDto = new ListQueryDto()) {
    return this.db.company.findMany({ where: this.scope(actor), select: providerCompanySelect, take: page.limit, skip: page.offset, orderBy: { id: 'asc' } });
  }
  async visibleAreas(id: string, actor: Actor, page: ListQueryDto = new ListQueryDto()) {
    if (!await this.db.company.findFirst({ where: { AND: [{ id }, this.scope(actor)] }, select: { id: true } })) throw new NotFoundException();
    return this.areas(id, page);
  }
  async areas(id: string, page: ListQueryDto = new ListQueryDto()) {
    await this.db.company.findUniqueOrThrow({ where: { id }, select: { id: true } });
    return this.db.companyServiceArea.findMany({ where: { companyId: id }, select: areaSelect, take: page.limit, skip: page.offset, orderBy: { id: 'asc' } });
  }
  profile(id: string, dto: CompanyProfileDto, req: CoreContext) {
    if (!req.actor.scopes.some(s => s.permissions.includes('company:manage') ||
      (s.role === 'COMPANY_MANAGER' && s.companyId === id && s.permissions.includes('company:own')))) throw new NotFoundException();
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.company.findUniqueOrThrow({ where: { id }, select: providerCompanySelect });
      const result = await tx.company.update({ where: { id }, data: { name: dto.name }, select: providerCompanySelect });
      await audit(tx, req, 'COMPANY_PROFILE_UPDATED', 'Company', id, result, before);
      return result;
    });
  }
  create(dto: CompanyDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      const company = await tx.company.create({ data: dto, select: companySelect });
      await audit(tx, req, 'COMPANY_CREATED', 'Company', company.id, company);
      return company;
    });
  }
  update(id: string, dto: CompanyDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.company.findUniqueOrThrow({ where: { id }, select: companySelect });
      const company = await tx.company.update({ where: { id }, data: dto, select: companySelect });
      await audit(tx, req, 'COMPANY_UPDATED', 'Company', id, company, before);
      return company;
    });
  }
  area(id: string, dto: ServiceAreaDto, req: CoreContext) {
    if (new Prisma.Decimal(dto.radiusKm).lte(0)) throw new BadRequestException();
    return this.db.$transaction(async tx => {
      const area = await tx.companyServiceArea.create({ data: { ...dto, companyId: id }, select: areaSelect });
      await audit(tx, req, 'SERVICE_AREA_CREATED', 'CompanyServiceArea', area.id, { companyId: id, ...area });
      return area;
    });
  }
  updateArea(id: string, areaId: string, dto: ServiceAreaDto, req: CoreContext) {
    if (new Prisma.Decimal(dto.radiusKm).lte(0)) throw new BadRequestException();
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "CompanyServiceArea" WHERE id = ${areaId}::uuid AND "companyId" = ${id}::uuid FOR UPDATE`;
      const before = await tx.companyServiceArea.findUniqueOrThrow({ where: { id: areaId, companyId: id }, select: areaSelect });
      const area = await tx.companyServiceArea.update({ where: { id: areaId, companyId: id }, data: dto, select: areaSelect });
      await audit(tx, req, 'SERVICE_AREA_UPDATED', 'CompanyServiceArea', areaId, { companyId: id, ...area }, before);
      return area;
    });
  }
}

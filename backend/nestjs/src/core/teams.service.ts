import { AdminTeamQueryDto, ListQueryDto } from './core.dto.js';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import type { AvailabilityDto, CapabilitiesDto, TeamDto, TeamLocationDto, TeamStatusDto, TeamUpdateDto } from './core.dto.js';
import { audit, canManage, canOperate, teamScope, type CoreContext } from './core.policy.js';
import { teamSelect, providerTeamDetailSelect, availabilitySelect, memberSelect } from './core.projections.js';

@Injectable()
export class TeamsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  private async accessible(tx: Prisma.TransactionClient, actor: Actor, id: string, mode: 'read' | 'manage' | 'operate') {
    const team = await tx.team.findFirst({ where: { AND: [{ id }, teamScope(actor)] }, select: teamSelect });
    if (!team || (mode === 'manage' && !canManage(actor, team.companyId)) ||
      (mode === 'operate' && !canOperate(actor, team))) throw new NotFoundException();
    return team;
  }
  private async locked(tx: Prisma.TransactionClient, actor: Actor, id: string, mode: 'manage' | 'operate') {
    // Every team configuration writer takes the same lock, including replace-all capabilities.
    await this.accessible(tx, actor, id, mode);
    await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${id}::uuid FOR UPDATE`;
    return this.accessible(tx, actor, id, mode);
  }
  list(req: CoreContext, page: AdminTeamQueryDto = new AdminTeamQueryDto()) {
    const query = page.query?.trim();
    const filters: Prisma.TeamWhereInput[] = [
      ...(page.companyId ? [{ companyId: page.companyId }] : []),
      ...(page.status ? [{ status: page.status }] : []),
      ...(page.active === undefined ? [] : [{ active: page.active }]),
      ...(query ? [{ OR: [{ internalCode: { contains: query, mode: 'insensitive' as const } }, { name: { contains: query, mode: 'insensitive' as const } }] }] : []),
    ];
    const where = filters.length ? { AND: [teamScope(req.actor), ...filters] } : teamScope(req.actor);
    return this.db.team.findMany({
      where,
      select: teamSelect, take: page.limit, skip: page.offset, orderBy: [{ id: 'asc' }],
    });
  }
  async detail(id: string, req: CoreContext) {
    await this.accessible(this.db, req.actor, id, 'read');
    return this.db.team.findUniqueOrThrow({ where: { id }, select: providerTeamDetailSelect });
  }
  async members(id: string, req: CoreContext, page: ListQueryDto = new ListQueryDto()) {
    await this.accessible(this.db, req.actor, id, 'read');
    return this.db.teamMember.findMany({ where: { teamId: id, active: true, user: { status: 'ACTIVE' } }, select: memberSelect, take: page.limit, skip: page.offset, orderBy: { id: 'asc' } });
  }
  create(dto: TeamDto, req: CoreContext) {
    if (!canManage(req.actor, dto.companyId)) throw new ForbiddenException();
    return this.db.$transaction(async tx => {
      const team = await tx.team.create({ data: dto, select: teamSelect });
      await audit(tx, req, 'TEAM_CREATED', 'Team', team.id, team);
      return team;
    });
  }
  update(id: string, dto: TeamUpdateDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      const before = await this.locked(tx, req.actor, id, 'manage');
      const team = await tx.team.update({ where: { id, companyId: before.companyId }, data: dto, select: teamSelect });
      await audit(tx, req, 'TEAM_UPDATED', 'Team', id, team, before);
      return team;
    });
  }
  async schedule(id: string, req: CoreContext, page: ListQueryDto = new ListQueryDto()) {
    await this.accessible(this.db, req.actor, id, 'read');
    return this.db.teamAvailability.findMany({ where: { teamId: id }, select: availabilitySelect, take: page.limit, skip: page.offset, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }] });
  }
  private interval(dto: AvailabilityDto) {
    const startsAt = new Date(dto.startsAt), endsAt = new Date(dto.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw new BadRequestException();
    return { startsAt, endsAt, available: dto.available };
  }
  availability(id: string, dto: AvailabilityDto, req: CoreContext) {
    const data = this.interval(dto);
    return this.db.$transaction(async tx => {
      await this.locked(tx, req.actor, id, 'operate');
      const result = await tx.teamAvailability.create({ data: { teamId: id, ...data }, select: availabilitySelect });
      await audit(tx, req, 'TEAM_AVAILABILITY_CREATED', 'TeamAvailability', result.id, { teamId: id, ...result });
      return result;
    });
  }
  updateAvailability(id: string, availabilityId: string, dto: AvailabilityDto, req: CoreContext) {
    const data = this.interval(dto);
    return this.db.$transaction(async tx => {
      await this.locked(tx, req.actor, id, 'operate');
      const before = await tx.teamAvailability.findUniqueOrThrow({ where: { id: availabilityId, teamId: id }, select: availabilitySelect });
      const result = await tx.teamAvailability.update({ where: { id: availabilityId, teamId: id }, data, select: availabilitySelect });
      await audit(tx, req, 'TEAM_AVAILABILITY_UPDATED', 'TeamAvailability', availabilityId, { teamId: id, ...result }, before);
      return result;
    });
  }
  removeAvailability(id: string, availabilityId: string, req: CoreContext) {
    return this.db.$transaction(async tx => {
      await this.locked(tx, req.actor, id, 'operate');
      const before = await tx.teamAvailability.findUniqueOrThrow({ where: { id: availabilityId, teamId: id }, select: availabilitySelect });
      await tx.teamAvailability.delete({ where: { id: availabilityId, teamId: id } });
      await audit(tx, req, 'TEAM_AVAILABILITY_REMOVED', 'TeamAvailability', availabilityId, { teamId: id, removed: true }, before);
      return { removed: true };
    });
  }
  async getCapabilities(id: string, req: CoreContext) {
    await this.accessible(this.db, req.actor, id, 'read');
    const rows = await this.db.teamServiceCapability.findMany({ where: { teamId: id }, select: { serviceId: true }, orderBy: { serviceId: 'asc' } });
    return { serviceIds: rows.map(row => row.serviceId) };
  }
  capabilities(id: string, dto: CapabilitiesDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      await this.locked(tx, req.actor, id, 'manage');
      const before = await tx.teamServiceCapability.findMany({ where: { teamId: id }, select: { serviceId: true } });
      await tx.teamServiceCapability.deleteMany({ where: { teamId: id } });
      await tx.teamServiceCapability.createMany({ data: dto.serviceIds.map(serviceId => ({ teamId: id, serviceId })) });
      await audit(tx, req, 'TEAM_CAPABILITIES_REPLACED', 'Team', id, dto, { serviceIds: before.map(row => row.serviceId) });
      return { serviceIds: dto.serviceIds };
    });
  }
  status(id: string, dto: TeamStatusDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      const before = await this.locked(tx, req.actor, id, 'operate');
      const result = await tx.team.update({ where: { id }, data: dto, select: { id: true, status: true } });
      await audit(tx, req, 'TEAM_AVAILABILITY_STATUS_CHANGED', 'Team', id, result, { status: before.status });
      return result;
    });
  }
  location(id: string, dto: TeamLocationDto, req: CoreContext) {
    const reportedAt = new Date(dto.reportedAt);
    if (!Number.isFinite(reportedAt.getTime()) || reportedAt > new Date()) throw new BadRequestException({ code: 'TEAM_LOCATION_TIMESTAMP_INVALID' });
    return this.db.$transaction(async tx => {
      const before = await this.locked(tx, req.actor, id, 'operate');
      const result = await tx.team.update({ where: { id }, data: { latitude: dto.latitude, longitude: dto.longitude, locationAt: reportedAt }, select: { id: true, latitude: true, longitude: true, locationAt: true } });
      await audit(tx, req, 'TEAM_LOCATION_UPDATED', 'Team', id, result, { id });
      return result;
    });
  }
}

import { AdminUserQueryDto } from './core.dto.js';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/database.module.js';
import type { CoreContext } from './core.policy.js';
import { audit } from './core.policy.js';
import type { ProvisionUserDto, UserStatusDto } from './core.dto.js';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  list(page: AdminUserQueryDto = new AdminUserQueryDto()) {
    return this.db.user.findMany({
      take: page.limit, skip: page.offset, orderBy: { id: 'asc' },
      where: {
        ...(page.status ? { status: page.status } : {}),
        ...(page.role ? { roles: { some: { role: { name: page.role } } } } : {}),
        ...(page.query ? { OR: [{ phone: { startsWith: page.query } }, { name: { contains: page.query, mode: 'insensitive' } }] } : {}),
      },
      select: { id: true, name: true, phone: true, status: true },
    });
  }
  async roles(id: string) {
    await this.db.user.findUniqueOrThrow({ where: { id }, select: { id: true } });
    const grants = await this.db.userRole.findMany({ where: { userId: id }, select: { id: true, companyId: true, teamId: true, role: { select: { name: true } } }, orderBy: { id: 'asc' } });
    return grants.map(grant => ({ id: grant.id, role: grant.role.name, companyId: grant.companyId, teamId: grant.teamId }));
  }
  provision(dto: ProvisionUserDto, req: CoreContext) {
    const provider = ['COMPANY_MANAGER', 'TEAM_LEADER_CLEANER'].includes(dto.role);
    if (provider !== !!dto.companyId || (dto.role === 'TEAM_LEADER_CLEANER') !== !!dto.teamId) throw new BadRequestException({ code: 'VALIDATION_ROLE_SCOPE', message: 'Role scope is invalid.' });
    return this.db.$transaction(async tx => {
      // Serialize duplicate provisioning even before a user row exists.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.phone}))`;
      if (dto.teamId) await tx.team.findFirstOrThrow({ where: { id: dto.teamId, companyId: dto.companyId } });
      const role = await tx.role.findUniqueOrThrow({ where: { name: dto.role } });
      const user = await tx.user.upsert({ where: { phone: dto.phone }, create: { phone: dto.phone, name: dto.name }, update: {} });
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
      const scope = { userId: user.id, roleId: role.id, companyId: dto.companyId ?? null, teamId: dto.teamId ?? null };
      if (!await tx.userRole.findFirst({ where: scope })) await tx.userRole.create({ data: scope });
      if (dto.role === 'CUSTOMER') await tx.customer.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
      if (dto.teamId) await tx.teamMember.upsert({ where: { teamId_userId: { teamId: dto.teamId, userId: user.id } }, create: { teamId: dto.teamId, userId: user.id, name: dto.name, role: dto.role }, update: { active: true } });
      await tx.auditLog.create({ data: { actorUserId: req.actor.userId, action: 'IDENTITY_PROVISIONED', resourceType: 'User', resourceId: user.id, after: { role: dto.role, companyId: dto.companyId ?? null, teamId: dto.teamId ?? null }, requestId: req.requestId } });
      return { id: user.id, name: user.name, status: user.status };
    });
  }
  status(id: string, dto: UserStatusDto, req: CoreContext) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.user.findUniqueOrThrow({ where: { id } });
      const user = await tx.user.update({ where: { id }, data: dto, select: { id: true, status: true } });
      if (dto.status !== 'ACTIVE') await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: req.actor.userId, action: 'USER_STATUS_CHANGED', resourceType: 'User', resourceId: id, before: { status: before.status }, after: { ...dto }, requestId: req.requestId } });
      return user;
    });
  }
  revoke(id: string, grantId: string, req: CoreContext) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
      const grant = await tx.userRole.findUniqueOrThrow({ where: { id: grantId, userId: id }, include: { role: true } });
      await tx.userRole.delete({ where: { id: grantId, userId: id } });
      if (grant.role.name === 'TEAM_LEADER_CLEANER' && grant.teamId) {
        await tx.teamMember.updateMany({ where: { teamId: grant.teamId, userId: id }, data: { active: false } });
      }
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit(tx, req, 'IDENTITY_ROLE_REVOKED', 'User', id, { revoked: true, grantId },
        { role: grant.role.name, companyId: grant.companyId, teamId: grant.teamId });
      return { revoked: true };
    });
  }
}

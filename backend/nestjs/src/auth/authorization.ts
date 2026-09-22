import { applyDecorators, type CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Prisma, RoleName } from '@prisma/client';
import type { ApiRequest } from '../common/http.js';
import { PrismaService } from '../database/database.module.js';

export const Public = () => SetMetadata('public', true);
export const Permission = (code: string) => SetMetadata('permission', code);
export const PlatformPermission = (code: string) => applyDecorators(Permission(code), SetMetadata('platform', true));
export const PlatformAnyPermission = (...codes: string[]) => applyDecorators(SetMetadata('permissions', codes), SetMetadata('platform', true));
export const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex');
export type Actor = {
  userId: string; sessionId: string; familyId: string;
  scopes: { role: RoleName; companyId: string | null; teamId: string | null; permissions: string[] }[];
};
export type AuthRequest = ApiRequest & { actor: Actor };

export function hasPlatformPermission(actor: Actor, code: string) {
  return actor.scopes.some(scope => scope.role === 'HOME_CLEAN_ADMIN' && scope.companyId === null && scope.teamId === null && scope.permissions.includes(code));
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector, @Inject(PrismaService) private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.header('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!token) throw new UnauthorizedException();
    const session = await this.db.session.findUnique({
      where: { accessTokenHash: sessionHash(token) },
      include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } }, company: true, team: true } } } } },
    });
    if (!session || session.revokedAt || session.accessExpiresAt <= new Date() || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') throw new UnauthorizedException();
    const scopes = session.user.roles.filter(grant => {
      if (grant.role.name === 'COMPANY_MANAGER') return !!grant.companyId && !grant.teamId && grant.company?.status === 'ACTIVE';
      if (grant.role.name === 'TEAM_LEADER_CLEANER') return !!grant.companyId && !!grant.teamId && grant.company?.status === 'ACTIVE' && grant.team?.active && grant.team.companyId === grant.companyId;
      return !grant.companyId && !grant.teamId;
    }).map(grant => ({ role: grant.role.name, companyId: grant.companyId, teamId: grant.teamId, permissions: grant.role.permissions.map(p => p.permission.code) }));
    request.actor = { userId: session.userId, sessionId: session.id, familyId: session.familyId, scopes };
    const anyPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [context.getHandler(), context.getClass()]);
    const platform = this.reflector.getAllAndOverride<boolean>('platform', [context.getHandler(), context.getClass()]);
    // A method-level any-of declaration intentionally overrides a class-level single permission.
    if (anyPermissions?.length) {
      if (platform && !anyPermissions.some(code => hasPlatformPermission(request.actor, code))) throw new ForbiddenException();
      if (!platform && !anyPermissions.some(code => scopes.some(scope => scope.permissions.includes(code)))) throw new ForbiddenException();
      return true;
    }
    const required = this.reflector.getAllAndOverride<string>('permission', [context.getHandler(), context.getClass()]);
    if (required && platform && !hasPlatformPermission(request.actor, required)) throw new ForbiddenException();
    if (required && !platform && !scopes.some(scope => scope.permissions.includes(required))) throw new ForbiddenException();
    return true;
  }
}

export function companyScope(actor: Actor, companyId: string, permission: string) {
  if (!actor.scopes.some(scope => scope.companyId === companyId && scope.permissions.includes(permission))) throw new ForbiddenException();
}

export function assignmentScope(actor: Actor): Prisma.AssignmentWhereInput {
  const scopes = actor.scopes.flatMap(scope => {
    if (scope.role === 'COMPANY_MANAGER' && scope.companyId && scope.permissions.includes('assignment:company')) return [{ companyId: scope.companyId }];
    if (scope.role === 'TEAM_LEADER_CLEANER' && scope.teamId && scope.companyId && scope.permissions.includes('assignment:team')) return [{ companyId: scope.companyId, teamId: scope.teamId }];
    return [];
  });
  if (!scopes.length) throw new ForbiddenException();
  return { OR: scopes };
}

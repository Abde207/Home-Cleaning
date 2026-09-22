import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Actor } from '../auth/authorization.js';

export type CoreContext = { actor: Actor; requestId: string };

export function canManage(actor: Actor, companyId: string) {
  return actor.scopes.some(s => s.permissions.includes('team:manage') ||
    (s.role === 'COMPANY_MANAGER' && s.companyId === companyId && s.permissions.includes('team:company')));
}

export function canOperate(actor: Actor, team: { id: string; companyId: string }) {
  return canManage(actor, team.companyId) || actor.scopes.some(s =>
    s.role === 'TEAM_LEADER_CLEANER' && s.companyId === team.companyId && s.teamId === team.id && s.permissions.includes('job:team'));
}

export function teamScope(actor: Actor): Prisma.TeamWhereInput {
  if (actor.scopes.some(s => s.permissions.includes('team:manage') || s.permissions.includes('team:read'))) return {};
  const scopes = actor.scopes.flatMap((s): Prisma.TeamWhereInput[] => {
    if (s.role === 'COMPANY_MANAGER' && s.companyId && s.permissions.includes('team:company')) return [{ companyId: s.companyId }];
    if (s.role === 'TEAM_LEADER_CLEANER' && s.companyId && s.teamId && s.permissions.includes('job:team')) return [{ companyId: s.companyId, id: s.teamId }];
    return [];
  });
  if (!scopes.length) throw new ForbiddenException();
  return { OR: scopes };
}

// Audit payloads are explicit projections; convert Decimal/Date to their JSON representations.
export function auditJson(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

export async function audit(tx: Prisma.TransactionClient, context: CoreContext, action: string,
  resourceType: string, resourceId: string, after: object, before?: object) {
  await tx.auditLog.create({ data: {
    actorUserId: context.actor.userId, requestId: context.requestId, action, resourceType, resourceId,
    after: auditJson(after), ...(before ? { before: auditJson(before) } : {}),
  } });
}

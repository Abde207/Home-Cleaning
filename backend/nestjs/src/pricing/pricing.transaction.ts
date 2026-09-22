import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../database/database.module.js';
import type { CoreContext } from '../core/core.policy.js';
import { auditJson } from '../core/core.policy.js';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

export async function pricingWrite<T extends object>(db: PrismaService, req: CoreContext, key: string | undefined, operation: string, payload: object, work: (tx: Prisma.TransactionClient) => Promise<T>, optional = false): Promise<T> {
  if (key === undefined && optional) return db.$transaction(work);
  if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  const hash = createHash('sha256').update(canonical(payload)).digest('hex');
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${req.actor.userId}:${operation}:${key}`}))`;
    const where = { userId_operation_key: { userId: req.actor.userId, operation, key } };
    const existing = await tx.idempotencyKey.findUnique({ where });
    if (existing) {
      if (existing.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
      return existing.response as T;
    }
    const result = await work(tx);
    await tx.idempotencyKey.create({ data: { userId: req.actor.userId, operation, key, requestHash: hash, response: auditJson(result) } });
    return result;
  });
}

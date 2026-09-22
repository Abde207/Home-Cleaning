import { HttpException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type OtpChallenge } from '@prisma/client';
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../database/database.module.js';
import { RedisService } from '../redis/redis.module.js';
import { OtpSender } from './otp-sender.js';
import { sessionHash, type Actor } from './authorization.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(OtpSender) private readonly sender: OtpSender,
  ) {}
  private digest(value: string) { return createHmac('sha256', this.config.getOrThrow<string>('OTP_HASH_SECRET')).update(value).digest('hex'); }

  private async limit(label: string, value: string, maximum: number) {
    const key = `homeclean:auth:${label}:${this.digest(value)}`;
    const count = await this.redis.client.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n", 1, key, 900);
    if (Number(count) > maximum) throw new HttpException({ code: 'AUTH_RATE_LIMITED', message: 'Try again later.' }, 429);
  }

  async requestOtp(phone: string, ip: string) {
    await this.limit('request-ip', ip, 20);
    await this.limit('request-phone', phone, 3);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await this.db.otpChallenge.create({ data: { id, phone, codeHash: this.digest(`${id}:${code}`), expiresAt } });
    try { await this.sender.send(id, phone, code, expiresAt); }
    catch (error) { await this.db.otpChallenge.update({ where: { id }, data: { usedAt: new Date() } }); throw error; }
    return { challengeId: id, expiresAt };
  }

  private async issue(tx: Prisma.TransactionClient, userId: string, familyId: string = randomUUID(), expiresAt = new Date(Date.now() + 30 * 86400_000)) {
    const accessToken = randomBytes(32).toString('base64url');
    const refreshToken = randomBytes(32).toString('base64url');
    const accessExpiresAt = new Date(Math.min(Date.now() + 15 * 60_000, expiresAt.getTime()));
    await tx.session.create({ data: { userId, familyId, accessTokenHash: sessionHash(accessToken), refreshTokenHash: sessionHash(refreshToken), accessExpiresAt, expiresAt } });
    return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt: expiresAt, tokenType: 'Bearer' };
  }

  async verifyOtp(challengeId: string, code: string, ip: string) {
    await this.limit('verify-ip', ip, 60);
    const result = await this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<OtpChallenge[]>`SELECT * FROM "OtpChallenge" WHERE id = ${challengeId}::uuid FOR UPDATE`;
      const challenge = rows[0];
      if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return null;
      const valid = timingSafeEqual(Buffer.from(challenge.codeHash, 'hex'), Buffer.from(this.digest(`${challengeId}:${code}`), 'hex'));
      if (!valid) {
        await tx.otpChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
        return null;
      }
      await tx.otpChallenge.update({ where: { id: challengeId }, data: { usedAt: new Date() } });
      const role = await tx.role.findUniqueOrThrow({ where: { name: 'CUSTOMER' } });
      const user = await tx.user.upsert({
        where: { phone: challenge.phone }, update: {},
        create: { phone: challenge.phone, customer: { create: {} }, roles: { create: { roleId: role.id } } },
      });
      if (user.status !== 'ACTIVE') return null;
      return this.issue(tx, user.id);
    });
    if (!result) throw new UnauthorizedException({ code: 'AUTH_INVALID_CODE', message: 'The code is invalid or expired.' });
    return result;
  }

  async refresh(refreshToken: string, ip: string) {
    await this.limit('refresh-ip', ip, 120);
    const tokenHash = sessionHash(refreshToken);
    const result = await this.db.$transaction(async tx => {
      const found = await tx.session.findUnique({ where: { refreshTokenHash: tokenHash } });
      if (!found) return null;
      // Serialize rotations across the whole token family, including replay revocation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.familyId}))`;
      const session = await tx.session.findUniqueOrThrow({ where: { id: found.id }, include: { user: true } });
      if (session.revokedAt) {
        await tx.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
        return null;
      }
      if (session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
      await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return this.issue(tx, session.userId, session.familyId, session.expiresAt);
    });
    if (!result) throw new UnauthorizedException({ code: 'AUTH_INVALID_SESSION', message: 'Sign in again.' });
    return result;
  }

  async logout(actor: Actor) {
    await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.familyId}))`;
      await tx.session.updateMany({ where: { familyId: actor.familyId }, data: { revokedAt: new Date() } });
    });
    return { revoked: true };
  }

  async me(actor: Actor) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { id: true, name: true, phone: true, locale: true } });
    return { ...user, scopes: actor.scopes };
  }
}

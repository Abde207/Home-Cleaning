import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/database.module.js';
import { RedisService } from '../redis/redis.module.js';
import { Public } from '../auth/authorization.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(RedisService) private readonly redis: RedisService) {}
  @Get('live')
  live() { return { status: 'ok' }; }

  @Get('ready')
  async ready() {
    try {
      await Promise.all([this.db.$queryRaw`SELECT 1`, this.redis.client.ping()]);
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException({ code: 'SYSTEM_NOT_READY' });
    }
  }
}

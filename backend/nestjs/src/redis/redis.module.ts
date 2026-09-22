import { Global, Inject, Injectable, Logger, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1,
      connectTimeout: 3000, commandTimeout: 3000,
      retryStrategy: attempt => Math.min(attempt * 200, 3000),
    });
    this.client.on('error', () => new Logger('Redis').warn('Redis connection unavailable'));
  }
  async onModuleInit() { await this.client.connect(); }
  async onModuleDestroy() { this.client.disconnect(); }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}

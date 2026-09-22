import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { CoreModule } from './core/core.module.js';
import { BookingModule } from './booking/booking.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { DispatchModule } from './dispatch/dispatch.module.js';
import { PaymentModule } from './payments/payment.module.js';
import { NotificationModule } from './notifications/notification.module.js';
import { ProviderAssignmentsModule } from './provider-operations/provider-assignments.module.js';
import { AdminReadModelsModule } from './admin-read-models/admin-read-models.module.js';
import { AdminFinanceModule } from './admin-finance/admin-finance.module.js';
import { AdminObservabilityModule } from './admin-observability/admin-observability.module.js';
import { LocationModule } from './location/location.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: fileURLToPath(new URL('../../../.env', import.meta.url)), validate: validateEnvironment }),
    DatabaseModule, RedisModule, AuthModule, CoreModule, BookingModule, PricingModule, DispatchModule, PaymentModule, NotificationModule, ProviderAssignmentsModule, AdminReadModelsModule, AdminFinanceModule, AdminObservabilityModule, LocationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

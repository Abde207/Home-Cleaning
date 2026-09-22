import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationService } from './notification.service.js';

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(@Inject(NotificationService) private readonly notifications: NotificationService) {}
  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.NOTIFICATION_WORKER_ENABLED === 'false') return;
    this.timer = setInterval(() => { void this.runOnce().catch(error => this.logger.error(error)); }, 5_000); this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async runOnce() {
    if (this.running) return { busy: true };
    this.running = true;
    try { const outbox = await this.notifications.processOutboxOnce(); const deliveries = await this.notifications.processDeliveriesOnce(); return { busy: false, outbox, deliveries }; }
    finally { this.running = false; }
  }
}

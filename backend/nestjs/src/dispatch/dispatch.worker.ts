import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/database.module.js';
import { DispatchService } from './dispatch.service.js';

/** PostgreSQL-backed retry sweep. Status/row locks, not process memory, are the durable work queue. */
@Injectable()
export class DispatchWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatchWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(@Inject(PrismaService) private readonly db: PrismaService,
    @Inject(DispatchService) private readonly dispatch: DispatchService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.DISPATCH_WORKER_ENABLED === 'false') return;
    this.timer = setInterval(() => { void this.runOnce().catch(error => this.logger.error(error)); }, 10_000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async runOnce(bookingId?: string) {
    if (this.running) return { processed: 0, succeeded: 0, failed: 0, busy: true };
    this.running = true;
    try {
      const now = new Date();
      const rows = await this.db.booking.findMany({ where: {
        ...(bookingId ? { id: bookingId } : {}),
        OR: [
          { status: { in: ['PAYMENT_CONFIRMED', 'SEARCHING_FOR_TEAM', 'REJECTED', 'TEAM_NO_SHOW'] } },
          { status: 'TEAM_ASSIGNED', assignments: { some: { status: 'OFFERED', expiresAt: { lte: now } } } },
        ],
      }, select: { id: true }, orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }], take: bookingId ? 1 : 100 });
      let succeeded = 0, failed = 0;
      for (const row of rows) {
        try { await this.dispatch.systemOffer(row.id); succeeded++; }
        catch (error) { failed++; this.logger.warn(`Dispatch retry failed for ${row.id}: ${error instanceof Error ? error.message : String(error)}`); }
      }
      return { processed: rows.length, succeeded, failed, busy: false };
    } finally { this.running = false; }
  }
}

import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module.js';
import { DispatchController, LegacyManualAssignmentController } from './dispatch.controller.js';
import { DispatchService } from './dispatch.service.js';
import { DispatchWorker } from './dispatch.worker.js';

@Module({ imports: [BookingModule], controllers: [DispatchController, LegacyManualAssignmentController], providers: [DispatchService, DispatchWorker] })
export class DispatchModule {}

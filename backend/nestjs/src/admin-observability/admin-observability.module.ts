import { Module } from '@nestjs/common';
import { AdminObservabilityController } from './admin-observability.controller.js';
import { AdminObservabilityService } from './admin-observability.service.js';

@Module({ controllers: [AdminObservabilityController], providers: [AdminObservabilityService] })
export class AdminObservabilityModule {}

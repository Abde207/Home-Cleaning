import { Module } from '@nestjs/common';
import { ProviderAssignmentsController } from './provider-assignments.controller.js';
import { ProviderAssignmentsService } from './provider-assignments.service.js';

@Module({ controllers: [ProviderAssignmentsController], providers: [ProviderAssignmentsService] })
export class ProviderAssignmentsModule {}

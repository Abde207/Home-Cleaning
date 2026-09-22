import { Module } from '@nestjs/common';
import { AdminReadModelsController } from './admin-read-models.controller.js';
import { AdminReadModelsService } from './admin-read-models.service.js';

@Module({ controllers: [AdminReadModelsController], providers: [AdminReadModelsService] })
export class AdminReadModelsModule {}

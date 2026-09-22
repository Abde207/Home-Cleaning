import { Module } from '@nestjs/common';
import { LocationService } from './location.service.js';
import { TrackingService } from './tracking.service.js';
import { TrackingController } from './tracking.controller.js';

@Module({ controllers: [TrackingController], providers: [LocationService, TrackingService], exports: [LocationService] })
export class LocationModule {}

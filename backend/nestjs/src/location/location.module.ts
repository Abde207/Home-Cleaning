import { Module } from '@nestjs/common';
import { LocationService } from './location.service.js';
import { TrackingService } from './tracking.service.js';
import { TrackingController } from './tracking.controller.js';
import { ConfigService } from '@nestjs/config';
import { DeterministicGeocodingProvider, GEOCODING_PROVIDER, ROUTING_PROVIDER, UnavailableRoutingProvider } from './location.provider.js';

@Module({ controllers: [TrackingController], providers: [LocationService, TrackingService,
  { provide: GEOCODING_PROVIDER, inject: [ConfigService], useFactory: (config: ConfigService) => {
    if (config.get('MAPS_PROVIDER') !== 'mock') throw new Error('MAPS_PROVIDER_NOT_CONFIGURED');
    return new DeterministicGeocodingProvider();
  } },
  { provide: ROUTING_PROVIDER, inject: [ConfigService], useFactory: (config: ConfigService) => {
    if (config.get('MAPS_PROVIDER') !== 'mock') throw new Error('MAPS_PROVIDER_NOT_CONFIGURED');
    return new UnavailableRoutingProvider();
  } }], exports: [LocationService, GEOCODING_PROVIDER, ROUTING_PROVIDER] })
export class LocationModule {}

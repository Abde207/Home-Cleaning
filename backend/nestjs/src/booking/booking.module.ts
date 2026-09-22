import { Module } from '@nestjs/common';
import { BookingAssignmentController, BookingController } from './booking.controller.js';
import { BookingService } from './booking.service.js';
import { PricingModule } from '../pricing/pricing.module.js';

@Module({ imports: [PricingModule], controllers: [BookingController, BookingAssignmentController], providers: [BookingService], exports: [BookingService] })
export class BookingModule {}

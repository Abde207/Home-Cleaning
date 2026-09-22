import { Module } from '@nestjs/common';
import { PricingController, PricingRulesController, PromotionsController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import { PricingAdminService } from './pricing.admin.service.js';

@Module({ controllers: [PricingController, PricingRulesController, PromotionsController], providers: [PricingService, PricingAdminService], exports: [PricingService] })
export class PricingModule {}

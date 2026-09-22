import { Body, Controller, Post, Req, Get, Param, ParseUUIDPipe, Headers, Query, HttpCode } from '@nestjs/common';
import { Permission, PlatformPermission, type AuthRequest } from '../auth/authorization.js';
import { QuoteRequestDto, PublishRuleDto, PublishPromotionDto, PricingActivationDto } from './pricing.dto.js';
import { PricingService } from './pricing.service.js';
import { PricingAdminService } from './pricing.admin.service.js';
import { ListQueryDto } from '../core/core.dto.js';

@Controller('bookings')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('quote')
  @Permission('booking:own')
  quote(@Req() req: AuthRequest, @Body() dto: QuoteRequestDto, @Headers('idempotency-key') key?: string) { return this.pricing.quote(req, dto, key); }

  @Get('quotes/:id')
  @Permission('booking:own')
  detail(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) { return this.pricing.detail(req, id); }
}

@Controller('admin/pricing/rules')
@PlatformPermission('pricing:manage')
export class PricingRulesController {
  constructor(private readonly pricing: PricingAdminService) {}
  @Get() list(@Query() page: ListQueryDto) { return this.pricing.rules(page); }
  @Post() publish(@Req() req: AuthRequest, @Body() dto: PublishRuleDto, @Headers('idempotency-key') key?: string) { return this.pricing.publishRule(req, dto, key); }
  @Post(':id/activation') @HttpCode(200)
  activation(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PricingActivationDto, @Headers('idempotency-key') key?: string) { return this.pricing.activation(req, id, dto.active, 'rule', key); }
}

@Controller('admin/promotions')
@PlatformPermission('promotion:manage')
export class PromotionsController {
  constructor(private readonly pricing: PricingAdminService) {}
  @Get() list(@Query() page: ListQueryDto) { return this.pricing.promotions(page); }
  @Post() publish(@Req() req: AuthRequest, @Body() dto: PublishPromotionDto, @Headers('idempotency-key') key?: string) { return this.pricing.publishPromotion(req, dto, key); }
  @Post(':id/activation') @HttpCode(200)
  activation(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PricingActivationDto, @Headers('idempotency-key') key?: string) { return this.pricing.activation(req, id, dto.active, 'promotion', key); }
}

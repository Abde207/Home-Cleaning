import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { Public, type AuthRequest } from '../auth/authorization.js';
import { CreatePaymentDto, CreateSettlementDto, PaymentRefundDto, SettlementCommandDto, SettlementPaymentDto } from './payment.dto.js';
import { PaymentService } from './payment.service.js';
import { SettlementService } from './settlement.service.js';
import type { Request } from 'express';
import { ListQueryDto } from '../core/core.dto.js';

type RawRequest = Request & { rawBody?: Buffer };

@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post()
  create(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Body() dto: CreatePaymentDto) { return this.payments.create(req.actor, dto, key); }

  @Get(':id')
  get(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) { return this.payments.get(req.actor, id); }

  @Post(':id/retry')
  @HttpCode(200)
  retry(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.payments.retry(req.actor, id, key); }

  @Post(':id/refunds')
  requestRefund(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PaymentRefundDto) { return this.payments.requestRefund(req.actor, id, dto, key); }
}

@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly payments: PaymentService) {}

  @Public()
  @Post(':provider')
  @HttpCode(200)
  webhook(@Param('provider') provider: string, @Headers('x-payment-signature') mockSignature: string | undefined,
    @Headers('hashstring') tapSignature: string | undefined, @Req() req: RawRequest) {
    if (!req.rawBody) throw new Error('Raw webhook body was not captured');
    return this.payments.webhook(provider, req.rawBody, provider === 'tap' ? tapSignature : mockSignature);
  }
}

@Controller('settlements')
export class SettlementController {
  constructor(private readonly settlements: SettlementService) {}

  @Get()
  list(@Req() req: AuthRequest) { return this.settlements.list(req.actor); }

  @Get(':id')
  detail(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) { return this.settlements.detail(req.actor, id); }

  @Post()
  create(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Body() dto: CreateSettlementDto) { return this.settlements.create(req.actor, dto, key); }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.settlements.approve(req.actor, id, key); }

  @Post(':id/calculate')
  @HttpCode(200)
  calculate(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.settlements.calculate(req.actor, id, key); }

  @Post(':id/submit-review')
  @HttpCode(200)
  submitReview(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.settlements.submitReview(req.actor, id, key); }

  @Post(':id/payments')
  pay(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SettlementPaymentDto) { return this.settlements.pay(req.actor, id, dto, key); }

  @Post(':id/reconcile')
  @HttpCode(200)
  reconcile(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.settlements.reconcile(req.actor, id, key); }

  @Post(':id/close')
  @HttpCode(200)
  close(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.settlements.close(req.actor, id, key); }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SettlementCommandDto) { return this.settlements.cancel(req.actor, id, dto, key); }

  @Post(':id/reverse')
  @HttpCode(200)
  reverse(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SettlementCommandDto) { return this.settlements.reverse(req.actor, id, dto, key); }
}

@Controller('provider/settlements')
export class ProviderSettlementController {
  constructor(private readonly settlements: SettlementService) {}

  @Get()
  list(@Req() req: AuthRequest, @Query() page: ListQueryDto) {
    return this.settlements.providerList(req.actor, page);
  }

  @Get(':id')
  detail(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.settlements.providerDetail(req.actor, id);
  }
}

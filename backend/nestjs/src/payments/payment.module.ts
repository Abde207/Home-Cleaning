import { Module } from '@nestjs/common';
import { PaymentController, PaymentWebhookController, ProviderSettlementController, SettlementController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { SettlementService } from './settlement.service.js';

@Module({ controllers: [PaymentController, PaymentWebhookController, SettlementController, ProviderSettlementController], providers: [PaymentService, SettlementService] })
export class PaymentModule {}

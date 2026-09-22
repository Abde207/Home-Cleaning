import { Module } from '@nestjs/common';
import { AdminFinanceController } from './admin-finance.controller.js';
import { AdminFinanceService } from './admin-finance.service.js';

@Module({ controllers: [AdminFinanceController], providers: [AdminFinanceService] })
export class AdminFinanceModule {}

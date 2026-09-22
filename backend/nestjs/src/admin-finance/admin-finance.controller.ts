import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import { PlatformAnyPermission } from '../auth/authorization.js';
import type { AuthRequest } from '../auth/authorization.js';
import { AdminFinanceService } from './admin-finance.service.js';
import { AdminCashQueryDto, AdminPaymentQueryDto, AdminRefundQueryDto, AdminSettlementQueryDto } from './admin-finance.dto.js';

@Controller('admin')
export class AdminFinanceController {
  constructor(private readonly finance: AdminFinanceService) {}

  @Get('payments') @PlatformAnyPermission('payment:read', 'payment:manage')
  payments(@Req() req: AuthRequest, @Query() query: AdminPaymentQueryDto) { return this.finance.payments(req.actor, query); }

  @Get('payments/:id') @PlatformAnyPermission('payment:read', 'payment:manage')
  payment(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) { return this.finance.payment(req.actor, id); }

  @Get('refunds') @PlatformAnyPermission('refund:read', 'refund:manage', 'payment:manage')
  refunds(@Req() req: AuthRequest, @Query() query: AdminRefundQueryDto) { return this.finance.refunds(req.actor, query); }

  @Get('cash-reconciliation') @PlatformAnyPermission('cash:read', 'payment:manage')
  cash(@Req() req: AuthRequest, @Query() query: AdminCashQueryDto) { return this.finance.cash(req.actor, query); }

  @Get('settlements') @PlatformAnyPermission('settlement:read', 'settlement:manage')
  settlements(@Req() req: AuthRequest, @Query() query: AdminSettlementQueryDto) { return this.finance.settlements(req.actor, query); }

  @Get('settlements/:id') @PlatformAnyPermission('settlement:read', 'settlement:manage')
  settlement(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) { return this.finance.settlement(req.actor, id); }
}

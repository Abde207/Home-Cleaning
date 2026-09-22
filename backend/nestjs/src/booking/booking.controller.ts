import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { Permission, type AuthRequest } from '../auth/authorization.js';
import type { ListQueryDto } from '../core/core.dto.js';
import { CancelBookingDto, CashCollectionDto, CompletionProofDto, CreateBookingDto, PaymentConfirmationDto, QuoteConfirmationDto, RefundCompletionDto, RefundDto } from './booking.dto.js';
import { BookingService } from './booking.service.js';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Get()
  list(@Req() req: AuthRequest, @Query() page: ListQueryDto) { return this.bookings.list(req.actor, page); }

  @Get(':id')
  detail(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.detail(req.actor, id); }

  @Post()
  @Permission('booking:own')
  create(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Body() dto: CreateBookingDto) { return this.bookings.create(req.actor, dto, key); }

  @Post(':id/confirm')
  @HttpCode(200)
  @Permission('booking:own')
  confirm(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.confirm(req.actor, id, key); }

  @Post(':id/select-cash')
  @HttpCode(200)
  @Permission('booking:own')
  selectCash(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.selectCash(req.actor, id, key); }

  @Post(':id/quote-confirmed')
  @HttpCode(200)
  @Permission('pricing:manage')
  confirmQuote(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: QuoteConfirmationDto) { return this.bookings.confirmQuote(req.actor, id, dto, key); }

  @Post(':id/start-online-payment')
  @HttpCode(200)
  @Permission('booking:own')
  initiateOnlinePayment(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.initiateOnlinePayment(req.actor, id, key); }

  @Post(':id/payment-confirmed')
  @HttpCode(200)
  @Permission('payment:manage')
  confirmPayment(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PaymentConfirmationDto) { return this.bookings.confirmPayment(req.actor, id, dto, key); }

  @Post(':id/cash-payment-confirmed')
  @HttpCode(200)
  @Permission('payment:manage')
  confirmCashPayment(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PaymentConfirmationDto) { return this.bookings.confirmCashPayment(req.actor, id, dto, key); }

  @Post(':id/no-team-available')
  @HttpCode(200)
  @Permission('dispatch:manage')
  noTeam(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.markNoTeamAvailable(req.actor, id, key); }

  @Post(':id/retry-assignment')
  @HttpCode(200)
  @Permission('dispatch:manage')
  retryAssignment(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.retryAssignment(req.actor, id, key); }

  @Post(':id/start-payment-reconciliation')
  @HttpCode(200)
  @Permission('payment:manage')
  beginReconciliation(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.beginPaymentReconciliation(req.actor, id, key); }

  @Post(':id/reconcile-payment')
  @HttpCode(200)
  @Permission('payment:manage')
  reconcilePayment(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.reconcilePayment(req.actor, id, key); }

  @Post(':id/complete')
  @HttpCode(200)
  @Permission('payment:manage')
  complete(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.complete(req.actor, id, key); }

  @Post(':id/refund')
  @HttpCode(200)
  @Permission('refund:manage')
  requestRefund(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundDto) { return this.bookings.requestRefund(req.actor, id, dto, key); }

  @Post(':id/refund-completed')
  @HttpCode(200)
  @Permission('refund:manage')
  completeRefund(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundCompletionDto) { return this.bookings.completeRefund(req.actor, id, dto, key); }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingDto) { return this.bookings.cancel(req.actor, id, dto, key); }
}

@Controller('assignments')
export class BookingAssignmentController {
  constructor(private readonly bookings: BookingService) {}

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.acceptAssignment(req.actor, id, key); }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingDto) { return this.bookings.rejectAssignment(req.actor, id, dto.reason, key); }

  @Post(':id/on-the-way')
  @HttpCode(200)
  markOnTheWay(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.markOnTheWay(req.actor, id, key); }

  @Post(':id/start-cleaning')
  @HttpCode(200)
  startCleaning(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.startCleaning(req.actor, id, key); }

  @Post(':id/complete-cleaning')
  @HttpCode(200)
  completeCleaning(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.completeCleaning(req.actor, id, key); }

  @Post(':id/completion-proof')
  @HttpCode(201)
  submitProof(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompletionProofDto) { return this.bookings.submitCompletionProof(req.actor, id, dto, key); }

  @Post(':id/team-no-show')
  @HttpCode(200)
  markTeamNoShow(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.markTeamNoShow(req.actor, id, key); }

  @Post(':id/customer-no-show')
  @HttpCode(200)
  markCustomerNoShow(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string) { return this.bookings.markCustomerNoShow(req.actor, id, key); }

  @Post(':id/collect-cash')
  @HttpCode(200)
  collectCash(@Req() req: AuthRequest, @Headers('idempotency-key') key: string | undefined, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CashCollectionDto) { return this.bookings.collectCash(req.actor, id, dto, key); }
}

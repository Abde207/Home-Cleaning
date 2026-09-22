import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { PlatformPermission } from '../auth/authorization.js';
import { AdminReadModelsService } from './admin-read-models.service.js';
import { AdminBookingListQueryDto, AdminDashboardQueryDto, AuditLogQueryDto } from './admin-read-models.dto.js';

@Controller('admin')
export class AdminReadModelsController {
  constructor(@Inject(AdminReadModelsService) private readonly reads: AdminReadModelsService) {}

  @Get('dashboard') @PlatformPermission('admin:dashboard:read')
  dashboard(@Query() dto: AdminDashboardQueryDto) { return this.reads.dashboard(dto); }

  @Get('bookings') @PlatformPermission('booking:operations')
  bookings(@Query() dto: AdminBookingListQueryDto) { return this.reads.bookings(dto); }

  @Get('bookings/:id') @PlatformPermission('booking:operations')
  bookingDetail(@Param('id', ParseUUIDPipe) id: string) { return this.reads.bookingDetail(id); }

  @Get('audit-logs') @PlatformPermission('audit:read')
  auditList(@Query() dto: AuditLogQueryDto) { return this.reads.auditList(dto); }

  @Get('audit-logs/:id') @PlatformPermission('audit:read')
  auditDetail(@Param('id', ParseUUIDPipe) id: string) { return this.reads.auditDetail(id); }
}

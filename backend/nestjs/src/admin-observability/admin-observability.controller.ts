import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import { PlatformPermission, type AuthRequest } from '../auth/authorization.js';
import { AdminLocationsQueryDto, AdminNotificationDeliveryQueryDto } from './admin-observability.dto.js';
import { AdminObservabilityService } from './admin-observability.service.js';

@Controller('admin')
export class AdminObservabilityController {
  constructor(@Inject(AdminObservabilityService) private readonly observability: AdminObservabilityService) {}

  @Get('notification-deliveries') @PlatformPermission('notification:operations:read')
  deliveries(@Query() dto: AdminNotificationDeliveryQueryDto) { return this.observability.deliveryList(dto); }

  @Get('notification-deliveries/:id') @PlatformPermission('notification:operations:read')
  delivery(@Param('id', ParseUUIDPipe) id: string) { return this.observability.deliveryDetail(id); }

  @Get('operations/locations') @PlatformPermission('admin:dashboard:read')
  locations(@Req() req: AuthRequest, @Query() dto: AdminLocationsQueryDto) { return this.observability.locations(req.actor, dto); }
}

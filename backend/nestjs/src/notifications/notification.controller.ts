import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Permission, type AuthRequest } from '../auth/authorization.js';
import { ListQueryDto } from '../core/core.dto.js';
import { DeviceTokenDto, NotificationReadDto } from './notification.dto.js';
import { NotificationService } from './notification.service.js';

@Controller('notifications')
@Permission('notification:own')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}
  @Get() list(@Req() req: AuthRequest, @Query() page: ListQueryDto) { return this.notifications.list(req.actor, page); }
  @Patch(':id/read') read(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() _dto: NotificationReadDto) { return this.notifications.read(req.actor, id); }
}

@Controller('devices')
@Permission('notification:own')
export class DeviceTokenController {
  constructor(private readonly notifications: NotificationService) {}
  @Post() register(@Req() req: AuthRequest, @Body() dto: DeviceTokenDto) { return this.notifications.registerDevice(req.actor, dto); }
  @Delete(':id') unregister(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) { return this.notifications.unregisterDevice(req.actor, id); }
}

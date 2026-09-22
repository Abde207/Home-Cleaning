import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/authorization.js';
import { TrackingService } from './tracking.service.js';
import { TeamLocationDto } from './tracking.dto.js';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}
  @Post('assignments/:id/location')
  update(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamLocationDto) {
    return this.tracking.update(req.actor, id, dto);
  }
  @Get('bookings/:id')
  @Header('Cache-Control', 'no-store')
  current(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.tracking.current(req.actor, id);
  }
}

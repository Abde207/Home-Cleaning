import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { Permission, type AuthRequest } from '../auth/authorization.js';
import { LegacyManualAssignmentDto, ManualDispatchDto } from './dispatch.dto.js';
import { DispatchService } from './dispatch.service.js';

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Post('bookings/:id/offer') @HttpCode(200) @Permission('dispatch:manage')
  offer(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Headers('idempotency-key') key: string | undefined) {
    return this.dispatch.offer(req.actor, id, key);
  }

  @Post('bookings/:id/manual') @HttpCode(200) @Permission('dispatch:manage')
  manual(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Headers('idempotency-key') key: string | undefined, @Body() dto: ManualDispatchDto) {
    return this.dispatch.manual(req.actor, id, dto, key);
  }

  @Get('monitoring') @Permission('dispatch:manage')
  monitoring(@Req() req: AuthRequest) { return this.dispatch.monitoring(req.actor); }

  @Get('offers')
  offers(@Req() req: AuthRequest) { return this.dispatch.offers(req.actor); }
}

@Controller('bookings')
export class LegacyManualAssignmentController {
  constructor(private readonly dispatch: DispatchService) {}

  @Post(':id/assign') @HttpCode(200) @Permission('dispatch:manage')
  assign(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Headers('idempotency-key') key: string | undefined, @Body() dto: LegacyManualAssignmentDto) {
    return this.dispatch.legacyManual(req.actor, id, dto, key);
  }
}

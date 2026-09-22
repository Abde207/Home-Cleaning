import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/authorization.js';
import { ProviderAssignmentListDto, ProviderCashWorklistDto } from './provider-assignments.dto.js';
import { ProviderAssignmentsService } from './provider-assignments.service.js';

@Controller('provider')
export class ProviderAssignmentsController {
  constructor(private readonly assignments: ProviderAssignmentsService) {}

  @Get('assignments')
  list(@Req() req: AuthRequest, @Query() query: ProviderAssignmentListDto) {
    return this.assignments.list(req.actor, query);
  }

  @Get('assignments/:id')
  detail(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.detail(req.actor, id);
  }

  @Get('cash-worklist')
  cashWorklist(@Req() req: AuthRequest, @Query() query: ProviderCashWorklistDto) {
    return this.assignments.cashWorklist(req.actor, query);
  }
}

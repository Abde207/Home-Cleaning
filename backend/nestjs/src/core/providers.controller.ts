import { Query, Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import { PlatformPermission, type AuthRequest } from '../auth/authorization.js';
import { AdminCompanyQueryDto, AdminTeamQueryDto, AvailabilityDto, CapabilitiesDto, CompanyDto, CompanyProfileDto, ServiceAreaDto, TeamDto, TeamLocationDto, TeamStatusDto, TeamUpdateDto, ListQueryDto } from './core.dto.js';
import { CompaniesService } from './companies.service.js';
import { TeamsService } from './teams.service.js';

@Controller('admin/companies')
@PlatformPermission('company:manage')
export class CompaniesController {
  constructor(@Inject(CompaniesService) private readonly companies: CompaniesService) {}
  @Get() list(@Query() page: AdminCompanyQueryDto) { return this.companies.list(page); }
  @Get(':id') detail(@Param('id', ParseUUIDPipe) id: string) { return this.companies.detail(id); }
  @Post() create(@Body() dto: CompanyDto, @Req() req: AuthRequest) { return this.companies.create(dto, req); }
  @Put(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompanyDto, @Req() req: AuthRequest) { return this.companies.update(id, dto, req); }
  @Get(':id/service-areas') areas(@Param('id', ParseUUIDPipe) id: string, @Query() page: ListQueryDto) { return this.companies.areas(id, page); }
  @Post(':id/service-areas') area(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ServiceAreaDto, @Req() req: AuthRequest) { return this.companies.area(id, dto, req); }
  @Put(':id/service-areas/:areaId') updateArea(@Param('id', ParseUUIDPipe) id: string, @Param('areaId', ParseUUIDPipe) areaId: string, @Body() dto: ServiceAreaDto, @Req() req: AuthRequest) { return this.companies.updateArea(id, areaId, dto, req); }
}

@Controller('provider/companies')
export class ProviderCompaniesController {
  constructor(@Inject(CompaniesService) private readonly companies: CompaniesService) {}
  @Get() list(@Req() req: AuthRequest, @Query() page: ListQueryDto) { return this.companies.visible(req.actor, page); }
  @Put(':id/profile') profile(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompanyProfileDto, @Req() req: AuthRequest) { return this.companies.profile(id, dto, req); }
  @Get(':id/service-areas') areas(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest, @Query() page: ListQueryDto) { return this.companies.visibleAreas(id, req.actor, page); }
}

@Controller('provider/teams')
export class TeamsController {
  constructor(@Inject(TeamsService) private readonly teams: TeamsService) {}
  @Get() list(@Req() req: AuthRequest, @Query() page: AdminTeamQueryDto) { return this.teams.list(req, page); }
  @Get(':id') detail(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return this.teams.detail(id, req); }
  @Get(':id/members') members(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest, @Query() page: ListQueryDto) { return this.teams.members(id, req, page); }
  @Post() create(@Body() dto: TeamDto, @Req() req: AuthRequest) { return this.teams.create(dto, req); }
  @Put(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamUpdateDto, @Req() req: AuthRequest) { return this.teams.update(id, dto, req); }
  @Get(':id/availability') schedule(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest, @Query() page: ListQueryDto) { return this.teams.schedule(id, req, page); }
  @Post(':id/availability') availability(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AvailabilityDto, @Req() req: AuthRequest) { return this.teams.availability(id, dto, req); }
  @Put(':id/availability/:availabilityId') updateAvailability(@Param('id', ParseUUIDPipe) id: string, @Param('availabilityId', ParseUUIDPipe) availabilityId: string, @Body() dto: AvailabilityDto, @Req() req: AuthRequest) { return this.teams.updateAvailability(id, availabilityId, dto, req); }
  @Delete(':id/availability/:availabilityId') removeAvailability(@Param('id', ParseUUIDPipe) id: string, @Param('availabilityId', ParseUUIDPipe) availabilityId: string, @Req() req: AuthRequest) { return this.teams.removeAvailability(id, availabilityId, req); }
  @Get(':id/capabilities') getCapabilities(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return this.teams.getCapabilities(id, req); }
  @Put(':id/capabilities') capabilities(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CapabilitiesDto, @Req() req: AuthRequest) { return this.teams.capabilities(id, dto, req); }
  @Put(':id/availability-status') status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamStatusDto, @Req() req: AuthRequest) { return this.teams.status(id, dto, req); }
  @Put(':id/location') location(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamLocationDto, @Req() req: AuthRequest) { return this.teams.location(id, dto, req); }
}

import { Query, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import { PlatformPermission, Public, type AuthRequest } from '../auth/authorization.js';
import { ListQueryDto, ServiceDto, ServiceExtraDto } from './core.dto.js';
import { CatalogService } from './catalog.service.js';
import { AdminCatalogService } from './admin-catalog.service.js';

@Controller('services')
export class ServicesController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}
  @Public() @Get() list(@Query() page: ListQueryDto) { return this.catalog.list(page); }
  @Public() @Get(':id') detail(@Param('id', ParseUUIDPipe) id: string) { return this.catalog.detail(id); }
}

@Controller('admin/services')
@PlatformPermission('service:manage')
export class AdminServicesController {
  constructor(@Inject(AdminCatalogService) private readonly catalog: AdminCatalogService) {}
  @Get() list(@Query() page: ListQueryDto) { return this.catalog.list(page); }
  @Post() create(@Body() dto: ServiceDto, @Req() req: AuthRequest) { return this.catalog.create(dto, req); }
  @Put(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ServiceDto, @Req() req: AuthRequest) { return this.catalog.update(id, dto, req); }
  @Get(':id/extras') extras(@Param('id', ParseUUIDPipe) id: string, @Query() page: ListQueryDto) { return this.catalog.extras(id, page); }
  @Post(':id/extras') extra(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ServiceExtraDto, @Req() req: AuthRequest) { return this.catalog.extra(id, dto, req); }
  @Put(':id/extras/:extraId') updateExtra(@Param('id', ParseUUIDPipe) id: string, @Param('extraId', ParseUUIDPipe) extraId: string, @Body() dto: ServiceExtraDto, @Req() req: AuthRequest) { return this.catalog.updateExtra(id, extraId, dto, req); }
}

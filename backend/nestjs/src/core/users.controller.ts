import { Query, Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import { PlatformAnyPermission, PlatformPermission, type AuthRequest } from '../auth/authorization.js';
import { AdminUserQueryDto, ProvisionUserDto, UserStatusDto } from './core.dto.js';
import { UsersService } from './users.service.js';

@Controller('admin/users')
@PlatformPermission('identity:manage')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}
  @Get() @PlatformAnyPermission('identity:read', 'identity:manage') list(@Query() page: AdminUserQueryDto) { return this.users.list(page); }
  @Get(':id/roles') @PlatformAnyPermission('identity:read', 'identity:manage') roles(@Param('id', ParseUUIDPipe) id: string) { return this.users.roles(id); }
  @Post() @PlatformPermission('identity:manage') provision(@Body() dto: ProvisionUserDto, @Req() req: AuthRequest) { return this.users.provision(dto, req); }
  @Put(':id/status') @PlatformPermission('identity:manage') status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UserStatusDto, @Req() req: AuthRequest) { return this.users.status(id, dto, req); }
  @Delete(':id/roles/:grantId') @PlatformPermission('identity:manage') revoke(@Param('id', ParseUUIDPipe) id: string, @Param('grantId', ParseUUIDPipe) grantId: string, @Req() req: AuthRequest) { return this.users.revoke(id, grantId, req); }
}

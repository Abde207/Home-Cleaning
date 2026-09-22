import { Query, Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Req } from '@nestjs/common';
import { Permission, PlatformPermission, type AuthRequest } from '../auth/authorization.js';
import { CustomersService } from './customers.service.js';
import { AdminCustomerQueryDto, ListQueryDto, AddressDto, ProfileDto, PropertyDto } from './core.dto.js';

@Controller('admin/customers')
@PlatformPermission('customer:read')
export class AdminCustomersController {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}
  @Get() list(@Query() page: AdminCustomerQueryDto) { return this.customers.list(page); }
  @Get(':id') detail(@Param('id', ParseUUIDPipe) id: string) { return this.customers.detail(id); }
}

@Controller('customers/me')
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}
  @Get() @Permission('profile:own') profile(@Req() req: AuthRequest) { return this.customers.profile(req.actor); }
  @Patch() @Permission('profile:own') update(@Req() req: AuthRequest, @Body() dto: ProfileDto) { return this.customers.updateProfile(req.actor, dto); }
  @Get('addresses') @Permission('address:own') addresses(@Req() req: AuthRequest, @Query() page: ListQueryDto) { return this.customers.addresses(req.actor, page); }
  @Post('addresses/validate') @Permission('address:own') validateAddress(@Body() dto: AddressDto) { return this.customers.validateAddress(dto); }
  @Post('addresses') @Permission('address:own') createAddress(@Req() req: AuthRequest, @Body() dto: AddressDto) { return this.customers.createAddress(req.actor, dto); }
  @Put('addresses/:id') @Permission('address:own') updateAddress(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddressDto) { return this.customers.updateAddress(req.actor, id, dto); }
  @Delete('addresses/:id') @Permission('address:own') archiveAddress(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) { return this.customers.archiveAddress(req.actor, id); }
  @Get('properties') @Permission('property:own') properties(@Req() req: AuthRequest, @Query() page: ListQueryDto) { return this.customers.properties(req.actor, page); }
  @Post('properties') @Permission('property:own') createProperty(@Req() req: AuthRequest, @Body() dto: PropertyDto) { return this.customers.saveProperty(req.actor, dto); }
  @Put('properties/:id') @Permission('property:own') updateProperty(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PropertyDto) { return this.customers.saveProperty(req.actor, dto, id); }
  @Delete('properties/:id') @Permission('property:own') archiveProperty(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) { return this.customers.archiveProperty(req.actor, id); }
}

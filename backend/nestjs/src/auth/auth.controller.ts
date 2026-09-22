import { Body, Controller, Get, Header, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { Public, type AuthRequest } from './authorization.js';
import { RefreshDto, RequestOtpDto, VerifyOtpDto } from './auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Public() @Post('request-otp') @HttpCode(202) @Header('Cache-Control', 'no-store')
  requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) { return this.auth.requestOtp(dto.phone, req.ip ?? 'unknown'); }
  @Public() @Post('verify-otp') @HttpCode(200) @Header('Cache-Control', 'no-store')
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) { return this.auth.verifyOtp(dto.challengeId, dto.code, req.ip ?? 'unknown'); }
  @Public() @Post('provider/request-otp') @HttpCode(202) @Header('Cache-Control', 'no-store')
  requestProviderOtp(@Body() dto: RequestOtpDto, @Req() req: Request) { return this.auth.requestOtp(dto.phone, req.ip ?? 'unknown', 'provider'); }
  @Public() @Post('provider/verify-otp') @HttpCode(200) @Header('Cache-Control', 'no-store')
  verifyProviderOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) { return this.auth.verifyOtp(dto.challengeId, dto.code, req.ip ?? 'unknown', 'provider'); }
  @Public() @Post('admin/request-otp') @HttpCode(202) @Header('Cache-Control', 'no-store')
  requestAdminOtp(@Body() dto: RequestOtpDto, @Req() req: Request) { return this.auth.requestOtp(dto.phone, req.ip ?? 'unknown', 'admin'); }
  @Public() @Post('admin/verify-otp') @HttpCode(200) @Header('Cache-Control', 'no-store')
  verifyAdminOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) { return this.auth.verifyOtp(dto.challengeId, dto.code, req.ip ?? 'unknown', 'admin'); }
  @Public() @Post('refresh') @HttpCode(200) @Header('Cache-Control', 'no-store')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) { return this.auth.refresh(dto.refreshToken, req.ip ?? 'unknown'); }
  @Post('logout') @HttpCode(200)
  logout(@Req() req: AuthRequest) { return this.auth.logout(req.actor); }
  @Get('me') @Header('Cache-Control', 'no-store')
  me(@Req() req: AuthRequest) { return this.auth.me(req.actor); }
}

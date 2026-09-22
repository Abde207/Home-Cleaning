import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './authorization.js';
import { AuthService } from './auth.service.js';
import { OtpSender } from './otp-sender.js';
import { AuthController } from './auth.controller.js';

@Module({ controllers: [AuthController], providers: [AuthService, OtpSender, { provide: APP_GUARD, useClass: AuthGuard }], exports: [AuthService] })
export class AuthModule {}

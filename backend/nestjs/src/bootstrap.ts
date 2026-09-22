import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter, ApiResponseInterceptor, requestContext } from './common/http.js';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: process.env.NODE_ENV === 'test' ? ['error'] : ['log', 'warn', 'error'] });
  const config = app.get(ConfigService);
  app.use(requestContext);
  app.use(helmet());
  app.use(json({ limit: '64kb', verify: (req, _res, buffer) => { (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); } }));
  app.enableCors({ origin: config.getOrThrow<string[]>('CORS_ORIGINS'), credentials: false, exposedHeaders: ['x-request-id'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: () => new BadRequestException({ code: 'VALIDATION_INVALID_INPUT', message: 'Request fields are invalid.' }),
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.enableShutdownHooks();
  return app;
}

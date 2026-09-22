import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost, Catch, type ExceptionFilter, HttpException, Injectable, Logger,
  type CallHandler, type ExecutionContext, type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { map } from 'rxjs';
import { Prisma } from '@prisma/client';

export type ApiRequest = Request & { requestId: string };
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const header = req.header('x-request-id');
  const requestId = header && /^[a-zA-Z0-9_-]{1,64}$/.test(header) ? header : randomUUID();
  (req as ApiRequest).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const started = performance.now();
  res.on('finish', () => {
    new Logger('HTTP').log(JSON.stringify({ requestId, method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode, durationMs: Math.round(performance.now() - started) }));
  });
  next();
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<ApiRequest>();
    const parserType = typeof exception === 'object' && exception !== null && 'type' in exception ? exception.type : undefined;
    const prismaStatus = exception instanceof Prisma.PrismaClientKnownRequestError ? ({ P2002: 409, P2025: 404, P2003: 400 } as Record<string, number>)[exception.code] : undefined;
    const status = exception instanceof HttpException ? exception.getStatus() : prismaStatus ?? (parserType === 'entity.parse.failed' ? 400 : parserType === 'entity.too.large' ? 413 : 500);
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const detail = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
    const code = typeof detail.code === 'string' ? detail.code : ({ 400: 'VALIDATION_INVALID_INPUT', 401: 'AUTH_REQUIRED', 403: 'FORBIDDEN_RESOURCE', 404: 'RESOURCE_NOT_FOUND', 409: 'CONFLICT_OPERATION', 413: 'VALIDATION_TOO_LARGE', 429: 'AUTH_RATE_LIMITED', 503: 'SYSTEM_UNAVAILABLE' } as Record<number, string>)[status] ?? 'SYSTEM_ERROR';
    if (status >= 500) new Logger('API').error(JSON.stringify({ requestId: request.requestId, status, code }));
    response.status(status).json({
      success: false,
      error: {
        code,
        message: status >= 500 ? 'The service is temporarily unavailable.' : typeof detail.message === 'string' ? detail.message : 'The request could not be completed.',
      },
      meta: { requestId: request.requestId },
    });
  }
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    return next.handle().pipe(map(data => ({ success: true, data, meta: { requestId: request.requestId } })));
  }
}

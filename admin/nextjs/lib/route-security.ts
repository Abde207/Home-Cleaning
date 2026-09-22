import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from './api';

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (!origin || origin !== request.nextUrl.origin || (site && site !== 'same-origin')) {
    throw new ApiError(403, 'FORBIDDEN_RESOURCE', 'Cross-origin session requests are not allowed.');
  }
}

export async function jsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') ?? 0) > 4096) throw new ApiError(413, 'VALIDATION_TOO_LARGE', 'Request is too large.');
  const raw = await request.text();
  if (raw.length > 4096) throw new ApiError(413, 'VALIDATION_TOO_LARGE', 'Request is too large.');
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* invalid JSON */ }
  throw new ApiError(400, 'VALIDATION_INVALID_INPUT', 'Invalid request body.');
}

export function routeError(error: unknown) {
  const failure = error instanceof ApiError ? error : new ApiError(503, 'SYSTEM_UNAVAILABLE', 'The service is temporarily unavailable.');
  return NextResponse.json({ success: false, error: { code: failure.code, message: failure.message }, meta: { requestId: failure.requestId ?? null } },
    { status: failure.status, headers: { 'Cache-Control': 'no-store' } });
}


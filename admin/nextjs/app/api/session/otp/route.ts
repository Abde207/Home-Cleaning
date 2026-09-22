import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, ApiError } from '../../../../lib/api';
import { assertSameOrigin, jsonBody, routeError } from '../../../../lib/route-security';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await jsonBody(request);
    if (Object.keys(body).length !== 1 || typeof body.phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(body.phone)) {
      throw new ApiError(400, 'VALIDATION_INVALID_INPUT', 'Enter a valid international phone number.');
    }
    const data = await backendRequest<{ challengeId: string; expiresAt: string }>('/auth/admin/request-otp', { method: 'POST', body, requestId: request.headers.get('x-request-id') ?? undefined });
    return NextResponse.json({ success: true, data }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}

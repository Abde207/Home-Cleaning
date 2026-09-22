import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, ApiError } from '../../../../lib/api';
import { isPlatformAdmin, type Identity } from '../../../../lib/permissions';
import { assertSameOrigin, jsonBody, routeError } from '../../../../lib/route-security';
import { clearTokens, storeTokens, validTokens, type Tokens } from '../../../../lib/session';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await jsonBody(request);
    if (Object.keys(body).length !== 2 || typeof body.challengeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.challengeId)
      || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) {
      throw new ApiError(400, 'VALIDATION_INVALID_INPUT', 'Enter the challenge and six-digit code.');
    }
    const tokens = await backendRequest<Tokens>('/auth/admin/verify-otp', { method: 'POST', body, requestId: request.headers.get('x-request-id') ?? undefined });
    if (!validTokens(tokens)) throw new ApiError(503, 'SYSTEM_ERROR', 'Invalid token response.');
    const identity = await backendRequest<Identity>('/auth/me', { accessToken: tokens.accessToken });
    if (!isPlatformAdmin(identity)) {
      await backendRequest('/auth/logout', { method: 'POST', accessToken: tokens.accessToken }).catch(() => undefined);
      await clearTokens();
      throw new ApiError(403, 'FORBIDDEN_RESOURCE', 'Admin access required.');
    }
    await storeTokens(tokens);
    return NextResponse.json({ success: true, data: { id: identity.id, locale: identity.locale } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}

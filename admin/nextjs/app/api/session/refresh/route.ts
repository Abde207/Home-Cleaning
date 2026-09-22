import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { backendRequest, ApiError } from '../../../../lib/api';
import { isPlatformAdmin, type Identity } from '../../../../lib/permissions';
import { createRefreshCoalescer } from '../../../../lib/refresh-coalescer';
import { assertSameOrigin, routeError } from '../../../../lib/route-security';
import { clearTokens, REFRESH_COOKIE, storeTokens, validTokens, type Tokens } from '../../../../lib/session';

// Coalesce concurrent rotations of the same incoming cookie in this Next process.
// Multi-instance deployments require a shared lock/result handoff before scaling out.
const coalesce = createRefreshCoalescer<Tokens>();

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const oldToken = (await cookies()).get(REFRESH_COOKIE)?.value;
    if (!oldToken || !/^[A-Za-z0-9_-]{43}$/.test(oldToken)) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in again.');
    const tokens = await coalesce(oldToken, () => backendRequest<Tokens>('/auth/refresh', {
      method: 'POST', body: { refreshToken: oldToken }, requestId: request.headers.get('x-request-id') ?? undefined,
    }));
    if (!validTokens(tokens)) throw new ApiError(503, 'SYSTEM_ERROR', 'Invalid token response.');
    const identity = await backendRequest<Identity>('/auth/me', { accessToken: tokens.accessToken });
    if (!isPlatformAdmin(identity)) {
      await backendRequest('/auth/logout', { method: 'POST', accessToken: tokens.accessToken }).catch(() => undefined);
      await clearTokens();
      throw new ApiError(403, 'FORBIDDEN_RESOURCE', 'Admin access required.');
    }
    await storeTokens(tokens);
    return NextResponse.json({ success: true, data: { refreshed: true } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) await clearTokens();
    return routeError(error);
  }
}

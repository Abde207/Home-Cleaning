import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { backendRequest, ApiError } from '../../../../lib/api';
import { assertSameOrigin, routeError } from '../../../../lib/route-security';
import { ACCESS_COOKIE, clearTokens } from '../../../../lib/session';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (token) {
      try { await backendRequest('/auth/logout', { method: 'POST', accessToken: token }); }
      catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
    }
    await clearTokens();
    return NextResponse.json({ success: true, data: { signedOut: true } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}

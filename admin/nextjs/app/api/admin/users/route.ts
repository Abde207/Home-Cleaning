import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, ApiError } from '../../../../lib/api';
import { assertSameOrigin, jsonBody, routeError } from '../../../../lib/route-security';
import { ACCESS_COOKIE } from '../../../../lib/session';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await jsonBody(request);
    const allowed = ['phone', 'name', 'role', 'companyId', 'teamId'];
    if (Object.keys(body).some(key => !allowed.includes(key)) || typeof body.phone !== 'string' || typeof body.name !== 'string' || typeof body.role !== 'string') {
      throw new ApiError(400, 'VALIDATION_INVALID_INPUT', 'Enter the required identity fields.');
    }
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    const data = await backendRequest('/admin/users', { method: 'POST', body, accessToken: token, requestId: request.headers.get('x-request-id') ?? undefined });
    return NextResponse.json({ success: true, data, meta: { requestId: request.headers.get('x-request-id') ?? null } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}

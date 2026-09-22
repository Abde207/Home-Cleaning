import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, ApiError } from '../../../../../../lib/api';
import { assertSameOrigin, jsonBody, routeError } from '../../../../../../lib/route-security';
import { ACCESS_COOKIE } from '../../../../../../lib/session';
import { cookies } from 'next/headers';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    if (!uuid.test(id)) throw new ApiError(400, 'VALIDATION_INVALID_INPUT', 'The user identifier is invalid.');
    const body = await jsonBody(request);
    if (Object.keys(body).length !== 1 || !['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].includes(String(body.status))) throw new ApiError(400, 'VALIDATION_INVALID_INPUT', 'The user status is invalid.');
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    const data = await backendRequest(`/admin/users/${id}/status`, { method: 'PUT', body, accessToken: token, requestId: request.headers.get('x-request-id') ?? undefined });
    return NextResponse.json({ success: true, data, meta: { requestId: request.headers.get('x-request-id') ?? null } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}

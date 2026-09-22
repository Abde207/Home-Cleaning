import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, ApiError } from '../../../../../../../lib/api';
import { assertSameOrigin, routeError } from '../../../../../../../lib/route-security';
import { ACCESS_COOKIE } from '../../../../../../../lib/session';
import { cookies } from 'next/headers';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; grantId: string }> }) {
  try {
    assertSameOrigin(request);
    const { id, grantId } = await params;
    if (!uuid.test(id) || !uuid.test(grantId)) throw new ApiError(400, 'VALIDATION_INVALID_INPUT', 'The identity grant identifier is invalid.');
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    const data = await backendRequest(`/admin/users/${id}/roles/${grantId}`, { method: 'DELETE', accessToken: token, requestId: request.headers.get('x-request-id') ?? undefined });
    return NextResponse.json({ success: true, data, meta: { requestId: request.headers.get('x-request-id') ?? null } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}

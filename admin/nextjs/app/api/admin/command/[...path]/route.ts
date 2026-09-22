import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, ApiError } from '../../../../../lib/api';
import { assertSameOrigin, jsonBody, routeError } from '../../../../../lib/route-security';
import { ACCESS_COOKIE } from '../../../../../lib/session';
import { cookies } from 'next/headers';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const allowed = [
  new RegExp(`^admin/companies$`), new RegExp(`^admin/companies/${uuid}$`), new RegExp(`^admin/companies/${uuid}/service-areas$`), new RegExp(`^admin/companies/${uuid}/service-areas/${uuid}$`),
  new RegExp(`^provider/teams$`), new RegExp(`^provider/teams/${uuid}$`), new RegExp(`^provider/teams/${uuid}/availability$`), new RegExp(`^provider/teams/${uuid}/availability/${uuid}$`), new RegExp(`^provider/teams/${uuid}/capabilities$`), new RegExp(`^provider/teams/${uuid}/availability-status$`), new RegExp(`^provider/teams/${uuid}/location$`),
  new RegExp(`^admin/services$`), new RegExp(`^admin/services/${uuid}$`), new RegExp(`^admin/services/${uuid}/extras$`), new RegExp(`^admin/services/${uuid}/extras/${uuid}$`),
  new RegExp(`^admin/users$`),
  new RegExp(`^admin/pricing/rules$`), new RegExp(`^admin/pricing/rules/${uuid}/activation$`), new RegExp(`^admin/promotions$`), new RegExp(`^admin/promotions/${uuid}/activation$`),
  new RegExp(`^dispatch/bookings/${uuid}/offer$`), new RegExp(`^dispatch/bookings/${uuid}/manual$`),
  new RegExp(`^bookings/${uuid}/retry-assignment$`), new RegExp(`^bookings/${uuid}/no-team-available$`), new RegExp(`^bookings/${uuid}/cancel$`),
  new RegExp(`^assignments/${uuid}/team-no-show$`), new RegExp(`^assignments/${uuid}/customer-no-show$`),
  new RegExp(`^payments/${uuid}/retry$`), new RegExp(`^payments/${uuid}/refunds$`),
  new RegExp(`^bookings/${uuid}/start-payment-reconciliation$`), new RegExp(`^bookings/${uuid}/reconcile-payment$`), new RegExp(`^bookings/${uuid}/complete$`),
  new RegExp(`^settlements$`), new RegExp(`^settlements/${uuid}/calculate$`), new RegExp(`^settlements/${uuid}/submit-review$`), new RegExp(`^settlements/${uuid}/approve$`), new RegExp(`^settlements/${uuid}/payments$`), new RegExp(`^settlements/${uuid}/reconcile$`), new RegExp(`^settlements/${uuid}/close$`), new RegExp(`^settlements/${uuid}/cancel$`), new RegExp(`^settlements/${uuid}/reverse$`),
];

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return forward(request, context, 'POST'); }
export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return forward(request, context, 'PUT'); }
export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return forward(request, context, 'DELETE'); }

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }, method: 'POST' | 'PUT' | 'DELETE') {
  try {
    assertSameOrigin(request);
    const path = (await context.params).path.join('/');
    if (!allowed.some(pattern => pattern.test(path))) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Command route not found.');
    const body = method === 'DELETE' ? undefined : await jsonBody(request);
    const idempotencyKey = request.headers.get('idempotency-key') ?? undefined;
    if (idempotencyKey !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(idempotencyKey)) throw new ApiError(400, 'VALIDATION_INVALID_INPUT', 'Invalid idempotency key.');
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    const data = await backendRequest(`/${path}`, { method, body, accessToken: token, requestId: request.headers.get('x-request-id') ?? undefined, idempotencyKey });
    return NextResponse.json({ success: true, data, meta: { requestId: request.headers.get('x-request-id') ?? null } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}

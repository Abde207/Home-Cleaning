import { randomUUID } from 'node:crypto';
import { adminEnvironment } from './environment.ts';

export type ApiEnvelope<T> = { success: true; data: T; meta: { requestId: string } };
export class ApiError extends Error {
  public status: number;
  public code: string;
  public requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export function backendUrl() {
  return adminEnvironment().backendApiUrl;
}

export async function backendRequest<T>(path: `/${string}`, options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; accessToken?: string; requestId?: string; idempotencyKey?: string } = {}): Promise<T> {
  if (path.startsWith('//') || path.includes('#') || /[\r\n]/.test(path)) throw new Error('Use a fixed backend API path');
  const requestId = options.requestId && /^[A-Za-z0-9_-]{1,64}$/.test(options.requestId) ? options.requestId : randomUUID();
  let response: Response;
  try {
    response = await fetch(`${backendUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: { 'x-request-id': requestId, ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}), ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(503, 'SYSTEM_UNAVAILABLE', 'The backend is unavailable.', requestId);
  }
  const payload = await response.json().catch(() => null) as (ApiEnvelope<T> & { error?: { code?: string; message?: string } }) | null;
  const responseId = payload?.meta?.requestId ?? response.headers.get('x-request-id') ?? requestId;
  if (!response.ok || !payload?.success) {
    throw new ApiError(response.status, payload?.error?.code ?? 'SYSTEM_ERROR', payload?.error?.message ?? 'The request failed.', responseId);
  }
  return payload.data;
}

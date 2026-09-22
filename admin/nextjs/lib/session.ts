import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { backendRequest, ApiError } from './api';
import type { Identity } from './permissions';

export const ACCESS_COOKIE = 'hc_admin_access';
export const REFRESH_COOKIE = 'hc_admin_refresh';
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export type Tokens = { accessToken: string; refreshToken: string; accessExpiresAt: string; refreshExpiresAt: string; tokenType: 'Bearer' };

export function validTokens(value: unknown): value is Tokens {
  if (!value || typeof value !== 'object') return false;
  const tokens = value as Record<string, unknown>;
  return tokenPattern.test(String(tokens.accessToken ?? '')) && tokenPattern.test(String(tokens.refreshToken ?? ''))
    && tokens.tokenType === 'Bearer' && Number.isFinite(Date.parse(String(tokens.accessExpiresAt)))
    && Number.isFinite(Date.parse(String(tokens.refreshExpiresAt)));
}

export async function storeTokens(tokens: Tokens) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  jar.set(ACCESS_COOKIE, tokens.accessToken, { httpOnly: true, secure, sameSite: 'strict', path: '/', expires: new Date(tokens.accessExpiresAt) });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, { httpOnly: true, secure, sameSite: 'strict', path: '/api/session', expires: new Date(tokens.refreshExpiresAt) });
}

export async function clearTokens() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.set(REFRESH_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/session', maxAge: 0 });
}

export const sessionIdentity = cache(async (): Promise<Identity> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token || !tokenPattern.test(token)) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in again.');
  return backendRequest<Identity>('/auth/me', { accessToken: token });
});

// Every server page that may load data must call this before querying/rendering.
// Next can render a child page before its parent layout, so layout gating alone is insufficient.
export async function mayRenderAdminPage() {
  try { return (await import('./permissions')).isPlatformAdmin(await sessionIdentity()); }
  catch (error) { if (error instanceof ApiError && [401, 403].includes(error.status)) return false; throw error; }
}

export async function backendForAdmin<T>(path: `/${string}`): Promise<T> {
  const identity = await sessionIdentity();
  const { isPlatformAdmin } = await import('./permissions');
  if (!isPlatformAdmin(identity)) throw new ApiError(403, 'FORBIDDEN_RESOURCE', 'Admin access required.');
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  return backendRequest<T>(path, { accessToken: token });
}

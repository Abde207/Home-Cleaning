import { createSign, randomUUID } from 'node:crypto';

export type PushMessage = { token: string; title: string; body: string; data: Record<string, string>; deliveryId?: string; platform?: string };
export class InvalidPushTokenError extends Error {}
export interface PushNotificationProvider { readonly name: string; send(message: PushMessage): Promise<{ providerReference: string }>; }

/** Local provider used by tests and development; production adapters can implement the same contract. */
export class MockPushNotificationProvider implements PushNotificationProvider {
  readonly name = 'mock';
  async send(message: PushMessage) {
    if (message.token.startsWith('invalid-')) throw new InvalidPushTokenError('Token rejected by provider');
    if (message.token.startsWith('retry-')) throw new Error('Temporary provider failure');
    return { providerReference: `mock-push-${randomUUID()}` };
  }
}

/** iOS tokens are Firebase registration tokens; Firebase forwards iOS delivery through APNs. */
export class FcmPushNotificationProvider implements PushNotificationProvider {
  readonly name = 'fcm_apns';
  private cached?: { value: string; expiresAt: number };
  constructor(private readonly projectId: string, private readonly clientEmail: string,
    private readonly privateKey: string, private readonly request: typeof fetch = fetch) {}
  private async accessToken() {
    if (this.cached && this.cached.expiresAt > Date.now() + 60_000) return this.cached.value;
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({ iss: this.clientEmail, scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })).toString('base64url');
    const input = `${header}.${claim}`;
    const signature = createSign('RSA-SHA256').update(input).sign(this.privateKey, 'base64url');
    let response: Response;
    try { response = await this.request('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(8_000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${input}.${signature}` }) }); }
    catch { throw new Error('PUSH_AUTH_UNAVAILABLE'); }
    if (!response.ok) throw new Error('PUSH_AUTH_REJECTED');
    const token = await response.json() as { access_token?: string; expires_in?: number };
    if (!token.access_token) throw new Error('PUSH_AUTH_INVALID_RESPONSE');
    this.cached = { value: token.access_token, expiresAt: Date.now() + Math.min(token.expires_in ?? 3600, 3600) * 1000 };
    return this.cached.value;
  }
  async send(message: PushMessage) {
    const access = await this.accessToken();
    let response: Response;
    try { response = await this.request(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/messages:send`, {
      method: 'POST', signal: AbortSignal.timeout(8_000),
      headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { token: message.token, notification: { title: message.title, body: message.body },
        data: message.data, android: { collapse_key: message.deliveryId },
        apns: { headers: { 'apns-collapse-id': message.deliveryId?.slice(0, 64) } } } }),
    }); } catch { throw new Error('PUSH_PROVIDER_UNAVAILABLE'); }
    if (response.status === 404) throw new InvalidPushTokenError('PUSH_TOKEN_UNREGISTERED');
    if (!response.ok) throw new Error('PUSH_PROVIDER_REJECTED');
    const result = await response.json() as { name?: string };
    if (!result.name) throw new Error('PUSH_PROVIDER_INVALID_RESPONSE');
    return { providerReference: result.name };
  }
}

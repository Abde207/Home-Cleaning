import { randomUUID } from 'node:crypto';

export type PushMessage = { token: string; title: string; body: string; data: Record<string, string> };
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

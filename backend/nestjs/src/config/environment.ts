import { dispatchConfig } from '../dispatch/dispatch.config.js';

export type AppEnvironment = 'development' | 'test' | 'staging' | 'production';
export type BackendEnvironment = Record<string, unknown> & {
  NODE_ENV: 'development' | 'test' | 'production'; APP_ENVIRONMENT: AppEnvironment;
  PORT: number; HOST: string; DATABASE_URL: string; REDIS_URL: string;
  CORS_ORIGINS: string[]; OTP_HASH_SECRET: string; OTP_DELIVERY_MODE: 'file' | 'twilio';
  PAYMENT_PROVIDER: 'mock' | 'tap'; PAYMENT_WEBHOOK_SECRET?: string;
};

function required(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`);
  return value;
}

function serviceUrl(value: string, key: string, protocols: string[]) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${key} must be a valid URL`); }
  if (!protocols.includes(url.protocol) || !url.hostname || url.hash) throw new Error(`${key} must use a supported protocol and host`);
  return url;
}

export function validateEnvironment(input: Record<string, unknown>): BackendEnvironment {
  const nodeEnv = String(input.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV is invalid');
  const environment = String(input.APP_ENVIRONMENT ?? nodeEnv);
  if (!['development', 'test', 'staging', 'production'].includes(environment)) throw new Error('APP_ENVIRONMENT is invalid');
  if ((environment === 'staging' || environment === 'production') !== (nodeEnv === 'production') ||
      (environment === 'test' && nodeEnv !== 'test') || (environment === 'development' && nodeEnv !== 'development')) {
    throw new Error('APP_ENVIRONMENT and NODE_ENV are inconsistent');
  }
  const port = Number(input.PORT ?? (environment === 'development' || environment === 'test' ? 3001 : NaN));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  const host = String(input.HOST ?? (environment === 'development' || environment === 'test' ? '127.0.0.1' : ''));
  if (!host || /[\s/:]/.test(host)) throw new Error('HOST is required and must be a hostname or IP address');
  const databaseUrl = required(input, 'DATABASE_URL');
  const redisUrl = required(input, 'REDIS_URL');
  const database = serviceUrl(databaseUrl, 'DATABASE_URL', ['postgres:', 'postgresql:']);
  const redis = serviceUrl(redisUrl, 'REDIS_URL', ['redis:', 'rediss:']);
  if (environment === 'staging' || environment === 'production') {
    const local = (host: string) => ['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase());
    if (local(database.hostname) || database.searchParams.has('host') ||
        database.searchParams.get('sslmode') !== 'require' || database.searchParams.get('sslaccept') !== 'strict')
      throw new Error('DATABASE_URL must use a nonlocal host and verified TLS');
    if (local(redis.hostname) || redis.protocol !== 'rediss:')
      throw new Error('REDIS_URL must target managed Redis with TLS');
    if (!database.username || !database.password || !redis.password)
      throw new Error('Database and Redis credentials are required');
  }
  const origins = String(input.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origins.length) throw new Error('CORS_ORIGINS must list allowed browser origins');
  for (const origin of origins) {
    const url = serviceUrl(origin, 'CORS_ORIGINS', ['http:', 'https:']);
    if (url.origin !== origin || ((environment === 'staging' || environment === 'production') && url.protocol !== 'https:')) {
      throw new Error('CORS_ORIGINS contains an invalid origin');
    }
  }
  const otpSecret = required(input, 'OTP_HASH_SECRET');
  if (otpSecret.length < 32) throw new Error('OTP_HASH_SECRET must contain at least 32 characters');
  const deliveryMode = required(input, 'OTP_DELIVERY_MODE');
  if (deliveryMode !== 'file' && deliveryMode !== 'twilio') throw new Error('OTP_DELIVERY_MODE must be file or twilio');
  if ((environment === 'staging' || environment === 'production') && deliveryMode === 'file') throw new Error('File OTP delivery is local-only');
  if (deliveryMode === 'twilio' && (!/^AC[0-9a-f]{32}$/i.test(String(input.TWILIO_ACCOUNT_SID)) ||
      !/^VA[0-9a-f]{32}$/i.test(String(input.TWILIO_VERIFY_SERVICE_SID)) ||
      !input.TWILIO_AUTH_TOKEN)) throw new Error('Twilio Verify configuration is incomplete');
  const provider = String(input.PAYMENT_PROVIDER ?? (environment === 'development' || environment === 'test' ? 'mock' : ''));
  if (provider !== 'mock' && provider !== 'tap') throw new Error('PAYMENT_PROVIDER is unsupported');
  if (environment === 'production' && provider !== 'tap') throw new Error('Production requires Tap payment provider');
  const webhookSecret = provider === 'mock' ? required(input, 'PAYMENT_WEBHOOK_SECRET') : undefined;
  if (webhookSecret && webhookSecret.length < 32) throw new Error('PAYMENT_WEBHOOK_SECRET must contain at least 32 characters');
  if (provider === 'tap') {
    if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(required(input, 'TAP_SECRET_KEY'))) throw new Error('TAP_SECRET_KEY is invalid');
    if (environment === 'production' && !String(input.TAP_SECRET_KEY).startsWith('sk_live_')) throw new Error('Production requires a live Tap key');
    if (environment !== 'production' && String(input.TAP_SECRET_KEY).startsWith('sk_live_')) throw new Error('Live Tap key outside production');
    for (const key of ['TAP_WEBHOOK_URL', 'TAP_REDIRECT_URL']) {
      const url = serviceUrl(required(input, key), key, ['https:']);
      if (url.username || url.password || url.search || url.hash) throw new Error(`${key} must be a clean HTTPS URL`);
    }
  }
  const pushProvider = String(input.PUSH_PROVIDER ?? 'mock');
  if (environment === 'staging' || environment === 'production') {
    for (const key of ['PAYMENT_PROVIDER', 'PUSH_PROVIDER', 'MAPS_PROVIDER', 'STORAGE_PROVIDER']) required(input, key);
  }
  if (!['mock', 'fcm_apns'].includes(pushProvider)) throw new Error('PUSH_PROVIDER is unsupported');
  if (environment === 'production' && pushProvider === 'mock') throw new Error('Production push provider is required');
  if (pushProvider === 'fcm_apns') {
    for (const key of ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY']) required(input, key);
    if (input.IOS_PUSH_TRANSPORT !== 'fcm_apns') throw new Error('IOS_PUSH_TRANSPORT must explicitly select the Firebase APNs bridge');
  }
  const mapsProvider = String(input.MAPS_PROVIDER ?? 'mock');
  const storageProvider = String(input.STORAGE_PROVIDER ?? 'local');
  if (mapsProvider !== 'mock' || storageProvider !== 'local') throw new Error('Maps/storage production provider selection is pending');
  if (environment === 'production') throw new Error('Production maps and object storage providers are pending');
  for (const [key, fallback, min, max] of [['ARRIVAL_GEOFENCE_METERS', 100, 10, 1000], ['TRACKING_STALE_SECONDS', 120, 30, 3600]] as const) {
    const value = Number(input[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} is invalid`);
  }
  dispatchConfig(input as NodeJS.ProcessEnv);
  for (const key of ['DISPATCH_WORKER_ENABLED', 'NOTIFICATION_WORKER_ENABLED']) {
    if (input[key] !== undefined && !['true', 'false'].includes(String(input[key]))) throw new Error(`${key} must be true or false`);
  }
  return { ...input, NODE_ENV: nodeEnv as BackendEnvironment['NODE_ENV'], APP_ENVIRONMENT: environment as AppEnvironment,
    PORT: port, HOST: host, DATABASE_URL: databaseUrl, REDIS_URL: redisUrl, CORS_ORIGINS: origins,
    OTP_HASH_SECRET: otpSecret, OTP_DELIVERY_MODE: deliveryMode, PAYMENT_PROVIDER: provider, PAYMENT_WEBHOOK_SECRET: webhookSecret };
}

export type AdminEnvironment = 'development' | 'test' | 'staging' | 'production';

export function adminEnvironment(input: NodeJS.ProcessEnv = process.env) {
  const runtime = input.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(runtime)) throw new Error('NODE_ENV is invalid');
  const environment = input.APP_ENVIRONMENT ?? runtime;
  if (!['development', 'test', 'staging', 'production'].includes(environment)) throw new Error('APP_ENVIRONMENT is invalid');
  if ((environment === 'staging' || environment === 'production') !== (runtime === 'production') ||
      (environment === 'test' && runtime !== 'test') || (environment === 'development' && runtime !== 'development')) {
    throw new Error('APP_ENVIRONMENT and NODE_ENV are inconsistent');
  }
  const raw = input.BACKEND_API_URL;
  if (!raw) throw new Error('BACKEND_API_URL is required');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('BACKEND_API_URL must be a valid URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/api/v1') {
    throw new Error('BACKEND_API_URL must be an HTTP(S) URL ending in /api/v1 without credentials or query');
  }
  if ((environment === 'staging' || environment === 'production') && url.protocol !== 'https:' &&
      !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Staging/production BACKEND_API_URL must use HTTPS unless loopback');
  }
  return { environment: environment as AdminEnvironment, backendApiUrl: url.toString().replace(/\/$/, '') };
}

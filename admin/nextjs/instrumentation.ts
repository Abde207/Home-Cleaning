import { adminEnvironment } from './lib/environment.ts';

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') adminEnvironment();
}

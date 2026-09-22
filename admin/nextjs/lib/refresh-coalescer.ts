import { createHash } from 'node:crypto';

// A process-local single-flight result for overlapping requests with one old cookie.
export function createRefreshCoalescer<T>(retentionMs = 30_000) {
  const rotations = new Map<string, Promise<T>>();
  return function coalesce(token: string, rotate: () => Promise<T>): Promise<T> {
    const key = createHash('sha256').update(token).digest('hex');
    const existing = rotations.get(key);
    if (existing) return existing;
    const pending = Promise.resolve().then(rotate);
    rotations.set(key, pending);
    void pending.finally(() => {
      const timer = setTimeout(() => rotations.delete(key), retentionMs);
      timer.unref?.();
    }).catch(() => undefined);
    return pending;
  };
}


import type { IKVRepository } from '../services/types';

export function isKvConflictError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status === 409) return true;
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /cambiaron|conflict|recarga antes de guardar/i.test(msg);
}

/**
 * Lee lo último del servidor, aplica solo el cambio local (`apply`) y guarda con esa revisión.
 * Si otro usuario guardó en medio (409), vuelve a leer y reaplica: nunca pisa datos ajenos.
 */
export async function kvAtomicUpdate<T>(input: {
  kv: IKVRepository;
  key: string;
  merge: (raw: T | null) => T;
  apply: (fresh: T) => T;
  maxAttempts?: number;
}): Promise<T> {
  const { kv, key, merge, apply } = input;
  const maxAttempts = input.maxAttempts ?? 4;
  const write = kv.setStrict ? kv.setStrict.bind(kv) : kv.set.bind(kv);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const read = kv.getWithStatus
      ? await kv.getWithStatus<T>(key)
      : { ok: true, value: await kv.get<T>(key) };
    if (!read.ok) {
      throw new Error('No se pudo leer la versión actual del servidor.');
    }
    const next = apply(merge(read.value));
    try {
      await write(key, next);
      return next;
    } catch (error) {
      lastError = error;
      if (!isKvConflictError(error) || attempt === maxAttempts) throw error;
      await new Promise((r) => setTimeout(r, 100 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

import type { MutableRefObject } from 'react';
import { api } from '../services/api';

export type KvSaveResult = 'saved' | 'skipped' | 'failed';

/** Promesa inicial de cadenas KV (no usar `true` — rompe kvSaveSucceeded). */
export const KV_CHAIN_IDLE: Promise<KvSaveResult> = Promise.resolve('saved');

/**
 * Encadena `saveKey` por clave KV: cada POST espera al anterior y envía
 * siempre el último snapshot en `latestRef`.
 *
 * Si `generationRef` cambió desde que se encoló (logout / re-hidratar),
 * se omite la escritura y devuelve `skipped` (no confundir con éxito).
 */
export function enqueueKvSerializedSave<T>(
  chainRef: MutableRefObject<Promise<KvSaveResult>>,
  generationRef: MutableRefObject<number>,
  latestRef: MutableRefObject<T>,
  kvKey: string,
  payload: T,
  options?: { updateLatestRef?: boolean }
): Promise<KvSaveResult> {
  if (options?.updateLatestRef !== false) {
    latestRef.current = payload;
  }
  const genAtEnqueue = generationRef.current;
  const snapshot = payload;
  const next = chainRef.current.then(async (): Promise<KvSaveResult> => {
    if (generationRef.current !== genAtEnqueue) {
      return 'skipped';
    }
    const toSave = options?.updateLatestRef === false ? snapshot : latestRef.current;
    const ok = await api.saveKey(kvKey, toSave as unknown);
    return ok ? 'saved' : 'failed';
  });
  chainRef.current = next.catch(() => 'failed' as KvSaveResult);
  return next;
}

/** Espera a que terminen los guardados encolados (p. ej. antes de logout). */
export async function flushKvSaveChain(
  chainRef: MutableRefObject<Promise<KvSaveResult>>
): Promise<KvSaveResult> {
  try {
    return await chainRef.current;
  } catch {
    return 'failed';
  }
}

export async function flushKvSaveChains(
  chainRefs: MutableRefObject<Promise<KvSaveResult>>[]
): Promise<void> {
  await Promise.all(chainRefs.map((ref) => flushKvSaveChain(ref)));
}

/** Compat: true solo si el guardado llegó a la nube. */
export function kvSaveSucceeded(result: KvSaveResult): boolean {
  return result === 'saved';
}

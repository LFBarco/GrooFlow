import type { MutableRefObject } from 'react';
import { api } from '../services/api';

/**
 * Encadena `saveKey` por clave KV: cada POST espera al anterior y envía
 * siempre el último snapshot en `latestRef` (evita que un guardado viejo
 * sobrescriba uno nuevo cuando hay cambios seguidos).
 *
 * Si `generationRef` cambió desde que se encoló (hidratar KV / logout),
 * se omite la escritura para no volcar estado invalidado.
 */
export function enqueueKvSerializedSave<T>(
  chainRef: MutableRefObject<Promise<boolean>>,
  generationRef: MutableRefObject<number>,
  latestRef: MutableRefObject<T>,
  kvKey: string,
  payload: T
): Promise<boolean> {
  latestRef.current = payload;
  const genAtEnqueue = generationRef.current;
  const next = chainRef.current.then(async (): Promise<boolean> => {
    if (generationRef.current !== genAtEnqueue) {
      return true;
    }
    return api.saveKey(kvKey, latestRef.current as unknown);
  });
  chainRef.current = next.catch(() => false);
  return next;
}

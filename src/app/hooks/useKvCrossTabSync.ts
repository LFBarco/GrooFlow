import { useEffect, type MutableRefObject } from 'react';
import { subscribeKvCrossTab } from '../utils/kvCrossTabSync';

/**
 * Escucha actualizaciones KV desde otras pestañas del mismo navegador.
 * `applyRef` debe apuntar siempre al handler más reciente (evita closures obsoletos).
 */
export function useKvCrossTabSync(
  enabled: boolean,
  applyRef: MutableRefObject<((key: string, value: unknown) => void) | null>
): void {
  useEffect(() => {
    if (!enabled) return;
    return subscribeKvCrossTab((msg) => {
      applyRef.current?.(msg.key, msg.value);
    });
  }, [enabled, applyRef]);
}

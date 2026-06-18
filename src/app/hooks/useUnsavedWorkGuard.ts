import { useEffect, type MutableRefObject } from 'react';

import { getKvSavesInFlightCount } from '../utils/kvSerializedSave';

export type UseUnsavedWorkGuardOptions = {
  enabled: boolean;
  cloudSyncPendingRef: MutableRefObject<number>;
  cloudSyncErrorRef: MutableRefObject<boolean>;
};

/**
 * Avisa al cerrar/recargar la pestaña si hay guardados en vuelo o error de sync sin resolver.
 */
export function useUnsavedWorkGuard(options: UseUnsavedWorkGuardOptions): void {
  const { enabled, cloudSyncPendingRef, cloudSyncErrorRef } = options;

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      const pending =
        cloudSyncPendingRef.current > 0 ||
        getKvSavesInFlightCount() > 0 ||
        cloudSyncErrorRef.current;
      if (!pending) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, cloudSyncPendingRef, cloudSyncErrorRef]);
}

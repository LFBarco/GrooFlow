import { useEffect, useRef } from 'react';

import { recoverSupabaseSessionAfterIdle } from '../utils/sessionRecovery';

export type SessionRecoveryOnFocusOptions = {
  enabled: boolean;
  /** Libera indicadores o flags que pudieron quedar bloqueados tras idle. */
  onRecover?: () => void;
};

/**
 * Al volver a la pestaña tras idle, renueva la sesión Supabase antes de que el
 * usuario intente guardar (evita guardados colgados hasta F5).
 */
export function useSessionRecoveryOnFocus(options: SessionRecoveryOnFocusOptions): void {
  const { enabled, onRecover } = options;
  const recoveringRef = useRef(false);
  const onRecoverRef = useRef(onRecover);
  onRecoverRef.current = onRecover;

  useEffect(() => {
    if (!enabled) return;

    const recover = async () => {
      if (recoveringRef.current || document.visibilityState !== 'visible') return;
      recoveringRef.current = true;
      try {
        const ok = await recoverSupabaseSessionAfterIdle();
        if (ok) onRecoverRef.current?.();
      } catch (e) {
        console.warn('[GrooFlow] recuperación de sesión al volver a la pestaña', e);
      } finally {
        recoveringRef.current = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void recover();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled]);
}

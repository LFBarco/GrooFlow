import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { saveAppKvKey } from '../services/repository/appKvSql';
import { getSupabaseClient } from '../services/repository/supabase';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import type { SystemSettings } from '../types';
import type { AsistenciaSettings } from '../types/asistencia';
import { mergeAsistenciaSettings } from '../utils/asistenciaData';
import {
  ASISTENCIA_SETTINGS_KV_KEY,
  mergeAsistenciaIntoSystemSettings,
} from '../utils/asistenciaPersistence';
import { persistKvDomainNow } from '../utils/kvDomainPersistence';
import { PRODUCTION_REMOTE_COOLDOWN_MS } from '../utils/listRemoteSyncGuard';
import { ensureSqlSave } from '../utils/sqlAutosaveBackup';
import { type KvSaveResult } from '../utils/kvSerializedSave';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();
const SQL_ERROR_TOAST_MS = 10_000;

export type UseAsistenciaPersistenceOptions = {
  isDataLoaded: boolean;
  systemSettingsHydratedRef: MutableRefObject<boolean>;
  setSystemSettings: Dispatch<SetStateAction<SystemSettings>>;
  systemSettingsLatestRef: MutableRefObject<SystemSettings>;
  asistenciaLatestRef: MutableRefObject<AsistenciaSettings>;
  asistenciaChainRef: MutableRefObject<Promise<KvSaveResult>>;
  skipHydrateRef: MutableRefObject<boolean>;
  cooldownUntilRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
};

export function useAsistenciaPersistence(options: UseAsistenciaPersistenceOptions) {
  const {
    isDataLoaded,
    systemSettingsHydratedRef,
    setSystemSettings,
    systemSettingsLatestRef,
    asistenciaLatestRef,
    asistenciaChainRef,
    skipHydrateRef,
    cooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  } = options;

  const sqlErrorToastAtRef = useRef(0);

  const persistAsistenciaNow = useCallback(
    async (
      updater: (prev: AsistenciaSettings) => AsistenciaSettings,
      successMessage?: string
    ): Promise<boolean> => {
      if (!isDataLoaded || !systemSettingsHydratedRef.current) {
        toast.error(
          'Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.'
        );
        return false;
      }

      const prevAsistencia = mergeAsistenciaSettings(asistenciaLatestRef.current);
      const nextAsistencia = mergeAsistenciaSettings(updater(prevAsistencia));
      const nextSettings = mergeAsistenciaIntoSystemSettings(
        systemSettingsLatestRef.current,
        nextAsistencia
      );

      asistenciaLatestRef.current = nextAsistencia;
      systemSettingsLatestRef.current = nextSettings;
      setSystemSettings(nextSettings);

      // 1) KV primero (rápido) — sin spinner global de la app
      const kvOk = await persistKvDomainNow({
        kvKey: ASISTENCIA_SETTINGS_KV_KEY,
        payload: nextAsistencia,
        refs: {
          hydratedFromKvRef: systemSettingsHydratedRef,
          skipHydrateRef,
          cooldownUntilRef,
          chainRef: asistenciaChainRef,
          latestRef: asistenciaLatestRef,
        },
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        errorMessage: 'No se pudo guardar la configuración de Asistencia en la nube.',
        successMessage,
      });

      if (!kvOk) return false;

      cooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;

      // 2) SQL en segundo plano (no bloquea al usuario)
      if (PRODUCTION_USE_SQL) {
        void (async () => {
          const { data: sess } = await getSupabaseClient().auth.getSession();
          const uid = sess.session?.user?.id ?? null;
          const sqlOk = await ensureSqlSave(
            true,
            ASISTENCIA_SETTINGS_KV_KEY,
            () => saveAppKvKey(getSupabaseClient(), ASISTENCIA_SETTINGS_KV_KEY, nextAsistencia, uid),
            lastSaveErrorAtRef,
            'No se pudo guardar la configuración de Asistencia en SQL. Revisa sesión o permisos.'
          );
          if (!sqlOk) {
            const now = Date.now();
            if (now - sqlErrorToastAtRef.current > SQL_ERROR_TOAST_MS) {
              sqlErrorToastAtRef.current = now;
              toast.error(
                'Asistencia guardada en la nube (KV) pero falló la réplica SQL. Reintenta guardar en unos segundos.'
              );
            }
          }
        })();
      }

      return true;
    },
    [
      isDataLoaded,
      systemSettingsHydratedRef,
      asistenciaLatestRef,
      systemSettingsLatestRef,
      setSystemSettings,
      asistenciaChainRef,
      skipHydrateRef,
      cooldownUntilRef,
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
    ]
  );

  return { persistAsistenciaNow };
}

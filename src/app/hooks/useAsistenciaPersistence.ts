import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { saveAppKvKey } from '../services/repository/appKvSql';
import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
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
      const prevSettings = systemSettingsLatestRef.current;
      const nextAsistencia = mergeAsistenciaSettings(updater(prevAsistencia));
      const nextSettings = mergeAsistenciaIntoSystemSettings(
        systemSettingsLatestRef.current,
        nextAsistencia
      );

      skipHydrateRef.current = true;
      try {
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
        });

        if (!kvOk) {
          asistenciaLatestRef.current = prevAsistencia;
          return false;
        }

        if (PRODUCTION_USE_SQL) {
          const client = await getSupabaseClientLazy();
          if (!client) {
            asistenciaLatestRef.current = prevAsistencia;
            return false;
          }
          const { data: sess } = await client.auth.getSession();
          const uid = sess.session?.user?.id ?? null;
          const sqlOk = await ensureSqlSave(
            true,
            ASISTENCIA_SETTINGS_KV_KEY,
            () => saveAppKvKey(client, ASISTENCIA_SETTINGS_KV_KEY, nextAsistencia, uid),
            lastSaveErrorAtRef,
            'No se pudo guardar la configuración de Asistencia en SQL. Revisa sesión o permisos.'
          );
          if (!sqlOk) {
            asistenciaLatestRef.current = prevAsistencia;
            return false;
          }
        }

        asistenciaLatestRef.current = nextAsistencia;
        systemSettingsLatestRef.current = nextSettings;
        setSystemSettings(nextSettings);
        cooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
        if (successMessage) toast.success(successMessage);
        return true;
      } finally {
        skipHydrateRef.current = false;
      }
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

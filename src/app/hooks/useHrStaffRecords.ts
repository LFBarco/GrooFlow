import { useEffect, useState } from 'react';

import type { WorkplaceAccidentRecord } from '../types/accidentes';
import type { UniformDeliveryRecord } from '../types/uniformes';
import { repository } from '../services/repository';
import {
  ACCIDENTES_SETTINGS_KV_KEY,
  mergeAccidentesSettings,
} from '../utils/accidentesData';
import { UNIFORMES_SETTINGS_KV_KEY, mergeUniformesSettings } from '../utils/uniformesData';

export function useHrStaffRecords() {
  const [accidents, setAccidents] = useState<WorkplaceAccidentRecord[]>([]);
  const [uniforms, setUniforms] = useState<UniformDeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRaw, uniRaw] = await Promise.all([
          repository.kv.get(ACCIDENTES_SETTINGS_KV_KEY),
          repository.kv.get(UNIFORMES_SETTINGS_KV_KEY),
        ]);
        if (cancelled) return;
        setAccidents(mergeAccidentesSettings(accRaw as never).records);
        setUniforms(mergeUniformesSettings(uniRaw as never).records);
      } catch {
        if (!cancelled) {
          setAccidents([]);
          setUniforms([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { accidents, uniforms, loading };
}

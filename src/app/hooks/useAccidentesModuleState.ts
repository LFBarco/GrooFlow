import type { AccidentesSettings } from '../types/accidentes';
import { ACCIDENTES_SETTINGS_KV_KEY, mergeAccidentesSettings } from '../utils/accidentesData';
import { useKvAtomicSettings } from './useKvAtomicSettings';

export function useAccidentesModuleState(canPersist: boolean) {
  return useKvAtomicSettings<AccidentesSettings>({
    key: ACCIDENTES_SETTINGS_KV_KEY,
    merge: mergeAccidentesSettings,
    canEdit: canPersist,
    messages: {
      loadError: 'No se pudo cargar el módulo de accidentes de trabajo.',
      saveError: 'No se pudo guardar el registro de accidentes. Se reintentará al próximo cambio.',
      permissionDenied: 'Sin permiso para guardar accidentes de trabajo.',
      noPermission: 'No tienes permiso para modificar accidentes de trabajo.',
    },
  });
}

import type { UniformesSettings } from '../types/uniformes';
import { UNIFORMES_SETTINGS_KV_KEY, mergeUniformesSettings } from '../utils/uniformesData';
import { useKvAtomicSettings } from './useKvAtomicSettings';

export function useUniformesModuleState(canEdit: boolean) {
  return useKvAtomicSettings<UniformesSettings>({
    key: UNIFORMES_SETTINGS_KV_KEY,
    merge: mergeUniformesSettings,
    canEdit,
    messages: {
      loadError: 'No se pudo cargar el módulo de entrega de uniformes.',
      saveError: 'No se pudo guardar el registro de uniformes. Se reintentará al próximo cambio.',
      permissionDenied: 'Sin permiso para guardar entregas de uniformes.',
      noPermission: 'No tienes permiso para editar entregas de uniformes.',
    },
  });
}

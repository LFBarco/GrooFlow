import { useMemo } from 'react';

import type { ViewType } from '../../routes';
import { buildAmbientBackground, getModuleIdentity } from '../../utils/grooflowIdentity';

type AmbientBackgroundProps = {
  moduleId: ViewType;
  isDark: boolean;
};

/**
 * Fondo ambiental por módulo — solo GrooFlow Light.
 * Transición suave 400ms al cambiar de módulo.
 */
export function AmbientBackground({ moduleId, isDark }: AmbientBackgroundProps) {
  const identity = getModuleIdentity(moduleId);
  const background = useMemo(() => buildAmbientBackground(identity), [identity]);

  if (isDark) return null;

  return (
    <div
      className="gf-ambient-layer fixed inset-0 z-0 pointer-events-none"
      style={{
        background,
        transition: 'background 160ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      aria-hidden
    />
  );
}

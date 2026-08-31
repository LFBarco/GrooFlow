import type { AsistenciaOperationalContext } from '../types/asistencia';
import { repository } from '../services/repository';

const STORAGE_KEY = 'gooflow:asistencia-operational:v1';
export const ASISTENCIA_OPERATIONAL_KV_KEY = 'data:asistencia-operational';

export function saveAsistenciaOperationalContext(ctx: AsistenciaOperationalContext): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    /* quota / private mode */
  }
  void repository.kv.set(ASISTENCIA_OPERATIONAL_KV_KEY, ctx).catch(() => {
    /* offline / sin sesión */
  });
}

export function loadAsistenciaOperationalContext(): AsistenciaOperationalContext | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AsistenciaOperationalContext;
  } catch {
    return null;
  }
}

export async function hydrateAsistenciaOperationalFromCloud(): Promise<AsistenciaOperationalContext | null> {
  try {
    const remote = await repository.kv.get<AsistenciaOperationalContext>(ASISTENCIA_OPERATIONAL_KV_KEY);
    if (remote && typeof remote === 'object') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      } catch {
        /* ignore */
      }
      return remote;
    }
  } catch {
    /* ignore */
  }
  return loadAsistenciaOperationalContext();
}

export function cacheAgeHours(fetchedAt: number | null | undefined): number | null {
  if (!fetchedAt) return null;
  return (Date.now() - fetchedAt) / (1000 * 60 * 60);
}

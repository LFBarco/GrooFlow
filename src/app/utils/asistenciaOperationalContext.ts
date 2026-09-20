import type { AsistenciaOperationalContext } from '../types/asistencia';
import { repository } from '../services/repository';

const STORAGE_KEY = 'gooflow:asistencia-operational:v1';
export const ASISTENCIA_OPERATIONAL_KV_KEY = 'data:asistencia-operational';

let pendingCtx: AsistenciaOperationalContext | null = null;
let debounceTimer: number | null = null;
let writing = false;

function contentFingerprint(ctx: AsistenciaOperationalContext): string {
  // Sin updatedAt: evita writes en cascada por timestamp distinto cada render.
  return JSON.stringify({
    dateYmd: ctx.dateYmd,
    cacheFetchedAt: ctx.cacheFetchedAt ?? null,
    bukEnabled: ctx.bukEnabled,
    criticalMissing: ctx.criticalMissing,
    coverageGaps: ctx.coverageGaps,
  });
}

let lastWrittenFingerprint = '';

async function flushOperationalToCloud(): Promise<void> {
  if (writing) return;
  const ctx = pendingCtx;
  pendingCtx = null;
  if (!ctx) return;

  const fp = contentFingerprint(ctx);
  if (fp === lastWrittenFingerprint) return;

  writing = true;
  try {
    // Asegura revisión antes del PUT (evita 409 en frío / tras otra pestaña).
    await repository.kv.get(ASISTENCIA_OPERATIONAL_KV_KEY);
    await repository.kv.set(ASISTENCIA_OPERATIONAL_KV_KEY, ctx);
    lastWrittenFingerprint = fp;
  } catch {
    /* offline / 409 agotado / sin sesión — no bloquear UI */
  } finally {
    writing = false;
    if (pendingCtx) {
      void flushOperationalToCloud();
    }
  }
}

/** Guarda en localStorage al instante; cloud con debounce + single-flight (no satura el pool HTTP). */
export function saveAsistenciaOperationalContext(ctx: AsistenciaOperationalContext): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    /* quota / private mode */
  }

  const fp = contentFingerprint(ctx);
  if (fp === lastWrittenFingerprint && !pendingCtx) return;

  pendingCtx = ctx;
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    void flushOperationalToCloud();
  }, 1500);
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
      lastWrittenFingerprint = contentFingerprint(remote);
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

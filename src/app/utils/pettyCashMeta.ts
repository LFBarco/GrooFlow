import type {
  PettyCashFundDelivery,
  PettyCashSettings,
  PettyCashWeekClosure,
  PettyCashWeekPreClosure,
  SystemSettings,
} from '../types';

/** Metadatos operativos de caja chica (no incluye límites ni plantillas de impresión). */
export type PettyCashWeekMetaPayload = {
  weekClosures: PettyCashWeekClosure[];
  weekPreClosures: PettyCashWeekPreClosure[];
  fundDeliveries: PettyCashFundDelivery[];
};

export const PETTY_CASH_META_KV_KEY = 'data:pettyCashMeta' as const;

const EMPTY_META: PettyCashWeekMetaPayload = {
  weekClosures: [],
  weekPreClosures: [],
  fundDeliveries: [],
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizePettyCashMeta(raw: unknown): PettyCashWeekMetaPayload {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_META };
  const o = raw as Record<string, unknown>;
  return {
    weekClosures: asArray(o.weekClosures),
    weekPreClosures: asArray(o.weekPreClosures),
    fundDeliveries: asArray(o.fundDeliveries),
  };
}

export function extractPettyCashMeta(
  pettyCash: PettyCashSettings | undefined
): PettyCashWeekMetaPayload {
  return {
    weekClosures: pettyCash?.weekClosures ?? [],
    weekPreClosures: pettyCash?.weekPreClosures ?? [],
    fundDeliveries: pettyCash?.fundDeliveries ?? [],
  };
}

export function isPettyCashMetaEmpty(meta: PettyCashWeekMetaPayload): boolean {
  return (
    meta.weekClosures.length === 0 &&
    meta.weekPreClosures.length === 0 &&
    meta.fundDeliveries.length === 0
  );
}

/** Prioriza SQL/KV meta; si vacío, usa arrays legacy en settings:system. */
export function resolvePettyCashMeta(
  remoteMeta: PettyCashWeekMetaPayload,
  legacyFromSettings: PettyCashWeekMetaPayload
): PettyCashWeekMetaPayload {
  if (!isPettyCashMetaEmpty(remoteMeta)) return remoteMeta;
  return legacyFromSettings;
}

export function mergePettyCashMetaIntoSettings(
  settings: SystemSettings,
  meta: PettyCashWeekMetaPayload
): SystemSettings {
  return {
    ...settings,
    pettyCash: {
      ...settings.pettyCash,
      weekClosures: meta.weekClosures,
      weekPreClosures: meta.weekPreClosures,
      fundDeliveries: meta.fundDeliveries,
    },
  };
}

/** Config de sistema para KV/SQL sin duplicar metadatos operativos. */
export function stripPettyCashMetaForSystemKv(settings: SystemSettings): SystemSettings {
  const pc = settings.pettyCash;
  if (!pc) return settings;
  const { weekClosures: _wc, weekPreClosures: _wp, fundDeliveries: _fd, ...rest } = pc;
  return {
    ...settings,
    pettyCash: {
      ...rest,
      weekClosures: [],
      weekPreClosures: [],
      fundDeliveries: [],
    },
  };
}

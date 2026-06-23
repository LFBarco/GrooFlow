import type { MutableRefObject } from 'react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { enqueueKvSerializedSave, kvSaveSucceeded, type KvSaveResult } from './kvSerializedSave';

/** Tras un POST exitoso, ignorar GET remotos unos segundos (replica / cache / re-hydrate). */
export const KV_DOMAIN_COOLDOWN_MS = 8000;

export interface KvDomainRefs<T> {
  hydratedFromKvRef: MutableRefObject<boolean>;
  skipHydrateRef: MutableRefObject<boolean>;
  cooldownUntilRef: MutableRefObject<number>;
  chainRef: MutableRefObject<Promise<KvSaveResult>>;
  latestRef: MutableRefObject<T>;
}

export function shouldAllowKvRemoteHydrate(
  fetchFailed: boolean | undefined,
  skipHydrateRef: MutableRefObject<boolean>,
  cooldownUntilRef: MutableRefObject<number>
): boolean {
  return (
    !fetchFailed &&
    !skipHydrateRef.current &&
    Date.now() >= cooldownUntilRef.current
  );
}

export function resetKvDomainRefs<T>(refs: KvDomainRefs<T>): void {
  refs.hydratedFromKvRef.current = false;
  refs.skipHydrateRef.current = false;
  refs.cooldownUntilRef.current = 0;
}

export type CloudSyncPhase = 'idle' | 'loading' | 'saving' | 'synced' | 'error';

export interface CloudSyncTracker {
  onStart: () => void;
  onEnd: (ok: boolean, kvKey?: string) => void;
}

const CLOUD_SYNC_STALE_MS = 18_000;

export function createCloudSyncTracker(
  pendingRef: MutableRefObject<number>,
  hasErrorRef: MutableRefObject<boolean>,
  setPhase: (phase: CloudSyncPhase) => void,
  errorKeyRef?: MutableRefObject<string | null>
): CloudSyncTracker {
  let staleTimer: ReturnType<typeof setTimeout> | null = null;

  const clearStaleTimer = () => {
    if (staleTimer) {
      clearTimeout(staleTimer);
      staleTimer = null;
    }
  };

  const recompute = () => {
    if (pendingRef.current > 0) {
      setPhase('saving');
      return;
    }
    setPhase(hasErrorRef.current ? 'error' : 'synced');
  };

  const armStaleWatchdog = () => {
    clearStaleTimer();
    staleTimer = setTimeout(() => {
      if (pendingRef.current <= 0) return;
      console.warn('[cloudSync] estado «Guardando» expirado; liberando indicador');
      pendingRef.current = 0;
      hasErrorRef.current = true;
      recompute();
    }, CLOUD_SYNC_STALE_MS);
  };

  return {
    onStart: () => {
      pendingRef.current += 1;
      setPhase('saving');
      armStaleWatchdog();
    },
    onEnd: (ok: boolean, kvKey?: string) => {
      clearStaleTimer();
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      if (!ok) {
        hasErrorRef.current = true;
        if (errorKeyRef && kvKey) errorKeyRef.current = kvKey;
      } else {
        if (pendingRef.current === 0) hasErrorRef.current = false;
        if (errorKeyRef?.current === kvKey) errorKeyRef.current = null;
      }
      recompute();
    },
  };
}

/**
 * Autosave encadenado con cooldown post-save y toast throttled en error.
 */
export async function autosaveKvDomain<T>(options: {
  kvKey: string;
  payload: T;
  refs: Pick<KvDomainRefs<T>, 'chainRef' | 'latestRef' | 'cooldownUntilRef'>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  errorMessage: string;
  sync?: CloudSyncTracker;
  enqueueOptions?: { updateLatestRef?: boolean };
}): Promise<boolean> {
  const {
    kvKey,
    payload,
    refs,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    errorMessage,
    sync,
    enqueueOptions,
  } = options;

  sync?.onStart();
  let result: KvSaveResult = 'failed';
  try {
    result = await enqueueKvSerializedSave(
      refs.chainRef,
      kvApplyGenerationRef,
      refs.latestRef,
      kvKey,
      payload,
      enqueueOptions
    );
  } catch (e) {
    console.warn(`[kvDomain] autosave ${kvKey}`, e);
    result = 'failed';
  } finally {
    sync?.onEnd(kvSaveSucceeded(result), kvKey);
  }
  const ok = kvSaveSucceeded(result);

  if (ok) {
    refs.cooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
    return true;
  }

  const now = Date.now();
  const last = lastSaveErrorAtRef.current[kvKey] ?? 0;
  if (now - last >= 8000) {
    lastSaveErrorAtRef.current[kvKey] = now;
    toast.error(errorMessage);
  }
  return false;
}

/** Persistencia inmediata (acciones críticas) con skip hydrate durante el POST. */
export async function persistKvDomainNow<T>(options: {
  kvKey: string;
  payload: T;
  refs: KvDomainRefs<T>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  errorMessage: string;
  successMessage?: string;
  sync?: CloudSyncTracker;
  enqueueOptions?: { updateLatestRef?: boolean };
}): Promise<boolean> {
  const { refs, enqueueOptions, ...rest } = options;
  if (enqueueOptions?.updateLatestRef !== false) {
    refs.latestRef.current = rest.payload;
  }
  refs.skipHydrateRef.current = true;
  try {
    const ok = await autosaveKvDomain({ ...rest, refs, enqueueOptions });
    if (ok && rest.successMessage) toast.success(rest.successMessage);
    return ok;
  } finally {
    refs.skipHydrateRef.current = false;
  }
}

import { kvPayloadsEqual } from './kvCrossTabSync';

/** Tras aplicar SQL remoto, ignorar eventos duplicados unos segundos. */
export const PRODUCTION_REMOTE_COOLDOWN_MS = 30_000;

/**
 * Evita que Realtime/poll SQL pise listas locales durante el cooldown post-guardado.
 * Fuera de cooldown, SQL gana (incluye borrados desde otra pestaña).
 */
export function shouldApplyListRemoteSnapshot<T>(
  local: T[],
  remote: T[],
  cooldownUntilMs: number
): boolean {
  if (Date.now() < cooldownUntilMs) return false;
  if (kvPayloadsEqual(local, remote)) return false;
  if (local.length > 0 && remote.length === 0) return false;
  return true;
}

/** Valores escalares (tema, saldo bancario). */
export function shouldApplyValueRemoteSnapshot<T>(
  local: T,
  remote: T,
  cooldownUntilMs: number
): boolean {
  if (Date.now() < cooldownUntilMs) return false;
  if (kvPayloadsEqual(local, remote)) return false;
  return true;
}

/** Objetos JSON (config, settings, umbrales). */
export function shouldApplyObjectRemoteSnapshot<T>(
  local: T,
  remote: T,
  cooldownUntilMs: number
): boolean {
  if (Date.now() < cooldownUntilMs) return false;
  if (kvPayloadsEqual(local, remote)) return false;
  return true;
}

/**
 * ============================================================
 *  GROOFLOW — API SERVICE (COMPATIBILITY LAYER)
 * ============================================================
 *
 * This file is the bridge between the "old" direct API calls
 * and the new repository pattern.
 *
 * - App.tsx and all components use `api.saveKey / fetchInitialData`
 *   as before — no changes needed in those files.
 * - Internally, `api` delegates to `repository` (IDataRepository).
 * - When you're ready to migrate components to use `repository`
 *   directly, you can do so incrementally and eventually remove
 *   this file.
 * ============================================================
 */

import { repository, KV_KEYS } from './repository';
import { getSupabaseClient } from './repository/supabase';
import { toast } from 'sonner';

// ─── Types (kept for backward compatibility) ─────────────────

export interface InitialDataKeys {
  'settings:config'?:           unknown;
  'settings:system'?:           unknown;
  'settings:theme'?:            unknown;
  'settings:alertThresholds'?:  unknown;
  'data:transactions'?:         unknown;
  'data:invoices'?:             unknown;
  'data:providers'?:            unknown;
  'data:requests'?:             unknown;
  'data:pettyCash'?:            unknown;
  'data:users'?:                unknown;
  'data:roles'?:                unknown;
  'data:feeReceipts'?:          unknown;
  'data:requisitions'?:         unknown;
  'data:treasuryInvoices'?:     unknown;
  'data:treasuryBankBalance'?:  unknown;
  'data:treasuryPaidHistory'?:  unknown;
  /** Metadato interno: el GET HTTP a `data:users` falló (no confundir con lista vacía). */
  __usersKvFetchFailed?: boolean;
}

const ALL_KEYS: Array<keyof InitialDataKeys> = [
  'settings:config',
  'settings:system',
  'settings:theme',
  'settings:alertThresholds',
  'data:transactions',
  'data:invoices',
  'data:providers',
  'data:requests',
  'data:pettyCash',
  'data:users',
  'data:roles',
  'data:feeReceipts',
  'data:requisitions',
  'data:treasuryInvoices',
  'data:treasuryBankBalance',
  'data:treasuryPaidHistory',
];

// ─── api object ───────────────────────────────────────────────

export const api = {
  /**
   * Load all persisted app data on startup.
   * Returns a key-value map with whatever was found.
   */
  async fetchInitialData(): Promise<InitialDataKeys> {
    const result: InitialDataKeys = {};
    const backend = import.meta.env.VITE_BACKEND ?? 'supabase';

    // Una sola renovación de sesión antes de muchos GET en paralelo (evita carreras de refresh).
    if (backend === 'supabase') {
      try {
        await getSupabaseClient().auth.refreshSession();
      } catch {
        /* getWithStatus fallará con ok:false si no hay sesión */
      }
    }

    const kv = repository.kv;

    await Promise.all(
      ALL_KEYS.map(async (key) => {
        if (key === 'data:users' && typeof kv.getWithStatus === 'function') {
          const { ok, value } = await kv.getWithStatus<unknown>(key);
          if (ok) {
            (result as Record<string, unknown>)['data:users'] = value ?? [];
          } else {
            result.__usersKvFetchFailed = true;
          }
          return;
        }
        const value = await kv.get(key);
        if (value !== null && value !== undefined) {
          (result as Record<string, unknown>)[key] = value;
        }
      })
    );

    return result;
  },

  /**
   * Persist a single key-value pair.
   * Replaces the old direct fetch() call.
   */
  async saveKey(key: string, data: unknown): Promise<boolean> {
    try {
      await repository.kv.set(key, data);
      return true;
    } catch (error) {
      console.warn(`[api] saveKey failed for "${key}":`, error);
      return false;
    }
  },

  /**
   * Create a new user in the auth system.
   * Wraps repository.auth.createUser with error handling + toast.
   */
  async signUp(
    email: string,
    password: string,
    name: string
  ): Promise<{ data?: unknown }> {
    try {
      const user = await repository.auth.createUser(email, password, name);
      return { data: user };
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : 'Error registrando usuario';
      const message = raw.includes('already') || raw.includes('email_exists')
        ? 'Este correo ya está registrado en el sistema.'
        : raw;
      toast.error(message);
      throw new Error(message);
    }
  },
};

// ─── Re-export repository for gradual migration ───────────────
//
// Components can start using `repository` directly instead of `api`.
// Both work — `api` just wraps `repository`.
//
//   import { repository } from '@/app/services/api';
//   const txs = await repository.transactions.getAll();

export { repository, KV_KEYS } from './repository';

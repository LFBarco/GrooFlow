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
import { getSupabaseClient, isSupabaseKvFatalAuthError } from './repository/supabase';
import { isAccessTokenExpired } from '../utils/accessToken';
import { broadcastKvUpdate, shouldBroadcastKvUpdate } from '../utils/kvCrossTabSync';
import { toast } from 'sonner';

/** Evitar spam por cada autosave si la sesión murió */
let kvSessionFatalToastAt = 0;

/**
 * Opcional: cuando el KV detecta JWT irrecuperable, la app puede forzar logout
 * para que el estado coincide con Supabase (evita “medio logueado” con autosave en bucle).
 */
let kvSessionFatalHandler: (() => void) | null = null;
let kvSessionFatalHandlerLastAt = 0;

export function setKvSessionFatalHandler(fn: (() => void) | null) {
  kvSessionFatalHandler = fn;
}

function invokeKvSessionFatalHandler() {
  const now = Date.now();
  if (now - kvSessionFatalHandlerLastAt < 5000) return;
  kvSessionFatalHandlerLastAt = now;
  try {
    kvSessionFatalHandler?.();
  } catch (e) {
    console.warn('[api] KvSessionFatalHandler', e);
  }
}

function toastKvSessionFatalOnce() {
  const now = Date.now();
  if (now - kvSessionFatalToastAt < 55_000) return;
  kvSessionFatalToastAt = now;
  toast.error('Sesión caducada o cerrada', {
    duration: 12_000,
    description:
      'No se pueden guardar datos en la nube sin una sesión válida. Cierra sesión, recarga (Ctrl+F5) e inicia sesión de nuevo.',
  });
}

// ─── Types (kept for backward compatibility) ─────────────────

export interface InitialDataKeys {
  'settings:config'?:           unknown;
  'settings:system'?:           unknown;
  'settings:theme'?:            unknown;
  'settings:alertThresholds'?:  unknown;
  'maintenance:transactionsClearedAt'?: unknown;
  'data:transactions'?:         unknown;
  'data:invoices'?:             unknown;
  'data:providers'?:            unknown;
  'data:products'?:             unknown;
  'data:requests'?:             unknown;
  'data:pettyCash'?:            unknown;
  /** Cierres, pre-cierres y dotaciones de caja chica (separado de settings:system). */
  'data:pettyCashMeta'?:        unknown;
  /** Personal, sedes y Buk Asistencia (separado de settings:system). */
  'settings:asistencia'?:        unknown;
  'data:users'?:                unknown;
  'data:roles'?:                unknown;
  'data:feeReceipts'?:          unknown;
  'data:treasuryInvoices'?:     unknown;
  'data:treasuryBankBalance'?:  unknown;
  'data:treasuryPaidHistory'?:  unknown;
  /** Plan de cuentas contables importado (Excel). */
  'data:chartOfAccounts'?: unknown;
  /** Flota clínica veterinaria (vehículos, mantenimiento, combustible). */
  'data:fleet'?: unknown;
  'data:inventory'?: unknown;
  /** Motor de conciliación de ingresos (batches, movimientos, matches). */
  'data:reconciliation'?: unknown;
  /** Metadato interno: el GET HTTP a `data:users` falló (no confundir con lista vacía). */
  __usersKvFetchFailed?: boolean;
  /** Metadato interno: el GET HTTP de transacciones/marca falló; no autosobrescribir con estado local. */
  __transactionsKvFetchFailed?: boolean;
  /** Metadato interno: GET de proveedores falló. */
  __providersKvFetchFailed?: boolean;
  /** Metadato interno: GET de caja chica falló. */
  __pettyCashKvFetchFailed?: boolean;
  /** Metadato interno: GET de configuración operativa (categorías) falló. */
  __configKvFetchFailed?: boolean;
  /** Metadato interno: GET de flota falló. */
  __fleetKvFetchFailed?: boolean;
  __inventoryKvFetchFailed?: boolean;
  /** Metadato interno: GET de umbrales de alertas falló. */
  __alertThresholdsKvFetchFailed?: boolean;
  /** Metadato interno: GET de plan de cuentas falló. */
  __chartOfAccountsKvFetchFailed?: boolean;
  /** Metadato interno: GET de productos falló. */
  __productsKvFetchFailed?: boolean;
  /** Metadato interno: GET de roles falló. */
  __rolesKvFetchFailed?: boolean;
  /** Metadato interno: GET de facturas falló. */
  __invoicesKvFetchFailed?: boolean;
  /** Metadato interno: GET de solicitudes falló. */
  __requestsKvFetchFailed?: boolean;
  /** Metadato interno: GET de honorarios falló. */
  __feeReceiptsKvFetchFailed?: boolean;
  /** Metadato interno: GET de configuración del sistema falló. */
  __systemSettingsKvFetchFailed?: boolean;
  /** Metadato interno: GET de asistencia dedicada falló. */
  __asistenciaKvFetchFailed?: boolean;
  /** Metadato interno: GET de facturas tesorería falló. */
  __treasuryInvoicesKvFetchFailed?: boolean;
  /** Metadato interno: GET de saldo bancario tesorería falló. */
  __treasuryBankBalanceKvFetchFailed?: boolean;
  /** Metadato interno: GET de historial pagos tesorería falló. */
  __treasuryPaidHistoryKvFetchFailed?: boolean;
  /** Metadato interno: GET de tema falló. */
  __themeKvFetchFailed?: boolean;
}

const KV_GET_WITH_STATUS_KEYS = new Set([
  'data:users',
  'data:transactions',
  'maintenance:transactionsClearedAt',
  'data:providers',
  'data:pettyCash',
  'data:pettyCashMeta',
  'settings:config',
  'settings:theme',
  'data:fleet',
  'data:inventory',
  'settings:alertThresholds',
  'data:chartOfAccounts',
  'data:products',
  'data:roles',
  'data:invoices',
  'data:requests',
  'data:feeReceipts',
  'settings:system',
  'settings:asistencia',
  'data:treasuryInvoices',
  'data:treasuryBankBalance',
  'data:treasuryPaidHistory',
]);

const ALL_KEYS: Array<keyof InitialDataKeys> = [
  'settings:config',
  'settings:system',
  'settings:asistencia',
  'settings:theme',
  'settings:alertThresholds',
  'maintenance:transactionsClearedAt',
  'data:transactions',
  'data:invoices',
  'data:providers',
  'data:products',
  'data:requests',
  'data:pettyCash',
  'data:pettyCashMeta',
  'data:users',
  'data:roles',
  'data:feeReceipts',
  'data:treasuryInvoices',
  'data:treasuryBankBalance',
  'data:treasuryPaidHistory',
  'data:chartOfAccounts',
  'data:fleet',
  'data:inventory',
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

    // Solo renovar si el JWT expiró; tras signIn el token ya es válido (evita ~2.5s de espera).
    if (backend === 'supabase') {
      try {
        const { data } = await getSupabaseClient().auth.getSession();
        const token = data.session?.access_token;
        if (data.session?.user && (!token || isAccessTokenExpired(token))) {
          await Promise.race([
            getSupabaseClient().auth.refreshSession(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
          ]);
        }
      } catch {
        /* KV decidirá con getSession interno */
      }
    }

    const kv = repository.kv;

    await Promise.all(
      ALL_KEYS.map(async (key) => {
        if (KV_GET_WITH_STATUS_KEYS.has(key) && typeof kv.getWithStatus === 'function') {
          const { ok, value } = await kv.getWithStatus<unknown>(key);
          if (ok) {
            const fallback =
              key === 'data:users' ||
              key === 'data:providers' ||
              key === 'data:pettyCash' ||
              key === 'data:chartOfAccounts' ||
              key === 'data:products'
                ? []
                : null;
            (result as Record<string, unknown>)[key] = value ?? fallback;
          } else {
            if (key === 'data:users') result.__usersKvFetchFailed = true;
            else if (key === 'data:transactions' || key === 'maintenance:transactionsClearedAt')
              result.__transactionsKvFetchFailed = true;
            else if (key === 'data:providers') result.__providersKvFetchFailed = true;
            else if (key === 'data:pettyCash') result.__pettyCashKvFetchFailed = true;
            else if (key === 'settings:config') result.__configKvFetchFailed = true;
            else if (key === 'settings:theme') result.__themeKvFetchFailed = true;
            else if (key === 'data:fleet') result.__fleetKvFetchFailed = true;
            else if (key === 'data:inventory') result.__inventoryKvFetchFailed = true;
            else if (key === 'settings:alertThresholds') result.__alertThresholdsKvFetchFailed = true;
            else if (key === 'data:chartOfAccounts') result.__chartOfAccountsKvFetchFailed = true;
            else if (key === 'data:products') result.__productsKvFetchFailed = true;
            else if (key === 'data:roles') result.__rolesKvFetchFailed = true;
            else if (key === 'data:invoices') result.__invoicesKvFetchFailed = true;
            else if (key === 'data:requests') result.__requestsKvFetchFailed = true;
            else if (key === 'data:feeReceipts') result.__feeReceiptsKvFetchFailed = true;
            else if (key === 'settings:system') result.__systemSettingsKvFetchFailed = true;
            else if (key === 'settings:asistencia') result.__asistenciaKvFetchFailed = true;
            else if (key === 'data:treasuryInvoices') result.__treasuryInvoicesKvFetchFailed = true;
            else if (key === 'data:treasuryBankBalance') result.__treasuryBankBalanceKvFetchFailed = true;
            else if (key === 'data:treasuryPaidHistory') result.__treasuryPaidHistoryKvFetchFailed = true;
          }
          return;
        }
        const value = await kv.get(key);
        if (value !== null && value !== undefined) {
          (result as Record<string, unknown>)[key] = value;
        }
      })
    );

    if (!result.__alertThresholdsKvFetchFailed && result['settings:alertThresholds'] == null) {
      try {
        const legacy = await kv.get('data:alertThresholds');
        if (legacy != null) {
          result['settings:alertThresholds'] = legacy;
        }
      } catch {
        /* migración legacy opcional */
      }
    }

    return result;
  },

  /** Carga perezosa de una clave KV (p. ej. conciliación con muchos movimientos). */
  async fetchKvKey<T = unknown>(key: string): Promise<T | null> {
    const backend = import.meta.env.VITE_BACKEND ?? 'supabase';
    if (backend === 'supabase') {
      try {
        const { data } = await getSupabaseClient().auth.getSession();
        const token = data.session?.access_token;
        if (data.session?.user && (!token || isAccessTokenExpired(token))) {
          await Promise.race([
            getSupabaseClient().auth.refreshSession(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
          ]);
        }
      } catch {
        /* noop */
      }
    }
    const value = await repository.kv.get<T>(key);
    return value ?? null;
  },

  /**
   * Persist a single key-value pair.
   * Replaces the old direct fetch() call.
   */
  async saveKey(key: string, data: unknown): Promise<boolean> {
    const backend = import.meta.env.VITE_BACKEND ?? 'supabase';
    /** Directorio grande / importaciones masivas: más reintentos por timeouts intermitentes. */
    const maxAttempts =
      key === 'data:providers' ||
      key === 'data:transactions' ||
      key === 'data:pettyCash' ||
      key === 'settings:system' ||
      key === 'settings:config' ||
      key === 'data:inventory' ||
      key === 'data:chartOfAccounts' ||
      key === 'data:products' ||
      key === 'data:roles' ||
      key === 'settings:alertThresholds' ||
      key === 'data:invoices' ||
      key === 'data:requests' ||
      key === 'data:feeReceipts' ||
      key === 'data:treasuryInvoices' ||
      key === 'data:treasuryPaidHistory' ||
      key === 'data:reconciliation'
        ? (backend === 'supabase' ? 6 : 3)
        : backend === 'supabase' ? 3 : 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await repository.kv.set(key, data);
        if (shouldBroadcastKvUpdate(key)) {
          broadcastKvUpdate(key, data);
        }
        return true;
      } catch (error) {
        if (backend === 'supabase' && isSupabaseKvFatalAuthError(error)) {
          toastKvSessionFatalOnce();
          try {
            const { data: d } = await getSupabaseClient().auth.getSession();
            /** No desloguear si el SDK sigue exponiendo usuario; evita falsos positivos en red/particionado */
            if (!d.session?.user) {
              invokeKvSessionFatalHandler();
            }
          } catch {
            invokeKvSessionFatalHandler();
          }
          console.warn(`[api] saveKey aborted "${key}" (sin sesión renovable)`, error);
          return false;
        }
        const last = attempt === maxAttempts;
        console.warn(`[api] saveKey failed for "${key}" (attempt ${attempt}/${maxAttempts}):`, error);
        if (last) return false;
        if (
          backend === 'supabase' &&
          !isSupabaseKvFatalAuthError(error)
        ) {
          try {
            const { data: s } = await getSupabaseClient().auth.getSession();
            if (s.session?.user) {
              await Promise.race([
                getSupabaseClient().auth.refreshSession(),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
              ]);
            }
          } catch {
            // noop
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
    return false;
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

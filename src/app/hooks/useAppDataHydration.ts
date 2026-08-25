/**
 * Hidratación KV + auth (extraído de App.tsx).
 * Generado/actualizado con: node scripts/generate-hydration.mjs
 */
import { useEffect } from 'react';
import { toast } from 'sonner';

import { DEFAULT_ROLES } from '../components/users/types';
import {
  clearLocalDemoSession,
  createLocalDemoAdminUser,
  getLocalDemoSessionEmail,
  isLocalDemoSessionActive,
} from '../config/demoLogin';
import { getSuperAdminEmails } from '../config/superAdmins';
import { initialStructure, initialSystemSettings, mergeSystemSettings } from '../data/initialData';
import { api } from '../services/api';
import {
  loadAppUsersFromSql,
  loadInvoicesFromSql,
  loadPettyCashFromSql,
  loadProvidersFromSql,
  loadPurchaseRequestsFromSql,
  loadRolesFromSql,
  migrateAppUsersKvToSql,
  migrateInvoicesKvToSql,
  migratePettyCashKvToSql,
  migrateProvidersKvToSql,
  migratePurchaseRequestsKvToSql,
  migrateRolesKvToSql,
  resolveListFromSql,
  resolveUsersFromSql,
} from '../services/repository/businessDomainsSql';
import {
  isFleetSqlEnabled,
  loadFleetFromSql,
  migrateFleetKvToSql,
} from '../services/repository/fleetSql';
import {
  isInventorySqlEnabled,
  loadInventoryFromSql,
  migrateInventoryKvToSql,
} from '../services/repository/inventorySql';
import { resolveAppKvFromSql, saveAppKvKey } from '../services/repository/appKvSql';
import {
  loadPettyCashMetaFromSql,
  migratePettyCashMetaKvToSql,
} from '../services/repository/pettyCashMetaSql';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import {
  loadTransactionsFromSql,
  migrateTransactionsKvToSql,
  isTransactionsSqlEnabled,
} from '../services/repository/transactionsSql';
import { repository } from '../services/repository';
import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
import { getGrooflowBackend } from '../config/backend';
import { isAdminAppUser, syncUserProfilesToSql, loadSelfAppUserProfile, mergeUserWithSqlProfile, touchOwnLastLogin } from '../services/repository/userProfileSync';
import type { Role } from '../components/users/types';
import type {
  AlertThresholds,
  ChartOfAccountEntry,
  ConfigStructure,
  InvoiceDraft,
  PettyCashTransaction,
  Product,
  Provider,
  PurchaseRequest,
  SystemSettings,
  Transaction,
  User,
} from '../types';
import type { FleetDataset } from '../types/fleet';
import type { InventoryDataset } from '../types/inventory';
import { createDemoFleetDataset, normalizeFleetDataset } from '../utils/fleetData';
import { isFleetDatasetEmpty } from '../utils/fleetDatasetEmpty';
import { mergeInventoryKvAndSql } from '../utils/inventoryKvPayload';
import { normalizeInventoryDataset } from '../utils/inventoryData';
import { isInventoryDatasetEmpty } from '../utils/inventoryDatasetEmpty';
import { hydrateTransactions } from '../utils/hydrateTransactions';
import { shouldAllowKvRemoteHydrate } from '../utils/kvDomainPersistence';
import { isAccessTokenExpired } from '../utils/accessToken';
import { mergeRolesWithDefaults } from '../utils/mergeRolesWithDefaults';
import {
  extractPettyCashMeta,
  mergePettyCashMetaIntoSettings,
  normalizePettyCashMeta,
  PETTY_CASH_META_KV_KEY,
  resolvePettyCashMeta,
} from '../utils/pettyCashMeta';
import {
  pettyCashMetaReconcileChanged,
  reconcilePettyCashMeta,
} from '../utils/pettyCashMetaReconcile';
import {
  ASISTENCIA_SETTINGS_KV_KEY,
  asistenciaSettingsHasContent,
  mergeAsistenciaIntoSystemSettings,
  resolveAsistenciaSettings,
} from '../utils/asistenciaPersistence';
import { parseTransactionDate } from '../utils/transactionDate';
import type { AsistenciaSettings } from '../types/asistencia';
import {
  applySuperAdminRoleFromConfig,
  dedupeUsersByEmail,
  mergeAuthUserIntoUsers,
  resolveCurrentUserRow,
} from '../utils/userListMerge';
import { isUserSessionBlocked, stampLastLoginInList } from '../utils/userSessionGuard';
import type { AppHydrationDeps } from './hydration/appHydrationDeps';

const APP_BACKEND = getGrooflowBackend();
const PRODUCTION_USE_SQL = isProductionSqlEnabled();
const TRANSACTIONS_USE_SQL = isTransactionsSqlEnabled();
const FLEET_USE_SQL = isFleetSqlEnabled();
const INVENTORY_USE_SQL = isInventorySqlEnabled();
const TRANSACTION_HISTORY_CLEAR_MARK = '2026-05-11-clear-transaction-history-v1';
const AUTH_CHECK_MAX_MS = 18_000;
const HYDRATE_FETCH_MAX_MS = 50_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: tiempo agotado (${ms / 1000}s)`)), ms)
    ),
  ]);
}

type FeeReceiptGlobal = {
  id: string;
  professionalId: string;
  professionalName: string;
  receiptNumber: string;
  issueDate: Date;
  amount: number;
  description: string;
  location?: string;
  dueDate: Date;
  paymentRequestedAt?: Date;
  status: 'pending' | 'approved' | 'requested_payment' | 'paid' | 'rejected';
  paymentDate?: Date;
  fileUrl?: string;
};

export function useAppDataHydration(deps: AppHydrationDeps): void {
  useEffect(() => {
    let cancelled = false;
    const backend = getGrooflowBackend();
    const authWatchdog = setTimeout(() => {
      if (!cancelled) deps.setIsAuthChecking(false);
    }, AUTH_CHECK_MAX_MS);

    const refreshSessionWithTimeout = async (ms = 2200) => {
      if (backend !== 'supabase') return null;
      const client = await getSupabaseClientLazy();
      if (!client) return null;
      return Promise.race([
        client.auth.refreshSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);
    };

    const sessionFromAuthUser = (user: { id: string; email?: string; name?: string } | null) => {
      if (!user) return null;
      return {
        access_token: 'rest',
        user: {
          id: user.id,
          email: user.email || '',
          user_metadata: { name: user.name },
        },
      };
    };

    const getStableSession = async () => {
      if (backend === 'rest' || backend === 'local') {
        const user = await repository.auth.getSession();
        return sessionFromAuthUser(user);
      }
      const client = await getSupabaseClientLazy();
      if (!client) return null;
      const first = await client.auth.getSession();
      const token = first.data.session?.access_token;
      if (token && !isAccessTokenExpired(token)) return first.data.session;
      try {
        await refreshSessionWithTimeout(4000);
      } catch {
        // noop: tolerar carreras transitorias al refrescar la página o despertar la pestaña.
      }
      const second = await client.auth.getSession();
      return second.data.session;
    };

    async function hydrateFromKv() {
      if (deps.signingOutRef.current) {
        deps.pendingHydrateRef.current = false;
        return;
      }
      if (deps.hydrateRunningRef.current) {
        deps.pendingHydrateRef.current = true;
        return;
      }
      deps.hydrateRunningRef.current = true;
      const shouldShowAuthChecking =
        !deps.cloudDataHydratedRef.current && backend === 'supabase';
      if (shouldShowAuthChecking) deps.setIsAuthChecking(true);
      deps.setCloudSyncPhase('loading');

      try {
        const session = await getStableSession();
        const sqlClient = backend === 'supabase' ? await getSupabaseClientLazy() : null;
        const hasCloudSession =
          backend === 'rest' ? Boolean(session?.user) : Boolean(session?.access_token);

        if (backend === 'supabase' || backend === 'rest') {
          if (!hasCloudSession) {
            deps.setIsAuthenticated(false);
            deps.setIsAuthChecking(false);
            return;
          }
          if (backend === 'supabase') deps.setCanSaveUsers(false);
          else deps.setCanSaveUsers(true);
        } else {
          deps.setCanSaveUsers(true);
        }

        let data = await withTimeout(
          api.fetchInitialData(),
          HYDRATE_FETCH_MAX_MS,
          'Carga inicial desde la nube'
        );
        let attempt = 0;
        while (backend === 'supabase' && data.__usersKvFetchFailed && attempt < 3) {
          attempt += 1;
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 350 * attempt));
          await refreshSessionWithTimeout();
          data = await withTimeout(
            api.fetchInitialData(),
            HYDRATE_FETCH_MAX_MS,
            'Reintento carga inicial'
          );
        }

        if (cancelled || deps.signingOutRef.current) return;

        /** Sesión al momento de aplicar auth (evita carrera si el usuario cerró sesión durante el fetch). */
        const sessionEffective = await getStableSession();

        if ((backend === 'supabase' && !sessionEffective?.access_token) ||
            (backend === 'rest' && !sessionEffective?.user)) {
            deps.setIsAuthenticated(false);
            deps.setIsAuthChecking(false);
            return;
        }

        if (backend === 'supabase' && data.__usersKvFetchFailed) {
          toast.error(
            'No se pudieron leer los usuarios desde la nube. Los cambios en la lista no se guardarán hasta que recargues o vuelvas a iniciar sesión.'
          );
          deps.setCanSaveUsers(false);
        } else {
          deps.setCanSaveUsers(true);
        }

        /** Solo en la primera hidratación: re-hidratar (p. ej. retry manual) no debe invalidar guardados en curso. */
        if (!deps.cloudDataHydratedRef.current) {
          deps.resetKvSaveChains();
        }

        let nextUsers: User[] = [];
        const usersFromKv = data['data:users'];
        if (Array.isArray(usersFromKv)) {
          const byId = Array.from(
            new Map(usersFromKv.map((u: User) => [u.id, u])).values()
          ) as User[];
          nextUsers = dedupeUsersByEmail(byId);
        }
        nextUsers = applySuperAdminRoleFromConfig(nextUsers);

        if (!cancelled && sessionEffective?.user) {
          nextUsers = mergeAuthUserIntoUsers(nextUsers, sessionEffective.user);
          nextUsers = dedupeUsersByEmail(applySuperAdminRoleFromConfig(nextUsers));
        }

        const hasLocalDemoSession = isLocalDemoSessionActive();

        let sessionUserRow: User | null = null;

        if (!cancelled && sessionEffective?.user) {
          clearLocalDemoSession();
          const em = (sessionEffective.user.email || '').trim().toLowerCase();
          const row = resolveCurrentUserRow(nextUsers, em, sessionEffective.user.id);
          sessionUserRow = row;
          if (!row) {
            await (backend === 'rest' || backend === 'local' ? repository.auth.signOut() : sqlClient!.auth.signOut());
            toast.error("Acceso denegado", {
              description:
                "Tu correo no aparece en la lista de usuarios del sistema. Un administrador debe darte de alta en «Gestión de usuarios».",
              duration: 10000,
            });
            deps.setCurrentUser(deps.GUEST_USER);
            deps.setIsAuthenticated(false);
            deps.setIsAuthChecking(false);
            return;
          }
          if (isUserSessionBlocked(row)) {
            await (backend === 'rest' || backend === 'local' ? repository.auth.signOut() : sqlClient!.auth.signOut());
            toast.error('Tu cuenta está desactivada. Contacta al Administrador.');
            deps.setCurrentUser(deps.GUEST_USER);
            deps.setIsAuthenticated(false);
            deps.setIsAuthChecking(false);
            return;
          }
          if (deps.signingOutRef.current) return;
          deps.setCurrentUser(row);
          deps.setIsAuthenticated(true);
          if (shouldShowAuthChecking) deps.setIsAuthChecking(false);
        } else if (backend === 'local' && hasLocalDemoSession) {
          if (!deps.signingOutRef.current) {
            const demoEmail = getLocalDemoSessionEmail() || 'admin@grooflow.com';
            if (nextUsers.length === 0) {
              nextUsers = applySuperAdminRoleFromConfig([createLocalDemoAdminUser(demoEmail)]);
              try {
                await api.saveKey('data:users', nextUsers);
              } catch (seedErr) {
                console.warn('[GrooFlow] No se pudo sembrar data:users demo local:', seedErr);
              }
            }
            const row =
              resolveCurrentUserRow(nextUsers, demoEmail) ??
              nextUsers.find((u) => (u.email || '').toLowerCase() === 'admin@grooflow.com') ??
              nextUsers[0];
            if (row) {
              deps.setUsers(nextUsers);
              deps.setCurrentUser({ ...row, lastLogin: new Date().toISOString() });
              deps.setIsAuthenticated(true);
              if (shouldShowAuthChecking) deps.setIsAuthChecking(false);
            } else {
              deps.setIsAuthenticated(false);
              deps.setIsAuthChecking(false);
            }
          }
        } else {
          deps.setIsAuthenticated(false);
          deps.setIsAuthChecking(false);
        }

        /** Solo tras validar sesión + fila de usuario (o modo invitado/local); evita “hidratación fantasma” en accesos denegados */
        deps.cloudDataHydratedRef.current = true;

        {
          const allowConfigRemote =
            !data.__configKvFetchFailed &&
            !deps.skipConfigHydrateRef.current &&
            Date.now() >= deps.configKvCooldownUntilRef.current;
          if (data.__configKvFetchFailed) {
            deps.configHydratedFromKvRef.current = false;
            toast.error(
              'No se pudo leer la configuración de Flujo de caja desde la nube. Los cambios no se guardarán hasta recargar o volver a iniciar sesión.'
            );
          } else if (allowConfigRemote) {
            const remoteConfig = data['settings:config'] as ConfigStructure | null | undefined;
            const sessionUserId = sessionEffective?.user?.id ?? null;
            let finalConfig = remoteConfig;
            if (PRODUCTION_USE_SQL) {
              finalConfig =
                ((await resolveAppKvFromSql(
                  sqlClient!,
                  'settings:config',
                  remoteConfig ?? initialStructure,
                  sessionUserId,
                  (v) => v == null
                )) as ConfigStructure | null | undefined) ?? remoteConfig ?? initialStructure;
            }
            if (finalConfig) {
              deps.setConfig(finalConfig);
              deps.configKvLatestRef.current = finalConfig;
            } else {
              deps.configKvLatestRef.current = initialStructure;
            }
            deps.configHydratedFromKvRef.current = true;
          }
        }

        {
          const allowSystemRemote = shouldAllowKvRemoteHydrate(
            data.__systemSettingsKvFetchFailed,
            deps.skipSystemSettingsHydrateRef,
            deps.systemSettingsKvCooldownUntilRef
          );
          if (data.__systemSettingsKvFetchFailed) {
            deps.systemSettingsHydratedFromKvRef.current = false;
            toast.error(
              'No se pudo leer la configuración del sistema desde la nube. Se detuvo el autoguardado.'
            );
          } else if (allowSystemRemote) {
            const remote = data['settings:system'] as Partial<SystemSettings> | null | undefined;
            const sessionUserId = sessionEffective?.user?.id ?? null;
            let resolvedRemote = remote;
            if (PRODUCTION_USE_SQL) {
              resolvedRemote =
                ((await resolveAppKvFromSql(
                  sqlClient!,
                  'settings:system',
                  remote ?? initialSystemSettings,
                  sessionUserId,
                  (v) => v == null
                )) as Partial<SystemSettings> | null | undefined) ?? remote;
            }
            const mergedBase = resolvedRemote
              ? mergeSystemSettings(resolvedRemote)
              : initialSystemSettings;
            const legacyMeta = extractPettyCashMeta(mergedBase.pettyCash);
            let remoteMeta = normalizePettyCashMeta(data[PETTY_CASH_META_KV_KEY]);
            if (PRODUCTION_USE_SQL) {
              const sqlMetaLoad = await loadPettyCashMetaFromSql(sqlClient!);
              if (sqlMetaLoad.ok && sqlMetaLoad.data) {
                remoteMeta = sqlMetaLoad.data;
              }
            }
            const resolvedMeta = resolvePettyCashMeta(remoteMeta, legacyMeta);
            if (
              PRODUCTION_USE_SQL &&
              sessionUserId &&
              !remoteMeta.weekClosures.length &&
              !remoteMeta.fundDeliveries.length &&
              (legacyMeta.weekClosures.length > 0 || legacyMeta.fundDeliveries.length > 0)
            ) {
              void migratePettyCashMetaKvToSql(
                sqlClient!,
                legacyMeta,
                sessionUserId
              );
            }
            const merged = mergePettyCashMetaIntoSettings(mergedBase, resolvedMeta);

            if (data.__asistenciaKvFetchFailed) {
              toast.error(
                'No se pudo leer la configuración de Asistencia desde la nube. Se usará la copia embebida en sistema.'
              );
            }

            let asistenciaRemote = data.__asistenciaKvFetchFailed
              ? undefined
              : (data[ASISTENCIA_SETTINGS_KV_KEY] as Partial<AsistenciaSettings> | null | undefined);
            if (!data.__asistenciaKvFetchFailed && PRODUCTION_USE_SQL) {
              asistenciaRemote =
                ((await resolveAppKvFromSql(
                  sqlClient!,
                  ASISTENCIA_SETTINGS_KV_KEY,
                  asistenciaRemote ?? merged.asistencia,
                  sessionUserId,
                  (v) => v == null
                )) as Partial<AsistenciaSettings> | null | undefined) ?? asistenciaRemote;
            }
            const resolvedAsistencia = resolveAsistenciaSettings(
              asistenciaRemote,
              merged.asistencia
            );
            const mergedWithAsistencia = mergeAsistenciaIntoSystemSettings(
              merged,
              resolvedAsistencia
            );
            if (
              PRODUCTION_USE_SQL &&
              sessionUserId &&
              asistenciaSettingsHasContent(resolvedAsistencia) &&
              !asistenciaSettingsHasContent(asistenciaRemote)
            ) {
              void saveAppKvKey(
                sqlClient!,
                ASISTENCIA_SETTINGS_KV_KEY,
                resolvedAsistencia,
                sessionUserId
              );
            }

            deps.pettyCashMetaKvLatestRef.current = resolvedMeta;
            deps.systemSettingsKvLatestRef.current = mergedWithAsistencia;
            deps.asistenciaKvLatestRef.current = resolvedAsistencia;
            deps.setSystemSettings(mergedWithAsistencia);
            deps.systemSettingsHydratedFromKvRef.current = true;
          }
        }

        if (data.__transactionsKvFetchFailed) {
          deps.transactionsCloudHydrationDoneRef.current = false;
          deps.transactionsHydratedFromKvRef.current = false;
          toast.error(
            'No se pudieron leer las transacciones desde la nube. Se detuvo el autoguardado para evitar sobrescribir el histórico.'
          );
        } else {
          const rawKv = data['data:transactions'];
          const kvList = Array.isArray(rawKv) ? hydrateTransactions(rawKv) : [];
          const kvUnique = Array.from(new Map(kvList.map((t) => [t.id, t])).values());
          let nextTransactions = kvUnique;
          const sessionUserId = sessionEffective?.user?.id ?? null;

          if (TRANSACTIONS_USE_SQL) {
            nextTransactions = await resolveListFromSql(
              kvUnique,
              () => loadTransactionsFromSql(sqlClient!),
              (list, uid) => migrateTransactionsKvToSql(sqlClient!, list, uid),
              sessionUserId
            );
          }

          deps.transactionsKvLatestRef.current = nextTransactions;
          deps.setTransactions(nextTransactions);
          deps.transactionsCloudHydrationDoneRef.current = true;
          deps.transactionsHydratedFromKvRef.current = true;

          if (data['maintenance:transactionsClearedAt'] !== TRANSACTION_HISTORY_CLEAR_MARK) {
            void api.saveKey('maintenance:transactionsClearedAt', TRANSACTION_HISTORY_CLEAR_MARK);
          }
        }

        {
          const allowInvoicesRemote = shouldAllowKvRemoteHydrate(
            data.__invoicesKvFetchFailed,
            deps.skipInvoicesHydrateRef,
            deps.invoicesKvCooldownUntilRef
          );
          if (data.__invoicesKvFetchFailed) {
            deps.invoicesHydratedFromKvRef.current = false;
            toast.error(
              'No se pudieron leer las facturas desde la nube. Se detuvo el autoguardado para no sobrescribirlas.'
            );
          } else if (allowInvoicesRemote) {
            const rawInv = data['data:invoices'];
            const kvUnique = Array.isArray(rawInv)
              ? (Array.from(
                  new Map((rawInv as InvoiceDraft[]).map((i) => [i.id, i])).values()
                ) as InvoiceDraft[])
              : APP_BACKEND === 'local'
                ? deps.initialInvoices
                : [];
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const unique = PRODUCTION_USE_SQL
              ? await resolveListFromSql(
                  kvUnique,
                  () => loadInvoicesFromSql(sqlClient!),
                  migrateInvoicesKvToSql,
                  sessionUserId
                )
              : kvUnique;
            deps.invoicesKvLatestRef.current = unique;
            deps.setInvoices(unique);
            deps.invoicesHydratedFromKvRef.current = true;
          }
        }

        const rawPv = data['data:providers'];
        const allowProvidersRemote =
          !data.__providersKvFetchFailed &&
          !deps.skipProvidersHydrateRef.current &&
          Date.now() >= deps.providersKvCooldownUntilRef.current;
        if (data.__providersKvFetchFailed) {
          toast.error(
            'No se pudieron leer los proveedores desde la nube. Se detuvo el autoguardado para no borrar el directorio.'
          );
        } else if (allowProvidersRemote) {
          deps.providersHydratedFromKvRef.current = true;
          const kvList = Array.isArray(rawPv)
            ? (Array.from(new Map(rawPv.map((p: Provider) => [p.id, p])).values()) as Provider[])
            : [];
          const sessionUserId = sessionEffective?.user?.id ?? null;
          const list = PRODUCTION_USE_SQL
            ? await resolveListFromSql(
                kvList,
                () => loadProvidersFromSql(sqlClient!),
                migrateProvidersKvToSql,
                sessionUserId
              )
            : kvList;
          deps.providersKvLatestRef.current = list;
          deps.setProviders(list);
        }

        {
          const allowChartRemote = shouldAllowKvRemoteHydrate(
            data.__chartOfAccountsKvFetchFailed,
            deps.skipChartOfAccountsHydrateRef,
            deps.chartOfAccountsKvCooldownUntilRef
          );
          if (data.__chartOfAccountsKvFetchFailed) {
            const sessionUserId = sessionEffective?.user?.id ?? null;
            if (PRODUCTION_USE_SQL && sessionUserId) {
              const sqlList =
                ((await resolveAppKvFromSql(
                  sqlClient!,
                  'data:chartOfAccounts',
                  [],
                  sessionUserId,
                  (v) => !Array.isArray(v) || v.length === 0
                )) as ChartOfAccountEntry[] | null | undefined) ?? [];
              deps.chartOfAccountsKvLatestRef.current = sqlList;
              deps.setChartOfAccounts(sqlList);
              deps.chartOfAccountsHydratedFromKvRef.current = true;
              if (sqlList.length === 0) {
                toast.error(
                  'No se pudo leer el plan de cuentas desde KV; SQL también está vacío. Revisa conexión antes de importar.'
                );
              }
            } else {
              deps.chartOfAccountsHydratedFromKvRef.current = false;
              toast.error(
                'No se pudo leer el plan de cuentas desde la nube. Se detuvo el autoguardado para no borrarlo.'
              );
            }
          } else if (allowChartRemote) {
            const raw = data['data:chartOfAccounts'] as ChartOfAccountEntry[] | null | undefined;
            const kvList = Array.isArray(raw) ? raw : [];
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const list = PRODUCTION_USE_SQL
              ? ((await resolveAppKvFromSql(
                  sqlClient!,
                  'data:chartOfAccounts',
                  kvList,
                  sessionUserId,
                  (v) => !Array.isArray(v) || v.length === 0
                )) as ChartOfAccountEntry[] | null | undefined) ?? kvList
              : kvList;
            deps.chartOfAccountsKvLatestRef.current = list;
            deps.setChartOfAccounts(list);
            deps.chartOfAccountsHydratedFromKvRef.current = true;
          }
        }

        {
          const allowProductsRemote = shouldAllowKvRemoteHydrate(
            data.__productsKvFetchFailed,
            deps.skipProductsHydrateRef,
            deps.productsKvCooldownUntilRef
          );
          if (data.__productsKvFetchFailed) {
            deps.productsHydratedFromKvRef.current = false;
            toast.error(
              'No se pudieron leer los productos desde la nube. Se detuvo el autoguardado para no borrar el catálogo.'
            );
          } else if (allowProductsRemote) {
            const rawPv = data['data:products'];
            const kvUnique = Array.isArray(rawPv)
              ? (Array.from(
                  new Map((rawPv as Product[]).map((p) => [p.id, p])).values()
                ) as Product[])
              : APP_BACKEND === 'local'
                ? deps.initialProducts
                : [];
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const resolved = PRODUCTION_USE_SQL
              ? ((await resolveAppKvFromSql(
                  sqlClient!,
                  'data:products',
                  kvUnique,
                  sessionUserId,
                  (v) => !Array.isArray(v) || v.length === 0
                )) as Product[] | null | undefined) ?? kvUnique
              : kvUnique;
            const mapped = resolved.map((p) => ({
              ...p,
              createdAt: p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt),
              updatedAt: p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt),
            }));
            deps.productsKvLatestRef.current = mapped;
            deps.setProducts(mapped);
            deps.productsHydratedFromKvRef.current = true;
          }
        }

        {
          const allowRequestsRemote = shouldAllowKvRemoteHydrate(
            data.__requestsKvFetchFailed,
            deps.skipRequestsHydrateRef,
            deps.requestsKvCooldownUntilRef
          );
          if (data.__requestsKvFetchFailed) {
            deps.requestsHydratedFromKvRef.current = false;
            toast.error(
              'No se pudieron leer las solicitudes de compra desde la nube. Se detuvo el autoguardado.'
            );
          } else if (allowRequestsRemote) {
            const rawReq = data['data:requests'];
            const kvUnique = Array.isArray(rawReq)
              ? (Array.from(
                  new Map((rawReq as PurchaseRequest[]).map((r) => [r.id, r])).values()
                ) as PurchaseRequest[])
              : APP_BACKEND === 'local'
                ? deps.initialRequests
                : [];
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const resolved = PRODUCTION_USE_SQL
              ? await resolveListFromSql(
                  kvUnique.map((r) => {
                    const rd = r.requestDate;
                    const asDate =
                      rd instanceof Date && !isNaN(rd.getTime())
                        ? rd
                        : new Date(
                            typeof rd === 'string' || typeof rd === 'number' ? rd : String(rd ?? '')
                          );
                    return {
                      ...r,
                      requestDate: isNaN(asDate.getTime()) ? new Date() : asDate,
                    };
                  }),
                  () => loadPurchaseRequestsFromSql(sqlClient!),
                  migratePurchaseRequestsKvToSql,
                  sessionUserId
                )
              : kvUnique;
            const mapped = resolved.map((r) => {
              const rd = r.requestDate;
              const asDate =
                rd instanceof Date && !isNaN(rd.getTime())
                  ? rd
                  : new Date(
                      typeof rd === 'string' || typeof rd === 'number' ? rd : String(rd ?? '')
                    );
              return {
                ...r,
                requestDate: isNaN(asDate.getTime()) ? new Date() : asDate,
              };
            });
            deps.requestsKvLatestRef.current = mapped;
            deps.setRequests(mapped);
            deps.requestsHydratedFromKvRef.current = true;
          }
        }

        {
          const allowPettyRemote =
            !data.__pettyCashKvFetchFailed &&
            !deps.skipPettyCashHydrateRef.current &&
            Date.now() >= deps.pettyCashKvCooldownUntilRef.current;
          if (data.__pettyCashKvFetchFailed) {
            deps.pettyCashHydratedFromKvRef.current = false;
            toast.error(
              'No se pudo leer Caja chica desde la nube. Se detuvo el autoguardado para no perder movimientos.'
            );
          } else if (allowPettyRemote) {
            const rawPc = data['data:pettyCash'];
            const kvPtx = Array.isArray(rawPc) ? (rawPc as PettyCashTransaction[]) : [];
            const kvMapped = kvPtx.map((t) => ({
              ...t,
              date: parseTransactionDate(t.date),
              documentDate:
                t.documentDate != null ? parseTransactionDate(t.documentDate) : undefined,
            }));
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const mapped = PRODUCTION_USE_SQL
              ? await resolveListFromSql(
                  kvMapped,
                  () => loadPettyCashFromSql(sqlClient!),
                  migratePettyCashKvToSql,
                  sessionUserId
                )
              : kvMapped;
            deps.pettyCashKvLatestRef.current = mapped;
            deps.setPettyCashTransactions(mapped);
            deps.pettyCashHydratedFromKvRef.current = true;
          }
        }

        if (PRODUCTION_USE_SQL && sessionEffective?.user?.id) {
          const sqlUsers = await resolveUsersFromSql(
            nextUsers,
            () => loadAppUsersFromSql(sqlClient!),
            migrateAppUsersKvToSql,
            sessionEffective.user.id,
            isAdminAppUser(sessionUserRow)
          );
          if (sqlUsers.length > 0) {
            nextUsers = dedupeUsersByEmail(applySuperAdminRoleFromConfig(sqlUsers));
            if (sessionEffective?.user) {
              nextUsers = mergeAuthUserIntoUsers(nextUsers, sessionEffective.user);
              nextUsers = dedupeUsersByEmail(applySuperAdminRoleFromConfig(nextUsers));
            }
          }
          if (sessionEffective.user.email) {
            const em = sessionEffective.user.email.trim().toLowerCase();
            const refreshedRow = resolveCurrentUserRow(nextUsers, em, sessionEffective.user.id);
            if (refreshedRow) {
              const profile = sqlClient
                ? await loadSelfAppUserProfile(sqlClient, sessionEffective.user.id)
                : null;
              const merged = applySuperAdminRoleFromConfig([
                mergeUserWithSqlProfile(refreshedRow, profile),
              ])[0]!;
              if (isUserSessionBlocked(merged)) {
                await (backend === 'rest' || backend === 'local' ? repository.auth.signOut() : sqlClient!.auth.signOut());
                toast.error('Tu cuenta está desactivada. Contacta al Administrador.');
                deps.setCurrentUser(deps.GUEST_USER);
                deps.setIsAuthenticated(false);
                deps.setIsAuthChecking(false);
                return;
              }
              deps.setCurrentUser(merged);
              sessionUserRow = merged;
            }
          }
        }

        if (sessionEffective?.user?.id && sessionUserRow && !isUserSessionBlocked(sessionUserRow)) {
          const loginAt = new Date().toISOString();
          nextUsers = stampLastLoginInList(nextUsers, sessionEffective.user.id, loginAt);
          deps.setCurrentUser((prev) =>
            prev.id === sessionEffective.user!.id ? { ...prev, lastLogin: loginAt } : prev
          );
          if (sqlClient) void touchOwnLastLogin(sqlClient);
        }

        deps.setUsers(nextUsers);
        if (!data.__usersKvFetchFailed) {
          deps.usersKvLatestRef.current = nextUsers;
          deps.usersHydratedFromKvRef.current = true;
          if (backend === 'supabase' && sessionEffective.user?.id) {
            void syncUserProfilesToSql(sqlClient!, nextUsers, {
              authUserId: sessionEffective.user.id,
              isAdmin: isAdminAppUser(sessionUserRow),
            });
          }
        } else {
          deps.usersHydratedFromKvRef.current = false;
        }

        {
          const allowRolesRemote = shouldAllowKvRemoteHydrate(
            data.__rolesKvFetchFailed,
            deps.skipRolesHydrateRef,
            deps.rolesKvCooldownUntilRef
          );
          if (data.__rolesKvFetchFailed) {
            deps.rolesHydratedFromKvRef.current = false;
            toast.error(
              'No se pudieron leer los roles desde la nube. Se detuvo el autoguardado para no sobrescribirlos.'
            );
          } else if (allowRolesRemote) {
            const rawRoles = data['data:roles'] as Role[] | null | undefined;
            const kvMerged = rawRoles ? mergeRolesWithDefaults(rawRoles) : DEFAULT_ROLES;
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const merged = PRODUCTION_USE_SQL
              ? mergeRolesWithDefaults(
                  await resolveListFromSql(
                    kvMerged,
                    () => loadRolesFromSql(sqlClient!),
                    migrateRolesKvToSql,
                    sessionUserId
                  )
                )
              : kvMerged;
            deps.rolesKvLatestRef.current = merged;
            deps.setRoles(merged);
            deps.rolesHydratedFromKvRef.current = true;
          }
        }

        {
          const allowFeeReceiptsRemote = shouldAllowKvRemoteHydrate(
            data.__feeReceiptsKvFetchFailed,
            deps.skipFeeReceiptsHydrateRef,
            deps.feeReceiptsKvCooldownUntilRef
          );
          if (data.__feeReceiptsKvFetchFailed) {
            deps.feeReceiptsHydratedFromKvRef.current = false;
            toast.error(
              'No se pudieron leer los honorarios desde la nube. Se detuvo el autoguardado.'
            );
          } else if (allowFeeReceiptsRemote) {
            const raw = data['data:feeReceipts'];
            const kvList = Array.isArray(raw) ? (raw as FeeReceiptGlobal[]) : [];
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const list = PRODUCTION_USE_SQL
              ? ((await resolveAppKvFromSql(
                  sqlClient!,
                  'data:feeReceipts',
                  kvList,
                  sessionUserId,
                  (v) => !Array.isArray(v) || v.length === 0
                )) as FeeReceiptGlobal[] | null | undefined) ?? kvList
              : kvList;
            deps.feeReceiptsKvLatestRef.current = list;
            deps.setFeeReceipts(list);
            deps.feeReceiptsHydratedFromKvRef.current = true;
          }
        }

        {
          const allowAlertThresholdsRemote = shouldAllowKvRemoteHydrate(
            data.__alertThresholdsKvFetchFailed,
            deps.skipAlertThresholdsHydrateRef,
            deps.alertThresholdsKvCooldownUntilRef
          );
          if (data.__alertThresholdsKvFetchFailed) {
            deps.alertThresholdsHydratedFromKvRef.current = false;
            toast.error(
              'No se pudieron leer los umbrales de alertas desde la nube. Se detuvo el autoguardado.'
            );
          } else if (allowAlertThresholdsRemote) {
            const remoteThresholds = data['settings:alertThresholds'] as AlertThresholds | null | undefined;
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const resolved = PRODUCTION_USE_SQL
              ? ((await resolveAppKvFromSql(
                  sqlClient!,
                  'settings:alertThresholds',
                  remoteThresholds,
                  sessionUserId,
                  (v) => v == null
                )) as AlertThresholds | null | undefined) ?? remoteThresholds
              : remoteThresholds;
            if (resolved) {
              deps.alertThresholdsKvLatestRef.current = resolved;
              deps.setAlertThresholds(resolved);
            }
            deps.alertThresholdsHydratedFromKvRef.current = true;
          }
        }

        {
          const allowThemeRemote = shouldAllowKvRemoteHydrate(
            data.__themeKvFetchFailed,
            deps.skipThemeHydrateRef,
            deps.themeKvCooldownUntilRef
          );
          if (data.__themeKvFetchFailed) {
            deps.themeHydratedFromKvRef.current = false;
            toast.error('No se pudo leer el tema desde la nube. Se detuvo el autoguardado.');
          } else if (allowThemeRemote) {
            const remote = data['settings:theme'];
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const resolved = PRODUCTION_USE_SQL
              ? ((await resolveAppKvFromSql(
                  sqlClient!,
                  'settings:theme',
                  remote,
                  sessionUserId,
                  (v) => v == null
                )) as 'dark' | 'light' | null | undefined) ?? remote
              : remote;
            const next: 'dark' | 'light' = resolved === 'light' ? 'light' : 'dark';
            deps.themeKvLatestRef.current = next;
            deps.setTheme(next);
            deps.themeHydratedFromKvRef.current = true;
          }
        }

        {
          const treasuryFetchFailed =
            data.__treasuryInvoicesKvFetchFailed ||
            data.__treasuryBankBalanceKvFetchFailed ||
            data.__treasuryPaidHistoryKvFetchFailed;
          const allowTreasuryRemote =
            !treasuryFetchFailed &&
            !deps.skipTreasuryHydrateRef.current &&
            Date.now() >= deps.treasuryKvCooldownUntilRef.current;

          if (treasuryFetchFailed) {
            deps.treasuryHydratedFromKvRef.current = false;
            deps.treasuryBankBalanceLoadedFromKvRef.current = false;
            toast.error(
              'No se pudo leer Tesorería desde la nube. Se detuvo el autoguardado para no perder datos.'
            );
          } else if (allowTreasuryRemote) {
            const sessionUserId = sessionEffective?.user?.id ?? null;
            const rawTi = data['data:treasuryInvoices'];
            const kvTiList = Array.isArray(rawTi) ? rawTi : [];
            const tiList = PRODUCTION_USE_SQL
              ? ((await resolveAppKvFromSql(
                  sqlClient!,
                  'data:treasuryInvoices',
                  kvTiList,
                  sessionUserId,
                  (v) => !Array.isArray(v) || v.length === 0
                )) as unknown[] | null | undefined) ?? kvTiList
              : kvTiList;
            deps.treasuryInvoicesKvLatestRef.current = tiList;
            deps.setTreasuryInvoices(tiList);

            deps.treasuryBankBalanceLoadedFromKvRef.current = true;
            const kvBal =
              data['data:treasuryBankBalance'] !== undefined && data['data:treasuryBankBalance'] !== null
                ? Number(data['data:treasuryBankBalance'])
                : undefined;
            const bal = PRODUCTION_USE_SQL
              ? ((await resolveAppKvFromSql(
                  sqlClient!,
                  'data:treasuryBankBalance',
                  kvBal,
                  sessionUserId,
                  (v) => v === undefined
                )) as number | null | undefined)
              : kvBal;
            if (bal !== undefined && bal !== null) {
              deps.treasuryBankBalanceKvLatestRef.current = Number(bal);
              deps.setTreasuryBankBalance(Number(bal));
            } else {
              deps.treasuryBankBalanceKvLatestRef.current = undefined;
              deps.setTreasuryBankBalance(undefined);
            }

            const rawPh = data['data:treasuryPaidHistory'];
            const kvPhList = Array.isArray(rawPh) ? rawPh : [];
            const phList = PRODUCTION_USE_SQL
              ? ((await resolveAppKvFromSql(
                  sqlClient!,
                  'data:treasuryPaidHistory',
                  kvPhList,
                  sessionUserId,
                  (v) => !Array.isArray(v) || v.length === 0
                )) as unknown[] | null | undefined) ?? kvPhList
              : kvPhList;
            deps.treasuryPaidHistoryKvLatestRef.current = phList;
            deps.setTreasuryPaidHistory(phList);

            deps.treasuryHydratedFromKvRef.current = true;
          }
        }

        {
          const allowFleetRemote = shouldAllowKvRemoteHydrate(
            data.__fleetKvFetchFailed,
            deps.skipFleetHydrateRef,
            deps.fleetKvCooldownUntilRef
          );
          const fleetFetchFailed = data.__fleetKvFetchFailed && !FLEET_USE_SQL;
          if (fleetFetchFailed) {
            deps.fleetHydratedFromKvRef.current = false;
            toast.error(
              'No se pudo leer Flota clínica desde la nube. Se detuvo el autoguardado para no perder vehículos ni checklists.'
            );
          } else if (allowFleetRemote || FLEET_USE_SQL) {
            let nextFleet: FleetDataset;
            const sessionUserId = sessionEffective?.user?.id ?? null;

            if (FLEET_USE_SQL) {
              const sqlLoad = await loadFleetFromSql(sqlClient!);
              const rawFleet = data['data:fleet'];
              const kvFleet = rawFleet != null ? normalizeFleetDataset(rawFleet) : null;
              const kvHasData = kvFleet != null && !isFleetDatasetEmpty(kvFleet);

              if (sqlLoad.ok && sqlLoad.data) {
                if (sqlLoad.empty && kvHasData && sessionUserId) {
                  await migrateFleetKvToSql(sqlClient!, kvFleet!, sessionUserId);
                  const reload = await loadFleetFromSql(sqlClient!);
                  nextFleet = reload.data ?? sqlLoad.data;
                  if (reload.timestamps) {
                    deps.fleetSqlTimestampsRef.current = reload.timestamps;
                  }
                } else {
                  nextFleet = sqlLoad.data;
                  if (sqlLoad.timestamps) {
                    deps.fleetSqlTimestampsRef.current = sqlLoad.timestamps;
                  }
                }
              } else if (kvHasData && sessionUserId) {
                await migrateFleetKvToSql(sqlClient!, kvFleet!, sessionUserId);
                const reload = await loadFleetFromSql(sqlClient!);
                nextFleet = reload.data ?? kvFleet!;
                if (reload.timestamps) {
                  deps.fleetSqlTimestampsRef.current = reload.timestamps;
                }
              } else if (kvHasData) {
                nextFleet = kvFleet!;
              } else if (sqlLoad.ok && sqlLoad.data) {
                nextFleet = sqlLoad.data;
                if (sqlLoad.timestamps) {
                  deps.fleetSqlTimestampsRef.current = sqlLoad.timestamps;
                }
              } else if (APP_BACKEND === 'local') {
                nextFleet = createDemoFleetDataset();
              } else {
                nextFleet = normalizeFleetDataset({});
              }
            } else {
              const rawFleet = data['data:fleet'];
              if (rawFleet != null) {
                nextFleet = normalizeFleetDataset(rawFleet);
              } else if (APP_BACKEND === 'local') {
                nextFleet = createDemoFleetDataset();
              } else {
                nextFleet = normalizeFleetDataset({});
              }
            }
            deps.fleetKvLatestRef.current = nextFleet;
            deps.setFleetDataset(nextFleet);
            deps.fleetHydratedFromKvRef.current = true;
          }
        }

        {
          const allowInventoryRemote = shouldAllowKvRemoteHydrate(
            data.__inventoryKvFetchFailed,
            deps.skipInventoryHydrateRef,
            deps.inventoryKvCooldownUntilRef
          );
          const inventoryFetchFailed = data.__inventoryKvFetchFailed && !INVENTORY_USE_SQL;
          if (inventoryFetchFailed) {
            deps.inventoryHydratedFromKvRef.current = false;
            toast.error(
              'No se pudo leer Inventario de equipos desde la nube. Se detuvo el autoguardado.'
            );
          } else if (allowInventoryRemote || INVENTORY_USE_SQL) {
            let nextInventory: InventoryDataset;
            const sessionUserId = sessionEffective?.user?.id ?? null;

            if (INVENTORY_USE_SQL) {
              const sqlLoad = await loadInventoryFromSql(sqlClient!);
              const rawInv = data['data:inventory'];
              const kvInv = rawInv != null ? normalizeInventoryDataset(rawInv) : null;
              const kvHasData = kvInv != null && !isInventoryDatasetEmpty(kvInv);

              if (kvHasData) {
                if (sqlLoad.ok && sqlLoad.data) {
                  if (sqlLoad.empty) {
                    /** SQL vacío = borrado en producción; no restaurar equipos desde KV obsoleto. */
                    nextInventory = sqlLoad.data;
                  } else {
                    nextInventory = mergeInventoryKvAndSql(kvInv!, sqlLoad.data);
                  }
                } else {
                  nextInventory = kvInv!;
                }
                void api.saveKey('data:inventory', nextInventory).then((ok) => {
                  if (!ok) {
                    console.warn('[hydration] inventory merge→KV backup failed');
                  }
                });
                if (sqlLoad.ok && sessionUserId && sqlLoad.data && !sqlLoad.empty) {
                  void migrateInventoryKvToSql(sqlClient!, nextInventory, sessionUserId);
                }
              } else if (sqlLoad.ok && sqlLoad.data && !sqlLoad.empty) {
                nextInventory = sqlLoad.data;
                void api.saveKey('data:inventory', nextInventory).then((ok) => {
                  if (!ok) {
                    console.warn('[hydration] inventory SQL→KV backup failed');
                  }
                });
              } else if (kvInv != null) {
                nextInventory = kvInv;
              } else if (sqlLoad.ok && sqlLoad.data) {
                nextInventory = sqlLoad.data;
              } else {
                nextInventory = normalizeInventoryDataset({});
              }
            } else {
              const rawInv = data['data:inventory'];
              if (rawInv != null) {
                nextInventory = normalizeInventoryDataset(rawInv);
              } else {
                nextInventory = normalizeInventoryDataset({});
              }
            }
            deps.inventoryKvLatestRef.current = nextInventory;
            deps.setInventoryDataset(nextInventory);
            deps.inventoryHydratedFromKvRef.current = true;
          }
        }

        if (
          deps.systemSettingsHydratedFromKvRef.current &&
          deps.pettyCashHydratedFromKvRef.current &&
          deps.pettyCashKvLatestRef.current.length > 0
        ) {
          const currentSettings = deps.systemSettingsKvLatestRef.current;
          const currentMeta = deps.pettyCashMetaKvLatestRef.current;
          const reconciled = reconcilePettyCashMeta({
            meta: currentMeta,
            transactions: deps.pettyCashKvLatestRef.current,
            users: nextUsers,
            globalFundLimit: currentSettings.pettyCash?.totalFundLimit ?? 1000,
          });
          if (pettyCashMetaReconcileChanged(currentMeta, reconciled)) {
            const mergedAfterReconcile = mergePettyCashMetaIntoSettings(
              currentSettings,
              reconciled
            );
            deps.pettyCashMetaKvLatestRef.current = reconciled;
            deps.systemSettingsKvLatestRef.current = mergedAfterReconcile;
            deps.setSystemSettings(mergedAfterReconcile);
          }
        }

        deps.providersCloudHydrationDoneRef.current = true;
        deps.cloudSyncErrorRef.current = false;
        deps.setCloudSyncPhase('synced');
        deps.setIsDataLoaded(true);
      } catch (hydrateErr) {
        console.error('[GrooFlow] hydrateFromKv:', hydrateErr);
        deps.cloudSyncErrorRef.current = true;
        deps.setCloudSyncPhase('error');
        toast.error(
          'Error al sincronizar datos desde la nube. Recarga la página o revisa tu conexión.'
        );
      } finally {
        deps.setIsAuthChecking(false);
        deps.hydrateRunningRef.current = false;
        const rerun = deps.pendingHydrateRef.current;
        deps.pendingHydrateRef.current = false;
        if (rerun && !cancelled && !deps.signingOutRef.current) {
          queueMicrotask(() => {
            void hydrateFromKv();
          });
        }
      }
    }

    deps.hydrateFromKvRef.current = hydrateFromKv;
    void hydrateFromKv();

    let unsubAuth: (() => void) | undefined;
    if (backend === 'supabase') {
      void getSupabaseClientLazy().then((client) => {
        if (cancelled || !client) return;
        const {
          data: { subscription },
        } = client.auth.onAuthStateChange(async (event, session) => {
          if (cancelled) return;
          if (deps.authNullDebounceRef.current) {
            clearTimeout(deps.authNullDebounceRef.current);
            deps.authNullDebounceRef.current = null;
          }
          if (event === 'TOKEN_REFRESHED') {
            return;
          }
          if (session?.user) {
            /** No hacer KV full-hydrate en USER_UPDATED: Supabase puede emitirlo tras metadatos y pisa estado local
             *  antes del autosave (ej. proveedores recién cargados parecían «no guardarse»). */
            const shouldHydrate =
              (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
              !deps.cloudDataHydratedRef.current;
            if (shouldHydrate) {
              if (event === 'SIGNED_IN' && deps.hydrateRunningRef.current) return;
              await hydrateFromKv();
            }
            return;
          }
          // Sesión nula: puede ser cierre real o carrera (F5, pestaña, red).
          if (event === 'TOKEN_REFRESHED') {
            return;
          }
          deps.authNullDebounceRef.current = setTimeout(async () => {
            deps.authNullDebounceRef.current = null;
            if (cancelled || deps.signingOutRef.current) return;
            let s2 = await getStableSession();
            if (!s2?.user) {
              try {
                await refreshSessionWithTimeout(5000);
                const retryClient = await getSupabaseClientLazy();
                const retry = retryClient ? await retryClient.auth.getSession() : null;
                s2 = retry?.data.session ?? null;
              } catch {
                /* intento extra tras idle / pestaña en segundo plano */
              }
            }
            if (s2?.user) {
              /** Sesión recuperada tras un null transitorio (refresh/red): no re-hidratar KV
               *  porque invalidaría colas de guardado y pisaría cambios locales recientes. */
              if (!deps.cloudDataHydratedRef.current) {
                await hydrateFromKv();
              }
              return;
            }
            clearLocalDemoSession();
            deps.setCurrentUser(deps.GUEST_USER);
            deps.setIsAuthenticated(false);
            deps.setIsAuthChecking(false);
            deps.cloudDataHydratedRef.current = false;
            deps.transactionsCloudHydrationDoneRef.current = false;
            deps.transactionsHydratedFromKvRef.current = false;
            deps.providersCloudHydrationDoneRef.current = false;
            deps.providersHydratedFromKvRef.current = false;
            deps.pettyCashHydratedFromKvRef.current = false;
            deps.providersKvCooldownUntilRef.current = 0;
            deps.pettyCashKvCooldownUntilRef.current = 0;
            deps.configHydratedFromKvRef.current = false;
            deps.configKvCooldownUntilRef.current = 0;
            deps.skipProvidersHydrateRef.current = false;
            deps.skipPettyCashHydrateRef.current = false;
            deps.skipConfigHydrateRef.current = false;
            deps.resetAllKvDomainRefs();
            deps.resetKvSaveChains();
            deps.cloudSyncPendingRef.current = 0;
            deps.cloudSyncErrorRef.current = false;
            deps.setCloudSyncPhase('idle');
            deps.setCanSaveUsers(true);
            deps.setIsDataLoaded(false);
          }, 600);
        });
        unsubAuth = () => subscription.unsubscribe();
      });
    }

    return () => {
      cancelled = true;
      clearTimeout(authWatchdog);
      if (deps.authNullDebounceRef.current) {
        clearTimeout(deps.authNullDebounceRef.current);
        deps.authNullDebounceRef.current = null;
      }
      unsubAuth?.();
      deps.hydrateFromKvRef.current = null;
    };
  }, []);
}

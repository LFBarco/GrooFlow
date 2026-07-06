/**

 * Realtime multi-dispositivo para dominios SQL de producción.

 */

import { useEffect, type MutableRefObject } from 'react';



import { getSupabaseClient } from '../services/repository/supabase';

import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';

import { loadProvidersFromSql } from '../services/repository/businessDomainsSql';

import { loadPettyCashFromSql } from '../services/repository/businessDomainsSql';
import { loadPettyCashMetaFromSql } from '../services/repository/pettyCashMetaSql';
import {
  extractPettyCashMeta,
  isPettyCashMetaEmpty,
  mergePettyCashMetaIntoSettings,
  type PettyCashWeekMetaPayload,
} from '../utils/pettyCashMeta';
import {
  mergePettyCashMetaPayloads,
  reconcilePettyCashMeta,
} from '../utils/pettyCashMetaReconcile';

import { loadInvoicesFromSql } from '../services/repository/businessDomainsSql';

import { loadPurchaseRequestsFromSql } from '../services/repository/businessDomainsSql';

import {
  loadAppUsersFromSql,
  loadRolesFromSql,
  resolveUsersFromSql,
} from '../services/repository/businessDomainsSql';

import { loadTransactionsFromSql } from '../services/repository/transactionsSql';

import { loadAppKvKey, mergeSystemSettingsSqlAndKv } from '../services/repository/appKvSql';

import { kvPayloadsEqual } from '../utils/kvCrossTabSync';
import { mergeRolesWithDefaults } from '../utils/mergeRolesWithDefaults';
import { parseTransactionDate } from '../utils/transactionDate';

import type {

  Provider,

  PettyCashTransaction,

  InvoiceDraft,

  PurchaseRequest,

  User,

  Transaction,

  Product,

  ChartOfAccountEntry,

  SystemSettings,

  AlertThresholds,

} from '../types';

import type { Role } from '../components/users/types';

import { initialStructure, type ConfigStructure, mergeSystemSettings } from '../data/initialData';



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



export type ProductionRealtimeHandlers = {

  transactions?: MutableRefObject<((items: Transaction[]) => void) | null>;

  transactionsLatest?: MutableRefObject<Transaction[]>;

  providers?: MutableRefObject<((items: Provider[]) => void) | null>;

  providersLatest?: MutableRefObject<Provider[]>;

  pettyCash?: MutableRefObject<((items: PettyCashTransaction[]) => void) | null>;

  pettyCashLatest?: MutableRefObject<PettyCashTransaction[]>;

  pettyCashMeta?: MutableRefObject<((items: SystemSettings) => void) | null>;

  pettyCashMetaLatest?: MutableRefObject<PettyCashWeekMetaPayload>;

  invoices?: MutableRefObject<((items: InvoiceDraft[]) => void) | null>;

  invoicesLatest?: MutableRefObject<InvoiceDraft[]>;

  requests?: MutableRefObject<((items: PurchaseRequest[]) => void) | null>;

  requestsLatest?: MutableRefObject<PurchaseRequest[]>;

  users?: MutableRefObject<((items: User[]) => void) | null>;

  usersLatest?: MutableRefObject<User[]>;

  /** Si true, Realtime recarga lista completa desde SQL (solo admin). */
  usersAdminReload?: MutableRefObject<boolean>;

  authUserId?: MutableRefObject<string | null>;

  roles?: MutableRefObject<((items: Role[]) => void) | null>;

  rolesLatest?: MutableRefObject<Role[]>;

  products?: MutableRefObject<((items: Product[]) => void) | null>;

  productsLatest?: MutableRefObject<Product[]>;

  feeReceipts?: MutableRefObject<((items: FeeReceiptGlobal[]) => void) | null>;

  feeReceiptsLatest?: MutableRefObject<FeeReceiptGlobal[]>;

  chartOfAccounts?: MutableRefObject<((items: ChartOfAccountEntry[]) => void) | null>;

  chartOfAccountsLatest?: MutableRefObject<ChartOfAccountEntry[]>;

  config?: MutableRefObject<((items: ConfigStructure) => void) | null>;

  configLatest?: MutableRefObject<ConfigStructure>;

  systemSettings?: MutableRefObject<((items: ReturnType<typeof mergeSystemSettings>) => void) | null>;

  systemSettingsLatest?: MutableRefObject<SystemSettings>;

  alertThresholds?: MutableRefObject<((items: AlertThresholds) => void) | null>;

  alertThresholdsLatest?: MutableRefObject<AlertThresholds>;

  theme?: MutableRefObject<((t: 'dark' | 'light') => void) | null>;

  themeLatest?: MutableRefObject<'dark' | 'light'>;

  treasuryInvoices?: MutableRefObject<((items: unknown[]) => void) | null>;

  treasuryInvoicesLatest?: MutableRefObject<unknown[]>;

  treasuryBankBalance?: MutableRefObject<((v: number | undefined) => void) | null>;

  treasuryBankBalanceLatest?: MutableRefObject<number | undefined>;

  treasuryPaidHistory?: MutableRefObject<((items: unknown[]) => void) | null>;

  treasuryPaidHistoryLatest?: MutableRefObject<unknown[]>;

};



const TABLE_CHANNELS: Array<{ table: string; channel: string }> = [

  { table: 'transactions', channel: 'grooflow-rt-transactions' },

  { table: 'providers', channel: 'grooflow-rt-providers' },

  { table: 'petty_cash_transactions', channel: 'grooflow-rt-petty-cash' },

  { table: 'petty_cash_week_meta', channel: 'grooflow-rt-petty-cash-meta' },

  { table: 'invoices', channel: 'grooflow-rt-invoices' },

  { table: 'purchase_requests', channel: 'grooflow-rt-requests' },

  { table: 'app_users', channel: 'grooflow-rt-users' },

  { table: 'roles', channel: 'grooflow-rt-roles' },

];



const APP_KV_KEYS = [

  'data:products',

  'data:feeReceipts',

  'data:chartOfAccounts',

  'settings:config',

  'settings:system',

  'settings:theme',

  'settings:alertThresholds',

  'data:treasuryInvoices',

  'data:treasuryBankBalance',

  'data:treasuryPaidHistory',

] as const;



export function useProductionRealtimeSync(enabled: boolean, handlers: ProductionRealtimeHandlers): void {

  useEffect(() => {

    if (!enabled || !isProductionSqlEnabled()) return;



    const client = getSupabaseClient();

    let cancelled = false;

    const debouncers = new Map<string, ReturnType<typeof setTimeout>>();

    const inFlight = new Set<string>();



    const schedule = (key: string, fn: () => Promise<void>) => {
      const prev = debouncers.get(key);
      if (prev) clearTimeout(prev);
      debouncers.set(
        key,
        setTimeout(() => {
          if (cancelled) return;
          if (inFlight.has(key)) {
            schedule(key, fn);
            return;
          }
          inFlight.add(key);
          void fn().finally(() => inFlight.delete(key));
        }, 400)
      );
    };



    const reloadTransactions = async () => {

      const h = handlers.transactions;

      const latest = handlers.transactionsLatest;

      if (!h || !latest) return;

      const result = await loadTransactionsFromSql(client);

      if (!result.ok || !result.data || kvPayloadsEqual(latest.current, result.data)) return;

      latest.current = result.data;

      h.current?.(result.data);

    };



    const reloadProviders = async () => {

      const h = handlers.providers;

      const latest = handlers.providersLatest;

      if (!h || !latest) return;

      const result = await loadProvidersFromSql(client);

      if (!result.ok || !result.data || kvPayloadsEqual(latest.current, result.data)) return;

      latest.current = result.data;

      h.current?.(result.data);

    };



    const reloadPettyCash = async () => {

      const h = handlers.pettyCash;

      const latest = handlers.pettyCashLatest;

      if (!h || !latest) return;

      const result = await loadPettyCashFromSql(client);

      if (!result.ok || !result.data || kvPayloadsEqual(latest.current, result.data)) return;

      latest.current = result.data;

      h.current?.(result.data);

    };



    const reloadPettyCashMeta = async () => {

      const h = handlers.pettyCashMeta;

      const metaLatest = handlers.pettyCashMetaLatest;

      const settingsLatest = handlers.systemSettingsLatest;

      if (!h || !metaLatest || !settingsLatest) return;

      const result = await loadPettyCashMetaFromSql(client);

      if (!result.ok || !result.data) return;

      const local = metaLatest.current;

      const remote = result.data;

      if (isPettyCashMetaEmpty(remote) && !isPettyCashMetaEmpty(local)) return;

      const merged = isPettyCashMetaEmpty(remote)
        ? local
        : isPettyCashMetaEmpty(local)
          ? remote
          : mergePettyCashMetaPayloads(local, remote);

      const pettyCashTxs = handlers.pettyCashLatest?.current ?? [];

      const reconciled =
        pettyCashTxs.length > 0
          ? reconcilePettyCashMeta({
              meta: merged,
              transactions: pettyCashTxs,
              users: handlers.usersLatest?.current ?? [],
              globalFundLimit:
                settingsLatest.current.pettyCash?.totalFundLimit ?? 1000,
            })
          : merged;

      if (kvPayloadsEqual(metaLatest.current, reconciled)) return;

      const mergedSettings = mergePettyCashMetaIntoSettings(
        settingsLatest.current,
        reconciled
      );

      metaLatest.current = reconciled;

      settingsLatest.current = mergedSettings;

      h.current?.(mergedSettings);

    };



    const reloadInvoices = async () => {

      const h = handlers.invoices;

      const latest = handlers.invoicesLatest;

      if (!h || !latest) return;

      const result = await loadInvoicesFromSql(client);

      if (!result.ok || !result.data || kvPayloadsEqual(latest.current, result.data)) return;

      latest.current = result.data;

      h.current?.(result.data);

    };



    const reloadRequests = async () => {

      const h = handlers.requests;

      const latest = handlers.requestsLatest;

      if (!h || !latest) return;

      const result = await loadPurchaseRequestsFromSql(client);

      if (!result.ok || !result.data || kvPayloadsEqual(latest.current, result.data)) return;

      latest.current = result.data;

      h.current?.(result.data);

    };



    const reloadUsers = async () => {

      const h = handlers.users;

      const latest = handlers.usersLatest;

      if (!h || !latest) return;

      const result = await loadAppUsersFromSql(client);

      if (!result.ok || !result.data) return;

      const isAdmin = handlers.usersAdminReload?.current === true;

      let next: User[];

      if (isAdmin) {
        next = result.data;
        if (kvPayloadsEqual(latest.current, next)) return;
      } else {
        const authUserId = handlers.authUserId?.current ?? null;
        const self = authUserId ? result.data.find((u) => u.id === authUserId) : undefined;
        if (!self || latest.current.length === 0) return;
        next = latest.current.map((u) => (u.id === self.id ? { ...u, ...self } : u));
        if (!next.some((u) => u.id === self.id)) next.push(self);
        if (kvPayloadsEqual(latest.current, next)) return;
      }

      latest.current = next;

      h.current?.(next);

    };



    const reloadRoles = async () => {

      const h = handlers.roles;

      const latest = handlers.rolesLatest;

      if (!h || !latest) return;

      const result = await loadRolesFromSql(client);

      if (!result.ok || !result.data) return;

      const merged = mergeRolesWithDefaults(result.data);

      if (kvPayloadsEqual(latest.current, merged)) return;

      latest.current = merged;

      h.current?.(merged);

    };



    const reloadAppKv = async (key: string) => {

      const result = await loadAppKvKey<unknown>(client, key);

      if (!result.ok || result.data == null) return;



      switch (key) {

        case 'data:products': {

          const h = handlers.products;

          const latest = handlers.productsLatest;

          if (!h || !latest || !Array.isArray(result.data)) return;

          const mapped = (result.data as Product[]).map((p) => ({

            ...p,

            createdAt: p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt),

            updatedAt: p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt),

          }));

          if (kvPayloadsEqual(latest.current, mapped)) return;

          latest.current = mapped;

          h.current?.(mapped);

          break;

        }

        case 'data:feeReceipts': {

          const h = handlers.feeReceipts;

          const latest = handlers.feeReceiptsLatest;

          if (!h || !latest || !Array.isArray(result.data)) return;

          const list = (result.data as FeeReceiptGlobal[]).map((r) => ({
            ...r,
            issueDate: parseTransactionDate(r.issueDate),
            dueDate: parseTransactionDate(r.dueDate),
            paymentRequestedAt: r.paymentRequestedAt
              ? parseTransactionDate(r.paymentRequestedAt)
              : undefined,
            paymentDate: r.paymentDate ? parseTransactionDate(r.paymentDate) : undefined,
          }));

          if (kvPayloadsEqual(latest.current, list)) return;

          latest.current = list;

          h.current?.(list);

          break;

        }

        case 'data:chartOfAccounts': {

          const h = handlers.chartOfAccounts;

          const latest = handlers.chartOfAccountsLatest;

          if (!h || !latest || !Array.isArray(result.data)) return;

          const list = result.data as ChartOfAccountEntry[];

          if (kvPayloadsEqual(latest.current, list)) return;

          latest.current = list;

          h.current?.(list);

          break;

        }

        case 'settings:config': {

          const h = handlers.config;

          const latest = handlers.configLatest;

          if (!h || !latest) return;

          const next = result.data as ConfigStructure;

          if (kvPayloadsEqual(latest.current, next)) return;

          latest.current = next;

          h.current?.(next);

          break;

        }

        case 'settings:system': {

          const h = handlers.systemSettings;

          const latest = handlers.systemSettingsLatest;

          const metaLatest = handlers.pettyCashMetaLatest;

          if (!h || !latest) return;

          const base = mergeSystemSettingsSqlAndKv(
            result.data as Partial<SystemSettings>,
            latest.current
          );

          const meta = metaLatest?.current ?? extractPettyCashMeta(base.pettyCash);

          const merged = mergePettyCashMetaIntoSettings(base, meta);

          if (kvPayloadsEqual(latest.current, merged)) return;

          latest.current = merged;

          h.current?.(merged);

          break;

        }

        case 'settings:theme': {

          const h = handlers.theme;

          const latest = handlers.themeLatest;

          if (!h || !latest) return;

          const t = result.data;

          if (t !== 'dark' && t !== 'light') return;

          if (kvPayloadsEqual(latest.current, t)) return;

          latest.current = t;

          h.current?.(t);

          break;

        }

        case 'settings:alertThresholds': {

          const h = handlers.alertThresholds;

          const latest = handlers.alertThresholdsLatest;

          if (!h || !latest) return;

          const next = result.data as AlertThresholds;

          if (kvPayloadsEqual(latest.current, next)) return;

          latest.current = next;

          h.current?.(next);

          break;

        }

        case 'data:treasuryInvoices': {

          const h = handlers.treasuryInvoices;

          const latest = handlers.treasuryInvoicesLatest;

          if (!h || !latest || !Array.isArray(result.data)) return;

          if (kvPayloadsEqual(latest.current, result.data)) return;

          latest.current = result.data;

          h.current?.(result.data);

          break;

        }

        case 'data:treasuryBankBalance': {

          const h = handlers.treasuryBankBalance;

          const latest = handlers.treasuryBankBalanceLatest;

          if (!h || !latest) return;

          const bal = result.data != null ? Number(result.data) : undefined;

          if (kvPayloadsEqual(latest.current, bal)) return;

          latest.current = bal;

          h.current?.(bal);

          break;

        }

        case 'data:treasuryPaidHistory': {

          const h = handlers.treasuryPaidHistory;

          const latest = handlers.treasuryPaidHistoryLatest;

          if (!h || !latest || !Array.isArray(result.data)) return;

          if (kvPayloadsEqual(latest.current, result.data)) return;

          latest.current = result.data;

          h.current?.(result.data);

          break;

        }

      }

    };



    const tableReloaders: Record<string, () => Promise<void>> = {

      transactions: reloadTransactions,

      providers: reloadProviders,

      petty_cash_transactions: reloadPettyCash,

      petty_cash_week_meta: reloadPettyCashMeta,

      invoices: reloadInvoices,

      purchase_requests: reloadRequests,

      app_users: reloadUsers,

      roles: reloadRoles,

    };



    const channels = TABLE_CHANNELS.map(({ table, channel }) =>

      client

        .channel(channel)

        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {

          schedule(table, tableReloaders[table] ?? (async () => {}));

        })

        .subscribe()

    );



    const kvChannel = client

      .channel('grooflow-rt-app-kv')

      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_kv' }, (payload) => {

        const key = (payload.new as { key?: string } | null)?.key ?? (payload.old as { key?: string } | null)?.key;

        if (key && (APP_KV_KEYS as readonly string[]).includes(key)) {

          schedule(`kv:${key}`, () => reloadAppKv(key));

        }

      })

      .subscribe();



    const pollTimer = setInterval(() => {
      if (cancelled) return;
      void reloadTransactions();
      void reloadProviders();
      void reloadPettyCash();
      void reloadPettyCashMeta();
      void reloadInvoices();
      void reloadRequests();
      void reloadUsers();
      void reloadRoles();
    }, 45_000);



    return () => {

      cancelled = true;

      debouncers.forEach((t) => clearTimeout(t));

      clearInterval(pollTimer);

      channels.forEach((ch) => void client.removeChannel(ch));

      void client.removeChannel(kvChannel);

    };

  }, [enabled, handlers]);

}



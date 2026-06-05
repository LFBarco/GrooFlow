/**
 * Genera useAppDataHydration.ts desde el bloque de App.tsx (líneas ~789-1698).
 * Ejecutar: node scripts/generate-hydration.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPath = path.join(root, 'src/app/App.tsx');
const outPath = path.join(root, 'src/app/hooks/useAppDataHydration.ts');

const lines = fs.readFileSync(appPath, 'utf8').split(/\r?\n/);
const effectBlock = lines.slice(788, 1698).join('\n');

/** Identificadores del closure de App que se leen vía `deps`. */
const BINDINGS = [
  'resetAllKvDomainRefs',
  'resetKvSaveChains',
  'hydrateFromKvRef',
  'authNullDebounceRef',
  'signingOutRef',
  'pendingHydrateRef',
  'hydrateRunningRef',
  'cloudDataHydratedRef',
  'cloudSyncPendingRef',
  'cloudSyncErrorRef',
  'transactionsCloudHydrationDoneRef',
  'transactionsHydratedFromKvRef',
  'skipTransactionsHydrateRef',
  'transactionsKvCooldownUntilRef',
  'transactionsKvLatestRef',
  'providersCloudHydrationDoneRef',
  'providersHydratedFromKvRef',
  'skipProvidersHydrateRef',
  'providersKvCooldownUntilRef',
  'providersKvLatestRef',
  'pettyCashHydratedFromKvRef',
  'skipPettyCashHydrateRef',
  'pettyCashKvCooldownUntilRef',
  'pettyCashKvLatestRef',
  'pettyCashMetaKvLatestRef',
  'configHydratedFromKvRef',
  'skipConfigHydrateRef',
  'configKvCooldownUntilRef',
  'configKvLatestRef',
  'systemSettingsHydratedFromKvRef',
  'skipSystemSettingsHydrateRef',
  'systemSettingsKvCooldownUntilRef',
  'systemSettingsKvLatestRef',
  'invoicesHydratedFromKvRef',
  'skipInvoicesHydrateRef',
  'invoicesKvCooldownUntilRef',
  'invoicesKvLatestRef',
  'requestsHydratedFromKvRef',
  'skipRequestsHydrateRef',
  'requestsKvCooldownUntilRef',
  'requestsKvLatestRef',
  'chartOfAccountsHydratedFromKvRef',
  'skipChartOfAccountsHydrateRef',
  'chartOfAccountsKvCooldownUntilRef',
  'chartOfAccountsKvLatestRef',
  'productsHydratedFromKvRef',
  'skipProductsHydrateRef',
  'productsKvCooldownUntilRef',
  'productsKvLatestRef',
  'rolesHydratedFromKvRef',
  'skipRolesHydrateRef',
  'rolesKvCooldownUntilRef',
  'rolesKvLatestRef',
  'usersHydratedFromKvRef',
  'skipUsersHydrateRef',
  'usersKvCooldownUntilRef',
  'usersKvLatestRef',
  'feeReceiptsHydratedFromKvRef',
  'skipFeeReceiptsHydrateRef',
  'feeReceiptsKvCooldownUntilRef',
  'feeReceiptsKvLatestRef',
  'alertThresholdsHydratedFromKvRef',
  'skipAlertThresholdsHydrateRef',
  'alertThresholdsKvCooldownUntilRef',
  'alertThresholdsKvLatestRef',
  'themeHydratedFromKvRef',
  'skipThemeHydrateRef',
  'themeKvCooldownUntilRef',
  'themeKvLatestRef',
  'fleetHydratedFromKvRef',
  'skipFleetHydrateRef',
  'fleetKvLatestRef',
  'treasuryHydratedFromKvRef',
  'skipTreasuryHydrateRef',
  'treasuryKvCooldownUntilRef',
  'treasuryInvoicesKvLatestRef',
  'treasuryBankBalanceKvLatestRef',
  'treasuryBankBalanceLoadedFromKvRef',
  'treasuryPaidHistoryKvLatestRef',
  'setIsAuthChecking',
  'setCloudSyncPhase',
  'setCanSaveUsers',
  'setIsAuthenticated',
  'setCurrentUser',
  'setIsDataLoaded',
  'setConfig',
  'setSystemSettings',
  'setTransactions',
  'setInvoices',
  'setProviders',
  'setPettyCashTransactions',
  'setUsers',
  'setRoles',
  'setFeeReceipts',
  'setAlertThresholds',
  'setChartOfAccounts',
  'setProducts',
  'setRequests',
  'setTheme',
  'setFleetDataset',
  'setTreasuryInvoices',
  'setTreasuryBankBalance',
  'setTreasuryPaidHistory',
  'GUEST_USER',
  'initialInvoices',
  'initialProducts',
  'initialRequests',
];

let body = effectBlock;
for (const id of [...BINDINGS].sort((a, b) => b.length - a.length)) {
  body = body.replace(new RegExp(`\\b${id}\\b`, 'g'), `deps.${id}`);
}

const header = `/**
 * Hidratación KV + auth (extraído de App.tsx).
 * Generado/actualizado con: node scripts/generate-hydration.mjs
 */
import { useEffect } from 'react';
import { toast } from 'sonner';

import { DEFAULT_ROLES } from '../components/users/types';
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
} from '../services/repository/businessDomainsSql';
import {
  loadFleetFromSql,
  migrateFleetKvToSql,
} from '../services/repository/fleetSql';
import { resolveAppKvFromSql } from '../services/repository/appKvSql';
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
import { getSupabaseClient } from '../services/repository/supabase';
import { isAdminAppUser, syncUserProfilesToSql } from '../services/repository/userProfileSync';
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
import { createDemoFleetDataset, normalizeFleetDataset } from '../utils/fleetData';
import { hydrateTransactions } from '../utils/hydrateTransactions';
import { shouldAllowKvRemoteHydrate } from '../utils/kvDomainPersistence';
import { mergeRolesWithDefaults } from '../utils/mergeRolesWithDefaults';
import {
  extractPettyCashMeta,
  mergePettyCashMetaIntoSettings,
  normalizePettyCashMeta,
  PETTY_CASH_META_KV_KEY,
  resolvePettyCashMeta,
} from '../utils/pettyCashMeta';
import { parseTransactionDate } from '../utils/transactionDate';
import {
  applySuperAdminRoleFromConfig,
  dedupeUsersByEmail,
  mergeAuthUserIntoUsers,
  resolveCurrentUserRow,
} from '../utils/userListMerge';
import { supabase } from '../../../utils/supabase/client';
import type { AppHydrationDeps } from './hydration/appHydrationDeps';

const APP_BACKEND = import.meta.env.VITE_BACKEND ?? 'supabase';
const PRODUCTION_USE_SQL = isProductionSqlEnabled();
const TRANSACTIONS_USE_SQL = isTransactionsSqlEnabled();
import { isFleetSqlEnabled } from '../services/repository/fleetSql';

const FLEET_USE_SQL = isFleetSqlEnabled();
const TRANSACTION_HISTORY_CLEAR_MARK = '2026-05-11-clear-transaction-history-v1';

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
`;

const footer = `
}
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + body + footer, 'utf8');
console.log('Wrote', outPath);

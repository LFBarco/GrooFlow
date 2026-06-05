import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { Role } from '../../components/users/types';
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
} from '../../types';
import type { FleetDataset } from '../../types/fleet';
import type { CloudSyncPhase } from '../../utils/kvDomainPersistence';

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

/** Refs, setters y utilidades que App pasa a `useAppDataHydration`. */
export type AppHydrationDeps = {
  resetAllKvDomainRefs: () => void;
  resetKvSaveChains: () => void;
  hydrateFromKvRef: MutableRefObject<(() => Promise<void>) | null>;
  authNullDebounceRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  signingOutRef: MutableRefObject<boolean>;
  pendingHydrateRef: MutableRefObject<boolean>;
  hydrateRunningRef: MutableRefObject<boolean>;
  cloudDataHydratedRef: MutableRefObject<boolean>;
  cloudSyncPendingRef: MutableRefObject<number>;
  cloudSyncErrorRef: MutableRefObject<boolean>;
  transactionsCloudHydrationDoneRef: MutableRefObject<boolean>;
  transactionsHydratedFromKvRef: MutableRefObject<boolean>;
  skipTransactionsHydrateRef: MutableRefObject<boolean>;
  transactionsKvCooldownUntilRef: MutableRefObject<number>;
  transactionsKvLatestRef: MutableRefObject<Transaction[]>;
  providersCloudHydrationDoneRef: MutableRefObject<boolean>;
  providersHydratedFromKvRef: MutableRefObject<boolean>;
  skipProvidersHydrateRef: MutableRefObject<boolean>;
  providersKvCooldownUntilRef: MutableRefObject<number>;
  providersKvLatestRef: MutableRefObject<Provider[]>;
  pettyCashHydratedFromKvRef: MutableRefObject<boolean>;
  skipPettyCashHydrateRef: MutableRefObject<boolean>;
  pettyCashKvCooldownUntilRef: MutableRefObject<number>;
  pettyCashKvLatestRef: MutableRefObject<PettyCashTransaction[]>;
  pettyCashMetaKvLatestRef: MutableRefObject<ReturnType<
    typeof import('../../utils/pettyCashMeta').extractPettyCashMeta
  >>;
  configHydratedFromKvRef: MutableRefObject<boolean>;
  skipConfigHydrateRef: MutableRefObject<boolean>;
  configKvCooldownUntilRef: MutableRefObject<number>;
  configKvLatestRef: MutableRefObject<ConfigStructure>;
  systemSettingsHydratedFromKvRef: MutableRefObject<boolean>;
  skipSystemSettingsHydrateRef: MutableRefObject<boolean>;
  systemSettingsKvCooldownUntilRef: MutableRefObject<number>;
  systemSettingsKvLatestRef: MutableRefObject<SystemSettings>;
  invoicesHydratedFromKvRef: MutableRefObject<boolean>;
  skipInvoicesHydrateRef: MutableRefObject<boolean>;
  invoicesKvCooldownUntilRef: MutableRefObject<number>;
  invoicesKvLatestRef: MutableRefObject<InvoiceDraft[]>;
  requestsHydratedFromKvRef: MutableRefObject<boolean>;
  skipRequestsHydrateRef: MutableRefObject<boolean>;
  requestsKvCooldownUntilRef: MutableRefObject<number>;
  requestsKvLatestRef: MutableRefObject<PurchaseRequest[]>;
  chartOfAccountsHydratedFromKvRef: MutableRefObject<boolean>;
  skipChartOfAccountsHydrateRef: MutableRefObject<boolean>;
  chartOfAccountsKvCooldownUntilRef: MutableRefObject<number>;
  chartOfAccountsKvLatestRef: MutableRefObject<ChartOfAccountEntry[]>;
  productsHydratedFromKvRef: MutableRefObject<boolean>;
  skipProductsHydrateRef: MutableRefObject<boolean>;
  productsKvCooldownUntilRef: MutableRefObject<number>;
  productsKvLatestRef: MutableRefObject<Product[]>;
  rolesHydratedFromKvRef: MutableRefObject<boolean>;
  skipRolesHydrateRef: MutableRefObject<boolean>;
  rolesKvCooldownUntilRef: MutableRefObject<number>;
  rolesKvLatestRef: MutableRefObject<Role[]>;
  usersHydratedFromKvRef: MutableRefObject<boolean>;
  skipUsersHydrateRef: MutableRefObject<boolean>;
  usersKvCooldownUntilRef: MutableRefObject<number>;
  usersKvLatestRef: MutableRefObject<User[]>;
  feeReceiptsHydratedFromKvRef: MutableRefObject<boolean>;
  skipFeeReceiptsHydrateRef: MutableRefObject<boolean>;
  feeReceiptsKvCooldownUntilRef: MutableRefObject<number>;
  feeReceiptsKvLatestRef: MutableRefObject<FeeReceiptGlobal[]>;
  alertThresholdsHydratedFromKvRef: MutableRefObject<boolean>;
  skipAlertThresholdsHydrateRef: MutableRefObject<boolean>;
  alertThresholdsKvCooldownUntilRef: MutableRefObject<number>;
  alertThresholdsKvLatestRef: MutableRefObject<AlertThresholds>;
  themeHydratedFromKvRef: MutableRefObject<boolean>;
  skipThemeHydrateRef: MutableRefObject<boolean>;
  themeKvCooldownUntilRef: MutableRefObject<number>;
  themeKvLatestRef: MutableRefObject<'dark' | 'light'>;
  fleetHydratedFromKvRef: MutableRefObject<boolean>;
  skipFleetHydrateRef: MutableRefObject<boolean>;
  fleetKvCooldownUntilRef: MutableRefObject<number>;
  fleetKvLatestRef: MutableRefObject<FleetDataset>;
  treasuryHydratedFromKvRef: MutableRefObject<boolean>;
  skipTreasuryHydrateRef: MutableRefObject<boolean>;
  treasuryKvCooldownUntilRef: MutableRefObject<number>;
  treasuryInvoicesKvLatestRef: MutableRefObject<unknown[]>;
  treasuryBankBalanceKvLatestRef: MutableRefObject<number | undefined>;
  treasuryBankBalanceLoadedFromKvRef: MutableRefObject<boolean>;
  treasuryPaidHistoryKvLatestRef: MutableRefObject<unknown[]>;
  setIsAuthChecking: Dispatch<SetStateAction<boolean>>;
  setCloudSyncPhase: Dispatch<SetStateAction<CloudSyncPhase>>;
  setCanSaveUsers: Dispatch<SetStateAction<boolean>>;
  setIsAuthenticated: Dispatch<SetStateAction<boolean>>;
  setCurrentUser: Dispatch<SetStateAction<User>>;
  setIsDataLoaded: Dispatch<SetStateAction<boolean>>;
  setConfig: Dispatch<SetStateAction<ConfigStructure>>;
  setSystemSettings: Dispatch<SetStateAction<SystemSettings>>;
  setTransactions: Dispatch<SetStateAction<Transaction[]>>;
  setInvoices: Dispatch<SetStateAction<InvoiceDraft[]>>;
  setProviders: Dispatch<SetStateAction<Provider[]>>;
  setPettyCashTransactions: Dispatch<SetStateAction<PettyCashTransaction[]>>;
  setUsers: Dispatch<SetStateAction<User[]>>;
  setRoles: Dispatch<SetStateAction<Role[]>>;
  setFeeReceipts: Dispatch<SetStateAction<FeeReceiptGlobal[]>>;
  setAlertThresholds: Dispatch<SetStateAction<AlertThresholds>>;
  setChartOfAccounts: Dispatch<SetStateAction<ChartOfAccountEntry[]>>;
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setRequests: Dispatch<SetStateAction<PurchaseRequest[]>>;
  setTheme: Dispatch<SetStateAction<'dark' | 'light'>>;
  setFleetDataset: Dispatch<SetStateAction<FleetDataset>>;
  setTreasuryInvoices: Dispatch<SetStateAction<unknown[]>>;
  setTreasuryBankBalance: Dispatch<SetStateAction<number | undefined>>;
  setTreasuryPaidHistory: Dispatch<SetStateAction<unknown[]>>;
  GUEST_USER: User;
  initialInvoices: InvoiceDraft[];
  initialProducts: Product[];
  initialRequests: PurchaseRequest[];
};

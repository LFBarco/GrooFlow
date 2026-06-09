/**
 * Autosave de dominios operativos restantes (facturas, solicitudes, tesorería, app_kv, etc.).
 */
import type { MutableRefObject } from 'react';

import {
  saveInvoicesToSql,
  savePurchaseRequestsToSql,
} from '../services/repository/businessDomainsSql';
import type {
  AlertThresholds,
  ChartOfAccountEntry,
  InvoiceDraft,
  Product,
  PurchaseRequest,
} from '../types';
import type { CloudSyncTracker, KvDomainRefs } from '../utils/kvDomainPersistence';
import { useKvAppKeyAutosave, useKvSqlTableAutosave } from './persistence/useKvDomainAutosave';

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

export type UseOperationalDomainsPersistenceOptions = {
  isDataLoaded: boolean;
  cloudSync: CloudSyncTracker;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  invoices: InvoiceDraft[];
  invoicesRefs: KvDomainRefs<InvoiceDraft[]>;
  invoicesHydratedRef: MutableRefObject<boolean>;
  requests: PurchaseRequest[];
  requestsRefs: KvDomainRefs<PurchaseRequest[]>;
  requestsHydratedRef: MutableRefObject<boolean>;
  chartOfAccounts: ChartOfAccountEntry[];
  chartRefs: KvDomainRefs<ChartOfAccountEntry[]>;
  chartHydratedRef: MutableRefObject<boolean>;
  products: Product[];
  productsRefs: KvDomainRefs<Product[]>;
  productsHydratedRef: MutableRefObject<boolean>;
  feeReceipts: FeeReceiptGlobal[];
  feeReceiptsRefs: KvDomainRefs<FeeReceiptGlobal[]>;
  feeReceiptsHydratedRef: MutableRefObject<boolean>;
  alertThresholds: AlertThresholds;
  alertRefs: KvDomainRefs<AlertThresholds>;
  alertHydratedRef: MutableRefObject<boolean>;
  theme: 'dark' | 'light';
  themeRefs: KvDomainRefs<'dark' | 'light'>;
  themeHydratedRef: MutableRefObject<boolean>;
  treasuryInvoices: unknown[];
  treasuryInvoicesRefs: KvDomainRefs<unknown[]>;
  treasuryBankBalance: number | undefined;
  treasuryBankBalanceRefs: KvDomainRefs<number | undefined>;
  treasuryPaidHistory: unknown[];
  treasuryPaidHistoryRefs: KvDomainRefs<unknown[]>;
  treasuryHydratedRef: MutableRefObject<boolean>;
  treasuryBankBalanceLoadedRef: MutableRefObject<boolean>;
};

export function useOperationalDomainsPersistence(o: UseOperationalDomainsPersistenceOptions): void {
  useKvSqlTableAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.invoicesHydratedRef,
    kvKey: 'data:invoices',
    data: o.invoices,
    refs: o.invoicesRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudieron guardar las facturas en la nube. Reintente en unos segundos.',
    saveSql: saveInvoicesToSql,
  });

  useKvSqlTableAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.requestsHydratedRef,
    kvKey: 'data:requests',
    data: o.requests,
    refs: o.requestsRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudieron guardar las solicitudes de compra en la nube.',
    saveSql: savePurchaseRequestsToSql,
  });

  useKvAppKeyAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.chartHydratedRef,
    kvKey: 'data:chartOfAccounts',
    data: o.chartOfAccounts,
    refs: o.chartRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudo guardar el plan de cuentas en la nube. Reintente en unos segundos.',
  });

  useKvAppKeyAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.productsHydratedRef,
    kvKey: 'data:products',
    data: o.products,
    refs: o.productsRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudo guardar el catálogo de productos en la nube. Reintente en unos segundos.',
  });

  useKvAppKeyAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.feeReceiptsHydratedRef,
    kvKey: 'data:feeReceipts',
    data: o.feeReceipts,
    refs: o.feeReceiptsRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudieron guardar los honorarios en la nube.',
  });

  useKvAppKeyAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.alertHydratedRef,
    kvKey: 'settings:alertThresholds',
    data: o.alertThresholds,
    refs: o.alertRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudieron guardar los umbrales de alertas en la nube.',
  });

  useKvAppKeyAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.themeHydratedRef,
    kvKey: 'settings:theme',
    data: o.theme,
    refs: o.themeRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudo guardar el tema en la nube.',
  });

  useKvAppKeyAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.treasuryHydratedRef,
    kvKey: 'data:treasuryInvoices',
    data: o.treasuryInvoices,
    refs: o.treasuryInvoicesRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudieron guardar las facturas de tesorería en la nube.',
  });

  useKvAppKeyAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.treasuryHydratedRef,
    kvKey: 'data:treasuryBankBalance',
    data: o.treasuryBankBalance,
    refs: o.treasuryBankBalanceRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudo guardar el saldo bancario en la nube.',
    skipIfUndefined: true,
  });

  useKvAppKeyAutosave({
    isDataLoaded: o.isDataLoaded,
    hydratedRef: o.treasuryHydratedRef,
    kvKey: 'data:treasuryPaidHistory',
    data: o.treasuryPaidHistory,
    refs: o.treasuryPaidHistoryRefs,
    kvApplyGenerationRef: o.kvApplyGenerationRef,
    lastSaveErrorAtRef: o.lastSaveErrorAtRef,
    cloudSync: o.cloudSync,
    errorMessage: 'No se pudo guardar el historial de pagos en la nube.',
  });
}

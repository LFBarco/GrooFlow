import { lazy, type ComponentType } from 'react';

import type { ViewType } from './routes';

type LazyModule<T extends ComponentType<unknown>> = { default: T };

function named<M extends Record<string, unknown>, K extends keyof M>(
  loader: () => Promise<M>,
  exportName: K
): () => Promise<LazyModule<M[K] & ComponentType<unknown>>> {
  return () =>
    loader().then((mod) => ({
      default: mod[exportName] as M[K] & ComponentType<unknown>,
    }));
}

/** Indicador compacto: no tapa el header ni el sidebar. */
export function RouteLoader() {
  return (
    <div className="flex min-h-[18vh] items-center justify-center text-muted-foreground" role="status">
      <div
        className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden
      />
      <span className="sr-only">Cargando módulo</span>
    </div>
  );
}

const loadOverview = named(() => import('./components/dashboard/Overview'), 'Overview');
const loadCashFlowChart = named(() => import('./components/dashboard/CashFlowChart'), 'CashFlowChart');
const loadRecentTransactions = named(
  () => import('./components/dashboard/RecentTransactions'),
  'RecentTransactions'
);
const loadTransactionForm = named(() => import('./components/transactions/TransactionForm'), 'TransactionForm');
const loadTransactionImporter = named(
  () => import('./components/transactions/TransactionImporter'),
  'TransactionImporter'
);
const loadPnLView = named(() => import('./components/finance/PnLView'), 'PnLView');
const loadPettyCashModule = named(() => import('./components/finance/PettyCashModule'), 'PettyCashModule');
const loadCashFlowGrid = named(() => import('./components/dashboard/CashFlowGrid'), 'CashFlowGrid');
const loadSmartCashFlowSimulation = named(
  () => import('./components/dashboard/SmartCashFlowSimulation'),
  'SmartCashFlowSimulation'
);
const loadAnalyticsDashboard = named(
  () => import('./components/dashboard/AnalyticsDashboard'),
  'AnalyticsDashboard'
);
const loadConfigPanel = named(() => import('./components/configuration/ConfigPanel'), 'ConfigPanel');
const loadAuditPanel = named(() => import('./components/audit/AuditPanel'), 'AuditPanel');
const loadMonthlySummary = named(() => import('./components/reports/MonthlySummary'), 'MonthlySummary');
const loadProviderManager = named(() => import('./components/providers/ProviderManager'), 'ProviderManager');
const loadChartOfAccountsModule = named(
  () => import('./components/accounting/ChartOfAccountsModule'),
  'ChartOfAccountsModule'
);
const loadPurchaseRequestManager = named(
  () => import('./components/purchases/PurchaseRequestManager'),
  'PurchaseRequestManager'
);
const loadProductModule = named(() => import('./components/products/ProductModule'), 'ProductModule');
const loadUserManager = named(() => import('./components/users/UserManager'), 'UserManager');
const loadTreasuryModule = named(() => import('./components/treasury/TreasuryModule'), 'TreasuryModule');
const loadProfessionalFeesModule = named(
  () => import('./components/finance/ProfessionalFeesModule'),
  'ProfessionalFeesModule'
);
const loadAlertsCenter = named(() => import('./components/alerts/AlertsCenter'), 'AlertsCenter');
const loadFleetModule = named(() => import('./components/fleet/FleetModule'), 'FleetModule');
const loadInventoryModule = named(() => import('./components/inventory/InventoryModule'), 'InventoryModule');
const loadAsistenciaModule = named(() => import('./components/asistencia/AsistenciaModule'), 'AsistenciaModule');
const loadTurnosModule = named(() => import('./components/turnos/TurnosModule'), 'TurnosModule');
const loadAccidentesModule = named(
  () => import('./components/accidentes/AccidentesModule'),
  'AccidentesModule'
);
const loadReconciliationModule = named(
  () => import('./reconciliation/ui/ReconciliationModule'),
  'ReconciliationModule'
);
const loadUserProfileDialog = named(() => import('./components/users/UserProfileDialog'), 'UserProfileDialog');

export const Overview = lazy(loadOverview);
export const CashFlowChart = lazy(loadCashFlowChart);
export const RecentTransactions = lazy(loadRecentTransactions);
export const TransactionForm = lazy(loadTransactionForm);
export const TransactionImporter = lazy(loadTransactionImporter);
export const PnLView = lazy(loadPnLView);
export const PettyCashModule = lazy(loadPettyCashModule);
export const CashFlowGrid = lazy(loadCashFlowGrid);
export const SmartCashFlowSimulation = lazy(loadSmartCashFlowSimulation);
export const AnalyticsDashboard = lazy(loadAnalyticsDashboard);
export const ConfigPanel = lazy(loadConfigPanel);
export const AuditPanel = lazy(loadAuditPanel);
export const MonthlySummary = lazy(loadMonthlySummary);
export const ProviderManager = lazy(loadProviderManager);
export const ChartOfAccountsModule = lazy(loadChartOfAccountsModule);
export const PurchaseRequestManager = lazy(loadPurchaseRequestManager);
export const ProductModule = lazy(loadProductModule);
export const UserManager = lazy(loadUserManager);
export const TreasuryModule = lazy(loadTreasuryModule);
export const ProfessionalFeesModule = lazy(loadProfessionalFeesModule);
export const AlertsCenter = lazy(loadAlertsCenter);
export const FleetModule = lazy(loadFleetModule);
export const InventoryModule = lazy(loadInventoryModule);
export const AsistenciaModule = lazy(loadAsistenciaModule);
export const TurnosModule = lazy(loadTurnosModule);
export const AccidentesModule = lazy(loadAccidentesModule);
export const ReconciliationModule = lazy(loadReconciliationModule);
export const UserProfileDialog = lazy(loadUserProfileDialog);

const VIEW_LOADERS: Record<ViewType, Array<() => Promise<unknown>>> = {
  dashboard: [loadOverview, loadCashFlowChart],
  alerts: [loadAlertsCenter],
  analytics: [loadAnalyticsDashboard],
  treasury: [loadTreasuryModule],
  transactions: [loadTransactionForm, loadRecentTransactions, loadTransactionImporter],
  cashflow: [loadCashFlowGrid, loadSmartCashFlowSimulation],
  pnl: [loadPnLView],
  reports: [loadMonthlySummary],
  pettycash: [loadPettyCashModule],
  fees: [loadProfessionalFeesModule],
  providers: [loadProviderManager],
  accounting: [loadChartOfAccountsModule],
  products: [loadProductModule],
  requests: [loadPurchaseRequestManager],
  audit: [loadAuditPanel],
  users: [loadUserManager],
  config: [loadConfigPanel],
  fleet: [loadFleetModule],
  inventory: [loadInventoryModule],
  asistencia: [loadAsistenciaModule],
  turnos: [loadTurnosModule],
  accidentes: [loadAccidentesModule],
  reconciliation: [loadReconciliationModule],
};

const prefetched = new Set<ViewType>();

/** Precarga el chunk de una vista (hover del menú o idle). `import()` queda en caché del navegador. */
export function prefetchView(view: ViewType): void {
  if (prefetched.has(view)) return;
  prefetched.add(view);
  for (const load of VIEW_LOADERS[view] ?? []) {
    void load();
  }
}

export function prefetchCommonViews(): void {
  (['dashboard', 'alerts', 'transactions', 'cashflow', 'treasury', 'reports'] as ViewType[]).forEach(
    prefetchView
  );
  void loadUserProfileDialog();
}

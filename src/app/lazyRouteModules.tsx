import { lazy } from 'react';

/** Indicador mientras se descarga el chunk del módulo (primera visita a esa vista). */
export function RouteLoader() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden
      />
      <p className="text-sm">Cargando módulo…</p>
    </div>
  );
}

/** Vistas y formularios pesados: se cargan bajo demanda (code-split) para un arranque más liviano. */
export const RecentTransactions = lazy(() =>
  import('./components/dashboard/RecentTransactions').then((m) => ({ default: m.RecentTransactions }))
);
export const TransactionForm = lazy(() =>
  import('./components/transactions/TransactionForm').then((m) => ({ default: m.TransactionForm }))
);
export const TransactionImporter = lazy(() =>
  import('./components/transactions/TransactionImporter').then((m) => ({ default: m.TransactionImporter }))
);
export const PnLView = lazy(() =>
  import('./components/finance/PnLView').then((m) => ({ default: m.PnLView }))
);
export const PettyCashModule = lazy(() =>
  import('./components/finance/PettyCashModule').then((m) => ({ default: m.PettyCashModule }))
);
export const CashFlowGrid = lazy(() =>
  import('./components/dashboard/CashFlowGrid').then((m) => ({ default: m.CashFlowGrid }))
);
export const AnalyticsDashboard = lazy(() =>
  import('./components/dashboard/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard }))
);
export const ConfigPanel = lazy(() =>
  import('./components/configuration/ConfigPanel').then((m) => ({ default: m.ConfigPanel }))
);
export const AuditPanel = lazy(() =>
  import('./components/audit/AuditPanel').then((m) => ({ default: m.AuditPanel }))
);
export const MonthlySummary = lazy(() =>
  import('./components/reports/MonthlySummary').then((m) => ({ default: m.MonthlySummary }))
);
export const ProviderManager = lazy(() =>
  import('./components/providers/ProviderManager').then((m) => ({ default: m.ProviderManager }))
);
export const ChartOfAccountsModule = lazy(() =>
  import('./components/accounting/ChartOfAccountsModule').then((m) => ({ default: m.ChartOfAccountsModule }))
);
export const PurchaseRequestManager = lazy(() =>
  import('./components/purchases/PurchaseRequestManager').then((m) => ({ default: m.PurchaseRequestManager }))
);
export const RequisitionModule = lazy(() =>
  import('./components/procurement/RequisitionModule').then((m) => ({ default: m.RequisitionModule }))
);
export const UserManager = lazy(() =>
  import('./components/users/UserManager').then((m) => ({ default: m.UserManager }))
);
export const TreasuryModule = lazy(() =>
  import('./components/treasury/TreasuryModule').then((m) => ({ default: m.TreasuryModule }))
);
export const ProfessionalFeesModule = lazy(() =>
  import('./components/finance/ProfessionalFeesModule').then((m) => ({ default: m.ProfessionalFeesModule }))
);
export const AlertsCenter = lazy(() =>
  import('./components/alerts/AlertsCenter').then((m) => ({ default: m.AlertsCenter }))
);

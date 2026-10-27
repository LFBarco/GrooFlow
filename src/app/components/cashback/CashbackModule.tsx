import { useCallback, useEffect, useState } from 'react';
import { HandCoins, Loader2, RefreshCw } from 'lucide-react';

import type { AccountingLinkSettings, ChartOfAccountEntry } from '../../types';
import type { CashbackInvoice, CashbackMeResponse, CashbackSettings } from '../../types/cashback';
import { fetchCashbackMe } from '../../utils/cashbackApi';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { CashbackInvoiceDialog } from './CashbackInvoiceDialog';
import { CashbackJournalPanel } from './CashbackJournalPanel';
import { CashbackLiquidationPanel } from './CashbackLiquidationPanel';
import { CashbackMyInvoices } from './CashbackMyInvoices';
import { CashbackReportsPanel } from './CashbackReportsPanel';
import { CashbackReviewPanel } from './CashbackReviewPanel';
import { CashbackSettingsPanel } from './CashbackSettingsPanel';

type Props = {
  chartOfAccounts?: ChartOfAccountEntry[];
  accountingLinks?: AccountingLinkSettings;
};

export function CashbackModule({ chartOfAccounts = [], accountingLinks = {} }: Props) {
  const [data, setData] = useState<CashbackMeResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashbackInvoice | null>(null);
  const [tab, setTab] = useState('mis');

  const load = useCallback(async () => {
    try {
      setData(await fetchCashbackMe());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar Cashback.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando Cashback…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>{error || 'No se pudo cargar Cashback.'}</p>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-4 w-4" /> Reintentar
        </Button>
      </div>
    );
  }

  const { capabilities, settings } = data;
  const canReviewTeam = capabilities.review || capabilities.configure;
  const canSeeReports = canReviewTeam || capabilities.export;
  const canSeeJournal = canSeeReports;
  const setSettings = (next: CashbackSettings) => setData((d) => (d ? { ...d, settings: next } : d));

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm dark:border-slate-700">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
            <HandCoins className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">Finanzas · Beneficio colaborador</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Cashback por facturas</h2>
          <p className="max-w-2xl text-sm text-muted-foreground hidden sm:block">
            Trae tu factura a nombre de la empresa y te reconocemos un importe. Contabilidad valida cada comprobante, el
            saldo se acumula mes a mes y se libera al alcanzar la meta.
          </p>
          <p className="text-sm text-muted-foreground sm:hidden">
            Sube tu factura a nombre de la empresa y acumula tu cashback.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="shrink-0">
          <RefreshCw className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="inline-flex w-max min-w-full sm:min-w-0 sm:flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="mis" className="shrink-0">
              <span className="sm:hidden">Mías</span>
              <span className="hidden sm:inline">Mis facturas</span>
            </TabsTrigger>
            {canReviewTeam ? (
              <TabsTrigger value="validacion" className="shrink-0">
                <span className="sm:hidden">Revisar</span>
                <span className="hidden sm:inline">Validación</span>
              </TabsTrigger>
            ) : null}
            {canReviewTeam ? (
              <TabsTrigger value="liquidacion" className="shrink-0">
                <span className="sm:hidden">Saldos</span>
                <span className="hidden sm:inline">Saldos y liquidación</span>
              </TabsTrigger>
            ) : null}
            {canSeeReports ? <TabsTrigger value="reportes" className="shrink-0">Reportes</TabsTrigger> : null}
            {canSeeJournal ? <TabsTrigger value="asientos" className="shrink-0">Asientos</TabsTrigger> : null}
            {capabilities.configure ? <TabsTrigger value="config" className="shrink-0">Reglas</TabsTrigger> : null}
          </TabsList>
        </div>

        <TabsContent value="mis" className="mt-4">
          <CashbackMyInvoices
            data={data}
            onNew={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            onEdit={(inv) => {
              setEditing(inv);
              setDialogOpen(true);
            }}
            onChanged={() => void load()}
          />
        </TabsContent>
        {canReviewTeam ? (
          <TabsContent value="validacion" className="mt-4">
            <CashbackReviewPanel
              settings={settings}
              chartOfAccounts={chartOfAccounts}
              accountingLinks={accountingLinks}
              canReview={capabilities.review}
              canExport={capabilities.export || capabilities.configure}
              onChanged={() => void load()}
            />
          </TabsContent>
        ) : null}
        {canReviewTeam ? (
          <TabsContent value="liquidacion" className="mt-4">
            <CashbackLiquidationPanel settings={settings} canConfigure={capabilities.configure} onChanged={() => void load()} />
          </TabsContent>
        ) : null}
        {canSeeReports ? (
          <TabsContent value="reportes" className="mt-4">
            <CashbackReportsPanel settings={settings} canExport={capabilities.export || capabilities.configure} />
          </TabsContent>
        ) : null}
        {canSeeJournal ? (
          <TabsContent value="asientos" className="mt-4">
            <CashbackJournalPanel settings={settings} chartOfAccounts={chartOfAccounts} accounting={accountingLinks} />
          </TabsContent>
        ) : null}
        {capabilities.configure ? (
          <TabsContent value="config" className="mt-4">
            <CashbackSettingsPanel settings={settings} onSaved={setSettings} />
          </TabsContent>
        ) : null}
      </Tabs>

      <CashbackInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        settings={settings}
        accountingLinks={accountingLinks}
        editing={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}

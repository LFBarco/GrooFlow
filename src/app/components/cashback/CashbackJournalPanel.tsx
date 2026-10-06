import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import type { AccountingLinkSettings, ChartOfAccountEntry } from '../../types';
import type { CashbackInvoice, CashbackSettings } from '../../types/cashback';
import { flattenJournalsToExportRows } from '../../utils/accountingJournal';
import { listCashbackInvoices } from '../../utils/cashbackApi';
import { buildCashbackInvoiceJournal, cashbackInvoiceHasJournal } from '../../utils/cashbackJournal';
import { categoryLabel, currentPeriod, shiftPeriod } from '../../utils/cashbackRules';
import { formatNumberEs } from '../../utils/numberFormat';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type Props = {
  settings: CashbackSettings;
  chartOfAccounts: ChartOfAccountEntry[];
  accounting: AccountingLinkSettings;
};

export function CashbackJournalPanel({ settings, chartOfAccounts, accounting }: Props) {
  const [desde, setDesde] = useState(shiftPeriod(currentPeriod(), -2));
  const [hasta, setHasta] = useState(currentPeriod());
  const [items, setItems] = useState<CashbackInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listCashbackInvoices({ estado: '', desde, hasta, q: '' }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las facturas.');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    void load();
  }, [load]);

  const bundles = useMemo(
    () =>
      items
        .filter(cashbackInvoiceHasJournal)
        .sort((a, b) => a.fechaEmision.localeCompare(b.fechaEmision))
        .map((inv) => buildCashbackInvoiceJournal(inv, chartOfAccounts, accounting, categoryLabel(settings, inv.categoria))),
    [items, chartOfAccounts, accounting, settings]
  );
  const withLines = bundles.filter((b) => b.lines.length > 0).length;

  const exportExcel = () => {
    const rows = flattenJournalsToExportRows(bundles.filter((b) => b.lines.length > 0));
    if (rows.length === 0) {
      toast.error('No hay líneas para exportar (revisa periodo y cuentas configuradas).');
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Asientos');
    XLSX.writeFile(wb, `asientos_cashback_${desde}_${hasta}.xlsx`);
    toast.success('Excel de asientos generado');
  };

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="text-lg">Vista previa — asientos Cashback</CardTitle>
        <CardDescription>
          Una línea por cuenta de cada factura <strong>aprobada o liquidada</strong> (periodo por fecha de emisión): Debe
          gasto con la cuenta del proveedor, Debe IGV crédito fiscal y Haber la contrapartida de Cashback configurada en
          Contabilidad → Plan de cuentas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
          </Button>
          <Button type="button" variant="secondary" onClick={exportExcel}>
            <Download className="mr-2 h-4 w-4" /> Exportar Excel (líneas)
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          En este periodo: <strong>{bundles.length}</strong> factura(s) aprobada(s) o liquidada(s), con asiento completo:{' '}
          <strong>{withLines}</strong>.
        </p>

        {bundles.length > 0 && withLines < bundles.length ? (
          <Alert className="border-amber-600/50 bg-amber-950/20">
            <AlertTitle className="text-sm">Hay facturas sin asiento completo</AlertTitle>
            <AlertDescription className="text-xs">
              Revise la cuenta IGV y la contrapartida de Cashback en Contabilidad → Plan de cuentas. Las filas en amarillo
              indican el motivo por factura.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="max-h-[min(560px,60vh)] overflow-auto rounded-md border text-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta contable</TableHead>
                <TableHead>Nombre cuenta</TableHead>
                <TableHead>Año y mes</TableHead>
                <TableHead>F. documento</TableHead>
                <TableHead>F. registro</TableHead>
                <TableHead>Serie – Nro.</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando…
                  </TableCell>
                </TableRow>
              ) : bundles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    No hay facturas aprobadas en el periodo seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                bundles.flatMap((b) =>
                  b.lines.length === 0 ? (
                    <TableRow key={`${b.transactionId}-empty`}>
                      <TableCell colSpan={10} className="bg-amber-50/50 text-amber-700 dark:bg-amber-950/20">
                        <span className="font-medium text-foreground/90">{b.serieNumero}</span> · {b.warnings.join(' ')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    b.lines.map((ln, idx) => (
                      <TableRow key={`${b.transactionId}-${idx}`}>
                        <TableCell className="font-mono text-xs">{ln.accountCode}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs" title={ln.accountName}>
                          {ln.accountName || '—'}
                        </TableCell>
                        <TableCell className="text-xs">{b.yearMonth}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{format(b.documentDate, 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{format(b.date, 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{b.serieNumero}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs" title={b.description}>
                          {b.description}
                        </TableCell>
                        <TableCell className="text-xs">{b.sede}</TableCell>
                        <TableCell className="text-right">{ln.debit > 0 ? formatNumberEs(ln.debit) : '—'}</TableCell>
                        <TableCell className="text-right">{ln.credit > 0 ? formatNumberEs(ln.credit) : '—'}</TableCell>
                      </TableRow>
                    ))
                  )
                )
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

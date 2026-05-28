import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type {
  AccountingLinkSettings,
  ChartOfAccountEntry,
  PettyCashTransaction,
  Provider,
  User,
} from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { toast } from 'sonner';
import { formatNumberEs } from '../../utils/numberFormat';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Download } from 'lucide-react';
import {
  buildPettyCashExpenseJournal,
  flattenJournalsToExportRows,
  pettyCashExpenseInPreviewDateRange,
} from '../../utils/accountingJournal';
import { format } from 'date-fns';

export interface PettyCashJournalPreviewProps {
  /** Todos los movimientos de caja chica (todos los responsables / sedes). */
  pettyCashTransactions: PettyCashTransaction[];
  providers: Provider[];
  chartOfAccounts: ChartOfAccountEntry[];
  accounting: AccountingLinkSettings;
  /** Para etiquetar responsable en la tabla. */
  users?: User[];
}

export function PettyCashJournalPreview({
  pettyCashTransactions,
  providers,
  chartOfAccounts,
  accounting,
  users = [],
}: PettyCashJournalPreviewProps) {
  const [previewFrom, setPreviewFrom] = useState(() =>
    format(new Date(Date.now() - 730 * 86400000), 'yyyy-MM-dd')
  );
  const [previewTo, setPreviewTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const custodianNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) {
      if (u?.id) m.set(u.id, (u.name || u.email || u.id).trim());
    }
    return m;
  }, [users]);

  const previewBundles = useMemo(() => {
    const txs = pettyCashTransactions.filter((t) =>
      pettyCashExpenseInPreviewDateRange(t, previewFrom, previewTo)
    );

    return txs.map((t) => buildPettyCashExpenseJournal(t, providers, chartOfAccounts, accounting));
  }, [pettyCashTransactions, previewFrom, previewTo, providers, chartOfAccounts, accounting]);

  const previewStats = useMemo(() => {
    const n = previewBundles.length;
    const withLines = previewBundles.filter((b) => b.lines.length > 0).length;
    return { total: n, withLines };
  }, [previewBundles]);

  const expenseCountInStore = useMemo(
    () =>
      pettyCashTransactions.filter(
        (t) => t.type === 'expense' && t.status !== 'voided' && t.status !== 'rejected'
      ).length,
    [pettyCashTransactions]
  );

  const exportPreviewExcel = () => {
    const rows = flattenJournalsToExportRows(previewBundles.filter((b) => b.lines.length > 0));
    if (rows.length === 0) {
      toast.error('No hay líneas para exportar (revisa fechas y cuentas configuradas).');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asientos');
    XLSX.writeFile(wb, `asientos_caja_chica_${previewFrom}_${previewTo}.xlsx`);
    toast.success('Excel de asientos generado');
  };

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="text-lg">Vista previa — asientos caja chica</CardTitle>
        <CardDescription>
          Incluye egresos de <strong>todos los responsables</strong> de caja chica (no solo el
          usuario actual). El rango usa <strong>fecha de registro</strong> o{' '}
          <strong>fecha del documento</strong> en hora local. Cuenta de gasto: comprobante,
          proveedor o cuenta genérica en enlaces (Contabilidad). Solo <strong>Factura</strong>{' '}
          desglosa IGV.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="date" value={previewFrom} onChange={(e) => setPreviewFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={previewTo} onChange={(e) => setPreviewTo(e.target.value)} />
          </div>
          <Button type="button" variant="secondary" onClick={exportPreviewExcel}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel (líneas)
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          En el sistema hay <strong>{expenseCountInStore}</strong> egreso(s) válido(s). En este rango:
          <strong> {previewStats.total}</strong> movimiento(s), con asiento completo:{' '}
          <strong>{previewStats.withLines}</strong>.
        </p>

        {expenseCountInStore > 0 && previewStats.total === 0 ? (
          <Alert className="border-amber-600/50 bg-amber-950/20">
            <AlertTitle className="text-sm">Ningún egreso cae en las fechas elegidas</AlertTitle>
            <AlertDescription className="text-xs">
              Amplíe <strong>Desde</strong> / <strong>Hasta</strong> (el filtro usa fecha de registro o
              de documento en hora local).
            </AlertDescription>
          </Alert>
        ) : null}

        {previewStats.total > 0 && previewStats.withLines === 0 ? (
          <Alert className="border-amber-600/50 bg-amber-950/20">
            <AlertTitle className="text-sm">Hay movimientos pero sin líneas de asiento</AlertTitle>
            <AlertDescription className="text-xs">
              Revise enlaces en Finanzas → Contabilidad (cuenta caja, IGV, cuenta de gasto) y que el plan
              de cuentas tenga esas cuentas a nivel operativo. Las filas en amarillo detallan el motivo por
              comprobante.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="rounded-md border max-h-[min(560px,60vh)] overflow-auto text-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta contable</TableHead>
                <TableHead>Nombre cuenta</TableHead>
                <TableHead>Año y mes</TableHead>
                <TableHead>F. documento</TableHead>
                <TableHead>F. registro</TableHead>
                <TableHead>Tipo doc.</TableHead>
                <TableHead>Serie – Nro.</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Responsable caja</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewBundles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                    No hay egresos en el rango seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                previewBundles.flatMap((b) => {
                  const custodianLabel = b.custodianId
                    ? custodianNameById.get(b.custodianId) || b.custodianId
                    : '—';
                  return b.lines.length === 0 ? (
                    <TableRow key={b.transactionId + '-empty'}>
                      <TableCell
                        colSpan={12}
                        className="bg-amber-50/50 text-amber-700 dark:bg-amber-950/20"
                      >
                        <span className="font-medium text-foreground/90">{custodianLabel}</span>
                        {' · '}
                        {b.transactionId}: {b.warnings.join(' ')}
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
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(b.documentDate, 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{format(b.date, 'dd/MM/yyyy')}</TableCell>
                        <TableCell
                          className="max-w-[120px] truncate text-xs whitespace-nowrap"
                          title={b.receiptType}
                        >
                          {b.receiptType}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate font-mono text-xs" title={b.serieNumero}>
                          {b.serieNumero}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs" title={b.description}>
                          {b.description}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs" title={custodianLabel}>
                          {custodianLabel}
                        </TableCell>
                        <TableCell className="text-xs">{b.sede}</TableCell>
                        <TableCell className="text-right">
                          {ln.debit > 0 ? formatNumberEs(ln.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {ln.credit > 0 ? formatNumberEs(ln.credit) : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

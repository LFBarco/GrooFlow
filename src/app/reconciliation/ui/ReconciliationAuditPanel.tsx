import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Search,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { TooltipProvider } from '../../components/ui/tooltip';
import {
  AUDIT_GLOSSARY,
  MATCH_STRATEGY_LABELS,
  PAYMENT_METHOD_LABELS,
  SOURCE_LABELS,
  STATUS_FILTER_OPTIONS,
  type AuditNavRequest,
  type AuditStatusFilter,
} from '../domain/auditLabels';
import { getActiveSession } from '../domain/dataset';
import { operationNumbersMatch } from '../domain/normalize';
import type { ReconciliationDataset, ReconciliationSourceType } from '../domain/types';
import {
  AUDIT_ALL_SESSIONS,
  buildAuditRows,
  computeAuditSummary,
  filterAuditRows,
  paginateRows,
  totalPages,
  type AuditPairRow,
  type AuditSessionScope,
} from '../engines/auditQueries';

type Props = {
  dataset: ReconciliationDataset;
  sessionScope: AuditSessionScope;
  navRequest?: AuditNavRequest | null;
  onNavConsumed?: () => void;
};

const PAGE_SIZE = 50;

const nativeSelectClass =
  'h-9 rounded-md border border-input bg-input-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function formatMoney(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: AuditPairRow['status'] }) {
  const map: Record<
    AuditPairRow['status'],
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    reconciled: { label: 'Conciliado', variant: 'default' },
    orphan_bank: { label: 'Banco sin venta', variant: 'destructive' },
    orphan_sales: { label: 'Venta sin banco', variant: 'destructive' },
    difference: { label: 'Diferencia', variant: 'secondary' },
    pending: { label: 'Pendiente', variant: 'outline' },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function MovementCell({ side, m }: { side: 'bank' | 'sales'; m?: AuditPairRow['bank'] }) {
  if (!m) return <td className="p-2 text-muted-foreground">—</td>;
  return (
    <td className="p-2 align-top">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground">{SOURCE_LABELS[m.sourceType]}</p>
        <p className="font-mono text-xs font-semibold">{m.operationNumber || '—'}</p>
        {m.operationNumberRaw && m.operationNumberRaw.replace(/\D/g, '') !== m.operationNumber && (
          <p className="font-mono text-[10px] text-muted-foreground">orig: {m.operationNumberRaw}</p>
        )}
        <p className="font-semibold">{formatMoney(m.amount)}</p>
        <p className="text-xs">{m.transactionDate}</p>
        {side === 'sales' && m.documentNumber && (
          <p className="text-xs text-muted-foreground">Doc: {m.documentNumber}</p>
        )}
        {m.registeredBy && <p className="text-xs text-muted-foreground">{m.registeredBy}</p>}
        <p className="text-xs">{PAYMENT_METHOD_LABELS[m.paymentMethod]}</p>
      </div>
    </td>
  );
}

function sessionScopeLabel(dataset: ReconciliationDataset, scope: AuditSessionScope): string {
  if (scope === AUDIT_ALL_SESSIONS) return 'Todas las sesiones';
  const session = dataset.sessions.find((s) => s.id === scope);
  return session?.label ?? getActiveSession(dataset).label;
}

export function ReconciliationAuditPanel({
  dataset,
  sessionScope,
  navRequest,
  onNavConsumed,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<AuditStatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const deferredSearch = useDeferredValue(search);

  const summary = useMemo(
    () => computeAuditSummary(dataset, sessionScope),
    [dataset, sessionScope]
  );
  const allRows = useMemo(() => buildAuditRows(dataset, sessionScope), [dataset, sessionScope]);
  const filtered = useMemo(
    () =>
      filterAuditRows(allRows, {
        status: statusFilter,
        source: sourceFilter === 'all' ? undefined : (sourceFilter as ReconciliationSourceType),
        search: deferredSearch,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [allRows, statusFilter, sourceFilter, deferredSearch, dateFrom, dateTo]
  );

  const pages = totalPages(filtered.length, PAGE_SIZE);
  const currentPage = Math.min(Math.max(1, page), pages);
  const pageRows = paginateRows(filtered, currentPage, PAGE_SIZE);
  const isSearchPending = search !== deferredSearch;
  const scopeLabel = sessionScopeLabel(dataset, sessionScope);
  const hasActiveFilters =
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    search.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  useEffect(() => {
    setPage(1);
  }, [sessionScope]);

  useEffect(() => {
    if (!navRequest) return;
    if (navRequest.statusFilter) setStatusFilter(navRequest.statusFilter);
    if (navRequest.search !== undefined) setSearch(navRequest.search);
    setPage(1);
    onNavConsumed?.();
  }, [navRequest, onNavConsumed]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const clearFilters = () => {
    setStatusFilter('all');
    setSourceFilter('all');
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium">Cruces validados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{summary.reconciledPairs}</p>
              <p className="text-xs text-muted-foreground">{formatMoney(summary.totalAmountReconciled)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium">Banco sin venta</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{summary.orphanBank}</p>
              <p className="text-xs text-muted-foreground">{formatMoney(summary.totalAmountOrphanBank)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium">Venta sin banco</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{summary.orphanSales}</p>
              <p className="text-xs text-muted-foreground">{formatMoney(summary.totalAmountOrphanSales)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium">Estrategia de cruce</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p>N° operación: {summary.byStrategy.operation_number}</p>
              <p>Monto + fecha: {summary.byStrategy.amount_date}</p>
              <p>Manual: {summary.byStrategy.manual}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Explorador de cruces</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">
                {filtered.length.toLocaleString('es-PE')} resultado(s)
              </span>{' '}
              de {allRows.length.toLocaleString('es-PE')} filas · sesión «{scopeLabel}» ·{' '}
              {summary.totalMovements.toLocaleString('es-PE')} movimientos
              {isSearchPending ? ' · filtrando…' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={`${nativeSelectClass} w-[200px]`}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as AuditStatusFilter);
                  setPage(1);
                }}
                aria-label="Filtrar por estado"
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className={`${nativeSelectClass} w-[160px]`}
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrar por fuente"
              >
                <option value="all">Todas las fuentes</option>
                {Object.entries(SOURCE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-[150px]"
                title="Desde"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-[150px]"
                title="Hasta"
              />
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="N° op., comprobante, counter…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Filtros activos:</span>
                {statusFilter !== 'all' && (
                  <Badge variant="secondary">
                    {STATUS_FILTER_OPTIONS.find((o) => o.id === statusFilter)?.label}
                  </Badge>
                )}
                {sourceFilter !== 'all' && (
                  <Badge variant="secondary">
                    {SOURCE_LABELS[sourceFilter as ReconciliationSourceType]}
                  </Badge>
                )}
                {dateFrom && <Badge variant="outline">Desde {dateFrom}</Badge>}
                {dateTo && <Badge variant="outline">Hasta {dateTo}</Badge>}
                {search.trim() && <Badge variant="outline">«{search.trim()}»</Badge>}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {STATUS_FILTER_OPTIONS.find((o) => o.id === statusFilter)?.description}
            </p>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Banco / Pasarela</th>
                    <th className="p-2">Venta ERP</th>
                    <th className="p-2">Δ Monto</th>
                    <th className="p-2">Estrategia</th>
                    <th className="p-2">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        {allRows.length === 0
                          ? 'No hay movimientos en la sesión seleccionada. Elija otra sesión arriba o importe archivos en la pestaña Importar.'
                          : 'Sin resultados para los filtros seleccionados.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const opsMatch =
                        row.bank &&
                        row.sales &&
                        operationNumbersMatch(
                          row.bank.operationNumberRaw || row.bank.operationNumber,
                          row.sales.operationNumberRaw || row.sales.operationNumber
                        );
                      return (
                      <tr key={row.id} className="border-t">
                        <td className="p-2">
                          <StatusBadge status={row.status} />
                        </td>
                        <MovementCell side="bank" m={row.bank} />
                        <MovementCell side="sales" m={row.sales} />
                        <td className="p-2">
                          {row.bank && row.sales ? (
                            !opsMatch ? (
                              <span className="font-medium text-red-600">N° op. distinto</span>
                            ) : row.amountDelta != null && Math.abs(row.amountDelta) > 0.05 ? (
                              <span className="font-medium text-amber-600">{formatMoney(row.amountDelta)}</span>
                            ) : (
                              <span className="text-emerald-600">OK</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          {row.strategy ? MATCH_STRATEGY_LABELS[row.strategy] : '—'}
                        </td>
                        <td className="p-2 text-xs">
                          {row.confidence != null ? `${(row.confidence * 100).toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Página {currentPage} de {pages} · {filtered.length.toLocaleString('es-PE')} fila(s)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <HelpCircle className="h-4 w-4" />
              Guía rápida para auditoría
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {Object.values(AUDIT_GLOSSARY).map((item) => (
              <div key={item.title}>
                <span className="font-medium text-foreground">{item.title}: </span>
                {item.body}
              </div>
            ))}
          </CardContent>
        </Card>

        {(summary.orphanBank > 0 || summary.orphanSales > 0) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              Hay {summary.orphanBank} abono(s) sin venta y {summary.orphanSales} venta(s) sin banco. Use el filtro
              correspondiente para validar caso por caso antes de cerrar el periodo.
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

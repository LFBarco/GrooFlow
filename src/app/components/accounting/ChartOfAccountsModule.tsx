import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import type { AccountingLinkSettings, ChartOfAccountEntry, SystemSettings } from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import {
  BookOpen,
  FileDown,
  Upload,
  Trash2,
  Table2,
  Link2,
  Download,
  Pencil,
} from 'lucide-react';
import {
  CHART_OPERATIVE_LEVEL,
  chartEntryLevel,
  chartSelectOptionsWithOrphan,
  normalizeAccountCode,
} from '../../utils/chartOfAccountsHelpers';
import {
  STARSOFT_CHART_HEADERS,
  parseChartOfAccountsImportRows,
} from '../../utils/chartOfAccountsImport';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { getEnabledSedeNames } from '../../utils/sedesCatalog';
import { getGrooflowBackend } from '../../config/backend';
import { useServerPagedList } from '../../hooks/useServerPagedList';
import { AccountCombobox } from '../ui/account-combobox';
import { appConfirm } from '../ui/app-dialog';
import {
  ClientDataTable,
  DataTablePaginationBar,
  DataTableToolbar,
  useClientDataTableState,
  type ClientDataTableColumn,
} from '../data-table/ClientDataTable';

interface ChartOfAccountsModuleProps {
  chartOfAccounts: ChartOfAccountEntry[];
  onUpdateChart: (rows: ChartOfAccountEntry[], successMessage?: string) => Promise<boolean>;
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (s: SystemSettings) => void;
}

export function ChartOfAccountsModule({
  chartOfAccounts,
  onUpdateChart,
  systemSettings,
  onUpdateSystemSettings,
}: ChartOfAccountsModuleProps) {
  type ImportMode = 'merge' | 'replace';
  type PendingImport = {
    rows: ChartOfAccountEntry[];
    summary: { created: number; updated: number; unchanged: number; inactivated: number };
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<ChartOfAccountEntry | null>(null);
  const [sedeConfigOpen, setSedeConfigOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const useServerPaging = getGrooflowBackend() === 'rest';
  const serverList = useServerPagedList<ChartOfAccountEntry>('chartOfAccounts', {
    initialPageSize: 25,
    enabled: useServerPaging,
  });
  const clientTable = useClientDataTableState({ initialPageSize: 25 });
  const search = useServerPaging ? serverList.search : clientTable.search;
  const setSearch = useServerPaging ? serverList.setSearch : clientTable.setSearch;
  const page = useServerPaging ? serverList.page : clientTable.page;
  const setPage = useServerPaging ? serverList.setPage : clientTable.setPage;
  const pageSize = useServerPaging ? serverList.pageSize : clientTable.pageSize;
  const setPageSize = useServerPaging ? serverList.setPageSize : clientTable.setPageSize;

  const accounting: AccountingLinkSettings = systemSettings.accounting ?? {};
  const enabledSedes = useMemo(() => getEnabledSedeNames(systemSettings), [systemSettings]);

  const setAccounting = (patch: Partial<AccountingLinkSettings>) => {
    onUpdateSystemSettings({
      ...systemSettings,
      accounting: { ...accounting, ...patch },
    });
  };

  const norm = (v: string | undefined | null) => normalizeAccountCode(v || '');

  const equalsBusinessFields = (a: ChartOfAccountEntry, b: ChartOfAccountEntry) =>
    a.name === b.name &&
    (a.level ?? null) === (b.level ?? null) &&
    (a.tipoAnexo ?? '') === (b.tipoAnexo ?? '') &&
    (a.centroCosto ?? '') === (b.centroCosto ?? '') &&
    (a.claseCuenta ?? '') === (b.claseCuenta ?? '') &&
    (a.destino ?? '') === (b.destino ?? '') &&
    (a.partidaPresupuesto ?? '') === (b.partidaPresupuesto ?? '') &&
    (a.ajusteDifCambio ?? '') === (b.ajusteDifCambio ?? '') &&
    (a.cuentaMonetaria ?? '') === (b.cuentaMonetaria ?? '') &&
    (a.conceptoIngGasto ?? '') === (b.conceptoIngGasto ?? '') &&
    (a.codSitFinancieraEstandar ?? '') === (b.codSitFinancieraEstandar ?? '') &&
    (a.codSitFinancieraTrib ?? '') === (b.codSitFinancieraTrib ?? '') &&
    (a.cuentaCargo ?? '') === (b.cuentaCargo ?? '') &&
    (a.cuentaAbono ?? '') === (b.cuentaAbono ?? '') &&
    (a.porcentaje ?? '') === (b.porcentaje ?? '') &&
    (a.plFuncionGroo ?? '') === (b.plFuncionGroo ?? '') &&
    (a.plplFuncionGoo ?? '') === (b.plplFuncionGoo ?? '') &&
    (a.kind ?? 'other') === (b.kind ?? 'other');

  const buildMergePreview = (incomingRows: ChartOfAccountEntry[]) => {
    const existingByCode = new Map(
      chartOfAccounts.map((r) => [norm(r.code), r] as const).filter(([k]) => !!k)
    );
    const incomingByCode = new Map(
      incomingRows.map((r) => [norm(r.code), r] as const).filter(([k]) => !!k)
    );
    const used = new Set<string>();

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let inactivated = 0;

    const merged: ChartOfAccountEntry[] = incomingRows.map((inc) => {
      const key = norm(inc.code);
      used.add(key);
      const old = existingByCode.get(key);
      if (!old) {
        created++;
        return { ...inc, active: true };
      }
      const nextRow: ChartOfAccountEntry = { ...old, ...inc, id: old.id, active: true };
      if (equalsBusinessFields(old, nextRow) && old.active) {
        unchanged++;
      } else {
        updated++;
      }
      return nextRow;
    });

    for (const old of chartOfAccounts) {
      const key = norm(old.code);
      if (!key || used.has(key)) continue;
      if (old.active) {
        inactivated++;
        merged.push({ ...old, active: false });
      } else {
        merged.push(old);
      }
    }

    return { rows: merged, summary: { created, updated, unchanged, inactivated } };
  };

  const level5Count = useMemo(
    () =>
      chartOfAccounts.filter(
        (e) => e.active && chartEntryLevel(e) === CHART_OPERATIVE_LEVEL
      ).length,
    [chartOfAccounts]
  );

  const igvLinkOptions = useMemo(
    () =>
      chartSelectOptionsWithOrphan(chartOfAccounts, accounting.igvPurchaseCreditAccountCode, {
        useLevel: CHART_OPERATIVE_LEVEL,
      }),
    [chartOfAccounts, accounting.igvPurchaseCreditAccountCode]
  );

  const pettyGlobalLinkOptions = useMemo(
    () =>
      chartSelectOptionsWithOrphan(chartOfAccounts, accounting.pettyCashCreditAccountCode, {
        useLevel: CHART_OPERATIVE_LEVEL,
      }),
    [chartOfAccounts, accounting.pettyCashCreditAccountCode]
  );

  const bankLinkOptions = useMemo(
    () =>
      chartSelectOptionsWithOrphan(chartOfAccounts, accounting.bankPaymentAccountCode, {
        useLevel: CHART_OPERATIVE_LEVEL,
      }),
    [chartOfAccounts, accounting.bankPaymentAccountCode]
  );

  const unknownExpenseLinkOptions = useMemo(
    () =>
      chartSelectOptionsWithOrphan(chartOfAccounts, accounting.pettyCashUnknownExpenseAccountCode, {
        useLevel: CHART_OPERATIVE_LEVEL,
      }),
    [chartOfAccounts, accounting.pettyCashUnknownExpenseAccountCode]
  );

  const sedeAccountOptions = (sede: string) =>
    chartSelectOptionsWithOrphan(chartOfAccounts, accounting.pettyCashCreditBySede?.[sede], {
      useLevel: CHART_OPERATIVE_LEVEL,
    });

  const filteredChart = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chartOfAccounts;
    return chartOfAccounts.filter(
      (e) =>
        e.code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.parentCode || '').toLowerCase().includes(q) ||
        (e.centroCosto || '').toLowerCase().includes(q)
    );
  }, [chartOfAccounts, search]);

  const chartTotalPages = useServerPaging
    ? serverList.totalPages
    : Math.max(1, Math.ceil(filteredChart.length / pageSize));
  useEffect(() => {
    if (useServerPaging) return;
    setPage((p) => Math.min(p, chartTotalPages));
  }, [chartTotalPages, setPage, useServerPaging]);

  const chartColumns = useMemo<ClientDataTableColumn<ChartOfAccountEntry>[]>(
    () => [
      {
        id: 'code',
        header: 'Cuenta',
        className: 'w-[100px] font-mono',
        cell: (row) => row.code,
      },
      {
        id: 'name',
        header: 'Nombre',
        cell: (row) => row.name,
      },
      {
        id: 'level',
        header: 'Nivel',
        className: 'w-[70px]',
        cell: (row) => row.level ?? '—',
      },
      {
        id: 'centro',
        header: 'Centro costo',
        className: 'w-[100px] font-mono',
        cell: (row) => row.centroCosto ?? '—',
      },
      {
        id: 'tipo',
        header: 'Tipo',
        className: 'w-[90px]',
        cell: (row) =>
          row.claseCuenta || row.kind ? (
            <Badge variant="outline" className="text-xs">
              {row.claseCuenta || row.kind}
            </Badge>
          ) : (
            '—'
          ),
      },
      {
        id: 'pct',
        header: '%',
        className: 'w-[90px] font-mono',
        cell: (row) => row.porcentaje ?? '—',
      },
      {
        id: 'pl',
        header: 'PL GROO',
        className: 'min-w-[120px] truncate max-w-[140px]',
        cell: (row) => <span title={row.plFuncionGroo}>{row.plFuncionGroo ?? '—'}</span>,
      },
      {
        id: 'plpl',
        header: 'PLPL',
        className: 'min-w-[120px] truncate max-w-[140px]',
        cell: (row) => <span title={row.plplFuncionGoo}>{row.plplFuncionGoo ?? '—'}</span>,
      },
      {
        id: 'edit',
        header: <span className="block text-right">Editar</span>,
        className: 'w-[80px] text-right',
        cell: (row) => (
          <Button size="icon" variant="ghost" onClick={() => setEditing({ ...row })}>
            <Pencil className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    []
  );

  const downloadTemplate = () => {
    const sample = [
      {
        CUENTA: '601111',
        DESCRIPCION: 'Mercaderias de ejemplo',
        NIVEL: 5,
        'TIPO ANEXO': '',
        'CENTRO DE COSTO': 'ADM',
        'CLASE CUENTA': 'GASTO',
        DESTINO: '',
        'PARTIDA PRESUPUESTO': '',
        'AJUSTE DIF. CAMBIO': '',
        'CUENTA MONETARIA': '',
        'CONCEPTO ING/GASTO': 'GASTO',
        'COD.SIT.FINANCIERA ESTANDAR': '',
        'COD.SIT.FINANCIERA TRIB.': '',
        'CUENTA CARGO': '',
        'CUENTA ABONO': '',
        PORCENTAJE: '100',
        'PL FUNCION GROO': 'EJEMPLO-GROO',
        'PLPL FUNCION GOO': 'EJEMPLO-PLPL',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PlanCuentas');
    XLSX.writeFile(wb, 'plantilla_plan_de_cuentas_grooflow.xlsx');
    toast.success('Plantilla descargada');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
        if (!json.length) {
          toast.error('El archivo está vacío');
          return;
        }

        const { rows: next, skipped } = parseChartOfAccountsImportRows(json);

        if (next.length === 0) {
          toast.error('No se leyeron filas válidas (requiere columnas CUENTA y DESCRIPCION).');
          return;
        }

        const preview = buildMergePreview(next);
        setPendingImport(preview);
        setImportMode('merge');
        toast.success(
          `Archivo leído: ${next.length} cuenta(s) válidas.${skipped ? ` Omitidas: ${skipped}.` : ''}`
        );
      } catch {
        toast.error('No se pudo leer el Excel');
      }
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const applyPendingImport = async () => {
    if (!pendingImport) return;
    const s = pendingImport.summary;
    const ok =
      importMode === 'replace'
        ? await onUpdateChart(
            pendingImport.rows
              .filter((r) => r.active)
              .map((r) => ({
                ...r,
                id: `coa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              })),
            'Plan de cuentas reemplazado por archivo.'
          )
        : await onUpdateChart(
            pendingImport.rows,
            `Merge aplicado. Nuevas: ${s.created}, actualizadas: ${s.updated}, inactivadas: ${s.inactivated}.`
          );
    if (ok) {
      setPendingImport(null);
      if (useServerPaging) await serverList.reload();
    }
  };

  const saveEditing = async () => {
    if (!editing) return;
    const code = normalizeAccountCode(editing.code);
    const name = (editing.name || '').trim();
    if (!code || !name) {
      toast.error('CUENTA y DESCRIPCION son obligatorias.');
      return;
    }
    const duplicated = chartOfAccounts.some(
      (r) => r.id !== editing.id && normalizeAccountCode(r.code) === code
    );
    if (duplicated) {
      toast.error('Ya existe otra cuenta con ese código.');
      return;
    }
    const next = chartOfAccounts.map((r) =>
      r.id === editing.id
        ? {
            ...editing,
            code,
            name,
            level: editing.level ? Number(editing.level) : undefined,
          }
        : r
    );
    const ok = await onUpdateChart(next, 'Cuenta actualizada.');
    if (ok) {
      setEditing(null);
      if (useServerPaging) await serverList.reload();
    }
  };

  const clearChart = async () => {
    if (!await appConfirm('¿Borrar todo el plan de cuentas cargado?')) return;
    await onUpdateChart([], 'Plan de cuentas vaciado.');
    if (useServerPaging) await serverList.reload();
  };

  const exportChartWithStarsoftHeaders = () => {
    const rows = chartOfAccounts.map((r) => ({
      CUENTA: r.code,
      DESCRIPCION: r.name,
      NIVEL: r.level ?? '',
      'TIPO ANEXO': r.tipoAnexo ?? '',
      'CENTRO DE COSTO': r.centroCosto ?? '',
      'CLASE CUENTA': r.claseCuenta ?? '',
      DESTINO: r.destino ?? '',
      'PARTIDA PRESUPUESTO': r.partidaPresupuesto ?? '',
      'AJUSTE DIF. CAMBIO': r.ajusteDifCambio ?? '',
      'CUENTA MONETARIA': r.cuentaMonetaria ?? '',
      'CONCEPTO ING/GASTO': r.conceptoIngGasto ?? '',
      'COD.SIT.FINANCIERA ESTANDAR': r.codSitFinancieraEstandar ?? '',
      'COD.SIT.FINANCIERA TRIB.': r.codSitFinancieraTrib ?? '',
      'CUENTA CARGO': r.cuentaCargo ?? '',
      'CUENTA ABONO': r.cuentaAbono ?? '',
      PORCENTAJE: r.porcentaje ?? '',
      'PL FUNCION GROO': r.plFuncionGroo ?? '',
      'PLPL FUNCION GOO': r.plplFuncionGoo ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: [...STARSOFT_CHART_HEADERS] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PlanCuentas');
    XLSX.writeFile(wb, `plan_cuentas_starsoft_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast.success('Plan de cuentas exportado con cabecera Starsoft.');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150 -mt-2">
      <div className="border-b border-border/60 pb-3">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary shrink-0" />
          Contabilidad — Plan de cuentas
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Importa tu plan contable (Excel). Configura cuentas de IGV y salida de caja para que los
          asientos de caja chica se generen correctamente (la vista previa está en el módulo{' '}
          <strong>Caja chica</strong>).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5" />
              Importar plan de cuentas
            </CardTitle>
            <CardDescription>
              Columnas obligatorias: <strong>CUENTA</strong>, <strong>DESCRIPCION</strong>. El resto
              sigue la plantilla Starsoft (incluye <strong>PORCENTAJE</strong>,{' '}
              <strong>PL FUNCION GROO</strong> y <strong>PLPL FUNCION GOO</strong>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={downloadTemplate}>
                <FileDown className="h-4 w-4 mr-2" />
                Descargar plantilla
              </Button>
              <Button type="button" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Subir Excel
              </Button>
              {chartOfAccounts.length > 0 && (
                <Button type="button" variant="outline" onClick={exportChartWithStarsoftHeaders}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar plan (Starsoft)
                </Button>
              )}
              {chartOfAccounts.length > 0 && (
                <Button type="button" variant="destructive" onClick={clearChart}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Vaciar plan
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls"
              onChange={handleFile}
            />
            <p className="text-xs text-muted-foreground">
              La importación <strong>reemplaza</strong> el plan actual. Haz una copia en Excel antes
              si necesitas conservar versiones.
            </p>
            <p className="text-xs text-muted-foreground">
              Cabecera esperada: <strong>{STARSOFT_CHART_HEADERS.join(' · ')}</strong>
            </p>
            {pendingImport && (
              <div className="rounded-md border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-2">
                <p className="text-sm font-medium">Resumen previo de actualización</p>
                <p className="text-xs text-muted-foreground">
                  Nuevas: <strong>{pendingImport.summary.created}</strong> · Actualizadas:{' '}
                  <strong>{pendingImport.summary.updated}</strong> · Sin cambio:{' '}
                  <strong>{pendingImport.summary.unchanged}</strong> · Inactivadas:{' '}
                  <strong>{pendingImport.summary.inactivated}</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={importMode} onValueChange={(v: ImportMode) => setImportMode(v)}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">Aplicar actualización (merge)</SelectItem>
                      <SelectItem value="replace">Reemplazar todo por archivo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={applyPendingImport}>
                    Confirmar importación
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingImport(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-5 w-5" />
              Enlaces para asientos (caja chica)
            </CardTitle>
            <CardDescription>
              Lista todas las cuentas activas del plan importado (cualquier NIVEL). Se usan al generar
              el asiento: gasto (proveedor) + IGV + haber caja.
              {chartOfAccounts.length === 0 ? (
                <span className="block text-amber-600 mt-1">
                  Importa primero tu plan de cuentas para elegir las cuentas desde aquí.
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>IGV crédito fiscal (compras)</Label>
              {chartOfAccounts.length > 0 ? (
                <AccountCombobox
                  options={igvLinkOptions}
                  value={accounting.igvPurchaseCreditAccountCode}
                  placeholder="Seleccionar cuenta"
                  onChange={(v) =>
                    setAccounting({
                      igvPurchaseCreditAccountCode: v === '__none__' ? undefined : v,
                    })
                  }
                />
              ) : (
                <Input
                  placeholder="Código cuenta IGV"
                  value={accounting.igvPurchaseCreditAccountCode || ''}
                  onChange={(e) =>
                    setAccounting({ igvPurchaseCreditAccountCode: e.target.value.trim() || undefined })
                  }
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                Cuentas del plan cargado; se guarda el nro. de <strong>CUENTA</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Salida caja chica (fallback global)</Label>
              {chartOfAccounts.length > 0 ? (
                <AccountCombobox
                  options={pettyGlobalLinkOptions}
                  value={accounting.pettyCashCreditAccountCode}
                  placeholder="Seleccionar cuenta"
                  onChange={(v) =>
                    setAccounting({
                      pettyCashCreditAccountCode: v === '__none__' ? undefined : v,
                    })
                  }
                />
              ) : (
                <Input
                  placeholder="Código cuenta caja / fondo fijo"
                  value={accounting.pettyCashCreditAccountCode || ''}
                  onChange={(e) =>
                    setAccounting({
                      pettyCashCreditAccountCode: e.target.value.trim() || undefined,
                    })
                  }
                />
              )}
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Si existe cuenta por sede, esa tendrá prioridad sobre esta global.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={() => setSedeConfigOpen(true)}>
                  Configurar por sede
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gasto caja chica sin cuenta mapeada (histórico / opcional)</Label>
              {chartOfAccounts.length > 0 ? (
                <AccountCombobox
                  options={unknownExpenseLinkOptions}
                  value={accounting.pettyCashUnknownExpenseAccountCode}
                  noneLabel="— Sin cuenta genérica —"
                  placeholder="Ej. 659 — gastos varios"
                  onChange={(v) =>
                    setAccounting({
                      pettyCashUnknownExpenseAccountCode: v === '__none__' ? undefined : v,
                    })
                  }
                />
              ) : (
                <Input
                  placeholder="Código cuenta gasto (nivel 5)"
                  value={accounting.pettyCashUnknownExpenseAccountCode || ''}
                  onChange={(e) =>
                    setAccounting({
                      pettyCashUnknownExpenseAccountCode: e.target.value.trim() || undefined,
                    })
                  }
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                Se usa cuando un egreso ya registrado no tiene cuenta en el comprobante ni en el proveedor.
                Así igual aparece en vista previa y export; contabilidad puede reclasificar en Starsoft.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Pago desde banco (opcional, futuro)</Label>
              {chartOfAccounts.length > 0 ? (
                <AccountCombobox
                  options={bankLinkOptions}
                  value={accounting.bankPaymentAccountCode}
                  placeholder="Cuenta nivel 5"
                  onChange={(v) =>
                    setAccounting({ bankPaymentAccountCode: v === '__none__' ? undefined : v })
                  }
                />
              ) : (
                <Input
                  placeholder="Código cuenta bancaria"
                  value={accounting.bankPaymentAccountCode || ''}
                  onChange={(e) =>
                    setAccounting({ bankPaymentAccountCode: e.target.value.trim() || undefined })
                  }
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Estos valores se guardan en <strong>Configuración del sistema</strong> (misma nube que
              el resto).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Table2 className="h-5 w-5" />
              Catálogo cargado ({useServerPaging ? serverList.total : chartOfAccounts.length})
              {level5Count > 0 ? (
                <Badge variant="secondary" className="ml-1 font-normal text-xs">
                  NIVEL {CHART_OPERATIVE_LEVEL}: {level5Count}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              Todas las columnas Starsoft se importan y se pueden editar (incl. PORCENTAJE y funciones PL).
              {level5Count > 0 ? (
                <span className="block mt-1">
                  Referencia: {level5Count} cuenta(s) con NIVEL {CHART_OPERATIVE_LEVEL} (operativas).
                </span>
              ) : null}
            </CardDescription>
          </div>
          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar código, nombre o centro de costo…"
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            filtered={useServerPaging ? serverList.filtered : filteredChart.length}
            total={useServerPaging ? serverList.total : chartOfAccounts.length}
            totalLabel="cuentas"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <ClientDataTable
            rows={useServerPaging ? serverList.items : filteredChart}
            columns={chartColumns}
            getRowId={(row) => row.id}
            page={Math.min(page, chartTotalPages)}
            pageSize={pageSize}
            serverPaged={useServerPaging}
            emptyMessage="No hay plan importado. Descarga la plantilla y sube tu archivo."
          />
          <DataTablePaginationBar
            page={Math.min(page, chartTotalPages)}
            totalPages={chartTotalPages}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cuenta del plan</DialogTitle>
            <DialogDescription>
              Puedes ajustar cualquier columna de tu plantilla Starsoft.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2">
              <div className="space-y-1">
                <Label>CUENTA</Label>
                <Input
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>DESCRIPCION</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>NIVEL</Label>
                <Input
                  value={editing.level ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, level: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>TIPO ANEXO</Label>
                <Input value={editing.tipoAnexo ?? ''} onChange={(e) => setEditing({ ...editing, tipoAnexo: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>CENTRO DE COSTO</Label>
                <Input value={editing.centroCosto ?? ''} onChange={(e) => setEditing({ ...editing, centroCosto: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>CLASE CUENTA</Label>
                <Input value={editing.claseCuenta ?? ''} onChange={(e) => setEditing({ ...editing, claseCuenta: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>DESTINO</Label>
                <Input value={editing.destino ?? ''} onChange={(e) => setEditing({ ...editing, destino: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>PARTIDA PRESUPUESTO</Label>
                <Input value={editing.partidaPresupuesto ?? ''} onChange={(e) => setEditing({ ...editing, partidaPresupuesto: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>AJUSTE DIF. CAMBIO</Label>
                <Input value={editing.ajusteDifCambio ?? ''} onChange={(e) => setEditing({ ...editing, ajusteDifCambio: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>CUENTA MONETARIA</Label>
                <Input value={editing.cuentaMonetaria ?? ''} onChange={(e) => setEditing({ ...editing, cuentaMonetaria: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>CONCEPTO ING/GASTO</Label>
                <Input value={editing.conceptoIngGasto ?? ''} onChange={(e) => setEditing({ ...editing, conceptoIngGasto: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>COD.SIT.FINANCIERA ESTANDAR</Label>
                <Input value={editing.codSitFinancieraEstandar ?? ''} onChange={(e) => setEditing({ ...editing, codSitFinancieraEstandar: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>COD.SIT.FINANCIERA TRIB.</Label>
                <Input value={editing.codSitFinancieraTrib ?? ''} onChange={(e) => setEditing({ ...editing, codSitFinancieraTrib: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>CUENTA CARGO</Label>
                <Input value={editing.cuentaCargo ?? ''} onChange={(e) => setEditing({ ...editing, cuentaCargo: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>CUENTA ABONO</Label>
                <Input value={editing.cuentaAbono ?? ''} onChange={(e) => setEditing({ ...editing, cuentaAbono: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>PORCENTAJE</Label>
                <Input value={editing.porcentaje ?? ''} onChange={(e) => setEditing({ ...editing, porcentaje: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>PL FUNCION GROO</Label>
                <Input value={editing.plFuncionGroo ?? ''} onChange={(e) => setEditing({ ...editing, plFuncionGroo: e.target.value || undefined })} />
              </div>
              <div className="space-y-1">
                <Label>PLPL FUNCION GOO</Label>
                <Input value={editing.plplFuncionGoo ?? ''} onChange={(e) => setEditing({ ...editing, plplFuncionGoo: e.target.value || undefined })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEditing}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sedeConfigOpen} onOpenChange={setSedeConfigOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cuentas de salida por sede</DialogTitle>
            <DialogDescription>
              Configuración compacta: cada sede puede tener su propia cuenta de salida de caja chica.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[52vh] overflow-auto pr-1">
            {(enabledSedes.length > 0 ? enabledSedes : []).map((sede) => {
              const val = accounting.pettyCashCreditBySede?.[sede] || '__none__';
              const opts = sedeAccountOptions(sede);
              return (
                <div key={sede} className="grid grid-cols-12 items-center gap-2">
                  <Label className="col-span-4 text-xs">{sede}</Label>
                  <div className="col-span-8">
                    {chartOfAccounts.length > 0 ? (
                      <AccountCombobox
                        options={opts}
                        value={val === '__none__' ? undefined : val}
                        noneLabel="Usar fallback global"
                        placeholder="Cuenta por sede"
                        onChange={(nextVal) => {
                          const nextMap = { ...(accounting.pettyCashCreditBySede || {}) };
                          if (nextVal === '__none__') {
                            delete nextMap[sede];
                          } else {
                            nextMap[sede] = nextVal;
                          }
                          setAccounting({ pettyCashCreditBySede: nextMap });
                        }}
                      />
                    ) : (
                      <Input
                        className="h-8 font-mono"
                        placeholder="Código cuenta"
                        value={accounting.pettyCashCreditBySede?.[sede] || ''}
                        onChange={(e) => {
                          const nextMap = { ...(accounting.pettyCashCreditBySede || {}) };
                          const v = e.target.value.trim();
                          if (!v) delete nextMap[sede];
                          else nextMap[sede] = v;
                          setAccounting({ pettyCashCreditBySede: nextMap });
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSedeConfigOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Moon,
  Printer,
  RefreshCw,
  Settings2,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import type { SystemSettings, User } from '../../types';
import type { AsistenciaFilters, AsistenciaSettings, AsistenciaStaffLiveState } from '../../types/asistencia';
import type { AsistenciaAreaGroup } from '../../types/asistencia';
import { ASISTENCIA_WORK_SHIFT_LABELS } from '../../types/asistencia';
import { useAsistenciaModuleState } from '../../hooks/useAsistenciaModuleState';
import { buildAsistenciaDaySummary, mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { buildFilterSedeOptions, buildFormSedeOptions } from '../../utils/gestionSedes';
import {
  cacheAgeLabel,
} from '../../utils/bukAsistenciaCache';
import {
  buildExampleBukRecords,
  mergeExampleStaffIntoSettings,
} from '../../utils/asistenciaExampleSeed';
import { buildLiveConsolidatedSummary, buildLiveSedeSummary, staffForSede } from '../../utils/asistenciaStaff';
import { buildBukDashboardSummary, buildBukMultiSedeDashboard, type BukDashboardRow } from '../../utils/asistenciaBukDashboard';
import {
  defaultAsistenciaFilters,
  filterBukDashboardRows,
  filterLiveConsolidatedSummary,
  filterLiveSedeSummary,
} from '../../utils/asistenciaFilters';
import { exportAsistenciaBukExcel, exportAsistenciaLiveExcel, exportAsistenciaMonthlyHrExcel } from '../../utils/asistenciaExport';
import { printAsistenciaLive } from '../../utils/asistenciaPrint';
import { planVsRealForStaffMember } from '../../utils/asistenciaPlanVsReal';
import { syncStaffFromUsers } from '../../utils/asistenciaStaffSync';
import { buildAsistenciaMultiSedeWeekTrend, buildAsistenciaWeekTrend } from '../../utils/asistenciaTrend';
import { buildAsistenciaOperationalAlerts } from '../../utils/asistenciaAlerts';
import { autoRefreshIntervalMs, shouldRunAutoRefresh } from '../../utils/asistenciaAutoRefresh';
import { saveAsistenciaOperationalContext } from '../../utils/asistenciaOperationalContext';
import {
  captureAsistenciaDailySnapshots,
  hydrateAsistenciaSnapshotsFromCloud,
  listAsistenciaSnapshots,
} from '../../utils/asistenciaSnapshots';
import { daysInWeek, weekRangeLabel } from '../../utils/turnosCalendar';
import { AsistenciaBukDashboard } from './AsistenciaBukDashboard';
import { AsistenciaBukMultiSedePanel } from './AsistenciaBukMultiSedePanel';
import { AsistenciaCriticalBanner } from './AsistenciaCriticalBanner';
import { AsistenciaCoveragePanel } from './AsistenciaCoveragePanel';
import { AsistenciaAlertBanner } from './AsistenciaAlertBanner';
import { AsistenciaCoverageDetailPanel } from './AsistenciaCoverageDetailPanel';
import { AsistenciaHistoryPanel } from './AsistenciaHistoryPanel';
import { AsistenciaFiltersBar } from './AsistenciaFiltersBar';
import { AsistenciaLiveView } from './AsistenciaLiveView';
import { AsistenciaSedeConfigPanel } from './AsistenciaSedeConfigPanel';
import { AsistenciaStaffDetailDialog } from './AsistenciaStaffDetailDialog';
import { AsistenciaWeekTrendPanel } from './AsistenciaWeekTrendPanel';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent } from '../ui/card';

export interface AsistenciaModuleProps {
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (settings: SystemSettings) => void;
  onPersistAsistenciaSettings?: (
    updater: (prev: AsistenciaSettings) => AsistenciaSettings,
    successMessage?: string
  ) => Promise<boolean>;
  onPersistSystemSettings?: (
    nextOrUpdater: SystemSettings | ((prev: SystemSettings) => SystemSettings),
    successMessage?: string
  ) => Promise<boolean>;
  visibleSedes?: string[];
  canConfigure?: boolean;
  users?: User[];
}

const AREA_GROUPS: AsistenciaAreaGroup[] = ['medica', 'peluqueria', 'global'];

export function AsistenciaModule({
  systemSettings,
  onUpdateSystemSettings,
  onPersistAsistenciaSettings,
  onPersistSystemSettings,
  visibleSedes = [],
  canConfigure = false,
  users = [],
}: AsistenciaModuleProps) {
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const {
    records,
    setRecords,
    cacheFetchedAt,
    loading,
    fetchProgress,
    moduleReady,
    turnosSettings,
    turnosLoading,
    refreshBuk,
    bukEnabled,
  } = useAsistenciaModuleState(asistencia);
  const [mainTab, setMainTab] = useState<'live' | 'dashboard' | 'config'>('live');
  const [liveViewMode, setLiveViewMode] = useState<'single' | 'consolidated'>('single');
  const [dashboardMultiSede, setDashboardMultiSede] = useState(false);
  const [showPlanVsReal, setShowPlanVsReal] = useState(false);
  const [filters, setFilters] = useState(defaultAsistenciaFilters);
  const [editLayout, setEditLayout] = useState(false);
  const [detailLive, setDetailLive] = useState<AsistenciaStaffLiveState | null>(null);
  const [detailBukRow, setDetailBukRow] = useState<BukDashboardRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [snapshots, setSnapshots] = useState(() => listAsistenciaSnapshots());
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden
  );

  useEffect(() => {
    let cancelled = false;
    void hydrateAsistenciaSnapshotsFromCloud().then((list) => {
      if (!cancelled) setSnapshots(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const shiftFilter = filters.shift;

  const sedeOptions = useMemo(() => {
    const extras = [
      ...(asistencia.staff ?? []).map((s) => s.sedeName),
      ...(asistencia.sedeProfiles ?? []).map((p) => p.sedeName),
      ...asistencia.requirements.map((r) => r.sedeName),
      ...(asistencia.sedeMappings ?? []).map((m) => m.sedeName),
    ];
    return buildFilterSedeOptions({ visibleSedes, extra: extras });
  }, [visibleSedes, asistencia]);

  const formSedeOptions = useMemo(
    () => buildFormSedeOptions(visibleSedes),
    [visibleSedes]
  );

  const [selectedSede, setSelectedSede] = useState(() => sedeOptions[0] ?? 'Principal');

  const activeSede = sedeOptions.includes(selectedSede) ? selectedSede : sedeOptions[0];

  const dateObj = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);
  const weekDays = useMemo(() => daysInWeek(dateObj), [dateObj]);
  const weekLabel = useMemo(() => weekRangeLabel(dateObj), [dateObj]);

  const dashboardUsesMulti =
    dashboardMultiSede || (liveViewMode === 'consolidated' && mainTab === 'dashboard');

  const liveSummary = useMemo(
    () =>
      buildLiveSedeSummary({
        sedeName: activeSede,
        settings: asistencia,
        records,
        date: dateObj,
        shiftFilter,
      }),
    [activeSede, asistencia, records, dateObj, shiftFilter]
  );

  const consolidatedSummary = useMemo(
    () =>
      buildLiveConsolidatedSummary({
        sedeNames: sedeOptions,
        settings: asistencia,
        records,
        date: dateObj,
        shiftFilter,
      }),
    [sedeOptions, asistencia, records, dateObj, shiftFilter]
  );

  const filteredLiveSummary = useMemo(
    () => (liveSummary ? filterLiveSedeSummary(liveSummary, filters) : undefined),
    [liveSummary, filters]
  );

  const filteredConsolidatedSummary = useMemo(
    () => filterLiveConsolidatedSummary(consolidatedSummary, filters),
    [consolidatedSummary, filters]
  );

  const coverageSummary = useMemo(
    () =>
      buildAsistenciaDaySummary({
        date: dateObj,
        records,
        settings: asistencia,
        visibleSedes: liveViewMode === 'consolidated' && mainTab === 'live' ? sedeOptions : [activeSede],
      }),
    [dateObj, records, asistencia, liveViewMode, mainTab, sedeOptions, activeSede]
  );

  const bukDashboardSummary = useMemo(
    () =>
      buildBukDashboardSummary({
        records,
        sedeName: activeSede,
        settings: asistencia,
        date: dateObj,
      }),
    [records, activeSede, asistencia, dateObj]
  );

  const bukAreaOptions = useMemo(
    () =>
      [...new Set(bukDashboardSummary.rows.map((r) => r.area).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es')
      ),
    [bukDashboardSummary.rows]
  );

  const bukSpecialtyOptions = useMemo(
    () =>
      [...new Set(bukDashboardSummary.rows.map((r) => r.especialidad).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es')
      ),
    [bukDashboardSummary.rows]
  );

  const bukMultiDashboardSummary = useMemo(
    () =>
      buildBukMultiSedeDashboard({
        records,
        sedeNames: sedeOptions,
        settings: asistencia,
        date: dateObj,
      }),
    [records, sedeOptions, asistencia, dateObj]
  );

  const weekTrend = useMemo(
    () =>
      dashboardUsesMulti || liveViewMode === 'consolidated'
        ? buildAsistenciaMultiSedeWeekTrend({
            records,
            settings: asistencia,
            sedeNames: sedeOptions,
            weekDays,
          })
        : buildAsistenciaWeekTrend({
            records,
            settings: asistencia,
            sedeName: activeSede,
            weekDays,
          }),
    [
      records,
      asistencia,
      sedeOptions,
      weekDays,
      activeSede,
      dashboardUsesMulti,
      liveViewMode,
    ]
  );

  const criticalMissing = useMemo(() => {
    if (liveViewMode === 'consolidated') {
      return consolidatedSummary.sedes.flatMap((s) => s.criticalMissing);
    }
    return liveSummary.criticalMissing;
  }, [liveViewMode, consolidatedSummary, liveSummary]);

  const operationalAlerts = useMemo(() => {
    const coverageGaps = coverageSummary.sedes.flatMap((sede) =>
      AREA_GROUPS.flatMap((group) =>
        sede.byArea[group].map((cov) => ({
          sedeName: cov.requirement.sedeName,
          cargoLabel: cov.requirement.cargoLabel,
          required: cov.requiredCount,
          present: cov.presentCount,
        }))
      )
    );
    return buildAsistenciaOperationalAlerts({
      updatedAt: new Date().toISOString(),
      dateYmd: selectedDate,
      cacheFetchedAt,
      criticalMissing: criticalMissing.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        cargoLabel: s.cargoLabel,
        sedeName: s.sedeName,
      })),
      coverageGaps,
      bukEnabled,
    });
  }, [coverageSummary, selectedDate, cacheFetchedAt, criticalMissing, bukEnabled]);

  useEffect(() => {
    const coverageGaps = coverageSummary.sedes.flatMap((sede) =>
      AREA_GROUPS.flatMap((group) =>
        sede.byArea[group].map((cov) => ({
          sedeName: cov.requirement.sedeName,
          cargoLabel: cov.requirement.cargoLabel,
          required: cov.requiredCount,
          present: cov.presentCount,
        }))
      )
    );
    saveAsistenciaOperationalContext({
      updatedAt: new Date().toISOString(),
      dateYmd: selectedDate,
      cacheFetchedAt,
      criticalMissing: criticalMissing.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        cargoLabel: s.cargoLabel,
        sedeName: s.sedeName,
      })),
      coverageGaps,
      bukEnabled,
    });
  }, [coverageSummary, selectedDate, cacheFetchedAt, criticalMissing, bukEnabled]);

  useEffect(() => {
    const onVis = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const monthPrefix = selectedDate.slice(0, 7);
  const monthLabel = format(dateObj, 'MMMM yyyy', { locale: es });

  const getPlanVsReal = useCallback(
    (live: AsistenciaStaffLiveState) => {
      if (!showPlanVsReal || !bukEnabled) return undefined;
      const compare = planVsRealForStaffMember({
        staff: live.staff,
        turnosSettings,
        asistencia,
        bukRecords: records,
        date: dateObj,
      });
      return compare.status === 'na' ? undefined : compare;
    },
    [showPlanVsReal, bukEnabled, turnosSettings, asistencia, records, dateObj]
  );

  const allLiveStaff = useMemo(() => {
    const fromSede = (s: typeof liveSummary) =>
      s
        ? [
            ...s.areas.flatMap((a) => a.staff),
            ...(s.manager ? [s.manager] : []),
          ]
        : [];
    if (liveViewMode === 'consolidated') {
      return consolidatedSummary.sedes.flatMap((s) => fromSede(s));
    }
    return fromSede(liveSummary);
  }, [consolidatedSummary, liveSummary, liveViewMode]);

  const openStaffDetail = useCallback((live: AsistenciaStaffLiveState) => {
    setDetailLive(live);
    setDetailBukRow(null);
    setDetailOpen(true);
  }, []);

  const openBukRowDetail = useCallback(
    (row: BukDashboardRow) => {
      const norm = (r: string) => r.replace(/[.\-\s]/g, '').toLowerCase();
      const live = allLiveStaff.find(
        (s) => s.staff.rut && norm(s.staff.rut) === norm(row.rut)
      );
      setDetailLive(live ?? null);
      setDetailBukRow(row);
      setDetailOpen(true);
    },
    [allLiveStaff]
  );

  const handleExportBuk = useCallback(() => {
    const rows = filterBukDashboardRows(bukDashboardSummary.rows, filters);
    if (rows.length === 0) {
      toast.error('No hay filas para exportar con los filtros actuales.');
      return;
    }
    exportAsistenciaBukExcel(rows, activeSede, selectedDate);
    toast.success(`Exportados ${rows.length} registro(s) Buk.`);
  }, [bukDashboardSummary.rows, filters, activeSede, selectedDate]);

  const handleExportLive = useCallback(() => {
    const staff =
      liveViewMode === 'consolidated'
        ? filteredConsolidatedSummary.sedes.flatMap((s) =>
            s.areas.flatMap((a) => a.staff)
          )
        : (filteredLiveSummary?.areas.flatMap((a) => a.staff) ?? []);
    if (staff.length === 0) {
      toast.error('No hay personal visible para exportar.');
      return;
    }
    const label =
      liveViewMode === 'consolidated' ? 'consolidado' : activeSede.replace(/\s+/g, '-');
    exportAsistenciaLiveExcel(staff, label, selectedDate);
    toast.success(`Exportados ${staff.length} colaborador(es) del organigrama.`);
  }, [
    liveViewMode,
    filteredConsolidatedSummary,
    filteredLiveSummary,
    activeSede,
    selectedDate,
  ]);

  const setShiftFilter = useCallback((shift: AsistenciaFilters['shift']) => {
    setFilters((prev) => ({ ...prev, shift }));
  }, []);

  const hasAnyStaff = useMemo(
    () => sedeOptions.some((s) => staffForSede(asistencia, s).length > 0),
    [sedeOptions, asistencia]
  );

  const saveAsistencia = useCallback(
    async (
      updater: (prev: AsistenciaSettings) => AsistenciaSettings,
      successMessage?: string
    ): Promise<boolean> => {
      if (onPersistAsistenciaSettings) {
        const ok = await onPersistAsistenciaSettings(updater, successMessage);
        if (!ok) {
          toast.error('No se pudo guardar en la nube. Revisa tu sesión e intenta de nuevo.');
        }
        return ok;
      }
      if (onPersistSystemSettings) {
        const ok = await onPersistSystemSettings(
          (prev) => ({
            ...prev,
            asistencia: updater(mergeAsistenciaSettings(prev.asistencia)),
          }),
          successMessage
        );
        if (!ok) {
          toast.error('No se pudo guardar en la nube. Revisa tu sesión e intenta de nuevo.');
        }
        return ok;
      }
      const next = updater(mergeAsistenciaSettings(systemSettings.asistencia));
      onUpdateSystemSettings({ ...systemSettings, asistencia: next });
      if (successMessage) toast.success(successMessage);
      return true;
    },
    [onPersistAsistenciaSettings, onPersistSystemSettings, onUpdateSystemSettings, systemSettings]
  );

  const refresh = useCallback(
    async (opts?: { silent?: boolean; source?: 'manual' | 'auto'; skipStaffCheck?: boolean }) => {
      const source = opts?.source ?? 'manual';
      if (!opts?.skipStaffCheck) {
        if (mainTab === 'live' && !hasAnyStaff) {
          toast.error('Registra personal en al menos una sede para el organigrama en vivo.');
          setMainTab('config');
          return;
        }
        if (
          mainTab === 'live' &&
          liveViewMode === 'single' &&
          staffForSede(asistencia, activeSede).length === 0
        ) {
          toast.error('Registra personal en la sede seleccionada o usa vista consolidada.');
          setMainTab('config');
          return;
        }
      }
      const result = await refreshBuk({
        activeSede,
        date: dateObj,
        silent: opts?.silent,
      });
      if (result.ok && result.records) {
        captureAsistenciaDailySnapshots({
          date: dateObj,
          sedeNames: sedeOptions,
          settings: asistencia,
          records: result.records,
          source,
        });
        setSnapshots(listAsistenciaSnapshots());
        if (source === 'auto') {
          void saveAsistencia(
            (prev) => ({
              ...prev,
              buk: {
                ...prev.buk,
                lastAutoRefreshAt: new Date().toISOString(),
              },
            }),
            undefined
          );
        }
      }
    },
    [
      mainTab,
      hasAnyStaff,
      liveViewMode,
      asistencia,
      activeSede,
      dateObj,
      refreshBuk,
      sedeOptions,
      saveAsistencia,
    ]
  );

  const handlePrintLive = useCallback(() => {
    const summaries =
      liveViewMode === 'consolidated'
        ? filteredConsolidatedSummary.sedes
        : filteredLiveSummary
          ? [filteredLiveSummary]
          : [];
    if (summaries.length === 0) {
      toast.error('No hay organigrama visible para imprimir.');
      return;
    }
    printAsistenciaLive({
      summaries,
      date: dateObj,
      titleSuffix: liveViewMode === 'consolidated' ? 'Consolidado' : activeSede,
    });
  }, [liveViewMode, filteredConsolidatedSummary, filteredLiveSummary, dateObj, activeSede]);

  const shiftWeek = useCallback((delta: number) => {
    setSelectedDate(format(addDays(dateObj, delta * 7), 'yyyy-MM-dd'));
  }, [dateObj]);

  const handleSyncUsers = useCallback(async () => {
    if (users.length === 0) {
      toast.error('No hay usuarios activos para importar.');
      return;
    }
    const targets = mainTab === 'config' ? [activeSede] : sedeOptions;
    const result = syncStaffFromUsers({
      users,
      settings: asistencia,
      sedeNames: targets,
    });
    const ok = await saveAsistencia(
      () => result.settings,
      `Personal sincronizado: ${result.added} nuevo(s), ${result.updated} actualizado(s).`
    );
    if (ok && result.skipped > 0) {
      toast.message(`${result.skipped} usuario(s) fuera de las sedes objetivo.`);
    }
  }, [users, mainTab, activeSede, sedeOptions, asistencia, saveAsistencia]);

  const loadExampleData = useCallback(async () => {
    const targets =
      liveViewMode === 'consolidated' || mainTab !== 'live' ? sedeOptions : [activeSede];
    const ok = await saveAsistencia((prev) => {
      let next = mergeAsistenciaSettings(prev);
      for (const sede of targets) {
        next = mergeExampleStaffIntoSettings(next, sede, { replaceSede: true });
      }
      return next;
    }, 'Personal de ejemplo guardado.');
    if (!ok) return;

    const nextSettings = targets.reduce(
      (acc, sede) => mergeExampleStaffIntoSettings(acc, sede, { replaceSede: true }),
      mergeAsistenciaSettings(asistencia)
    );
    const exampleRecords = targets.flatMap((sede) =>
      buildExampleBukRecords({
        sedeName: sede,
        dateYmd: selectedDate,
        staff: staffForSede(nextSettings, sede),
      })
    );
    setRecords(exampleRecords, Date.now());
    toast.success(
      `Ejemplo listo: ${exampleRecords.length} marcaciones simuladas para ${format(dateObj, "d 'de' MMMM", { locale: es })}.`
    );
  }, [
    activeSede,
    asistencia,
    dateObj,
    liveViewMode,
    mainTab,
    saveAsistencia,
    selectedDate,
    sedeOptions,
  ]);

  const handleExportMonthly = useCallback(() => {
    const monthSnapshots = snapshots.filter((s) => s.dateYmd.startsWith(monthPrefix));
    if (monthSnapshots.length === 0 && records.length === 0) {
      toast.error(`No hay datos de ${monthLabel} para exportar.`);
      return;
    }
    exportAsistenciaMonthlyHrExcel({
      monthPrefix,
      monthLabel,
      snapshots: monthSnapshots,
      records,
    });
    toast.success(`Reporte RRHH ${monthLabel} descargado.`);
  }, [snapshots, monthPrefix, monthLabel, records]);

  useEffect(() => {
    if (
      !shouldRunAutoRefresh({
        buk: asistencia.buk,
        loading,
        documentVisible,
      })
    ) {
      return;
    }
    const ms = autoRefreshIntervalMs(asistencia.buk);
    const id = window.setInterval(() => {
      if (
        !shouldRunAutoRefresh({
          buk: asistencia.buk,
          loading,
          documentVisible: !document.hidden,
        })
      ) {
        return;
      }
      void refresh({ silent: true, source: 'auto', skipStaffCheck: true });
    }, ms);
    return () => window.clearInterval(id);
  }, [
    asistencia.buk,
    loading,
    documentVisible,
    refresh,
  ]);

  if (!moduleReady || turnosLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando módulo de asistencia…
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="asistencia-module">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
            <Users className="h-5 w-5" />
            <span className="text-sm font-medium">Asistencia del día</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Panel de dotación operativa</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Gestiona el personal por sede y visualiza el organigrama en vivo cruzado con Buk Asistencia.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sede</label>
            <Select
              value={activeSede}
              onValueChange={setSelectedSede}
              disabled={liveViewMode === 'consolidated' && mainTab === 'live'}
            >
              <SelectTrigger className="w-[180px] bg-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sedeOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Semana · {weekLabel}</label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => shiftWeek(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[160px] bg-background border-border text-foreground dark:bg-slate-900/60 dark:border-slate-700 dark:text-white"
              />
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => shiftWeek(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {loading && fetchProgress ? fetchProgress : 'Actualizar Buk'}
          </Button>
          {bukEnabled ? (
            <Button
              type="button"
              variant={showPlanVsReal ? 'default' : 'outline'}
              size="sm"
              className={showPlanVsReal ? 'bg-teal-600 hover:bg-teal-500 text-white border-0' : ''}
              onClick={() => setShowPlanVsReal((v) => !v)}
            >
              Plan vs real
            </Button>
          ) : null}
          {canConfigure && users.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void handleSyncUsers()}>
              <UserPlus className="h-4 w-4 mr-1" />
              Sync usuarios
            </Button>
          ) : null}
          {canConfigure ? (
            <Button
              type="button"
              variant="outline"
              className="border-border"
              data-testid="asistencia-load-examples"
              onClick={() => void loadExampleData()}
            >
              Datos de ejemplo
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={records.length === 0 && snapshots.length === 0}
            onClick={handleExportMonthly}
          >
            <CalendarRange className="h-4 w-4 mr-1" />
            RRHH mensual
          </Button>
          {mainTab === 'live' ? (
            <>
              <div className="flex rounded-lg border border-border overflow-hidden dark:border-slate-700">
                {(
                  [
                    { id: 'all' as const, label: 'Todos', icon: Users },
                    { id: 'day' as const, label: ASISTENCIA_WORK_SHIFT_LABELS.day, icon: Sun },
                    { id: 'night' as const, label: ASISTENCIA_WORK_SHIFT_LABELS.night, icon: Moon },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant="ghost"
                    data-testid={`asistencia-shift-${id}`}
                    className={
                      shiftFilter === id
                        ? 'rounded-none bg-indigo-600 hover:bg-indigo-500 text-white'
                        : 'rounded-none text-muted-foreground hover:bg-muted dark:text-slate-300 dark:hover:bg-slate-800'
                    }
                    onClick={() => setShiftFilter(id)}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1" />
                    {label}
                  </Button>
                ))}
              </div>
              <Button
              type="button"
              variant={liveViewMode === 'consolidated' ? 'default' : 'outline'}
              className={
                liveViewMode === 'consolidated'
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-0'
                  : 'border-border text-foreground bg-background dark:border-slate-600 dark:text-slate-200 dark:bg-slate-900/60'
              }
              onClick={() =>
                setLiveViewMode((m) => (m === 'consolidated' ? 'single' : 'consolidated'))
              }
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              {liveViewMode === 'consolidated' ? 'Consolidado' : 'Por sede'}
            </Button>
            </>
          ) : null}
        </div>
        {cacheFetchedAt && records.length > 0 ? (
          <p className="w-full text-xs text-muted-foreground">
            Caché local: {records.length} registros · actualizado {cacheAgeLabel(cacheFetchedAt)} · válido 48 h
            {asistencia.buk?.autoRefreshEnabled ? (
              <> · auto-refresh cada {asistencia.buk.autoRefreshIntervalMinutes ?? 30} min</>
            ) : null}
          </p>
        ) : null}
      </div>

      <AsistenciaAlertBanner alerts={operationalAlerts} />

      {!asistencia.buk?.enabled ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium">Integración Buk no activa</p>
              <p className="text-sm text-muted-foreground">
                Un administrador debe activar Buk en Configuración → Integraciones y probar la conexión.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AsistenciaFiltersBar
        filters={filters}
        onChange={setFilters}
        areaOptions={bukAreaOptions}
        specialtyOptions={bukSpecialtyOptions}
        showLiveFilters={mainTab === 'live'}
        showBukFilters={mainTab === 'dashboard' || mainTab === 'live'}
      />

      {criticalMissing.length > 0 && mainTab === 'live' ? (
        <AsistenciaCriticalBanner
          missing={criticalMissing}
          sedeLabel={liveViewMode === 'consolidated' ? 'Todas las sedes' : activeSede}
        />
      ) : null}

      {records.length > 0 ? (
        <AsistenciaWeekTrendPanel
          days={weekTrend}
          selectedDateKey={selectedDate}
          onSelectDate={setSelectedDate}
          sedeLabel={
            liveViewMode === 'consolidated' || dashboardUsesMulti
              ? `${sedeOptions.length} sedes`
              : activeSede
          }
        />
      ) : null}

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'live' | 'dashboard' | 'config')}>
        <TabsList className="bg-muted/60 border border-border dark:bg-slate-900/80 dark:border-slate-800">
          <TabsTrigger value="live" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-1" /> Operativa en vivo
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard Buk
          </TabsTrigger>
          {canConfigure ? (
            <TabsTrigger value="config" data-testid="asistencia-tab-config" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Settings2 className="h-4 w-4 mr-1" /> Configuración sede
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="live" className="mt-4 space-y-4">
          {records.length > 0 ? (
            <>
              <AsistenciaCoveragePanel
                summary={coverageSummary}
                sedeName={liveViewMode === 'single' ? activeSede : undefined}
                compact
              />
              <AsistenciaCoverageDetailPanel
                summary={coverageSummary}
                sedeName={liveViewMode === 'single' ? activeSede : undefined}
              />
            </>
          ) : null}
          {records.length === 0 && !loading ? (
            <Card className="border-border bg-muted/40 dark:border-slate-800 dark:bg-slate-950/50">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Pulsa «Actualizar Buk» para cargar marcaciones de{' '}
                {format(dateObj, "d 'de' MMMM", { locale: es })}. El organigrama mostrará ausentes en rojo.
              </CardContent>
            </Card>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={records.length === 0}
              onClick={handlePrintLive}
            >
              <Printer className="mr-1 h-4 w-4" />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={records.length === 0}
              onClick={handleExportLive}
            >
              <Download className="mr-1 h-4 w-4" />
              Exportar organigrama
            </Button>
          </div>
          <AsistenciaLiveView
            mode={liveViewMode}
            shiftFilter={shiftFilter}
            viewDate={dateObj}
            summary={liveViewMode === 'single' ? filteredLiveSummary : undefined}
            consolidated={liveViewMode === 'consolidated' ? filteredConsolidatedSummary : undefined}
            asistenciaSettings={settings}
            editLayout={editLayout}
            canEditLayout={canConfigure}
            onEditLayoutChange={setEditLayout}
            onPersistLayout={saveAsistencia}
            onRefresh={() => void refresh()}
            loading={loading}
            onStaffClick={openStaffDetail}
            getPlanVsReal={getPlanVsReal}
          />
          {records.length > 0 &&
          (liveViewMode === 'consolidated'
            ? consolidatedSummary.absentCount > 0
            : liveSummary.absentCount > 0) ? (
            <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/10">
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Diagnóstico de cruce Buk —{' '}
                  {liveViewMode === 'consolidated' ? 'todas las sedes' : activeSede}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {(liveViewMode === 'consolidated'
                    ? consolidatedSummary.sedes.flatMap((s) => s.areas.flatMap((a) => a.staff))
                    : liveSummary.areas.flatMap((a) => a.staff)
                  )
                    .filter((s) => s.status === 'ausente' && s.matchHint)
                    .map((s) => (
                      <li key={s.staff.id} className="rounded-lg border border-border bg-muted/40 dark:border-slate-800 dark:bg-slate-950/50 p-3">
                        <span className="font-medium text-foreground">{s.staff.fullName}</span>
                        <span className="text-slate-500">
                          {' '}
                          · {s.staff.cargoLabel} · {s.staff.sedeName}
                        </span>
                        <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90 leading-relaxed">{s.matchHint}</p>
                      </li>
                    ))}
                </ul>
                {(liveViewMode === 'consolidated'
                  ? consolidatedSummary.sedes.some((s) => s.bukRecintosOnDate.length > 0)
                  : liveSummary.bukRecintosOnDate.length > 0) ? (
                  <p className="text-xs text-muted-foreground">
                    Revisa códigos recinto Buk en Configuración sede si el cruce falla.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4 space-y-4">
          {records.length > 0 ? (
            <>
              <AsistenciaCoveragePanel
                summary={coverageSummary}
                sedeName={dashboardUsesMulti ? undefined : activeSede}
                compact
              />
              <AsistenciaCoverageDetailPanel
                summary={coverageSummary}
                sedeName={dashboardUsesMulti ? undefined : activeSede}
              />
            </>
          ) : null}
          <AsistenciaHistoryPanel snapshots={snapshots} onSelectDate={setSelectedDate} />
          {sedeOptions.length > 1 ? (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant={dashboardMultiSede ? 'default' : 'outline'}
                className={dashboardMultiSede ? 'bg-teal-600 hover:bg-teal-500 text-white border-0' : ''}
                onClick={() => setDashboardMultiSede((v) => !v)}
              >
                <Building2 className="h-4 w-4 mr-1" />
                {dashboardMultiSede ? 'Multi-sede activo' : 'Ver todas las sedes'}
              </Button>
            </div>
          ) : null}
          {dashboardUsesMulti ? (
            <AsistenciaBukMultiSedePanel
              multi={bukMultiDashboardSummary}
              filters={filters}
              onRowClick={(row, sedeName) => {
                setSelectedSede(sedeName);
                openBukRowDetail(row);
              }}
            />
          ) : (
            <AsistenciaBukDashboard
              records={records}
              settings={asistencia}
              sedeName={activeSede}
              date={dateObj}
              filters={filters}
              onRowClick={openBukRowDetail}
              onExport={handleExportBuk}
            />
          )}
        </TabsContent>

        {canConfigure ? (
          <TabsContent value="config" className="mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Configurando: <strong className="text-foreground">{activeSede}</strong>
              </div>
              {canConfigure && users.length > 0 ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void handleSyncUsers()}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Importar usuarios a esta sede
                </Button>
              ) : null}
            </div>
            <AsistenciaSedeConfigPanel
              sedeName={activeSede}
              settings={asistencia}
              sedeOptions={sedeOptions}
              canConfigure={canConfigure}
              onSave={saveAsistencia}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <AsistenciaStaffDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        live={detailLive}
        bukRow={detailBukRow}
        viewDate={dateObj}
      />
    </div>
  );
}

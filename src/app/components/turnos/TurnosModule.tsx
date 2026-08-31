import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Settings2,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { SystemSettings, User } from '../../types';
import type { TurnosFilters, TurnosGridDensity, TurnosViewMode } from '../../types/turnos';
import { VET_WORK_AREAS } from '../../types/accidentes';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { sanitizeBukBaseUrl } from '../../utils/bukAsistenciaApi';
import { loadBukAsistenciaCache } from '../../utils/bukAsistenciaCache';
import type { BukAsistenciaRecord } from '../../types/asistencia';
import { exportTurnosWeekExcel, printTurnosWeek } from '../../utils/turnosExport';
import {
  dayHeaderLabel,
  daysInWeek,
  daysInMonthGrid,
  isInMonth,
  shiftAnchor,
  toDateKey,
  weekRangeLabel,
} from '../../utils/turnosCalendar';
import {
  assignmentForCell,
  computePeriodKpis,
  copyWeekAssignments,
  defaultTurnosFilters,
  filterTurnosRoster,
  rosterForPlanning,
} from '../../utils/turnosData';
import { comparePlanVsReal } from '../../utils/turnosAsistenciaBridge';
import { computeLaborAlerts } from '../../utils/turnosValidation';
import { isWeekPublished, weekKeyForAnchor } from '../../utils/turnosAudit';
import { useTurnosModuleState } from '../../hooks/useTurnosModuleState';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { TurnosWeekGrid } from './TurnosWeekGrid';
import { TurnosDayView } from './TurnosDayView';
import { TurnosMonthView } from './TurnosMonthView';
import { TurnosRosterDialog } from './TurnosRosterDialog';
import { TurnosFiltersBar } from './TurnosFiltersBar';
import { TurnosKpiBar } from './TurnosKpiBar';
import { TurnosStaffingConfigDialog } from './TurnosStaffingConfigDialog';
import { TurnosVacanciesView } from './TurnosVacanciesView';
import { TurnosValidationBanner } from './TurnosValidationBanner';
import { TurnosPublishBar } from './TurnosPublishBar';
import { TurnosTemplatesDialog } from './TurnosTemplatesDialog';
import { TurnosHistoryDialog } from './TurnosHistoryDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export interface TurnosModuleProps {
  users: User[];
  systemSettings: SystemSettings;
  visibleSedes?: string[];
  canEdit?: boolean;
  currentUser?: User;
}

export function TurnosModule({
  users,
  systemSettings,
  visibleSedes = [],
  canEdit = false,
  currentUser,
}: TurnosModuleProps) {
  const asistencia = useMemo(
    () => mergeAsistenciaSettings(systemSettings.asistencia),
    [systemSettings.asistencia]
  );
  const { settings, loading, saving, updateSettings, syncRoster } = useTurnosModuleState({
    users,
    asistencia,
    canEdit,
  });

  const [viewMode, setViewMode] = useState<TurnosViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [workSede, setWorkSede] = useState('Todas');
  const [rosterOpen, setRosterOpen] = useState(false);
  const [staffingOpen, setStaffingOpen] = useState(false);
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [showPlanVsReal, setShowPlanVsReal] = useState(false);
  const [gridDensity, setGridDensity] = useState<TurnosGridDensity>('comfortable');
  const [filters, setFilters] = useState<TurnosFilters>(defaultTurnosFilters);

  const currentStaffId = useMemo(() => {
    if (!currentUser || currentUser.id === 'guest') return undefined;
    const byUser = settings.roster.find((r) => r.userId === currentUser.id);
    if (byUser) return byUser.id;
    const email = currentUser.email?.trim().toLowerCase();
    if (email) {
      const byEmail = settings.roster.find((r) => r.email?.trim().toLowerCase() === email);
      if (byEmail) return byEmail.id;
    }
    return undefined;
  }, [settings.roster, currentUser]);

  const currentUserName = currentUser?.name;

  const bukBaseUrl = sanitizeBukBaseUrl(asistencia.buk?.apiBaseUrl || 'https://app.ctrlit.cl/ctrl/api/v2');
  const bukToken = asistencia.buk?.apiToken?.trim() ?? '';
  const bukEnabled = Boolean(asistencia.buk?.enabled && bukToken);

  const [bukRecords, setBukRecords] = useState<BukAsistenciaRecord[]>([]);

  useEffect(() => {
    if (!bukEnabled) {
      setBukRecords([]);
      return;
    }
    const cached = loadBukAsistenciaCache({ baseUrl: bukBaseUrl, apiToken: bukToken });
    setBukRecords(cached?.records ?? []);
  }, [bukEnabled, bukBaseUrl, bukToken]);

  const sedeOptions = useMemo(() => {
    const fromStaff = (asistencia.staff ?? []).map((s) => s.sedeName);
    const fromRoster = settings.roster.map((r) => r.homeSede);
    const fromUsers = users.flatMap((u) => u.sedes ?? (u.location ? [u.location] : []));
    const all = [...new Set([...visibleSedes, ...fromStaff, ...fromRoster, ...fromUsers])].filter(Boolean);
    return all.length > 0 ? all : ['Principal'];
  }, [visibleSedes, asistencia, settings.roster, users]);

  const weekDays = useMemo(() => daysInWeek(anchor), [anchor]);
  const dateKey = toDateKey(anchor);

  const periodDateKeys = useMemo(() => {
    if (viewMode === 'day') return [dateKey];
    if (viewMode === 'week') return weekDays.map(toDateKey);
    return daysInMonthGrid(anchor)
      .filter((d) => isInMonth(d, anchor))
      .map(toDateKey);
  }, [viewMode, dateKey, weekDays, anchor]);

  const baseRoster = useMemo(() => {
    if (showAllStaff && workSede !== 'Todas') return settings.roster.filter((r) => r.active);
    return rosterForPlanning(
      settings.roster,
      settings.assignments,
      workSede,
      periodDateKeys
    );
  }, [settings.roster, settings.assignments, workSede, periodDateKeys, showAllStaff]);

  const laborAlerts = useMemo(
    () => computeLaborAlerts(settings, baseRoster, periodDateKeys, workSede),
    [settings, baseRoster, periodDateKeys, workSede]
  );

  const alertStaffIds = useMemo(
    () => new Set(laborAlerts.map((a) => a.staffId)),
    [laborAlerts]
  );

  const planVsRealStaffIds = useMemo(() => {
    if (filters.planVsRealStatus === 'Todos' || !showPlanVsReal) return undefined;
    const ids = new Set<string>();
    for (const staff of baseRoster) {
      for (const key of periodDateKeys) {
        const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
        const assignment = assignmentForCell(settings, staff.id, key, cellSede);
        const compare = comparePlanVsReal({
          roster: staff,
          assignment,
          asistencia,
          bukRecords,
          date: new Date(`${key}T12:00:00`),
          workSede,
        });
        if (compare.status === filters.planVsRealStatus) {
          ids.add(staff.id);
          break;
        }
      }
    }
    return ids;
  }, [
    filters.planVsRealStatus,
    showPlanVsReal,
    baseRoster,
    periodDateKeys,
    settings,
    workSede,
    asistencia,
    bukRecords,
  ]);

  const filteredRoster = useMemo(
    () =>
      filterTurnosRoster(baseRoster, settings, filters, periodDateKeys, workSede, {
        alertStaffIds,
        planVsRealStaffIds,
      }),
    [baseRoster, settings, filters, periodDateKeys, workSede, alertStaffIds, planVsRealStaffIds]
  );

  const weekDateFilterOptions = useMemo(
    () =>
      weekDays.map((d) => {
        const { weekday, day } = dayHeaderLabel(d);
        return { value: toDateKey(d), label: `${weekday} ${day}` };
      }),
    [weekDays]
  );

  const weekPublished =
    viewMode === 'week' &&
    workSede !== 'Todas' &&
    isWeekPublished(settings, weekKeyForAnchor(anchor), workSede);

  const workAreaOptions = useMemo(() => {
    const fromRoster = baseRoster.map((r) => r.workArea || 'Sin área');
    return [...new Set([...VET_WORK_AREAS, ...fromRoster])].sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }, [baseRoster]);

  const roleOptions = useMemo(() => {
    const roles = baseRoster.map((r) => r.roleLabel).filter(Boolean);
    return [...new Set(roles)].sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseRoster]);

  const kpis = useMemo(
    () => computePeriodKpis(settings, periodDateKeys, baseRoster, workSede),
    [settings, periodDateKeys, baseRoster, workSede]
  );

  const navigate = useCallback(
    (delta: number) => setAnchor((prev) => shiftAnchor(viewMode, prev, delta)),
    [viewMode]
  );

  const goToToday = () => setAnchor(new Date());

  const handleSelectDayFromMonth = (day: Date) => {
    setAnchor(day);
    setViewMode('day');
  };

  const copyPreviousWeek = () => {
    if (!canEdit) return;
    const currentKeys = weekDays.map(toDateKey);
    const prevAnchor = shiftAnchor('week', anchor, -1);
    const prevKeys = daysInWeek(prevAnchor).map(toDateKey);
    updateSettings(
      (prev) => copyWeekAssignments(prev, prevKeys, currentKeys, workSede),
      'Semana copiada desde la anterior.'
    );
  };

  const periodLabel =
    viewMode === 'day'
      ? format(anchor, "d 'de' MMMM yyyy", { locale: es })
      : viewMode === 'week'
        ? weekRangeLabel(anchor)
        : format(anchor, 'MMMM yyyy', { locale: es });

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando planificación de turnos…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm dark:border-slate-700">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-300">
            <CalendarRange className="h-5 w-5" />
            <span className="text-sm font-medium">Planificación de turnos</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Gestión de dotación</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Programa turnos día, noche, libre y capacitación por sede. Arrastra en la vista semanal,
            cubre otras sedes y mantén el roster sincronizado con usuarios.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Sede</label>
            <Select value={workSede} onValueChange={setWorkSede}>
              <SelectTrigger className="w-[180px] bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas las sedes</SelectItem>
                {sedeOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {viewMode === 'day' ? (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Fecha</label>
              <Input
                type="date"
                value={dateKey}
                onChange={(e) => setAnchor(new Date(`${e.target.value}T12:00:00`))}
                className="w-[160px]"
              />
            </div>
          ) : null}

          <div className="flex items-center rounded-lg border border-border dark:border-slate-700">
            <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={goToToday}
              className="min-w-[140px] px-2 text-sm font-medium capitalize hover:text-primary"
            >
              {periodLabel}
            </button>
            <Button type="button" variant="ghost" size="icon" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as TurnosViewMode)}>
            <TabsList>
              <TabsTrigger value="day">Día</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mes</TabsTrigger>
              <TabsTrigger value="vacancies">Vacantes</TabsTrigger>
            </TabsList>
          </Tabs>

          {viewMode === 'week' ? (
            <Select
              value={gridDensity}
              onValueChange={(v) => setGridDensity(v as TurnosGridDensity)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compacta</SelectItem>
                <SelectItem value="comfortable">Cómoda</SelectItem>
                <SelectItem value="spacious">Amplia</SelectItem>
              </SelectContent>
            </Select>
          ) : null}

          {viewMode === 'week' && canEdit ? (
            <TurnosTemplatesDialog
              settings={settings}
              roster={filteredRoster}
              dateKeys={weekDays.map(toDateKey)}
              workSede={workSede}
              canEdit={canEdit}
              currentUserName={currentUserName}
              onUpdate={updateSettings}
            />
          ) : null}

          <TurnosHistoryDialog settings={settings} />

          {viewMode === 'week' && canEdit ? (
            <Button type="button" variant="outline" onClick={copyPreviousWeek} disabled={saving}>
              <Copy className="mr-1 h-4 w-4" />
              Copiar semana ant.
            </Button>
          ) : null}

          {viewMode === 'week' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline">
                  <Download className="mr-1 h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    exportTurnosWeekExcel({
                      settings,
                      roster: filteredRoster,
                      weekDays,
                      workSede,
                      anchor,
                    })
                  }
                >
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    printTurnosWeek({
                      settings,
                      roster: filteredRoster,
                      weekDays,
                      workSede,
                      anchor,
                    })
                  }
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Button type="button" variant="outline" onClick={() => setStaffingOpen(true)}>
            <Settings2 className="mr-1 h-4 w-4" />
            Dotación
          </Button>

          {bukEnabled ? (
            <Button
              type="button"
              variant={showPlanVsReal ? 'default' : 'outline'}
              onClick={() => setShowPlanVsReal((v) => !v)}
            >
              Plan vs real
            </Button>
          ) : null}

          <Button type="button" variant="outline" onClick={syncRoster} disabled={!canEdit || saving}>
            <RefreshCw className={`mr-1 h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>

          <Button type="button" variant="secondary" onClick={() => setRosterOpen(true)}>
            <Users className="mr-1 h-4 w-4" />
            Personal ({settings.roster.length})
          </Button>

          {workSede !== 'Todas' ? (
            <Button
              type="button"
              variant={showAllStaff ? 'default' : 'outline'}
              onClick={() => setShowAllStaff((v) => !v)}
            >
              {showAllStaff ? 'Solo sede' : 'Ver todo (cobertura)'}
            </Button>
          ) : null}
        </div>

        {settings.rosterSyncedAt ? (
          <p className="w-full text-xs text-muted-foreground">
            Roster sincronizado · {settings.roster.length} personas ·{' '}
            {settings.assignments.length} asignaciones · {filteredRoster.length} visibles con filtros
          </p>
        ) : null}
      </div>

      <TurnosKpiBar kpis={kpis} />

      <TurnosValidationBanner alerts={laborAlerts} />

      {viewMode === 'week' ? (
        <TurnosPublishBar
          settings={settings}
          anchor={anchor}
          workSede={workSede}
          canEdit={canEdit}
          currentUserName={currentUserName}
          onUpdate={updateSettings}
        />
      ) : null}

      {viewMode !== 'vacancies' ? (
        <TurnosFiltersBar
          filters={filters}
          workAreas={workAreaOptions}
          roleOptions={roleOptions}
          sedeOptions={sedeOptions}
          weekDateOptions={viewMode === 'week' ? weekDateFilterOptions : undefined}
          onChange={setFilters}
        />
      ) : null}

      {viewMode === 'week' ? (
        <TurnosWeekGrid
          settings={settings}
          weekDays={weekDays}
          roster={filteredRoster}
          workSede={workSede}
          canEdit={canEdit}
          showPlanVsReal={showPlanVsReal}
          asistencia={asistencia}
          bukRecords={bukRecords}
          density={gridDensity}
          readOnlyPublished={weekPublished}
          onUpdate={updateSettings}
        />
      ) : null}

      {viewMode === 'day' ? (
        <TurnosDayView
          settings={settings}
          date={anchor}
          roster={filteredRoster}
          workSede={workSede}
          canEdit={canEdit}
          onUpdate={updateSettings}
        />
      ) : null}

      {viewMode === 'vacancies' ? (
        <TurnosVacanciesView
          settings={settings}
          roster={settings.roster.filter((r) => r.active)}
          workSede={workSede}
          sedeOptions={sedeOptions}
          canEdit={canEdit}
          currentStaffId={currentStaffId}
          currentUserName={currentUserName}
          onUpdate={updateSettings}
        />
      ) : null}

      {viewMode === 'month' ? (
        <TurnosMonthView
          settings={settings}
          monthAnchor={anchor}
          workSede={workSede}
          onSelectDay={handleSelectDayFromMonth}
        />
      ) : null}

      <TurnosRosterDialog
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        settings={settings}
        sedeOptions={sedeOptions}
        canEdit={canEdit}
        onUpdate={updateSettings}
      />

      <TurnosStaffingConfigDialog
        open={staffingOpen}
        onOpenChange={setStaffingOpen}
        settings={settings}
        sedeOptions={sedeOptions}
        workAreas={workAreaOptions}
        canEdit={canEdit}
        onUpdate={updateSettings}
      />
    </div>
  );
}

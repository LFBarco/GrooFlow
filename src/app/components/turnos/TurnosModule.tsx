import { useCallback, useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { SystemSettings, User } from '../../types';
import type { TurnosViewMode } from '../../types/turnos';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import {
  daysInWeek,
  shiftAnchor,
  toDateKey,
  weekRangeLabel,
} from '../../utils/turnosCalendar';
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

export interface TurnosModuleProps {
  users: User[];
  systemSettings: SystemSettings;
  visibleSedes?: string[];
  canEdit?: boolean;
}

export function TurnosModule({
  users,
  systemSettings,
  visibleSedes = [],
  canEdit = false,
}: TurnosModuleProps) {
  const asistencia = mergeAsistenciaSettings(systemSettings.asistencia);
  const { settings, loading, saving, updateSettings, syncRoster } = useTurnosModuleState({
    users,
    asistencia,
    canEdit,
  });

  const [viewMode, setViewMode] = useState<TurnosViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [workSede, setWorkSede] = useState('Todas');
  const [rosterOpen, setRosterOpen] = useState(false);
  const [showAllStaff, setShowAllStaff] = useState(false);

  const sedeOptions = useMemo(() => {
    const fromStaff = (asistencia.staff ?? []).map((s) => s.sedeName);
    const fromRoster = settings.roster.map((r) => r.homeSede);
    const fromUsers = users.flatMap((u) => u.sedes ?? (u.location ? [u.location] : []));
    const all = [...new Set([...visibleSedes, ...fromStaff, ...fromRoster, ...fromUsers])].filter(Boolean);
    return all.length > 0 ? all : ['Principal'];
  }, [visibleSedes, asistencia, settings.roster, users]);

  const weekDays = useMemo(() => daysInWeek(anchor), [anchor]);
  const dateKey = toDateKey(anchor);

  const navigate = useCallback(
    (delta: number) => setAnchor((prev) => shiftAnchor(viewMode, prev, delta)),
    [viewMode]
  );

  const goToToday = () => setAnchor(new Date());

  const handleSelectDayFromMonth = (day: Date) => {
    setAnchor(day);
    setViewMode('day');
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
            </TabsList>
          </Tabs>

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
            {settings.assignments.length} asignaciones
          </p>
        ) : null}
      </div>

      {viewMode === 'week' ? (
        <TurnosWeekGrid
          settings={settings}
          weekDays={weekDays}
          workSede={workSede}
          canEdit={canEdit}
          showAllStaff={showAllStaff}
          onUpdate={updateSettings}
        />
      ) : null}

      {viewMode === 'day' ? (
        <TurnosDayView
          settings={settings}
          date={anchor}
          workSede={workSede}
          canEdit={canEdit}
          showAllStaff={showAllStaff}
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
    </div>
  );
}

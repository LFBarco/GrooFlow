import { Building2, Check, Clock, MapPin, Moon, Sun, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type { TurnosRosterEntry, TurnosSettings } from '../../types/turnos';
import {
  applyToVacancy,
  approveApplication,
  cancelVacancy,
  createVacancy,
  getOpenVacancies,
  getPendingApplications,
  rejectApplication,
} from '../../utils/turnosCoverage';
import { cn } from '../ui/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useMemo, useState } from 'react';

type Props = {
  settings: TurnosSettings;
  roster: TurnosRosterEntry[];
  workSede: string;
  sedeOptions: string[];
  canEdit: boolean;
  currentStaffId?: string;
  currentUserName?: string;
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings, message?: string) => void;
};

export function TurnosVacanciesView({
  settings,
  roster,
  workSede,
  sedeOptions,
  canEdit,
  currentStaffId,
  currentUserName,
  onUpdate,
}: Props) {
  const [filterSede, setFilterSede] = useState('Todas');
  const [applyNote, setApplyNote] = useState('');
  const [selectedVacancy, setSelectedVacancy] = useState<string | null>(null);
  const [newVacancy, setNewVacancy] = useState({
    date: '',
    shift: 'day' as 'day' | 'night',
    workSede: sedeOptions[0] ?? 'Principal',
    workArea: '',
    reason: '',
  });

  const openVacancies = useMemo(() => {
    const list = getOpenVacancies(settings, filterSede === 'Todas' ? undefined : filterSede);
    return [...list].sort((a, b) => a.date.localeCompare(b.date) || a.workSede.localeCompare(b.workSede));
  }, [settings, filterSede]);

  const pendingForManager = useMemo(
    () => getPendingApplications(settings, workSede === 'Todas' ? undefined : workSede),
    [settings, workSede]
  );

  const myStaff = currentStaffId
    ? roster.find((r) => r.id === currentStaffId)
    : roster.find((r) => r.userId && settings.roster.some((x) => x.id === r.id));

  const handleApply = (vacancyId: string) => {
    const staffId = currentStaffId ?? roster[0]?.id;
    if (!staffId) return;
    onUpdate(
      (prev) => applyToVacancy(prev, { vacancyId, staffId, note: applyNote }),
      'Postulación enviada. El encargado de sede debe aprobarla.'
    );
    setApplyNote('');
    setSelectedVacancy(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 dark:border-slate-700">
          <div className="space-y-1">
            <Label className="text-xs">Ver vacantes de</Label>
            <Select value={filterSede} onValueChange={setFilterSede}>
              <SelectTrigger className="w-[200px]">
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
          <p className="text-sm text-muted-foreground">
            {openVacancies.length} turno(s) vacante(s) · Personal de cualquier sede puede postularse
          </p>
        </div>

        {openVacancies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay turnos vacantes abiertos con los filtros actuales.
            </CardContent>
          </Card>
        ) : (
          openVacancies.map((vac) => {
            const myApplication = (settings.applications ?? []).find(
              (a) =>
                a.vacancyId === vac.id &&
                a.staffId === (currentStaffId ?? '') &&
                a.status !== 'cancelled'
            );
            const pendingCount = (settings.applications ?? []).filter(
              (a) => a.vacancyId === vac.id && a.status === 'pending'
            ).length;

            return (
              <Card key={vac.id} className="overflow-hidden">
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          vac.shift === 'day'
                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                            : 'border-violet-300 bg-violet-50 text-violet-900'
                        )}
                      >
                        {vac.shift === 'day' ? (
                          <Sun className="mr-1 h-3 w-3" />
                        ) : (
                          <Moon className="mr-1 h-3 w-3" />
                        )}
                        {vac.shift === 'day' ? 'Día' : 'Noche'}
                      </Badge>
                      <span className="font-semibold capitalize text-foreground">
                        {format(parseISO(vac.date), "EEE d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      {vac.workSede}
                      {vac.workArea ? ` · ${vac.workArea}` : ''}
                    </p>
                    {vac.reason ? (
                      <p className="text-sm text-muted-foreground">{vac.reason}</p>
                    ) : null}
                    {pendingCount > 0 ? (
                      <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <Clock className="h-3 w-3" />
                        {pendingCount} postulación(es) pendiente(s)
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    {myApplication?.status === 'pending' ? (
                      <Badge variant="secondary">Tu postulación está pendiente</Badge>
                    ) : myApplication?.status === 'approved' ? (
                      <Badge className="bg-emerald-600">Aprobada — turno asignado</Badge>
                    ) : myApplication?.status === 'rejected' ? (
                      <Badge variant="destructive">Postulación rechazada</Badge>
                    ) : (
                      <>
                        {selectedVacancy === vac.id ? (
                          <div className="w-full min-w-[220px] space-y-2">
                            <Textarea
                              placeholder="Mensaje opcional al encargado…"
                              value={applyNote}
                              onChange={(e) => setApplyNote(e.target.value)}
                              rows={2}
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleApply(vac.id)}>
                                Confirmar postulación
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedVacancy(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => setSelectedVacancy(vac.id)}>
                            Postularme a cubrir
                          </Button>
                        )}
                      </>
                    )}
                    {canEdit && workSede !== 'Todas' && vac.workSede === workSede ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          onUpdate(
                            (prev) => cancelVacancy(prev, vac.id, currentUserName),
                            'Vacante cancelada.'
                          )
                        }
                      >
                        Cancelar vacante
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="space-y-4">
        {canEdit ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Publicar turno vacante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={newVacancy.date}
                  onChange={(e) => setNewVacancy((v) => ({ ...v, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Turno</Label>
                <Select
                  value={newVacancy.shift}
                  onValueChange={(v) =>
                    setNewVacancy((s) => ({ ...s, shift: v as 'day' | 'night' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Día</SelectItem>
                    <SelectItem value="night">Noche</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sede</Label>
                <Select
                  value={newVacancy.workSede}
                  onValueChange={(v) => setNewVacancy((s) => ({ ...s, workSede: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sedeOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motivo (opcional)</Label>
                <Input
                  value={newVacancy.reason}
                  onChange={(e) => setNewVacancy((v) => ({ ...v, reason: e.target.value }))}
                  placeholder="Ej. baja médica, vacaciones…"
                />
              </div>
              <Button
                className="w-full"
                disabled={!newVacancy.date}
                onClick={() => {
                  onUpdate(
                    (prev) =>
                      createVacancy(prev, {
                        date: newVacancy.date,
                        shift: newVacancy.shift,
                        workSede: newVacancy.workSede,
                        workArea: newVacancy.workArea || undefined,
                        reason: newVacancy.reason || undefined,
                        createdBy: currentUserName,
                      }, currentUserName),
                    'Turno vacante publicado.'
                  );
                  setNewVacancy((v) => ({ ...v, date: '', reason: '' }));
                }}
              >
                Publicar vacante
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {canEdit && pendingForManager.length > 0 ? (
          <Card className="border-amber-200 dark:border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-amber-600" />
                Postulaciones por aprobar ({pendingForManager.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingForManager.map((app) => {
                const vac = (settings.vacancies ?? []).find((v) => v.id === app.vacancyId);
                if (!vac) return null;
                return (
                  <div
                    key={app.id}
                    className="rounded-lg border border-border p-3 text-sm dark:border-slate-700"
                  >
                    <p className="font-medium">{app.staffName}</p>
                    <p className="text-xs text-muted-foreground">
                      Desde {app.homeSede}
                      {app.isExternal ? ' · Externo' : ''}
                    </p>
                    <p className="mt-1 text-xs">
                      {vac.workSede} · {vac.date} · {vac.shift === 'day' ? 'Día' : 'Noche'}
                    </p>
                    {app.note ? (
                      <p className="mt-1 text-xs italic text-muted-foreground">"{app.note}"</p>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() =>
                          onUpdate(
                            (prev) => approveApplication(prev, app.id, currentUserName),
                            `${app.staffName} aprobado para cubrir el turno.`
                          )
                        }
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() =>
                          onUpdate(
                            (prev) => rejectApplication(prev, app.id, currentUserName),
                            'Postulación rechazada.'
                          )
                        }
                      >
                        <X className="mr-1 h-3 w-3" />
                        Rechazar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leyenda de cobertura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <span className="rounded bg-cyan-500 px-1 text-[10px] font-bold text-white">COV</span>
              Personal de otra sede (cobertura interna)
            </p>
            <p className="flex items-center gap-2">
              <span className="rounded bg-orange-500 px-1 text-[10px] font-bold text-white">EXT</span>
              Personal externo
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Tras aprobar, el turno queda en la grilla con el código correspondiente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

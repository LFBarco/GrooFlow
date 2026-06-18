import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, LayoutGrid, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';

import type { AsistenciaSettings, AsistenciaStaffMember } from '../../types/asistencia';
import { ASISTENCIA_STAFF_AREA_LABELS, ASISTENCIA_WORK_SHIFT_LABELS } from '../../types/asistencia';
import { getSedeProfile, staffForSede } from '../../utils/asistenciaStaff';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import {
  applyAddOrgColumn,
  applyOrgColumnLabels,
  applyRemoveOrgColumn,
  isBuiltinOrgColumnId,
  resolveOrgColumns,
} from '../../utils/asistenciaOrgColumns';
import { AsistenciaOrgConfigDialog } from './AsistenciaOrgConfigDialog';
import { AsistenciaStaffDialog } from './AsistenciaStaffDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const BUILTIN_BADGE: Record<string, string> = {
  administracion: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
  medica: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  peluqueria: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
};

const CUSTOM_BADGE = 'bg-violet-500/20 text-violet-300 border-violet-500/30';

type Props = {
  sedeName: string;
  settings: AsistenciaSettings;
  sedeOptions?: string[];
  canConfigure: boolean;
  onSave: (
    updater: (prev: AsistenciaSettings) => AsistenciaSettings,
    successMessage?: string
  ) => Promise<boolean>;
};

export function AsistenciaSedeConfigPanel({ sedeName, settings, sedeOptions = [], canConfigure, onSave }: Props) {
  const profile = getSedeProfile(settings, sedeName);
  const orgColumns = useMemo(() => resolveOrgColumns(profile), [profile]);
  const staff = staffForSede(settings, sedeName);
  const [editSede, setEditSede] = useState(false);
  const [scheduleStart, setScheduleStart] = useState(profile.scheduleStart ?? '08:00');
  const [scheduleEnd, setScheduleEnd] = useState(profile.scheduleEnd ?? '18:00');
  const [scheduleNightStart, setScheduleNightStart] = useState(profile.scheduleNightStart ?? '20:00');
  const [scheduleNightEnd, setScheduleNightEnd] = useState(profile.scheduleNightEnd ?? '08:00');
  const [bukCode, setBukCode] = useState(profile.bukRecintoCode ?? '');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<AsistenciaStaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [areaOrder, setAreaOrder] = useState<string[]>(() => orgColumns.map((c) => c.id));
  const [areaLabels, setAreaLabels] = useState<Record<string, string>>(() => {
    const labels: Record<string, string> = {};
    for (const col of orgColumns) {
      labels[col.id] = col.label;
    }
    return labels;
  });
  const [hideEmptyAreas, setHideEmptyAreas] = useState(profile.hideEmptyAreas ?? false);
  const [newColumnLabel, setNewColumnLabel] = useState('');

  const runSave = async (
    updater: (prev: AsistenciaSettings) => AsistenciaSettings,
    successMessage?: string
  ) => {
    if (saving) return false;
    setSaving(true);
    try {
      return await onSave(updater, successMessage);
    } finally {
      setSaving(false);
    }
  };

  const byColumn = useMemo(() => {
    const map: Record<string, AsistenciaStaffMember[]> = {};
    for (const col of orgColumns) map[col.id] = [];
    for (const s of staff) {
      if (!map[s.area]) map[s.area] = [];
      map[s.area]!.push(s);
    }
    return map;
  }, [staff, orgColumns]);

  const saveSedeProfile = async () => {
    const ok = await runSave((prev) => {
      const rest = (prev.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName);
      const mappings = (prev.sedeMappings ?? []).filter((m) => m.sedeName !== sedeName);
      return mergeAsistenciaSettings({
        ...prev,
        sedeProfiles: [
          ...rest,
          {
            sedeName,
            scheduleStart,
            scheduleEnd,
            scheduleNightStart,
            scheduleNightEnd,
            bukRecintoCode: bukCode.trim() || undefined,
          },
        ],
        sedeMappings: bukCode.trim()
          ? [...mappings, { sedeName, bukRecintoCode: bukCode.trim() }]
          : mappings,
      });
    }, 'Configuración de sede guardada.');
    if (ok) setEditSede(false);
  };

  const saveOrgLayout = async () => {
    const ok = await runSave(
      (prev) =>
        applyOrgColumnLabels(prev, sedeName, areaLabels, areaOrder, hideEmptyAreas),
      'Estructura del organigrama guardada.'
    );
    return ok;
  };

  const addColumn = async () => {
    const label = newColumnLabel.trim();
    if (!label) return;
    const ok = await runSave(
      (prev) => applyAddOrgColumn(prev, sedeName, label),
      'Columna agregada al organigrama.'
    );
    if (ok) {
      setNewColumnLabel('');
      const next = applyAddOrgColumn(settings, sedeName, label);
      const cols = resolveOrgColumns(getSedeProfile(next, sedeName));
      setAreaOrder(cols.map((c) => c.id));
      setAreaLabels(Object.fromEntries(cols.map((c) => [c.id, c.label])));
    }
  };

  const removeColumn = async (columnId: string) => {
    if (isBuiltinOrgColumnId(columnId)) return;
    if (!window.confirm('¿Eliminar esta columna del organigrama? El personal se moverá a Administración.')) return;
    const ok = await runSave(
      (prev) => applyRemoveOrgColumn(prev, sedeName, columnId),
      'Columna eliminada.'
    );
    if (ok) {
      const nextProfile = getSedeProfile(
        applyRemoveOrgColumn(settings, sedeName, columnId),
        sedeName
      );
      const cols = resolveOrgColumns(nextProfile);
      setAreaOrder(cols.map((c) => c.id));
      setAreaLabels(Object.fromEntries(cols.map((c) => [c.id, c.label])));
    }
  };

  const moveArea = (index: number, dir: -1 | 1) => {
    setAreaOrder((order) => {
      const next = [...order];
      const target = index + dir;
      if (target < 0 || target >= next.length) return order;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const upsertStaff = async (member: AsistenciaStaffMember) => {
    const isEdit = member.id === editingStaff?.id;
    const ok = await runSave((prev) => {
      const others = (prev.staff ?? []).filter((s) => s.id !== member.id);
      let nextStaff = [...others, { ...member, sedeName }];
      if (member.isManager) {
        nextStaff = nextStaff.map((s) =>
          s.sedeName === sedeName && s.id !== member.id ? { ...s, isManager: false } : s
        );
      }
      return mergeAsistenciaSettings({ ...prev, staff: nextStaff });
    }, isEdit ? 'Personal actualizado.' : 'Personal agregado.');
    if (ok) setEditingStaff(null);
  };

  const removeStaff = async (id: string) => {
    if (!window.confirm('¿Eliminar este miembro del personal?')) return;
    await runSave(
      (prev) =>
        mergeAsistenciaSettings({
          ...prev,
          staff: (prev.staff ?? []).filter((s) => s.id !== id),
        }),
      'Personal eliminado.'
    );
  };

  const badgeClass = (columnId: string) =>
    BUILTIN_BADGE[columnId] ?? CUSTOM_BADGE;

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-950/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Building2 className="h-5 w-5 text-indigo-400" />
              Configuración de Sede
            </CardTitle>
            <CardDescription className="text-slate-400">
              Gestiona la información de tu sede y el personal.
            </CardDescription>
          </div>
          {canConfigure ? (
            editSede ? (
              <Button size="sm" disabled={saving} onClick={() => void saveSedeProfile()}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Guardar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-200"
                onClick={() => {
                  setScheduleStart(profile.scheduleStart ?? '08:00');
                  setScheduleEnd(profile.scheduleEnd ?? '18:00');
                  setScheduleNightStart(profile.scheduleNightStart ?? '20:00');
                  setScheduleNightEnd(profile.scheduleNightEnd ?? '08:00');
                  setBukCode(profile.bukRecintoCode ?? '');
                  setEditSede(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-1" /> Editar Sede
              </Button>
            )
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-500 mb-1">Nombre de la Sede</p>
              <p className="text-lg font-semibold text-white">{sedeName}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:col-span-2">
              <p className="text-xs text-slate-500 mb-1">Horario</p>
              {editSede ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase text-slate-500 w-12">Día</span>
                    <Input type="time" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className="h-8 w-[110px] bg-slate-800 border-slate-700 text-white" />
                    <span className="text-slate-500">-</span>
                    <Input type="time" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} className="h-8 w-[110px] bg-slate-800 border-slate-700 text-white" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase text-slate-500 w-12">Noche</span>
                    <Input type="time" value={scheduleNightStart} onChange={(e) => setScheduleNightStart(e.target.value)} className="h-8 w-[110px] bg-slate-800 border-slate-700 text-white" />
                    <span className="text-slate-500">-</span>
                    <Input type="time" value={scheduleNightEnd} onChange={(e) => setScheduleNightEnd(e.target.value)} className="h-8 w-[110px] bg-slate-800 border-slate-700 text-white" />
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-white">
                  Día {profile.scheduleStart} - {profile.scheduleEnd}
                  <span className="text-slate-500 font-normal mx-2">·</span>
                  Noche {profile.scheduleNightStart ?? '20:00'} - {profile.scheduleNightEnd ?? '08:00'}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-500 mb-1">Personal Registrado</p>
              <p className="text-lg font-semibold text-white">{staff.length}</p>
            </div>
          </div>
          {editSede ? (
            <div className="mt-4 space-y-2">
              <Label className="text-slate-400 text-xs">Código recinto Buk</Label>
              <Input
                value={bukCode}
                onChange={(e) => setBukCode(e.target.value)}
                placeholder="Ej. Petmax o Petmax · Petmax Principal"
                className="max-w-md bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-[11px] text-slate-500">
                Puedes pegar el código solo (Petmax) o la etiqueta completa del diagnóstico.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canConfigure ? (
        <Card className="border-slate-800 bg-slate-950/80">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <LayoutGrid className="h-5 w-5 text-cyan-400" />
                Estructura del organigrama
              </CardTitle>
              <CardDescription className="text-slate-400">
                Agrega columnas, renómbralas, ordénalas y define la dotación Buk por cargo.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-200"
                onClick={() => setOrgDialogOpen(true)}
              >
                Dotación Buk
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={() => void saveOrgLayout()}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Guardar estructura
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {areaOrder.map((columnId, index) => {
                const builtin = isBuiltinOrgColumnId(columnId);
                const defaultLabel = builtin
                  ? ASISTENCIA_STAFF_AREA_LABELS[columnId]
                  : orgColumns.find((c) => c.id === columnId)?.label ?? columnId;
                return (
                  <div
                    key={columnId}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3"
                  >
                    <span className="text-xs text-slate-500 w-24 shrink-0">
                      Columna {index + 1}
                    </span>
                    <Input
                      value={areaLabels[columnId] ?? defaultLabel}
                      onChange={(e) =>
                        setAreaLabels((prev) => ({ ...prev, [columnId]: e.target.value }))
                      }
                      className="max-w-xs h-8 bg-slate-800 border-slate-700 text-white"
                    />
                    <span className="text-[10px] text-slate-500">
                      ({builtin ? 'built-in' : 'personalizada'})
                    </span>
                    <div className="ml-auto flex gap-1">
                      {!builtin ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                          onClick={() => void removeColumn(columnId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400"
                        disabled={index === 0}
                        onClick={() => moveArea(index, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400"
                        disabled={index === areaOrder.length - 1}
                        onClick={() => moveArea(index, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-3">
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label className="text-xs text-slate-400">Nueva columna</Label>
                <Input
                  value={newColumnLabel}
                  onChange={(e) => setNewColumnLabel(e.target.value)}
                  placeholder="Ej. Recepción, Laboratorio…"
                  className="h-8 bg-slate-800 border-slate-700 text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addColumn();
                  }}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-200"
                disabled={!newColumnLabel.trim() || saving}
                onClick={() => void addColumn()}
              >
                <Plus className="h-4 w-4 mr-1" /> Agregar columna
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="hide-empty-areas"
                checked={hideEmptyAreas}
                onCheckedChange={setHideEmptyAreas}
              />
              <Label htmlFor="hide-empty-areas" className="text-sm text-slate-300">
                Ocultar áreas sin personal en el organigrama en vivo
              </Label>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-800 bg-slate-950/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-violet-400" />
              Gestión de Personal
            </CardTitle>
            <CardDescription className="text-slate-400">
              Agrega y administra el personal de cada área. Los cargos disponibles dependen del área seleccionada.
            </CardDescription>
          </div>
          {canConfigure ? (
            <Button
              className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white border-0"
              data-testid="asistencia-add-staff"
              onClick={() => {
                setEditingStaff(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar Personal
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {orgColumns.map((col) => {
            const list = byColumn[col.id] ?? [];
            return (
              <div key={col.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass(col.id)}`}>
                    {col.label}
                  </span>
                  <span className="text-xs text-slate-500">{list.length} personas</span>
                </div>
                {list.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 py-8 text-center text-sm text-slate-500">
                    No hay personal asignado a esta área
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{member.fullName}</p>
                          <p className="text-xs text-slate-400">
                            {member.cargoLabel} · {member.expectedTime} ·{' '}
                            {ASISTENCIA_WORK_SHIFT_LABELS[member.shift ?? 'day']}
                          </p>
                          {member.isCritical ? (
                            <span className="text-[10px] text-amber-400">Puesto crítico</span>
                          ) : null}
                        </div>
                        {canConfigure ? (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-white"
                              onClick={() => {
                                setEditingStaff(member);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-400"
                              onClick={() => void removeStaff(member.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AsistenciaStaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sedeName={sedeName}
        sedeProfile={profile}
        orgColumns={orgColumns}
        initial={editingStaff}
        onSave={(member) => void upsertStaff(member)}
      />

      <AsistenciaOrgConfigDialog
        open={orgDialogOpen}
        onOpenChange={setOrgDialogOpen}
        settings={settings}
        sedeOptions={sedeOptions.length ? sedeOptions : [sedeName]}
        onSave={(next) => {
          void runSave(() => mergeAsistenciaSettings(next), 'Dotación Buk guardada.');
        }}
      />
    </div>
  );
}

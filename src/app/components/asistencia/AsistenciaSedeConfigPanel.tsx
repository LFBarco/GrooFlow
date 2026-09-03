import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, CornerDownRight, LayoutGrid, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';

import type { AsistenciaOrgSubColumn, AsistenciaSettings, AsistenciaStaffMember } from '../../types/asistencia';
import { ASISTENCIA_STAFF_AREA_LABELS, ASISTENCIA_WORK_SHIFT_LABELS } from '../../types/asistencia';
import { formatWeeklyShiftSummary } from '../../utils/asistenciaShift';
import { getSedeProfile, staffForSede } from '../../utils/asistenciaStaff';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { mergeExampleStaffIntoSettings } from '../../utils/asistenciaExampleSeed';
import {
  applyAddOrgColumn,
  applyAddOrgSubColumn,
  applyOrgColumnLabels,
  applyRemoveOrgColumn,
  applyRemoveOrgSubColumn,
  cargosForOrgColumn,
  cargoListToText,
  isBuiltinOrgColumnId,
  parseCargoListText,
  resolveOrgColumns,
  resolveOrgSubColumns,
} from '../../utils/asistenciaOrgColumns';
import { Textarea } from '../ui/textarea';
import { AsistenciaOrgConfigDialog } from './AsistenciaOrgConfigDialog';
import { AsistenciaOrgChartEditor } from './AsistenciaOrgChartEditor';
import { AsistenciaStaffDialog } from './AsistenciaStaffDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { appAlert, appConfirm } from '../ui/app-dialog';

const BUILTIN_BADGE: Record<string, string> = {
  administracion:
    'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-500/30',
  medica:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
  peluqueria:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30',
};

const CUSTOM_BADGE =
  'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30';

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
  const [scheduleTolerance, setScheduleTolerance] = useState(
    String(profile.scheduleToleranceMinutes ?? 10)
  );
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
  const [cargoByColumnText, setCargoByColumnText] = useState<Record<string, string>>(() => {
    const cols = resolveOrgColumns(profile);
    return Object.fromEntries(
      cols.map((c) => [
        c.id,
        cargoListToText(cargosForOrgColumn(profile, c.id)),
      ])
    );
  });
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newSubColumnByParent, setNewSubColumnByParent] = useState<Record<string, string>>({});

  const syncOrgFormFromProfile = (p = profile) => {
    const cols = resolveOrgColumns(p);
    setAreaOrder(cols.map((c) => c.id));
    const labels: Record<string, string> = {};
    for (const col of cols) labels[col.id] = col.label;
    for (const sub of p.subOrgColumns ?? []) {
      labels[sub.id] = p.areaLabels?.[sub.id]?.trim() || sub.label;
    }
    setAreaLabels(labels);
    setHideEmptyAreas(p.hideEmptyAreas ?? false);
    setCargoByColumnText(
      Object.fromEntries(
        cols.flatMap((c) => {
          const entries: [string, string][] = [
            [c.id, cargoListToText(cargosForOrgColumn(p, c.id))],
          ];
          for (const sub of resolveOrgSubColumns(p, c.id)) {
            entries.push([sub.id, cargoListToText(cargosForOrgColumn(p, sub.id))]);
          }
          return entries;
        })
      )
    );
  };

  useEffect(() => {
    syncOrgFormFromProfile(profile);
  }, [
    sedeName,
    profile.areaOrder,
    profile.customOrgColumns,
    profile.subOrgColumns,
    profile.areaLabels,
    profile.cargoByColumn,
    profile.hideEmptyAreas,
  ]);

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
    for (const col of orgColumns) {
      map[col.id] = [];
      for (const sub of resolveOrgSubColumns(profile, col.id)) map[sub.id] = [];
    }
    for (const s of staff) {
      if (!map[s.area]) map[s.area] = [];
      map[s.area]!.push(s);
    }
    return map;
  }, [staff, orgColumns, profile.subOrgColumns]);

  const staffSections = useMemo(() => {
    const sections: { id: string; label: string; parentId: string; parentLabel?: string }[] = [];
    for (const col of orgColumns) {
      sections.push({ id: col.id, label: areaLabels[col.id] ?? col.label, parentId: col.id });
      for (const sub of resolveOrgSubColumns(profile, col.id)) {
        sections.push({
          id: sub.id,
          label: areaLabels[sub.id]?.trim() || sub.label,
          parentId: col.id,
          parentLabel: areaLabels[col.id] ?? col.label,
        });
      }
    }
    return sections;
  }, [orgColumns, profile.subOrgColumns, areaLabels]);

  const saveSedeProfile = async () => {
    const tolerance = Math.max(0, Math.min(120, Number(scheduleTolerance) || 10));
    const ok = await runSave((prev) => {
      const rest = (prev.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName);
      const mappings = (prev.sedeMappings ?? []).filter((m) => m.sedeName !== sedeName);
      return mergeAsistenciaSettings({
        ...prev,
        sedeProfiles: [
          ...rest,
          {
            ...profile,
            sedeName,
            scheduleStart,
            scheduleEnd,
            scheduleNightStart,
            scheduleNightEnd,
            scheduleToleranceMinutes: tolerance,
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
    const allAreaIds = [
      ...areaOrder,
      ...(profile.subOrgColumns ?? []).map((s) => s.id),
    ];
    const cargoByColumn = Object.fromEntries(
      allAreaIds.map((columnId) => {
        const text =
          cargoByColumnText[columnId] ?? cargoListToText(cargosForOrgColumn(profile, columnId));
        const cargos = parseCargoListText(text);
        const fallback = cargosForOrgColumn({ ...profile, cargoByColumn: undefined }, columnId);
        return [columnId, cargos.length > 0 ? cargos : fallback] as const;
      })
    );
    const subOrgColumns: AsistenciaOrgSubColumn[] = (profile.subOrgColumns ?? []).map((sub) => ({
      ...sub,
      label: areaLabels[sub.id]?.trim() || sub.label,
    }));
    const ok = await runSave(
      (prev) =>
        applyOrgColumnLabels(
          prev,
          sedeName,
          areaLabels,
          areaOrder,
          hideEmptyAreas,
          cargoByColumn,
          subOrgColumns
        ),
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
    if (ok) setNewColumnLabel('');
  };

  const addSubColumn = async (parentColumnId: string) => {
    const label = (newSubColumnByParent[parentColumnId] ?? '').trim();
    if (!label) return;
    const ok = await runSave(
      (prev) => applyAddOrgSubColumn(prev, sedeName, parentColumnId, label),
      'Subcolumna agregada.'
    );
    if (ok) {
      setNewSubColumnByParent((prev) => ({ ...prev, [parentColumnId]: '' }));
    }
  };

  const removeSubColumn = async (subColumnId: string) => {
    if (!await appConfirm('¿Eliminar esta subcolumna? El personal pasará a la columna principal.')) return;
    await runSave(
      (prev) => applyRemoveOrgSubColumn(prev, sedeName, subColumnId),
      'Subcolumna eliminada.'
    );
  };

  const removeColumn = async (columnId: string) => {
    if (isBuiltinOrgColumnId(columnId)) return;
    if (!await appConfirm('¿Eliminar esta columna del organigrama? El personal se moverá a Administración.')) return;
    await runSave(
      (prev) => applyRemoveOrgColumn(prev, sedeName, columnId),
      'Columna eliminada.'
    );
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
    if (!await appConfirm('¿Eliminar este miembro del personal?')) return;
    await runSave(
      (prev) =>
        mergeAsistenciaSettings({
          ...prev,
          staff: (prev.staff ?? []).filter((s) => s.id !== id),
        }),
      'Personal eliminado.'
    );
  };

  const loadExampleStaff = async () => {
    await runSave(
      (prev) => mergeExampleStaffIntoSettings(prev, sedeName, { replaceSede: true }),
      'Personal de ejemplo cargado.'
    );
  };

  const badgeClass = (columnId: string) =>
    BUILTIN_BADGE[columnId] ?? CUSTOM_BADGE;

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card dark:border-slate-800 dark:bg-slate-950/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
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
                className="border-border text-foreground dark:border-slate-600 dark:text-slate-200"
                onClick={() => {
                  setScheduleStart(profile.scheduleStart ?? '08:00');
                  setScheduleEnd(profile.scheduleEnd ?? '18:00');
                  setScheduleNightStart(profile.scheduleNightStart ?? '20:00');
                  setScheduleNightEnd(profile.scheduleNightEnd ?? '08:00');
                  setScheduleTolerance(String(profile.scheduleToleranceMinutes ?? 10));
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
            <div className="rounded-xl border border-border bg-muted/40 dark:border-slate-800 dark:bg-slate-900/50 p-4">
              <p className="text-xs text-muted-foreground mb-1">Nombre de la Sede</p>
              <p className="text-lg font-semibold text-foreground">{sedeName}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 dark:border-slate-800 dark:bg-slate-900/50 p-4 sm:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Horario</p>
              {editSede ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase text-slate-500 w-12">Día</span>
                    <Input type="time" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className="h-8 w-[110px] bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                    <span className="text-slate-500">-</span>
                    <Input type="time" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} className="h-8 w-[110px] bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase text-slate-500 w-12">Noche</span>
                    <Input type="time" value={scheduleNightStart} onChange={(e) => setScheduleNightStart(e.target.value)} className="h-8 w-[110px] bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                    <span className="text-slate-500">-</span>
                    <Input type="time" value={scheduleNightEnd} onChange={(e) => setScheduleNightEnd(e.target.value)} className="h-8 w-[110px] bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase text-slate-500 w-12">Tol.</span>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      value={scheduleTolerance}
                      onChange={(e) => setScheduleTolerance(e.target.value)}
                      className="h-8 w-[72px] bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                    <span className="text-xs text-muted-foreground">min después de entrada turno día (ej. 08:00 + 10 = hasta 08:10)</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-foreground">
                  Día {profile.scheduleStart} - {profile.scheduleEnd}
                  <span className="text-slate-500 font-normal mx-2">·</span>
                  Noche {profile.scheduleNightStart ?? '20:00'} - {profile.scheduleNightEnd ?? '08:00'}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-muted/40 dark:border-slate-800 dark:bg-slate-900/50 p-4">
              <p className="text-xs text-muted-foreground mb-1">Personal Registrado</p>
              <p className="text-lg font-semibold text-foreground">{staff.length}</p>
            </div>
          </div>
          {editSede ? (
            <div className="mt-4 space-y-2">
              <Label className="text-slate-400 text-xs">Código recinto Buk</Label>
              <Input
                value={bukCode}
                onChange={(e) => setBukCode(e.target.value)}
                placeholder="Ej. Petmax o Petmax · Petmax Principal"
                className="max-w-md bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <p className="text-[11px] text-slate-500">
                Puedes pegar el código solo (Petmax) o la etiqueta completa del diagnóstico.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canConfigure ? (
        <Card className="border-border bg-card dark:border-slate-800 dark:bg-slate-950/80">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <LayoutGrid className="h-5 w-5 text-cyan-400" />
                Estructura del organigrama
              </CardTitle>
              <CardDescription className="text-slate-400">
                Agrega columnas y subcolumnas, renómbralas, ordénalas y define cargos por área.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-border text-foreground dark:border-slate-600 dark:text-slate-200"
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
                    className="rounded-xl border border-border bg-muted/40 dark:border-slate-800 dark:bg-slate-900/50 p-3 space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">
                      Columna {index + 1}
                    </span>
                    <Input
                      value={areaLabels[columnId] ?? defaultLabel}
                      onChange={(e) =>
                        setAreaLabels((prev) => ({ ...prev, [columnId]: e.target.value }))
                      }
                      className="max-w-xs h-8 bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white"
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
                    <div className="space-y-1.5 pl-0 sm:pl-24">
                      <Label className="text-xs text-muted-foreground">Cargos visibles en esta área</Label>
                      <Textarea
                        value={
                          cargoByColumnText[columnId] ??
                          cargoListToText(cargosForOrgColumn(profile, columnId))
                        }
                        onChange={(e) =>
                          setCargoByColumnText((prev) => ({ ...prev, [columnId]: e.target.value }))
                        }
                        placeholder={'Un cargo por línea\nEj. Médico veterinario\nAsistente veterinario'}
                        rows={3}
                        className="text-sm bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white resize-y min-h-[72px]"
                      />
                      <p className="text-[10px] text-slate-500">
                        Estos cargos aparecen al agregar personal y en el organigrama en vivo.
                      </p>
                    </div>

                    <div className="space-y-2 pl-0 sm:pl-24 border-t border-border/60 pt-3 dark:border-slate-800">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <CornerDownRight className="h-3 w-3" />
                        Subcolumnas (divisiones dentro de esta área)
                      </Label>
                      {resolveOrgSubColumns(profile, columnId).map((sub) => (
                        <div
                          key={sub.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-background/60 p-2 dark:border-slate-700 dark:bg-slate-900/40"
                        >
                          <Input
                            value={areaLabels[sub.id] ?? sub.label}
                            onChange={(e) =>
                              setAreaLabels((prev) => ({ ...prev, [sub.id]: e.target.value }))
                            }
                            placeholder="Nombre subcolumna"
                            className="h-8 max-w-xs bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-400"
                            onClick={() => void removeSubColumn(sub.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex flex-wrap items-end gap-2">
                        <Input
                          value={newSubColumnByParent[columnId] ?? ''}
                          onChange={(e) =>
                            setNewSubColumnByParent((prev) => ({
                              ...prev,
                              [columnId]: e.target.value,
                            }))
                          }
                          placeholder="Ej. Recepción, Triaje, Quirófano…"
                          className="h-8 max-w-xs bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void addSubColumn(columnId);
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!(newSubColumnByParent[columnId] ?? '').trim() || saving}
                          onClick={() => void addSubColumn(columnId)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Subcolumna
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border bg-muted/30 dark:border-slate-700 dark:bg-slate-900/30 p-3">
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label className="text-xs text-muted-foreground">Nueva columna</Label>
                <Input
                  value={newColumnLabel}
                  onChange={(e) => setNewColumnLabel(e.target.value)}
                  placeholder="Ej. Recepción, Laboratorio…"
                  className="h-8 bg-background border-border text-foreground dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addColumn();
                  }}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-border text-foreground dark:border-slate-600 dark:text-slate-200"
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
              <Label htmlFor="hide-empty-areas" className="text-sm text-muted-foreground">
                Ocultar áreas sin personal en el organigrama en vivo
              </Label>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canConfigure ? (
        <AsistenciaOrgChartEditor
          sedeName={sedeName}
          settings={settings}
          canConfigure={canConfigure}
          onSave={onSave}
        />
      ) : null}

      <Card className="border-border bg-card dark:border-slate-800 dark:bg-slate-950/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-violet-400" />
              Gestión de Personal
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Agrega y administra el personal de cada área. Los cargos disponibles dependen del área seleccionada.
            </CardDescription>
          </div>
          {canConfigure ? (
            <div className="flex flex-wrap gap-2 justify-end">
              {staff.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-border"
                  data-testid="asistencia-load-example-staff"
                  disabled={saving}
                  onClick={() => void loadExampleStaff()}
                >
                  Cargar ejemplo
                </Button>
              ) : null}
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
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {staffSections.map((section) => {
            const list = byColumn[section.id] ?? [];
            return (
              <div key={section.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass(section.parentId)}`}>
                    {section.parentLabel ? `${section.parentLabel} › ${section.label}` : section.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{list.length} personas</span>
                </div>
                {list.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 dark:border-slate-700 dark:bg-slate-900/30 py-8 text-center text-sm text-muted-foreground">
                    No hay personal asignado a esta área
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 dark:border-slate-800 dark:bg-slate-900/50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{member.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.cargoLabel} · {member.expectedTime} ·{' '}
                            {formatWeeklyShiftSummary(member) ??
                              ASISTENCIA_WORK_SHIFT_LABELS[member.shift ?? 'day']}
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
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
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

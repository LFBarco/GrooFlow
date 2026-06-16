import { useMemo, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';

import type { AsistenciaSettings, AsistenciaStaffArea, AsistenciaStaffMember } from '../../types/asistencia';
import { ASISTENCIA_STAFF_AREA_LABELS, ASISTENCIA_STAFF_AREAS } from '../../types/asistencia';
import { getSedeProfile, staffForSede } from '../../utils/asistenciaStaff';
import { mergeAsistenciaSettings } from '../../utils/asistenciaData';
import { AsistenciaStaffDialog } from './AsistenciaStaffDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const AREA_BADGE: Record<AsistenciaStaffArea, string> = {
  administracion: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
  medica: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  peluqueria: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
};

type Props = {
  sedeName: string;
  settings: AsistenciaSettings;
  canConfigure: boolean;
  onSave: (
    updater: (prev: AsistenciaSettings) => AsistenciaSettings,
    successMessage?: string
  ) => Promise<boolean>;
};

export function AsistenciaSedeConfigPanel({ sedeName, settings, canConfigure, onSave }: Props) {
  const profile = getSedeProfile(settings, sedeName);
  const staff = staffForSede(settings, sedeName);
  const [editSede, setEditSede] = useState(false);
  const [scheduleStart, setScheduleStart] = useState(profile.scheduleStart ?? '08:00');
  const [scheduleEnd, setScheduleEnd] = useState(profile.scheduleEnd ?? '18:00');
  const [bukCode, setBukCode] = useState(profile.bukRecintoCode ?? '');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<AsistenciaStaffMember | null>(null);
  const [saving, setSaving] = useState(false);

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

  const byArea = useMemo(() => {
    const map: Record<AsistenciaStaffArea, AsistenciaStaffMember[]> = {
      administracion: [],
      medica: [],
      peluqueria: [],
    };
    for (const s of staff) map[s.area].push(s);
    return map;
  }, [staff]);

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
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-500 mb-1">Horario</p>
              {editSede ? (
                <div className="flex items-center gap-2">
                  <Input type="time" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className="h-8 bg-slate-800 border-slate-700 text-white" />
                  <span className="text-slate-500">-</span>
                  <Input type="time" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} className="h-8 bg-slate-800 border-slate-700 text-white" />
                </div>
              ) : (
                <p className="text-lg font-semibold text-white">{profile.scheduleStart} - {profile.scheduleEnd}</p>
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

      <Card className="border-slate-800 bg-slate-950/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-violet-400" />
              Gestión de Personal
            </CardTitle>
            <CardDescription className="text-slate-400">
              Agrega y administra el personal de cada área.
            </CardDescription>
          </div>
          {canConfigure ? (
            <Button
              className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white border-0"
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
          {ASISTENCIA_STAFF_AREAS.map((area) => {
            const list = byArea[area];
            return (
              <div key={area} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${AREA_BADGE[area]}`}>
                    {ASISTENCIA_STAFF_AREA_LABELS[area]}
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
                          <p className="text-xs text-slate-400">{member.cargoLabel} · {member.expectedTime}</p>
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
        initial={editingStaff}
        onSave={(member) => void upsertStaff(member)}
      />
    </div>
  );
}

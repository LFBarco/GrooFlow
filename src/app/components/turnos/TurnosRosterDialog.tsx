import { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';

import type { TurnosRosterEntry, TurnosSettings } from '../../types/turnos';
import { VET_WORK_AREAS } from '../../types/accidentes';
import { removeRosterEntry, upsertManualRosterEntry } from '../../utils/turnosData';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: TurnosSettings;
  sedeOptions: string[];
  canEdit: boolean;
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings, message?: string) => void;
};

export function TurnosRosterDialog({
  open,
  onOpenChange,
  settings,
  sedeOptions,
  canEdit,
  onUpdate,
}: Props) {
  const [editing, setEditing] = useState<TurnosRosterEntry | null>(null);
  const [fullName, setFullName] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [workArea, setWorkArea] = useState<string>(VET_WORK_AREAS[0]);
  const [homeSede, setHomeSede] = useState(sedeOptions[0] ?? 'Principal');
  const [initials, setInitials] = useState('');

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setFullName('');
      setRoleLabel('');
      setWorkArea(VET_WORK_AREAS[0]);
      setHomeSede(sedeOptions[0] ?? 'Principal');
      setInitials('');
    }
  }, [open, sedeOptions]);

  const startEdit = (entry: TurnosRosterEntry) => {
    if (entry.source !== 'manual') return;
    setEditing(entry);
    setFullName(entry.fullName);
    setRoleLabel(entry.roleLabel);
    setWorkArea(entry.workArea || VET_WORK_AREAS[0]);
    setHomeSede(entry.homeSede);
    setInitials(entry.initials);
  };

  const saveManual = () => {
    if (!fullName.trim()) return;
    onUpdate(
      (prev) =>
        upsertManualRosterEntry(prev, {
          id: editing?.id,
          fullName: fullName.trim(),
          roleLabel: roleLabel.trim() || 'Personal',
          workArea,
          homeSede,
          initials: initials.trim(),
        }),
      editing ? 'Personal actualizado.' : 'Personal agregado al roster.'
    );
    setEditing(null);
    setFullName('');
    setRoleLabel('');
    setWorkArea(VET_WORK_AREAS[0]);
    setInitials('');
  };

  const removeManual = (id: string) => {
    onUpdate((prev) => removeRosterEntry(prev, id), 'Personal eliminado del roster.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Personal del roster</DialogTitle>
          <DialogDescription>
            Sincronizado con usuarios del sistema y personal de asistencia. Puedes agregar externos manualmente.
          </DialogDescription>
        </DialogHeader>

        {canEdit ? (
          <div className="space-y-3 rounded-lg border border-border p-3 dark:border-slate-700">
            <p className="text-sm font-medium">{editing ? 'Editar manual' : 'Agregar manual'}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="turnos-roster-name">Nombre completo</Label>
                <Input
                  id="turnos-roster-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Carlos Mendoza"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="turnos-roster-role">Cargo</Label>
                <Input
                  id="turnos-roster-role"
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  placeholder="Counter"
                />
              </div>
              <div className="space-y-1">
                <Label>Área</Label>
                <Select value={workArea} onValueChange={setWorkArea}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VET_WORK_AREAS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Sede habitual</Label>
                <Select value={homeSede} onValueChange={setHomeSede}>
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
                <Label htmlFor="turnos-roster-initials">Iniciales (opcional)</Label>
                <Input
                  id="turnos-roster-initials"
                  value={initials}
                  onChange={(e) => setInitials(e.target.value)}
                  maxLength={3}
                  placeholder="CM"
                />
              </div>
            </div>
            <Button type="button" onClick={saveManual} disabled={!fullName.trim()}>
              <UserPlus className="mr-1 h-4 w-4" />
              {editing ? 'Guardar cambios' : 'Agregar al roster'}
            </Button>
          </div>
        ) : null}

        <ul className="max-h-[320px] space-y-2 overflow-y-auto">
          {settings.roster.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entry.fullName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {entry.roleLabel}
                  {entry.workArea ? ` · ${entry.workArea}` : ''}
                  {' · '}
                  {entry.homeSede}
                  {entry.source !== 'manual' ? ` · ${entry.source}` : ''}
                </p>
              </div>
              {canEdit && entry.source === 'manual' ? (
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(entry)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => removeManual(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { BookmarkPlus, Trash2 } from 'lucide-react';

import type { TurnosRosterEntry, TurnosSettings } from '../../types/turnos';
import {
  applyTemplateToWeek,
  deleteTemplate,
  saveWeekAsTemplate,
} from '../../utils/turnosTemplates';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type Props = {
  settings: TurnosSettings;
  roster: TurnosRosterEntry[];
  dateKeys: string[];
  workSede: string;
  canEdit: boolean;
  currentUserName?: string;
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings, message?: string) => void;
};

export function TurnosTemplatesDialog({
  settings,
  roster,
  dateKeys,
  workSede,
  canEdit,
  currentUserName,
  onUpdate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const templates = settings.templates ?? [];

  if (!canEdit) return null;

  const saveCurrent = () => {
    if (!name.trim()) return;
    onUpdate(
      (prev) =>
        saveWeekAsTemplate(prev, {
          name: name.trim(),
          sede: workSede !== 'Todas' ? workSede : undefined,
          dateKeys,
          staffIds: roster.map((r) => r.id),
          workSede,
        }, currentUserName),
      'Plantilla guardada.'
    );
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BookmarkPlus className="mr-1 h-4 w-4" />
          Plantillas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plantillas de semana</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Guardar semana actual</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nombre de plantilla…"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button type="button" onClick={saveCurrent} disabled={!name.trim()}>
                Guardar
              </Button>
            </div>
          </div>
          {templates.length > 0 ? (
            <ul className="max-h-[240px] space-y-2 overflow-y-auto text-sm">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 dark:border-slate-700"
                >
                  <div>
                    <p className="font-medium">{t.name}</p>
                    {t.sede ? (
                      <p className="text-xs text-muted-foreground">{t.sede}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onUpdate(
                          (prev) =>
                            applyTemplateToWeek(prev, t.id, dateKeys, workSede, currentUserName),
                          `Plantilla "${t.name}" aplicada.`
                        );
                        setOpen(false);
                      }}
                    >
                      Aplicar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onUpdate((prev) => deleteTemplate(prev, t.id), 'Plantilla eliminada.')
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay plantillas guardadas.</p>
          )}
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}

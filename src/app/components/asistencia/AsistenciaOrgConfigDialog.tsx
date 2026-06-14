import { useMemo, useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import type {
  AsistenciaAreaGroup,
  AsistenciaOrgRequirement,
  AsistenciaSettings,
} from '../../types/asistencia';
import { ASISTENCIA_AREA_GROUP_LABELS } from '../../types/asistencia';
import { buildDefaultRequirementsForSede } from '../../utils/asistenciaData';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AsistenciaSettings;
  sedeOptions: string[];
  onSave: (next: AsistenciaSettings) => void;
};

function newId() {
  return `req_${Math.random().toString(36).slice(2, 9)}`;
}

export function AsistenciaOrgConfigDialog({
  open,
  onOpenChange,
  settings,
  sedeOptions,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<AsistenciaSettings>(settings);

  const syncDraft = () => setDraft({ ...settings, requirements: [...settings.requirements] });

  const patchReq = (id: string, patch: Partial<AsistenciaOrgRequirement>) => {
    setDraft((d) => ({
      ...d,
      requirements: d.requirements.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const addRow = () => {
    const sede = sedeOptions[0] ?? 'Principal';
    setDraft((d) => ({
      ...d,
      requirements: [
        ...d.requirements,
        {
          id: newId(),
          sedeName: sede,
          areaGroup: 'medica' as AsistenciaAreaGroup,
          cargoLabel: 'Nuevo cargo',
          requiredCount: 1,
          sortOrder: d.requirements.length + 1,
        },
      ],
    }));
  };

  const seedSede = (sedeName: string) => {
    const mapping = draft.sedeMappings?.find((m) => m.sedeName === sedeName);
    const seeded = buildDefaultRequirementsForSede(sedeName, mapping?.bukRecintoCode);
    setDraft((d) => ({
      ...d,
      requirements: [...d.requirements.filter((r) => r.sedeName !== sedeName), ...seeded],
    }));
    toast.success(`Plantilla aplicada para ${sedeName}.`);
  };

  const handleSave = () => {
    const clean = draft.requirements.filter((r) => r.cargoLabel.trim() && r.sedeName.trim());
    if (clean.length === 0) {
      toast.error('Agrega al menos un cargo en la estructura.');
      return;
    }
    onSave({ ...draft, requirements: clean });
    onOpenChange(false);
    toast.success('Estructura organizacional guardada.');
  };

  const groupedSedes = useMemo(() => {
    const fromReqs = [...new Set(draft.requirements.map((r) => r.sedeName))];
    return [...new Set([...sedeOptions, ...fromReqs])];
  }, [draft.requirements, sedeOptions]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) syncDraft();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estructura organizacional — dotación por sede</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <Label className="text-sm font-medium">Mapeo sede GooFlow → recinto Buk</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {groupedSedes.map((sede) => {
                const map = draft.sedeMappings?.find((m) => m.sedeName === sede);
                return (
                  <div key={sede} className="flex gap-2 items-center">
                    <span className="text-sm w-28 shrink-0 truncate" title={sede}>{sede}</span>
                    <Input
                      placeholder="Código Buk (ej. Petmax)"
                      value={map?.bukRecintoCode ?? ''}
                      onChange={(e) => {
                        const code = e.target.value;
                        setDraft((d) => {
                          const rest = (d.sedeMappings ?? []).filter((m) => m.sedeName !== sede);
                          if (!code.trim()) return { ...d, sedeMappings: rest };
                          return {
                            ...d,
                            sedeMappings: [...rest, { sedeName: sede, bukRecintoCode: code.trim() }],
                          };
                        });
                      }}
                      className="h-8"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => seedSede(sede)} title="Plantilla">
                      <Wand2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Define cuántas personas deben estar presentes por sede, área y cargo. El panel compara con Buk Asistencia.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Cargo
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sede</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Match área Buk</TableHead>
                <TableHead>Match especialidad</TableHead>
                <TableHead className="w-[80px]">Req.</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.requirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Sin cargos configurados. Usa «Plantilla» por sede o «+ Cargo».
                  </TableCell>
                </TableRow>
              ) : (
                draft.requirements.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Select value={r.sedeName} onValueChange={(v) => patchReq(r.id, { sedeName: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {groupedSedes.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.areaGroup}
                        onValueChange={(v) => patchReq(r.id, { areaGroup: v as AsistenciaAreaGroup })}
                      >
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ASISTENCIA_AREA_GROUP_LABELS) as AsistenciaAreaGroup[]).map((k) => (
                            <SelectItem key={k} value={k}>{ASISTENCIA_AREA_GROUP_LABELS[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        value={r.cargoLabel}
                        onChange={(e) => patchReq(r.id, { cargoLabel: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        placeholder="Ej. MEDICOS VET"
                        value={r.matchArea ?? ''}
                        onChange={(e) => patchReq(r.id, { matchArea: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        placeholder="Opcional"
                        value={r.matchSpecialty ?? ''}
                        onChange={(e) => patchReq(r.id, { matchSpecialty: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        className="h-8"
                        value={r.requiredCount}
                        onChange={(e) =>
                          patchReq(r.id, { requiredCount: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            requirements: d.requirements.filter((x) => x.id !== r.id),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar estructura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

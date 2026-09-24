import { useMemo, useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import type {
  AsistenciaAreaGroup,
  AsistenciaCostCenterSedeMapping,
  AsistenciaDispositivoSedeMapping,
  AsistenciaOrgRequirement,
  AsistenciaSettings,
} from '../../types/asistencia';
import { ASISTENCIA_AREA_GROUP_LABELS } from '../../types/asistencia';
import { buildDefaultRequirementsForSede } from '../../utils/asistenciaData';
import { DEFAULT_BUK_PE_COST_CENTER_SEDES } from '../../utils/asistenciaSedeOperativa';
import { DEFAULT_DISPOSITIVO_SEDES } from '../../utils/bukAsistenciaRegistro';
import { syncBukRecintoCodeInSettings } from '../../utils/asistenciaStaffSync';
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

/** Fuente única de código huellero/obra_id: perfil de sede → sedeMappings. */
function sedeMappingsFromProfiles(settings: AsistenciaSettings) {
  const fromProfiles = (settings.sedeProfiles ?? [])
    .filter((p) => p.sedeName?.trim() && p.bukRecintoCode?.trim())
    .map((p) => ({
      sedeName: p.sedeName.trim(),
      bukRecintoCode: p.bukRecintoCode!.trim(),
    }));
  if (fromProfiles.length > 0) return fromProfiles;
  return [...(settings.sedeMappings ?? [])];
}

function buildDraft(settings: AsistenciaSettings): AsistenciaSettings {
  return {
    ...settings,
    requirements: [...settings.requirements],
    costCenterSedeMappings: [...(settings.costCenterSedeMappings ?? [])],
    dispositivoSedeMappings: [...(settings.dispositivoSedeMappings ?? [])],
    sedeMappings: sedeMappingsFromProfiles(settings),
  };
}

export function AsistenciaOrgConfigDialog({
  open,
  onOpenChange,
  settings,
  sedeOptions,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<AsistenciaSettings>(() => buildDraft(settings));

  const syncDraft = () => setDraft(buildDraft(settings));

  const patchReq = (id: string, patch: Partial<AsistenciaOrgRequirement>) => {
    setDraft((d) => ({
      ...d,
      requirements: d.requirements.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const ccRows = draft.costCenterSedeMappings ?? [];
  const deviceRows = draft.dispositivoSedeMappings ?? [];

  const patchCc = (index: number, patch: Partial<AsistenciaCostCenterSedeMapping>) => {
    setDraft((d) => {
      const rows = [...(d.costCenterSedeMappings ?? [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...d, costCenterSedeMappings: rows };
    });
  };

  const addCcRow = () => {
    setDraft((d) => ({
      ...d,
      costCenterSedeMappings: [
        ...(d.costCenterSedeMappings ?? []),
        { costCenterCode: '', sedeName: sedeOptions[0] ?? '' },
      ],
    }));
  };

  const removeCcRow = (index: number) => {
    setDraft((d) => ({
      ...d,
      costCenterSedeMappings: (d.costCenterSedeMappings ?? []).filter((_, i) => i !== index),
    }));
  };

  const seedDefaultCostCenters = () => {
    const rows: AsistenciaCostCenterSedeMapping[] = Object.entries(DEFAULT_BUK_PE_COST_CENTER_SEDES).map(
      ([costCenterCode, sedeName]) => ({ costCenterCode, sedeName })
    );
    setDraft((d) => ({ ...d, costCenterSedeMappings: rows }));
    toast.success('Mapa default CC → sede cargado (puedes editarlo).');
  };

  const patchDevice = (index: number, patch: Partial<AsistenciaDispositivoSedeMapping>) => {
    setDraft((d) => {
      const rows = [...(d.dispositivoSedeMappings ?? [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...d, dispositivoSedeMappings: rows };
    });
  };

  const addDeviceRow = () => {
    setDraft((d) => ({
      ...d,
      dispositivoSedeMappings: [
        ...(d.dispositivoSedeMappings ?? []),
        { dispositivoId: '', sedeName: sedeOptions[0] ?? '' },
      ],
    }));
  };

  const removeDeviceRow = (index: number) => {
    setDraft((d) => ({
      ...d,
      dispositivoSedeMappings: (d.dispositivoSedeMappings ?? []).filter((_, i) => i !== index),
    }));
  };

  const seedDefaultDevices = () => {
    const rows: AsistenciaDispositivoSedeMapping[] = Object.entries(DEFAULT_DISPOSITIVO_SEDES).map(
      ([dispositivoId, sedeName]) => ({ dispositivoId, sedeName })
    );
    setDraft((d) => ({ ...d, dispositivoSedeMappings: rows }));
    toast.success('Mapa default dispositivo → sede cargado (puedes editarlo).');
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
    const profileCode = draft.sedeProfiles?.find((p) => p.sedeName === sedeName)?.bukRecintoCode;
    const seeded = buildDefaultRequirementsForSede(
      sedeName,
      mapping?.bukRecintoCode ?? profileCode
    );
    setDraft((d) => ({
      ...d,
      requirements: [...d.requirements.filter((r) => r.sedeName !== sedeName), ...seeded],
    }));
    toast.success(`Plantilla aplicada para ${sedeName}.`);
  };

  const groupedSedes = useMemo(() => {
    const fromReqs = [...new Set(draft.requirements.map((r) => r.sedeName))];
    return [...new Set([...sedeOptions, ...fromReqs])];
  }, [draft.requirements, sedeOptions]);

  const handleSave = () => {
    const clean = draft.requirements.filter((r) => r.cargoLabel.trim() && r.sedeName.trim());
    if (clean.length === 0) {
      toast.error('Agrega al menos un cargo en la estructura.');
      return;
    }
    const cleanCc = (draft.costCenterSedeMappings ?? []).filter(
      (r) => r.costCenterCode.trim() && r.sedeName.trim()
    );
    const cleanDevices = (draft.dispositivoSedeMappings ?? []).filter(
      (r) => r.dispositivoId.trim() && r.sedeName.trim()
    );
    let next: AsistenciaSettings = {
      ...draft,
      requirements: clean,
      costCenterSedeMappings: cleanCc,
      dispositivoSedeMappings: cleanDevices,
    };
    // Alinear perfil ↔ mapeo (perfil es la fuente canónica al reabrir).
    for (const m of next.sedeMappings ?? []) {
      next = syncBukRecintoCodeInSettings(next, m.sedeName, m.bukRecintoCode);
    }
    for (const sede of groupedSedes) {
      const stillMapped = (next.sedeMappings ?? []).some((m) => m.sedeName === sede);
      if (!stillMapped) {
        const profileCode = next.sedeProfiles?.find((p) => p.sedeName === sede)?.bukRecintoCode;
        if (profileCode) {
          next = syncBukRecintoCodeInSettings(next, sede, undefined);
        }
      }
    }
    onSave(next);
    onOpenChange(false);
    toast.success('Estructura organizacional guardada.');
  };

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
          <DialogTitle>Estructura organizacional — plantilla por sede</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <Label className="text-sm font-medium">
              ID dispositivo UDP/SPK (o obra_id) por sede
            </Label>
            <p className="text-xs text-muted-foreground">
              Código del huellero Ctrlit vinculado a cada sede. Preferible el ID de dispositivo
              (UDP…/SPK…); también acepta obra_id numérico. Quien marca ahí aparece en esa sede del
              organigrama del día. Se guarda en el perfil de la sede (una sola fuente).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {groupedSedes.map((sede) => {
                const map = draft.sedeMappings?.find((m) => m.sedeName === sede);
                return (
                  <div key={sede} className="flex gap-2 items-center">
                    <span className="text-sm w-28 shrink-0 truncate" title={sede}>
                      {sede}
                    </span>
                    <Input
                      placeholder="UDP… / SPK… / obra_id"
                      value={map?.bukRecintoCode ?? ''}
                      onChange={(e) => {
                        const code = e.target.value;
                        setDraft((d) => {
                          const rest = (d.sedeMappings ?? []).filter((m) => m.sedeName !== sede);
                          if (!code.trim()) return { ...d, sedeMappings: rest };
                          return {
                            ...d,
                            sedeMappings: [
                              ...rest,
                              { sedeName: sede, bukRecintoCode: code.trim() },
                            ],
                          };
                        });
                      }}
                      className="h-8 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => seedSede(sede)}
                      title="Plantilla de cargos"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className="text-sm font-medium">Dispositivo huellero → sede del día</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mapa del campo <code className="text-[10px]">dispositivo</code> (UDP…/SPK…) a sede
                  GrooFlow. Prioridad alta en el organigrama en vivo. Si está vacío, se usan los
                  defaults internos.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={seedDefaultDevices}>
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  Defaults
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addDeviceRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Dispositivo
                </Button>
              </div>
            </div>
            {deviceRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin overrides. El sistema usará el mapa default (5 huelleros) hasta que cargues
                «Defaults» o agregues filas.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {deviceRows.map((row, idx) => (
                  <div key={`dev-${idx}`} className="flex gap-2 items-center">
                    <Input
                      placeholder="UDP… / SPK…"
                      value={row.dispositivoId}
                      onChange={(e) =>
                        patchDevice(idx, {
                          dispositivoId: e.target.value.trim().toUpperCase().replace(/\s+/g, ''),
                        })
                      }
                      className="h-8 w-40 font-mono text-xs"
                    />
                    <Select
                      value={row.sedeName || '__none__'}
                      onValueChange={(v) =>
                        patchDevice(idx, { sedeName: v === '__none__' ? '' : v })
                      }
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue placeholder="Sede" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {sedeOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                        {row.sedeName && !sedeOptions.includes(row.sedeName) ? (
                          <SelectItem value={row.sedeName}>{row.sedeName}</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeDeviceRow(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className="text-sm font-medium">Centro de costo Buk.pe → sede base</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define la pertenencia del organigrama (no el huellero del día). Si está vacío, se
                  usa el mapa interno (101010 Benavides, 606060 Magdalena…).
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={seedDefaultCostCenters}>
                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                  Defaults
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addCcRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  CC
                </Button>
              </div>
            </div>
            {ccRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin overrides. El sistema usará el mapa default hasta que cargues «Defaults» o
                agregues filas.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {ccRows.map((row, idx) => (
                  <div key={`cc-${idx}`} className="flex gap-2 items-center">
                    <Input
                      placeholder="Código CC"
                      value={row.costCenterCode}
                      onChange={(e) =>
                        patchCc(idx, {
                          costCenterCode: e.target.value.replace(/\D/g, '').slice(0, 6),
                        })
                      }
                      className="h-8 w-24 font-mono"
                    />
                    <Select
                      value={row.sedeName || '__none__'}
                      onValueChange={(v) => patchCc(idx, { sedeName: v === '__none__' ? '' : v })}
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue placeholder="Sede" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {sedeOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                        {row.sedeName && !sedeOptions.includes(row.sedeName) ? (
                          <SelectItem value={row.sedeName}>{row.sedeName}</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCcRow(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Define cuántas personas deben estar presentes por sede, área y cargo. El panel compara
              con Buk Asistencia.
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
                <TableHead className="w-24">Requeridos</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.requirements.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Select
                      value={r.sedeName}
                      onValueChange={(v) => patchReq(r.id, { sedeName: v })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {groupedSedes.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.areaGroup}
                      onValueChange={(v) =>
                        patchReq(r.id, { areaGroup: v as AsistenciaAreaGroup })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ASISTENCIA_AREA_GROUP_LABELS) as AsistenciaAreaGroup[]).map(
                          (k) => (
                            <SelectItem key={k} value={k}>
                              {ASISTENCIA_AREA_GROUP_LABELS[k]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r.cargoLabel}
                      onChange={(e) => patchReq(r.id, { cargoLabel: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r.matchArea ?? ''}
                      onChange={(e) => patchReq(r.id, { matchArea: e.target.value })}
                      className="h-8"
                      placeholder="opcional"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r.matchSpecialty ?? ''}
                      onChange={(e) => patchReq(r.id, { matchSpecialty: e.target.value })}
                      className="h-8"
                      placeholder="opcional"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={r.requiredCount}
                      onChange={(e) =>
                        patchReq(r.id, { requiredCount: Number(e.target.value) || 0 })
                      }
                      className="h-8 w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          requirements: d.requirements.filter((x) => x.id !== r.id),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

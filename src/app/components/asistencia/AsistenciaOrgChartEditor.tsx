import { useMemo, useState } from 'react';
import { GitBranch, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';

import type { AsistenciaOrgChartColor, AsistenciaOrgChartNode, AsistenciaSettings } from '../../types/asistencia';
import { getSedeProfile } from '../../utils/asistenciaStaff';
import {
  applyOrgChartNodes,
  applyRemoveOrgChartNode,
  applySetOrgChartMode,
  applyUpdateOrgChartNode,
  buildOrgChartFromColumns,
  buildOrgChartTree,
  orgChartAssignableOptions,
  orgChartParentOptions,
  sortOrgChartNodes,
} from '../../utils/asistenciaOrgChart';
import { AsistenciaOrgChartTree } from './AsistenciaOrgChartTree';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const COLOR_OPTIONS: { value: AsistenciaOrgChartColor; label: string }[] = [
  { value: 'default', label: 'Gris' },
  { value: 'blue', label: 'Azul oscuro' },
  { value: 'lightblue', label: 'Azul claro' },
  { value: 'green', label: 'Verde' },
  { value: 'orange', label: 'Naranja' },
  { value: 'red', label: 'Rojo' },
  { value: 'violet', label: 'Violeta' },
];

type Props = {
  sedeName: string;
  settings: AsistenciaSettings;
  canConfigure: boolean;
  onSave: (
    updater: (prev: AsistenciaSettings) => AsistenciaSettings,
    successMessage?: string
  ) => Promise<boolean>;
};

export function AsistenciaOrgChartEditor({ sedeName, settings, canConfigure, onSave }: Props) {
  const profile = getSedeProfile(settings, sedeName);
  const [saving, setSaving] = useState(false);
  const [draftNodes, setDraftNodes] = useState<AsistenciaOrgChartNode[]>(
    () => profile.orgChartNodes ?? []
  );
  const [treeMode, setTreeMode] = useState(profile.orgChartMode === 'tree');
  const [newNode, setNewNode] = useState({
    label: '',
    parentId: null as string | null,
    childrenLayout: 'horizontal' as 'horizontal' | 'vertical',
    color: 'blue' as AsistenciaOrgChartColor,
    areaId: '',
  });

  const assignableAreas = useMemo(() => orgChartAssignableOptions(profile), [profile]);
  const parentOptions = useMemo(
    () => orgChartParentOptions(draftNodes),
    [draftNodes]
  );

  const previewSummary = useMemo(
    () => ({
      sedeName,
      scheduleLabel: '',
      workingCount: 0,
      absentCount: 0,
      lateCount: 0,
      manager: null,
      areas: [],
      isOperational: true,
      criticalMissing: [],
      bukRecintosOnDate: [],
      recordsOnDateCount: 0,
    }),
    [sedeName]
  );

  const previewTree = useMemo(
    () => buildOrgChartTree(draftNodes, previewSummary),
    [draftNodes, previewSummary]
  );

  const saveAll = async () => {
    setSaving(true);
    try {
      await onSave(
        (prev) => applyOrgChartNodes(prev, sedeName, draftNodes, treeMode ? 'tree' : 'columns'),
        'Organigrama jerárquico guardado.'
      );
    } finally {
      setSaving(false);
    }
  };

  const generateFromColumns = async () => {
    const generated = buildOrgChartFromColumns(profile);
    setDraftNodes(generated);
    setTreeMode(true);
    setSaving(true);
    try {
      await onSave(
        (prev) => applyOrgChartNodes(prev, sedeName, generated, 'tree'),
        'Árbol generado desde columnas actuales.'
      );
    } finally {
      setSaving(false);
    }
  };

  const addNode = () => {
    if (!newNode.label.trim()) return;
    const node: AsistenciaOrgChartNode = {
      id: `draft_${Date.now()}`,
      parentId: newNode.parentId,
      label: newNode.label.trim(),
      childrenLayout: newNode.childrenLayout,
      color: newNode.color,
      areaId: newNode.areaId || undefined,
      sortOrder: draftNodes.filter((n) => n.parentId === newNode.parentId).length,
    };
    setDraftNodes((prev) => [...prev, node]);
    setNewNode((p) => ({ ...p, label: '', areaId: '' }));
  };

  const updateNode = (id: string, patch: Partial<AsistenciaOrgChartNode>) => {
    setDraftNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const removeNode = (id: string) => {
    const toRemove = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of draftNodes) {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          changed = true;
        }
      }
    }
    setDraftNodes((prev) => prev.filter((n) => !toRemove.has(n.id)));
  };

  const toggleMode = async (enabled: boolean) => {
    setTreeMode(enabled);
    if (canConfigure) {
      setSaving(true);
      try {
        await onSave(
          (prev) => applySetOrgChartMode(prev, sedeName, enabled ? 'tree' : 'columns'),
          enabled ? 'Vista en árbol activada.' : 'Vista en columnas activada.'
        );
      } finally {
        setSaving(false);
      }
    }
  };

  if (!canConfigure) {
    return treeMode && draftNodes.length > 0 ? (
      <AsistenciaOrgChartTree sedeName={sedeName} tree={[]} />
    ) : null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-cyan-500/40 bg-cyan-950/5 p-4 dark:bg-cyan-950/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <GitBranch className="h-4 w-4 text-cyan-400" />
            Organigrama jerárquico (árbol)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Define niveles, ramas horizontales o verticales y colores como en el diagrama de sede.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="tree-mode" checked={treeMode} onCheckedChange={(v) => void toggleMode(v)} />
          <Label htmlFor="tree-mode" className="text-xs text-muted-foreground">
            Usar vista en árbol
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void generateFromColumns()}>
          <Wand2 className="h-3.5 w-3.5 mr-1" />
          Generar desde columnas
        </Button>
        <Button type="button" size="sm" disabled={saving || !treeMode} onClick={() => void saveAll()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
          Guardar árbol
        </Button>
      </div>

      {treeMode ? (
        <>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {sortOrgChartNodes(draftNodes).map((node) => (
              <div
                key={node.id}
                className="grid gap-2 rounded-lg border border-border bg-background/80 p-3 sm:grid-cols-[1fr_140px_120px_140px_auto] dark:border-slate-700"
              >
                <Input
                  value={node.label}
                  onChange={(e) => updateNode(node.id, { label: e.target.value })}
                  placeholder="Etiqueta del nodo"
                  className="h-8"
                />
                <Select
                  value={node.parentId ?? '__root__'}
                  onValueChange={(v) => updateNode(node.id, { parentId: v === '__root__' ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Padre" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgChartParentOptions(draftNodes, node.id).map((p) => (
                      <SelectItem key={p.id ?? '__root__'} value={p.id ?? '__root__'}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={node.childrenLayout ?? 'horizontal'}
                  onValueChange={(v) =>
                    updateNode(node.id, { childrenLayout: v as 'horizontal' | 'vertical' })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Hijos → horizontal</SelectItem>
                    <SelectItem value="vertical">Hijos → vertical</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={node.color ?? 'default'}
                  onValueChange={(v) => updateNode(node.id, { color: v as AsistenciaOrgChartColor })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1 sm:col-span-5">
                  <Select
                    value={node.areaId ?? '__none__'}
                    onValueChange={(v) => updateNode(node.id, { areaId: v === '__none__' ? undefined : v })}
                  >
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Área vinculada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin área (solo título)</SelectItem>
                      {assignableAreas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.isSub ? `↳ ${a.label}` : a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400"
                    onClick={() => removeNode(node.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-dashed border-border p-3 space-y-2 dark:border-slate-700">
            <Label className="text-xs text-muted-foreground">Agregar nodo</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                value={newNode.label}
                onChange={(e) => setNewNode((p) => ({ ...p, label: e.target.value }))}
                placeholder="Ej. Supervisores, Zona baños…"
                className="h-8"
              />
              <Select
                value={newNode.parentId ?? '__root__'}
                onValueChange={(v) =>
                  setNewNode((p) => ({ ...p, parentId: v === '__root__' ? null : v }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id ?? '__root__'} value={p.id ?? '__root__'}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={newNode.childrenLayout}
                onValueChange={(v) =>
                  setNewNode((p) => ({ ...p, childrenLayout: v as 'horizontal' | 'vertical' }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Ramas horizontales</SelectItem>
                  <SelectItem value="vertical">Apilado vertical</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="outline" disabled={!newNode.label.trim()} onClick={addNode}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nodo
              </Button>
            </div>
          </div>

          {draftNodes.length > 0 ? (
            <div className="rounded-xl border border-border bg-muted/20 p-4 overflow-x-auto dark:border-slate-700">
              <p className="text-xs text-muted-foreground mb-3">Vista previa (estructura)</p>
              <AsistenciaOrgChartTree sedeName={sedeName} tree={previewTree} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Checklist de inspección vehicular (movilidad canina) — configuración, firmas, adjuntos e historial.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardCheck,
  History,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Paperclip,
  Image as ImageIcon,
  User,
  Shield,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

import type {
  FleetChecklistSection,
  FleetDataset,
  FleetInspectionAttachment,
  FleetInspectionRecord,
  FleetVehicle,
} from '../../types/fleet';
import {
  computeInspectionCompliance,
  DEFAULT_FLEET_CHECKLIST,
  getAllChecklistItemIds,
} from '../../utils/fleetData';
import { applyFleetDatasetChange, type FleetPersistFn } from '../../utils/fleetPersist';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Textarea } from '../ui/textarea';

const MAX_FILE_BYTES = 1_800_000;

function fleetNewId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}_${Date.now().toString(36)}`;
}

/** Lienzo de firma — guarda PNG data URL (Pointer Events: mouse + táctil estable) */
export function SignaturePad({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  /** Evita que un PNG antiguo pise el trazo recién pintado cuando `value` cambia muy rápido */
  const valuePaintId = useRef(0);

  const layoutCanvas = (): CanvasRenderingContext2D | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cssW = rect.width;
    const cssH = rect.height;
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (c.width !== pxW || c.height !== pxH) {
      c.width = pxW;
      c.height = pxH;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  };

  const cssPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const paintBackground = () => {
    const c = canvasRef.current;
    const ctx = layoutCanvas();
    if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  const applyValueProp = (src: string | undefined) => {
    const id = ++valuePaintId.current;
    paintBackground();
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      if (id !== valuePaintId.current) return;
      const ctx2 = layoutCanvas();
      if (!ctx2 || !canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      ctx2.fillStyle = '#0f172a';
      ctx2.fillRect(0, 0, r.width, r.height);
      ctx2.drawImage(img, 0, 0, r.width, r.height);
    };
    img.src = src;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = cssPos(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = layoutCanvas();
    const c = canvasRef.current;
    if (!ctx || !c || !last.current) return;
    const p = cssPos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    onChange(c.toDataURL('image/png'));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    paintBackground();
    onChange(undefined);
  };

  /** Mientras dibuja no re-sincronizar desde props (borraría el lienzo hasta el decode del PNG). */
  useEffect(() => {
    const tid = window.requestAnimationFrame(() => {
      if (drawing.current) return;
      applyValueProp(value);
    });
    return () => window.cancelAnimationFrame(tid);
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-slate-200">{label}</Label>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-slate-400" onClick={clear}>
          Limpiar
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        className="block w-full max-w-full h-[120px] min-h-[120px] touch-none rounded-lg border border-white/15 bg-slate-950 cursor-crosshair select-none"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => {
          if (!drawing.current) return;
          onPointerUp(e);
        }}
      />
      {value && <p className="text-[10px] text-emerald-400/90">Firma capturada</p>}
    </div>
  );
}

export function FleetChecklistConfigurator({
  dataset,
  setDataset,
  onPersistDataset,
}: {
  dataset: FleetDataset;
  setDataset: React.Dispatch<React.SetStateAction<FleetDataset>>;
  onPersistDataset?: FleetPersistFn;
}) {
  const sections = dataset.checklistSections?.length ? dataset.checklistSections : DEFAULT_FLEET_CHECKLIST;
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);

  const persistNow = async (
    nextSections: FleetChecklistSection[],
    successMessage?: string
  ): Promise<boolean> => {
    let next!: FleetDataset;
    setDataset((prev) => {
      next = { ...prev, checklistSections: nextSections };
      return next;
    });
    if (persistInFlightRef.current) {
      await new Promise((r) => setTimeout(r, 120));
    }
    persistInFlightRef.current = true;
    try {
      return await applyFleetDatasetChange(
        setDataset,
        onPersistDataset,
        next,
        successMessage ?? 'Plantilla de checklist actualizada.'
      );
    } finally {
      persistInFlightRef.current = false;
    }
  };

  const persistDebounced = (nextSections: FleetChecklistSection[]) => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      void persistNow(nextSections);
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, []);

  const addSection = () => {
    const id = fleetNewId('fc_sec');
    void persistNow([
      ...sections.map((s, i) => ({ ...s, sortOrder: i })),
      { id, title: 'Nueva categoría', sortOrder: sections.length, items: [] },
    ]);
  };

  const updateSectionTitle = (id: string, title: string) => {
    persistDebounced(sections.map((s) => (s.id === id ? { ...s, title } : s)));
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sections.length) return;
    const copy = [...sections];
    const [sp] = copy.splice(idx, 1);
    copy.splice(j, 0, sp);
    void persistNow(copy.map((s, i) => ({ ...s, sortOrder: i })));
  };

  const removeSection = (id: string) => {
    if (!confirm('¿Eliminar esta categoría y todos sus ítems?')) return;
    void persistNow(sections.filter((s) => s.id !== id).map((s, i) => ({ ...s, sortOrder: i })));
  };

  const addItem = (sectionId: string) => {
    const itemId = fleetNewId('fc_it');
    void persistNow(
      sections.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          items: [
            ...s.items,
            { id: itemId, label: 'Nuevo ítem', sortOrder: s.items.length },
          ],
        };
      })
    );
  };

  const updateItemLabel = (sectionId: string, itemId: string, label: string) => {
    persistDebounced(
      sections.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          items: s.items.map((it) => (it.id === itemId ? { ...it, label } : it)),
        };
      })
    );
  };

  const moveItem = (sectionId: string, itemId: string, dir: -1 | 1) => {
    void persistNow(
      sections.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.items.findIndex((i) => i.id === itemId);
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= s.items.length) return s;
        const copy = [...s.items];
        const [row] = copy.splice(idx, 1);
        copy.splice(j, 0, row);
        return { ...s, items: copy.map((it, i) => ({ ...it, sortOrder: i })) };
      })
    );
  };

  const removeItem = (sectionId: string, itemId: string) => {
    void persistNow(
      sections.map((s) => {
        if (s.id !== sectionId) return s;
        return { ...s, items: s.items.filter((it) => it.id !== itemId) };
      })
    );
  };

  const restoreDefault = () => {
    if (!confirm('¿Restaurar plantilla estándar de movilidad canina? Se perderán los cambios actuales.')) return;
    void persistNow(
      JSON.parse(JSON.stringify(DEFAULT_FLEET_CHECKLIST)) as FleetChecklistSection[],
      'Plantilla estándar restaurada.'
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400 max-w-2xl">
          Defina categorías e ítems. Cada inspección evaluará <strong className="text-white">Cumple / No cumple</strong> y calculará el % de cumplimiento vinculado al conductor.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-white/15" onClick={restoreDefault}>
            Restaurar plantilla
          </Button>
          <Button size="sm" className="gap-1 bg-violet-600 hover:bg-violet-500" onClick={addSection}>
            <Plus className="h-4 w-4" />
            Categoría
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {sections.map((sec) => (
          <Card key={sec.id} className="border-white/10 bg-slate-950/70 text-white">
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
              <div className="flex-1 space-y-2">
                <Label className="text-xs text-slate-500">Título de categoría</Label>
                <Input
                  value={sec.title}
                  onChange={(e) => updateSectionTitle(sec.id, e.target.value)}
                  className="bg-slate-900/80 border-white/15"
                />
              </div>
              <div className="flex flex-col gap-1 pt-6">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveSection(sec.id, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveSection(sec.id, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => removeSection(sec.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {sec.items.map((it) => (
                <div key={it.id} className="flex gap-2 items-center">
                  <Input
                    value={it.label}
                    onChange={(e) => updateItemLabel(sec.id, it.id, e.target.value)}
                    className="flex-1 bg-slate-900/60 border-white/10 text-sm"
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => moveItem(sec.id, it.id, -1)}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => moveItem(sec.id, it.id, 1)}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-red-400" onClick={() => removeItem(sec.id, it.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => addItem(sec.id)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Ítem
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InspectionDetailView({ record, dataset }: { record: FleetInspectionRecord; dataset: FleetDataset }) {
  const template = dataset.checklistSections?.length ? dataset.checklistSections : DEFAULT_FLEET_CHECKLIST;
  const vehicle = dataset.vehicles.find((v) => v.id === record.vehicleId);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-3 text-slate-300">
        <Badge className="bg-emerald-500/20 text-emerald-200">{vehicle?.plate ?? record.vehicleId}</Badge>
        <span>{format(parseISO(record.dateTime), "dd/MM/yyyy HH:mm", { locale: es })}</span>
        <Badge variant="outline" className="border-amber-500/40 text-amber-200">
          Cumplimiento {record.compliancePercent}%
        </Badge>
      </div>
      <p>
        <User className="inline h-4 w-4 mr-1 text-sky-400" />
        Chofer: <strong className="text-white">{record.driverName}</strong>
        {record.supervisorName && (
          <>
            {' '}
            · <Shield className="inline h-4 w-4 mx-1 text-violet-400" />
            Supervisor: <strong className="text-white">{record.supervisorName}</strong>
          </>
        )}
      </p>
      {record.odometerKm != null && <p className="text-slate-400">Odómetro: {record.odometerKm.toLocaleString('es-PE')} km</p>}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead>Categoría</TableHead>
              <TableHead>Ítem</TableHead>
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...template]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .flatMap((sec) =>
                [...sec.items]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((it) => {
                    const r = record.responses[it.id];
                    return (
                      <TableRow key={it.id} className="border-white/10">
                        <TableCell className="text-slate-500">{sec.title}</TableCell>
                        <TableCell className="text-white">{it.label}</TableCell>
                        <TableCell className="text-right">
                          {r === 'pass' ? (
                            <Badge className="bg-emerald-500/25 text-emerald-200">Cumple</Badge>
                          ) : (
                            <Badge className="bg-red-500/25 text-red-200">No cumple</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
          </TableBody>
        </Table>
      </div>
      {record.notes && (
        <div>
          <Label className="text-slate-500">Notas</Label>
          <p className="text-slate-300 mt-1 whitespace-pre-wrap">{record.notes}</p>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {record.driverSignatureDataUrl && (
          <div>
            <Label className="text-slate-500 mb-1 block">Firma chofer</Label>
            <img src={record.driverSignatureDataUrl} alt="Firma chofer" className="rounded border border-white/10 max-h-28 bg-slate-900" />
          </div>
        )}
        {record.supervisorSignatureDataUrl && (
          <div>
            <Label className="text-slate-500 mb-1 block">Firma supervisor</Label>
            <img src={record.supervisorSignatureDataUrl} alt="Firma supervisor" className="rounded border border-white/10 max-h-28 bg-slate-900" />
          </div>
        )}
      </div>
      {record.attachments.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-1 text-slate-400">
            <Paperclip className="h-4 w-4" /> Adjuntos
          </Label>
          <div className="flex flex-wrap gap-3">
            {record.attachments.map((a) => (
              <a
                key={a.id}
                href={a.dataUrl}
                download={a.fileName}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-sky-300 hover:bg-white/5"
              >
                <ImageIcon className="h-4 w-4" />
                {a.fileName}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FleetVehicleInspectionBar({
  vehicle,
  dataset,
  setDataset,
  onPersistDataset,
}: {
  vehicle: FleetVehicle;
  dataset: FleetDataset;
  setDataset: React.Dispatch<React.SetStateAction<FleetDataset>>;
  onPersistDataset?: FleetPersistFn;
}) {
  const [openNew, setOpenNew] = useState(false);
  const [openHist, setOpenHist] = useState(false);
  const [detail, setDetail] = useState<FleetInspectionRecord | null>(null);

  const template = dataset.checklistSections?.length ? dataset.checklistSections : DEFAULT_FLEET_CHECKLIST;
  const templateIds = useMemo(() => getAllChecklistItemIds(template), [template]);

  const vehicleInspections = useMemo(
    () =>
      [...dataset.inspections].filter((i) => i.vehicleId === vehicle.id).sort((a, b) => parseISO(b.dateTime).getTime() - parseISO(a.dateTime).getTime()),
    [dataset.inspections, vehicle.id]
  );

  const [dateTime, setDateTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [odometerKm, setOdometerKm] = useState<number>(vehicle.currentOdometerKm || 0);
  const [driverName, setDriverName] = useState(vehicle.assignedDriverName || '');
  const [supervisorName, setSupervisorName] = useState('');
  const [responses, setResponses] = useState<Record<string, 'pass' | 'fail'>>({});
  const [notes, setNotes] = useState('');
  const [driverSig, setDriverSig] = useState<string | undefined>();
  const [supSig, setSupSig] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<FleetInspectionAttachment[]>([]);

  useEffect(() => {
    if (!openNew) return;
    const init: Record<string, 'pass' | 'fail'> = {};
    for (const id of templateIds) init[id] = 'pass';
    setResponses(init);
    setDateTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setOdometerKm(vehicle.currentOdometerKm || 0);
    setDriverName(vehicle.assignedDriverName || '');
    setSupervisorName('');
    setNotes('');
    setDriverSig(undefined);
    setSupSig(undefined);
    setAttachments([]);
  }, [openNew, templateIds, vehicle]);

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const next: FleetInspectionAttachment[] = [...attachments];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`Archivo muy grande: ${file.name} (máx ~1.8 MB)`);
        continue;
      }
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((res, rej) => {
        reader.onload = () => res(String(reader.result));
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      next.push({
        id: fleetNewId('att'),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
    }
    setAttachments(next);
    e.target.value = '';
  };

  const submitInspection = async () => {
    if (!driverName.trim()) {
      toast.error('Indique nombre del chofer.');
      return;
    }
    for (const id of templateIds) {
      if (!responses[id]) {
        toast.error('Complete todos los ítems del checklist.');
        return;
      }
    }
    if (!driverSig || !supSig) {
      toast.error('Se requieren ambas firmas (chofer y supervisor).');
      return;
    }
    const compliance = computeInspectionCompliance(responses, templateIds);
    const now = new Date().toISOString();
    const prevScore = vehicle.driverPerformanceScore ?? 100;
    const prevDem = vehicle.driverInspectionDemerits ?? 0;
    const newScore = Math.round(prevScore * 0.35 + compliance * 0.65);
    const demeritAdd = compliance < 85 ? Math.max(1, Math.ceil((85 - compliance) / 5)) : 0;
    const newDem = prevDem + demeritAdd;

    const rec: FleetInspectionRecord = {
      id: fleetNewId('finsp'),
      vehicleId: vehicle.id,
      dateTime,
      odometerKm: odometerKm || undefined,
      driverName: driverName.trim(),
      supervisorName: supervisorName.trim() || undefined,
      responses: { ...responses },
      compliancePercent: compliance,
      driverDemeritPointsAfter: newDem,
      driverPerformanceScoreAfter: newScore,
      driverSignatureDataUrl: driverSig,
      supervisorSignatureDataUrl: supSig,
      attachments,
      notes: notes.trim() || undefined,
      createdAt: now,
    };

    const next: FleetDataset = {
      ...dataset,
      inspections: [rec, ...dataset.inspections],
      vehicles: dataset.vehicles.map((v) =>
        v.id === vehicle.id
          ? {
              ...v,
              updatedAt: now,
              lastInspectionCompliance: compliance,
              lastInspectionAt: dateTime,
              driverPerformanceScore: newScore,
              driverInspectionDemerits: newDem,
              currentOdometerKm: Math.max(v.currentOdometerKm, odometerKm || 0),
            }
          : v
      ),
    };
    const ok = await applyFleetDatasetChange(
      setDataset,
      onPersistDataset,
      next,
      `Inspección registrada · ${compliance}% cumplimiento`
    );
    if (ok) setOpenNew(false);
  };

  return (
    <>
      <div className="border-t border-white/10 pt-3 mt-2 space-y-2">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="text-[11px] space-y-1">
            {vehicle.lastInspectionCompliance != null ? (
              <>
                <span className="text-slate-500">Última inspección:</span>{' '}
                <Badge variant="outline" className={vehicle.lastInspectionCompliance >= 85 ? 'border-emerald-500/40 text-emerald-200' : 'border-amber-500/40 text-amber-200'}>
                  {vehicle.lastInspectionCompliance}% cumplimiento
                </Badge>
                {vehicle.driverPerformanceScore != null && (
                  <span className="text-slate-500 ml-2">
                    · Índice chofer {vehicle.driverPerformanceScore}/100
                    {vehicle.driverInspectionDemerits != null && vehicle.driverInspectionDemerits > 0 && (
                      <span className="text-rose-300"> · Observaciones acum. {vehicle.driverInspectionDemerits}</span>
                    )}
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-500">Sin inspecciones registradas</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" className="h-8 gap-1 bg-teal-600/90 hover:bg-teal-500 text-white" onClick={() => setOpenNew(true)}>
            <ClipboardCheck className="h-3.5 w-3.5" />
            Checklist inspección
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 border-white/15" onClick={() => setOpenHist(true)}>
            <History className="h-3.5 w-3.5 mr-1" />
            Historial ({vehicleInspections.length})
          </Button>
        </div>
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto bg-slate-950 border-white/15 text-white">
          <DialogHeader>
            <DialogTitle>Nueva inspección — {vehicle.plate}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Movilidad canina · marque cumplimiento por ítem. El resultado afecta el índice del conductor asignado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fecha y hora</Label>
              <Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="bg-slate-900 border-white/15" />
            </div>
            <div className="space-y-1.5">
              <Label>Odómetro (km)</Label>
              <Input type="number" value={odometerKm || ''} onChange={(e) => setOdometerKm(Number(e.target.value))} className="bg-slate-900 border-white/15" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Chofer *</Label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Nombre completo" className="bg-slate-900 border-white/15" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Supervisor / responsable</Label>
              <Input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} className="bg-slate-900 border-white/15" />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {[...template]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((sec) => (
                <div key={sec.id}>
                  <div className="text-xs font-semibold text-violet-300 mb-2">{sec.title}</div>
                  <div className="space-y-2">
                    {[...sec.items]
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((it) => (
                        <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 bg-slate-900/40">
                          <span className="text-sm text-slate-200">{it.label}</span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={responses[it.id] === 'pass' ? 'default' : 'outline'}
                              className={responses[it.id] === 'pass' ? 'bg-emerald-600 hover:bg-emerald-500' : 'border-white/15'}
                              onClick={() => setResponses((r) => ({ ...r, [it.id]: 'pass' }))}
                            >
                              Cumple
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={responses[it.id] === 'fail' ? 'destructive' : 'outline'}
                              className={responses[it.id] === 'fail' ? '' : 'border-white/15'}
                              onClick={() => setResponses((r) => ({ ...r, [it.id]: 'fail' }))}
                            >
                              No cumple
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>

          <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-sm">
            <span className="text-slate-400">Cumplimiento proyectado: </span>
            <strong className="text-teal-300 tabular-nums">
              {computeInspectionCompliance(responses, templateIds)}%
            </strong>
          </div>

          <Textarea placeholder="Observaciones (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="bg-slate-900 border-white/15" />

          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-slate-300">
              <Paperclip className="h-4 w-4" /> Adjuntos (fotos / PDF ligeros)
            </Label>
            <Input type="file" multiple accept="image/*,application/pdf" className="text-xs" onChange={onPickFiles} />
            {attachments.length > 0 && (
              <ul className="text-xs text-slate-400 space-y-1">
                {attachments.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span className="truncate">{a.fileName}</span>
                    <button
                      type="button"
                      className="text-red-400 hover:underline"
                      onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <SignaturePad label="Firma del chofer del vehículo *" value={driverSig} onChange={setDriverSig} />
          <SignaturePad label="Firma del supervisor *" value={supSig} onChange={setSupSig} />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="border-white/15" onClick={() => setOpenNew(false)}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={submitInspection}>
              Guardar inspección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openHist} onOpenChange={setOpenHist}>
        <DialogContent className="max-w-lg max-h-[85vh] bg-slate-950 border-white/15 text-white flex flex-col">
          <DialogHeader>
            <DialogTitle>Historial inspecciones — {vehicle.plate}</DialogTitle>
            <DialogDescription className="text-slate-400">{vehicleInspections.length} registro(s)</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[55vh] pr-3">
            <div className="space-y-2">
              {vehicleInspections.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left rounded-lg border border-white/10 p-3 hover:bg-white/5 transition-colors"
                  onClick={() => {
                    setDetail(r);
                    setOpenHist(false);
                  }}
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-sm font-medium text-white">{format(parseISO(r.dateTime), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                    <Badge variant="outline" className="border-teal-500/40 text-teal-200">
                      {r.compliancePercent}%
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{r.driverName}</p>
                </button>
              ))}
              {vehicleInspections.length === 0 && <p className="text-sm text-slate-500">Sin registros.</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border-white/15 text-white">
          <DialogHeader>
            <DialogTitle>Detalle inspección</DialogTitle>
          </DialogHeader>
          {detail && <InspectionDetailView record={detail} dataset={dataset} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Tabla global de inspecciones (todos los vehículos) */
export function FleetInspectionsGlobalTable({ dataset }: { dataset: FleetDataset }) {
  const rows = useMemo(
    () =>
      [...dataset.inspections].sort((a, b) => parseISO(b.dateTime).getTime() - parseISO(a.dateTime).getTime()),
    [dataset.inspections]
  );
  const [detail, setDetail] = useState<FleetInspectionRecord | null>(null);

  return (
    <>
      <Card className="border-white/10 bg-slate-950/70 text-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-sky-400" />
            Historial global de inspecciones
          </CardTitle>
          <CardDescription className="text-slate-400">Últimos checklist registrados en la flota</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[min(420px,55vh)]">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const v = dataset.vehicles.find((x) => x.id === r.vehicleId);
                  return (
                    <TableRow key={r.id} className="border-white/10">
                      <TableCell className="text-slate-300">{format(parseISO(r.dateTime), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                      <TableCell className="font-mono">{v?.plate ?? r.vehicleId}</TableCell>
                      <TableCell>{r.driverName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant="outline" className="border-white/20">
                          {r.compliancePercent}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setDetail(r)}>
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">Sin inspecciones aún.</p>}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border-white/15 text-white">
          <DialogHeader>
            <DialogTitle>Detalle inspección</DialogTitle>
          </DialogHeader>
          {detail && <InspectionDetailView record={detail} dataset={dataset} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

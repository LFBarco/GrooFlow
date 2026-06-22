import React, { useRef, useState } from 'react';
import { Download, FileUp, Upload } from 'lucide-react';
import { toast } from 'sonner';

import type { FleetDataset } from '../../types/fleet';
import {
  downloadFleetFuelImportTemplate,
  FLEET_FUEL_TEMPLATE_FILENAME,
  parseFleetFuelWorkbook,
} from '../../utils/fleetFuelImport';
import { applyFleetDatasetChange, type FleetPersistFn } from '../../utils/fleetPersist';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export type FleetFuelBulkImportProps = {
  dataset: FleetDataset;
  setDataset: React.Dispatch<React.SetStateAction<FleetDataset>>;
  onPersistDataset?: FleetPersistFn;
  visibleSedes?: string[];
  defaultHomeBase?: string;
};

export function FleetFuelBulkImport({
  dataset,
  setDataset,
  onPersistDataset,
  visibleSedes = [],
  defaultHomeBase,
}: FleetFuelBulkImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const sedes = visibleSedes.length > 0 ? visibleSedes : [defaultHomeBase || 'Principal'].filter(Boolean);

  const handleDownloadTemplate = () => {
    downloadFleetFuelImportTemplate(dataset.vehicles, sedes);
    toast.success('Plantilla Excel descargada.');
  };

  const processFile = async (file: File) => {
    if (dataset.vehicles.length === 0) {
      toast.error('Registre al menos un vehículo en la pestaña Flota antes de importar combustible.');
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseFleetFuelWorkbook(buffer, dataset.vehicles, {
        defaultSede: defaultHomeBase,
      });

      if (result.entries.length === 0) {
        const detail = result.errors[0] ?? 'No se encontraron filas válidas.';
        toast.error('Importación sin registros.', { description: detail });
        return;
      }

      const now = new Date().toISOString();
      const updatedVehicles = dataset.vehicles.map((v) => {
        const maxKm = result.vehicleMaxOdometer.get(v.id);
        if (maxKm != null && maxKm > v.currentOdometerKm) {
          return { ...v, currentOdometerKm: maxKm, updatedAt: now };
        }
        return v;
      });

      const next: FleetDataset = {
        ...dataset,
        fuelEntries: [...result.entries, ...dataset.fuelEntries],
        vehicles: updatedVehicles,
      };

      const ok = await applyFleetDatasetChange(
        setDataset,
        onPersistDataset,
        next,
        `${result.entries.length} repostaje(s) importado(s).`
      );

      if (ok) {
        if (result.errors.length > 0) {
          toast.warning(`${result.errors.length} fila(s) omitida(s) por errores.`, {
            description: result.errors.slice(0, 3).join('\n'),
            duration: 10_000,
          });
        }
        setOpen(false);
      }
    } catch (e) {
      console.warn('[GrooFlow] fleet fuel import:', e);
      toast.error('No se pudo leer el archivo Excel. Verifique formato e intente de nuevo.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 border-cyan-500/30 text-cyan-100 hover:bg-cyan-950/40"
        onClick={() => setOpen(true)}
      >
        <Upload className="h-4 w-4" />
        Carga masiva
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-950 border-white/15 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Carga masiva de combustible</DialogTitle>
            <DialogDescription>
              Descargue la plantilla Excel, complete un repostaje por fila e importe el archivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3 space-y-2">
              <p className="text-slate-300">
                Columnas obligatorias: <strong>Placa</strong>, <strong>Fecha</strong>,{' '}
                <strong>Odómetro km</strong>, <strong>Litros</strong>, <strong>Costo total S/</strong>.
              </p>
              <p className="text-slate-400 text-xs">
                La placa debe existir en su flota. Opcional: Sede, Estación, Tanque lleno (Si/No), Notas.
              </p>
              <p className="text-slate-500 text-xs font-mono">{FLEET_FUEL_TEMPLATE_FILENAME}</p>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              onClick={handleDownloadTemplate}
            >
              <Download className="h-4 w-4" />
              Descargar plantilla .xlsx
            </Button>

            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/35 bg-cyan-950/10 px-4 py-8 cursor-pointer hover:bg-cyan-950/20 transition-colors">
              <FileUp className="h-8 w-8 text-cyan-400" />
              <span className="text-slate-200 font-medium">
                {busy ? 'Procesando…' : 'Seleccionar archivo Excel'}
              </span>
              <span className="text-xs text-slate-500">.xlsx · .xls</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={busy}
                onChange={onFileChange}
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

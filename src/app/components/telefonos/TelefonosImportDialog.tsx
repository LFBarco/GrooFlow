import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import type { TelefonoImportResult, TelefonoImportRow } from '../../types/telefonos';
import { importTelefonos } from '../../utils/telefonosApi';
import { detectImportColumns, findHeaderRow, formatPhone, rowsFromMatrix } from '../../utils/telefonosRules';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

const FIELD_LABEL: Record<keyof TelefonoImportRow, string> = {
  numero: 'Número',
  operador: 'Operador',
  plan: 'Plan',
  costoMensual: 'Costo',
  equipo: 'Equipo',
  imei: 'IMEI',
  iccid: 'Chip',
  nombre: 'Usuario (proveedor)',
};

export function TelefonosImportDialog({ open, onOpenChange, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<TelefonoImportRow[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [result, setResult] = useState<TelefonoImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName('');
    setRows([]);
    setFields([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
      const headerRow = findHeaderRow(matrix);
      const mapping = detectImportColumns(matrix[headerRow] ?? []);
      if (mapping.numero === undefined) {
        toast.error('No encontré una columna de número (Número, Teléfono, Línea, Celular…).');
        return;
      }
      setFields(Object.keys(mapping).map((k) => FIELD_LABEL[k as keyof TelefonoImportRow]));
      setRows(rowsFromMatrix(matrix, headerRow, mapping));
    } catch {
      toast.error('No se pudo leer el archivo.');
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const r = await importTelefonos(rows);
      setResult(r);
      toast.success(`Importación lista: ${r.creados} nuevas, ${r.actualizados} actualizadas`);
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo importar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar lista del operador</DialogTitle>
          <DialogDescription>
            Sube el Excel o CSV del proveedor. Las líneas nuevas se vinculan solas al colaborador cuyo teléfono en Buk
            coincide; las demás quedan «Sin asignar». En líneas existentes solo se actualizan operador, plan, costo y
            equipo; la asignación se conserva.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <Button variant="outline" onClick={() => inputRef.current?.click()} className="w-full">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {fileName || 'Elegir archivo…'}
        </Button>

        {fields.length ? (
          <p className="text-xs text-muted-foreground">Columnas detectadas: {fields.join(', ')}</p>
        ) : null}

        {rows.length ? (
          <div className="max-h-64 overflow-auto rounded-md border text-sm">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted text-left text-xs">
                <tr>
                  <th className="px-2 py-1">Número</th>
                  <th className="px-2 py-1">Operador / plan</th>
                  <th className="px-2 py-1">Costo</th>
                  <th className="px-2 py-1">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={`${r.numero}-${i}`} className="border-t">
                    <td className="px-2 py-1 font-mono">{formatPhone(r.numero)}</td>
                    <td className="px-2 py-1">{[r.operador, r.plan].filter(Boolean).join(' · ')}</td>
                    <td className="px-2 py-1">{r.costoMensual ?? ''}</td>
                    <td className="px-2 py-1">{r.nombre ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 ? (
              <p className="p-2 text-xs text-muted-foreground">…y {rows.length - 50} filas más.</p>
            ) : null}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            {result.creados} líneas nuevas ({result.vinculados} vinculadas automáticamente a colaboradores),{' '}
            {result.actualizados} actualizadas.
            {result.omitidos.length ? ` Omitidas: ${result.omitidos.slice(0, 10).join(', ')}` : ''}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={() => void doImport()} disabled={!rows.length || busy || !!result}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
            Importar {rows.length ? `${rows.length} líneas` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

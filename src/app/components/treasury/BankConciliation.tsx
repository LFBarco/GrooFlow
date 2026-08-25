import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BankMovement, Invoice } from './types';
import { Check, X, ArrowRightLeft, FileSpreadsheet, CheckCircle2, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface BankConciliationProps {
  movements: BankMovement[];
  systemPayments: Invoice[];
  onConciliate: (movementId: string, invoiceId: string) => void;
  onImportMovements?: (movements: BankMovement[]) => void;
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function parseAmount(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: unknown): Date {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial date (días desde 1899-12-30)
    const utc = Date.UTC(1899, 11, 30) + v * 86400000;
    return new Date(utc);
  }
  const d = new Date(String(v ?? ''));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function parseBankExtract(file: File): Promise<BankMovement[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const now = Date.now();
    return rows
      .map((row, i) => {
        const keys = Object.keys(row);
        const pick = (...needles: string[]) => {
          const k = keys.find((key) => needles.some((n) => key.toLowerCase().includes(n)));
          return k ? row[k] : undefined;
        };
        const description = cellStr(pick('desc', 'glosa', 'concepto', 'detalle', 'narrat') || `Movimiento ${i + 1}`);
        const operationNumber = cellStr(pick('oper', 'nro', 'referencia', 'ref', 'voucher') || `EXT-${i + 1}`);
        const cargo = pick('cargo', 'debito', 'débito');
        const abono = pick('abono', 'credito', 'crédito');
        let amount = parseAmount(pick('monto', 'importe', 'amount', 'valor'));
        if (cargo != null && cellStr(cargo) !== '') amount = -Math.abs(parseAmount(cargo));
        else if (abono != null && cellStr(abono) !== '') amount = Math.abs(parseAmount(abono));
        const date = parseDate(pick('fecha', 'date', 'f.op', 'operac'));
        return {
          id: `imp-${now}-${i}`,
          operationNumber,
          description,
          amount,
          date,
          status: 'unmatched' as const,
        };
      })
      .filter((m) => m.description && m.amount !== 0);
  });
}

export const BankConciliation: React.FC<BankConciliationProps> = ({
  movements,
  systemPayments,
  onConciliate,
  onImportMovements,
}) => {
  const [selectedMovement, setSelectedMovement] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const unmatchedMovements = movements.filter(m => m.status === 'unmatched');
  const unmatchedInvoices = systemPayments.filter(i => i.status === 'in_transit');

  const handleMatch = () => {
    if (selectedMovement && selectedInvoice) {
      onConciliate(selectedMovement, selectedInvoice);
      setSelectedMovement(null);
      setSelectedInvoice(null);
    }
  };

  const handleAutoMatch = () => {
    const newMatches: { movementId: string, invoiceId: string, confidence: number, reason: string }[] = [];

    unmatchedMovements.forEach(mov => {
      if (newMatches.some(m => m.movementId === mov.id)) return;

      const amount = Math.abs(mov.amount);
      const movDate = new Date(mov.date);
      const movDesc = mov.description.toLowerCase();

      let bestCandidate: Invoice | null = null;
      let highestConfidence = 0;
      let matchReason = "";

      unmatchedInvoices.forEach(inv => {
        if (newMatches.some(m => m.invoiceId === inv.id)) return;

        let confidence = 0;
        const reasons: string[] = [];

        if (Math.abs(inv.amount - amount) < 0.05) {
          confidence += 0.6;
          reasons.push("Monto exacto");
        } else {
          return;
        }

        const invDate = new Date(inv.dueDate);
        const daysDiff = Math.abs((movDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 3) {
          confidence += 0.3;
          reasons.push(`Fecha cercana (${Math.round(daysDiff)}d)`);
        } else if (daysDiff <= 7) {
          confidence += 0.1;
          reasons.push(`Fecha aprox (${Math.round(daysDiff)}d)`);
        }

        const providerName = inv.providerName.toLowerCase();
        if (movDesc.includes(providerName) || providerName.includes(movDesc)) {
          confidence += 0.3;
          reasons.push("Nombre proveedor coincide");
        }

        if (movDesc.includes(inv.documentNumber.toLowerCase())) {
          confidence += 0.4;
          reasons.push("N° Documento coincide");
        }

        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestCandidate = inv;
          matchReason = reasons.join(", ");
        }
      });

      if (bestCandidate && highestConfidence >= 0.6) {
        newMatches.push({
          movementId: mov.id,
          invoiceId: bestCandidate.id,
          confidence: highestConfidence,
          reason: matchReason
        });
      }
    });

    if (newMatches.length > 0) {
      newMatches.forEach(m => onConciliate(m.movementId, m.invoiceId));
      toast.success(`${newMatches.length} coincidencia(s) conciliadas`, {
        description: newMatches[0].reason,
      });
    } else {
      toast.info('No hay coincidencias automáticas claras. Selecciona un movimiento y un pago para conciliar.');
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = await parseBankExtract(file);
      if (imported.length === 0) {
        toast.error('No se encontraron movimientos. Usa columnas Fecha, Descripción y Monto (o Cargo/Abono).');
        return;
      }
      onImportMovements?.(imported);
      toast.success(`${imported.length} movimiento(s) importados`);
    } catch {
      toast.error('No se pudo leer el extracto. Prueba un Excel o CSV.');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 relative">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          void handleImportFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
            Centro de Conciliación
          </h2>
          <p className="text-sm text-muted-foreground">
            Cruza el extracto bancario con los pagos enviados a banco.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAutoMatch}
            className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/15 flex items-center gap-2 shadow-sm text-sm font-medium transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            Auto-conciliar
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-accent flex items-center gap-2 shadow-sm text-sm font-medium"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Extracto
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        <div className="flex flex-col bg-card rounded-xl border border-border overflow-hidden shadow-sm h-full">
          <div className="p-4 bg-muted/40 border-b border-border flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="font-bold text-foreground text-sm">Extracto Bancario</span>
            </div>
            <span className="text-xs bg-background border border-border px-2 py-0.5 rounded-full text-muted-foreground font-mono">
              {unmatchedMovements.length} items
            </span>
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-3 bg-muted/20">
            {unmatchedMovements.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <CheckCircle2 className="w-12 h-12 mb-2 opacity-30" />
                <p className="text-sm">Sin movimientos pendientes</p>
                <p className="text-xs mt-1">Importa un extracto Excel o CSV para conciliar.</p>
              </div>
            ) : (
              unmatchedMovements.map(mov => (
                <motion.div
                  layoutId={mov.id}
                  key={mov.id}
                  onClick={() => setSelectedMovement(mov.id)}
                  className={clsx(
                    "p-4 rounded-xl border cursor-pointer transition-all shadow-sm relative group",
                    selectedMovement === mov.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary z-10"
                      : "border-border bg-card hover:border-primary/40 hover:shadow-md"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground text-sm">{mov.description}</span>
                      <span className="text-xs text-muted-foreground font-mono mt-0.5">OP: {mov.operationNumber}</span>
                    </div>
                    <span className="font-mono font-bold text-red-500 text-sm whitespace-nowrap">
                      {formatCurrencyEs(mov.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {mov.date.toLocaleDateString()}
                    </span>
                    {selectedMovement === mov.id && (
                      <span className="text-primary font-medium">Seleccionado</span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col bg-card rounded-xl border border-border overflow-hidden shadow-sm h-full">
          <div className="p-4 bg-muted/40 border-b border-border flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="font-bold text-foreground text-sm">Pagos en Sistema</span>
            </div>
            <span className="text-xs bg-background border border-border px-2 py-0.5 rounded-full text-muted-foreground font-mono">
              {unmatchedInvoices.length} items
            </span>
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-3 bg-muted/20">
            {unmatchedInvoices.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <CheckCircle2 className="w-12 h-12 mb-2 opacity-30" />
                <p className="text-sm">Sin pagos en tránsito</p>
                <p className="text-xs mt-1">Aprueba o envía pagos desde la Mesa de Pagos.</p>
              </div>
            ) : (
              unmatchedInvoices.map(inv => (
                <motion.div
                  layoutId={inv.id}
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv.id)}
                  className={clsx(
                    "p-4 rounded-xl border cursor-pointer transition-all shadow-sm relative group",
                    selectedInvoice === inv.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary z-10"
                      : "border-border bg-card hover:border-primary/40 hover:shadow-md"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground text-sm">{inv.providerName}</span>
                      <span className="text-xs text-muted-foreground font-mono mt-0.5">{inv.documentType} {inv.documentNumber}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground text-sm whitespace-nowrap">
                      {formatCurrencyEs(inv.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Vence: {inv.dueDate.toLocaleDateString()}
                    </span>
                    <span className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded font-medium text-[10px] uppercase tracking-wide">
                      En Tránsito
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedMovement && selectedInvoice && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background pl-6 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-6 z-50"
          >
            <div className="flex items-center gap-3 text-sm">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-background/60 uppercase tracking-wider">Banco</span>
                <span className="font-mono font-bold text-red-300">{formatCurrencyEs(Math.abs(movements.find(m => m.id === selectedMovement)?.amount || 0))}</span>
              </div>
              <div className="bg-background/10 rounded-full p-1">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-background/60 uppercase tracking-wider">Sistema</span>
                <span className="font-mono font-bold text-green-300">{formatCurrencyEs(systemPayments.find(i => i.id === selectedInvoice)?.amount ?? 0)}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-background/20"></div>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleMatch}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 active:scale-95"
              >
                <Check className="w-4 h-4" />
                Conciliar
              </button>
              <button
                type="button"
                onClick={() => { setSelectedMovement(null); setSelectedInvoice(null); }}
                className="hover:bg-background/10 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

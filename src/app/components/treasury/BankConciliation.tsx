import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BankMovement, Invoice } from './types';
import { Check, X, ArrowRightLeft, Search, AlertTriangle, FileSpreadsheet, CheckCircle2, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

interface BankConciliationProps {
  movements: BankMovement[];
  systemPayments: Invoice[];
  onConciliate: (movementId: string, invoiceId: string) => void;
}

export const BankConciliation: React.FC<BankConciliationProps> = ({
  movements,
  systemPayments,
  onConciliate
}) => {
  const [selectedMovement, setSelectedMovement] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  // Filter only unmatched items
  const unmatchedMovements = movements.filter(m => m.status === 'unmatched');
  const unmatchedInvoices = systemPayments.filter(i => i.status === 'in_transit'); // Only items sent to bank

  // Manual Match
  const handleMatch = () => {
    if (selectedMovement && selectedInvoice) {
        onConciliate(selectedMovement, selectedInvoice);
        setSelectedMovement(null);
        setSelectedInvoice(null);
    }
  };

  // Auto-Match Logic
  const handleAutoMatch = () => {
    let matchesFound = 0;
    const newMatches: { movementId: string, invoiceId: string, confidence: number, reason: string }[] = [];

    // Advanced Heuristic Logic
    unmatchedMovements.forEach(mov => {
      // Skip if already matched in this run
      if (newMatches.some(m => m.movementId === mov.id)) return;

      const amount = Math.abs(mov.amount);
      const movDate = new Date(mov.date);
      const movDesc = mov.description.toLowerCase();

      // Find best candidate
      let bestCandidate = null;
      let highestConfidence = 0;
      let matchReason = "";

      unmatchedInvoices.forEach(inv => {
         // Skip if already matched
         if (newMatches.some(m => m.invoiceId === inv.id)) return;

         let confidence = 0;
         const reasons = [];

         // 1. Amount Match (High Weight)
         if (Math.abs(inv.amount - amount) < 0.05) {
             confidence += 0.6;
             reasons.push("Monto exacto");
         } else {
             return; // If amount doesn't match, it's very risky to auto-match
         }

         // 2. Date Match (Medium Weight)
         const invDate = new Date(inv.dueDate); // Or issueDate, depending on logic. Usually payment is around due date.
         const daysDiff = Math.abs((movDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
         
         if (daysDiff <= 3) {
             confidence += 0.3;
             reasons.push(`Fecha cercana (${daysDiff}d)`);
         } else if (daysDiff <= 7) {
             confidence += 0.1;
             reasons.push(`Fecha aprox (${daysDiff}d)`);
         }

         // 3. Text Match (Medium Weight)
         // Check if provider name is in bank description
         const providerName = inv.providerName.toLowerCase();
         if (movDesc.includes(providerName) || providerName.includes(movDesc)) {
             confidence += 0.3;
             reasons.push("Nombre proveedor coincide");
         }
         
         // Check document number
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

      if (bestCandidate && highestConfidence >= 0.6) { // Threshold
        newMatches.push({ 
            movementId: mov.id, 
            invoiceId: bestCandidate.id,
            confidence: highestConfidence,
            reason: matchReason
        });
        matchesFound++;
      }
    });

    if (matchesFound > 0) {
      if (confirm(`🤖 IA de Conciliación:\n\nHe encontrado ${matchesFound} coincidencias con alta probabilidad.\n\nEjemplo: ${newMatches[0].reason}\n\n¿Deseas conciliarlas automáticamente?`)) {
        newMatches.forEach(m => onConciliate(m.movementId, m.invoiceId));
      }
    } else {
      alert("No se encontraron coincidencias automáticas claras. Por favor concilia manualmente seleccionando un ítem de cada columna.");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 relative">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            Centro de Conciliación Inteligente
          </h2>
          <p className="text-sm text-gray-500">
            Cruza tus movimientos bancarios con tus registros contables.
          </p>
        </div>
        <div className="flex gap-2">
            <button 
            onClick={handleAutoMatch}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-2 shadow-sm text-sm font-medium transition-all"
            >
            <CheckCircle2 className="w-4 h-4" />
            Auto-Conciliar con IA
            </button>
            <button 
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 shadow-sm text-sm font-medium"
            >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Extracto
            </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Column: Bank Movements */}
        <div className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm h-full">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="font-bold text-gray-700 text-sm">Extracto Bancario</span>
            </div>
            <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-500 font-mono">
              {unmatchedMovements.length} items
            </span>
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-3 bg-gray-50/50">
            {unmatchedMovements.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <CheckCircle2 className="w-12 h-12 mb-2 text-green-100" />
                    <p className="text-sm">Todo conciliado</p>
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
                        ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500 z-10" 
                        : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                    )}
                >
                    <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm">{mov.description}</span>
                        <span className="text-xs text-gray-400 font-mono mt-0.5">OP: {mov.operationNumber}</span>
                    </div>
                    <span className="font-mono font-bold text-red-600 text-sm whitespace-nowrap">
                        - S/ {Math.abs(mov.amount).toFixed(2)}
                    </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-100 pt-2 mt-2">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {mov.date.toLocaleDateString()}
                        </span>
                        {selectedMovement === mov.id && (
                            <span className="text-indigo-600 font-medium animate-pulse">Seleccionado</span>
                        )}
                    </div>
                </motion.div>
                ))
            )}
          </div>
        </div>

        {/* Right Column: System Records */}
        <div className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm h-full">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="font-bold text-gray-700 text-sm">Pagos en Sistema</span>
            </div>
            <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-500 font-mono">
              {unmatchedInvoices.length} items
            </span>
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-3 bg-gray-50/50">
            {unmatchedInvoices.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <CheckCircle2 className="w-12 h-12 mb-2 text-green-100" />
                    <p className="text-sm">Sin pagos pendientes</p>
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
                        ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500 z-10" 
                        : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                    )}
                >
                    <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm">{inv.providerName}</span>
                        <span className="text-xs text-gray-500 font-mono mt-0.5">{inv.documentType} {inv.documentNumber}</span>
                    </div>
                    <span className="font-mono font-bold text-gray-900 text-sm whitespace-nowrap">
                        S/ {inv.amount.toFixed(2)}
                    </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-100 pt-2 mt-2">
                         <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Vence: {inv.dueDate.toLocaleDateString()}
                        </span>
                        <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium text-[10px] uppercase tracking-wide">
                            En Tránsito
                        </span>
                    </div>
                </motion.div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Action Footer (Floating) */}
      <AnimatePresence>
        {selectedMovement && selectedInvoice && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white pl-6 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-6 z-50 border border-gray-700/50 backdrop-blur-sm bg-opacity-95"
          >
            <div className="flex items-center gap-3 text-sm">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Banco</span>
                    <span className="font-mono font-bold text-red-300">S/ {Math.abs(movements.find(m => m.id === selectedMovement)?.amount || 0).toFixed(2)}</span>
                </div>
                <div className="bg-gray-800 rounded-full p-1">
                     <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                </div>
                 <div className="flex flex-col items-start">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Sistema</span>
                    <span className="font-mono font-bold text-green-300">S/ {systemPayments.find(i => i.id === selectedInvoice)?.amount.toFixed(2) || 0}</span>
                </div>
            </div>
            
            <div className="h-8 w-px bg-gray-700"></div>
            
            <div className="flex gap-1">
                <button 
                onClick={handleMatch}
                className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-green-900/20 active:scale-95"
                >
                <Check className="w-4 h-4" />
                Conciliar
                </button>
                <button 
                onClick={() => { setSelectedMovement(null); setSelectedInvoice(null); }}
                className="hover:bg-gray-800 text-gray-400 hover:text-white p-2 rounded-full transition-colors"
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

import React, { useState, useMemo } from 'react';
import { Invoice } from './types';
import { motion } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  CheckSquare, 
  AlertCircle, 
  Filter, 
  Download, 
  Search,
  Clock,
  Landmark,
  Banknote,
  FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PaymentWorkbenchProps {
  invoices: Invoice[];
  onSchedulePayment: (invoiceIds: string[]) => void;
  bankBalance: number;
}

export const PaymentWorkbench: React.FC<PaymentWorkbenchProps> = ({ 
  invoices, 
  onSchedulePayment, 
  bankBalance 
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  
  // Filter only pending invoices
  const pendingInvoices = useMemo(() => {
    return invoices.filter(inv => 
      inv.status === 'pending' && 
      (inv.providerName.toLowerCase().includes(filterText.toLowerCase()) || 
       inv.documentNumber.includes(filterText) ||
       inv.providerRuc.includes(filterText))
    );
  }, [invoices, filterText]);

  const totalSelected = useMemo(() => {
    return pendingInvoices
      .filter(inv => selectedIds.has(inv.id))
      .reduce((sum, inv) => sum + inv.amount, 0);
  }, [pendingInvoices, selectedIds]);

  const projectedBalance = bankBalance - totalSelected;

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === pendingInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingInvoices.map(i => i.id)));
    }
  };

  // Liquidity Projection Bar Logic
  // We want to show how much of the liquidity is "committed" by selection
  const liquidityPercent = Math.min(100, (totalSelected / bankBalance) * 100);
  
  const handleExportBatch = (format: 'bcp' | 'bbva' | 'excel') => {
    // Mock export logic
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    alert(`Generando archivo ${format.toUpperCase()} para ${selectedIds.size} pagos...`);
  };

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500">
      
      {/* Top Panel: KPIs & Actions */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="flex flex-col md:flex-row">
          
          {/* KPIs Section */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            
            {/* Saldo Real */}
            <div className="p-6 flex flex-col justify-center">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Saldo Real (Banco)</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg text-muted-foreground font-medium">S/</span>
                <span className="text-3xl font-bold text-foreground">
                    {bankBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Seleccionado */}
            <div className="p-6 flex flex-col justify-center bg-primary/5">
              <span className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Seleccionado</span>
              <div className="flex items-baseline gap-1 text-primary">
                <span className="text-lg opacity-70 font-medium">S/</span>
                <span className="text-3xl font-bold">
                    {totalSelected.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Saldo Proyectado */}
            <div className="p-6 flex flex-col justify-center">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Saldo Proyectado</span>
              <div className={clsx(
                "flex items-baseline gap-1",
                projectedBalance < 0 ? "text-red-500" : "text-green-500"
              )}>
                <span className="text-lg opacity-70 font-medium">S/</span>
                <span className="text-3xl font-bold">
                    {projectedBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Section (Right Side) */}
          <div className="p-4 md:w-[320px] bg-muted/20 border-t md:border-t-0 md:border-l border-border flex flex-col gap-3 justify-center">
             <button
              disabled={selectedIds.size === 0}
              onClick={() => handleExportBatch('bcp')}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-md shadow-sm h-10 flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Exportar Telecrédito BCP</span>
              <Download className="w-4 h-4" />
            </button>
            <div className="flex gap-2">
                <button
                  disabled={selectedIds.size === 0}
                  onClick={() => handleExportBatch('bbva')}
                  className="flex-1 bg-background border border-input text-foreground font-medium rounded-md hover:bg-accent hover:text-accent-foreground h-9 text-xs transition-colors disabled:opacity-50"
                >
                  BBVA NetCash
                </button>
                <button
                  disabled={selectedIds.size === 0}
                  onClick={() => onSchedulePayment(Array.from(selectedIds))}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-md h-9 text-xs transition-colors disabled:opacity-50 shadow-sm"
                >
                  Pago Manual
                </button>
            </div>
          </div>
        </div>

        {/* Liquidity Projection Strip */}
        <div className="px-6 py-4 border-t border-border bg-card/50 flex flex-col gap-2">
          <div className="flex justify-between items-end">
             <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">Proyección Liquidez</span>
                <span className="text-[10px] text-muted-foreground/80">Cobertura de pagos seleccionados</span>
             </div>
             <span className="text-xs font-medium text-muted-foreground">
                {liquidityPercent.toFixed(1)}% Comprometido
             </span>
          </div>
          
          <div className="h-4 w-full bg-emerald-500/20 rounded-full overflow-hidden relative">
             {/* Background (Available) is the container bg */}
             {/* Foreground (Selected/Consumed) */}
             <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${liquidityPercent}%` }}
                className="h-full bg-indigo-500 absolute left-0 top-0"
             />
             {/* Decorative markers */}
             <div className="absolute inset-0 flex justify-between px-1">
                 {[...Array(10)].map((_, i) => (
                     <div key={i} className="w-px h-full bg-background/30" />
                 ))}
             </div>
          </div>
        </div>
      </div>

      {/* Filters & Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative flex-1 w-full max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar por proveedor, RUC o número de factura..." 
            className="w-full pl-10 pr-4 h-11 text-sm bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none px-4 h-11 text-sm font-medium text-foreground bg-background border border-input rounded-lg hover:bg-accent flex items-center justify-center gap-2 shadow-sm transition-colors">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
          <button className="flex-1 md:flex-none px-4 h-11 text-sm font-medium text-foreground bg-background border border-input rounded-lg hover:bg-accent flex items-center justify-center gap-2 shadow-sm transition-colors">
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-input text-primary focus:ring-primary/20"
                    checked={selectedIds.size === pendingInvoices.length && pendingInvoices.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-4">VENCIMIENTO</th>
                <th className="px-4 py-4">PROVEEDOR</th>
                <th className="px-4 py-4">DOCUMENTO</th>
                <th className="px-4 py-4">CATEGORÍA</th>
                <th className="px-4 py-4 text-right">IMPORTE</th>
                <th className="px-4 py-4">TENTATIVA PAGO</th>
                <th className="px-4 py-4">SEDE</th>
                <th className="px-6 py-4 text-center">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-muted rounded-full">
                         <FileText className="w-6 h-6 opacity-50" />
                      </div>
                      <p>No se encontraron facturas pendientes.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingInvoices.map((inv) => {
                  const isOverdue = new Date() > inv.dueDate;
                  const isSelected = selectedIds.has(inv.id);
                  
                  return (
                    <motion.tr 
                      key={inv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={clsx(
                        "group transition-colors cursor-pointer",
                        isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                      )}
                      onClick={() => toggleSelection(inv.id)}
                    >
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                            <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-input text-primary focus:ring-primary/20 cursor-pointer"
                            checked={isSelected}
                            onChange={() => toggleSelection(inv.id)}
                            />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className={clsx(
                          "flex items-center gap-2 font-medium",
                          isOverdue ? "text-red-500" : "text-foreground"
                        )}>
                            {isOverdue && <AlertCircle className="w-4 h-4" />}
                            {!isOverdue && <CalendarIcon className="w-4 h-4 text-muted-foreground" />}
                            {format(inv.dueDate, 'dd MMM', { locale: es })}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-foreground">{inv.providerName}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">RUC: {inv.providerRuc}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-foreground font-medium">{inv.documentType}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{inv.documentNumber}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                          {inv.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-foreground">
                        S/ {inv.amount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground text-sm">
                         {format(inv.tentativePaymentDate, 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {inv.branchId}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                          Pendiente
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
import { useMemo, useState, useRef, useEffect } from 'react';
import { Transaction, TransactionType, SystemSettings, InvoiceDraft } from '../../types';
import { format, getDaysInMonth, startOfMonth, addDays, isSameDay, getDate, parseISO, isToday, startOfYear, eachMonthOfInterval, endOfYear, isSameMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { ConfigStructure, ConceptDefinition, getSubcategories } from '../../data/initialData';
import { AlertTriangle, TrendingUp, TrendingDown, RefreshCw, CalendarCheck, ChevronRight, ChevronDown, Settings as SettingsIcon, Download, Maximize2, Minimize2, CalendarDays, CalendarRange } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { clsx } from 'clsx';
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

interface CashFlowGridProps {
  transactions: Transaction[];
  currentDate?: Date;
  config: ConfigStructure;
  systemSettings?: SystemSettings;
  onUpdateSettings?: (settings: SystemSettings) => void;
  onAddProjectedTransactions?: (txs: Transaction[]) => void;
  invoices?: InvoiceDraft[];
}

type ViewMode = 'daily' | 'annual';

export function CashFlowGrid({ transactions, currentDate = new Date(), config, systemSettings, onUpdateSettings, onAddProjectedTransactions, invoices = [] }: CashFlowGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Date Calculations
  const startDate = startOfMonth(currentDate);
  const daysInMonth = getDaysInMonth(currentDate);
  const startYear = startOfYear(currentDate);
  
  // Settings Dialog State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempBalance, setTempBalance] = useState<string>('');
  const [tempDate, setTempDate] = useState<string>('');

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };


  const openSettings = () => {
    if (systemSettings) {
        setTempBalance(systemSettings.initialBalance?.toString() || '0');
        setTempDate(systemSettings.initialBalanceDate || format(new Date(), 'yyyy-MM-dd'));
    }
    setIsSettingsOpen(true);
  };

  const saveSettings = () => {
      if (onUpdateSettings && systemSettings) {
          onUpdateSettings({
              ...systemSettings,
              initialBalance: parseFloat(tempBalance) || 0,
              initialBalanceDate: tempDate
          });
          setIsSettingsOpen(false);
          toast.success("Saldo inicial actualizado");
      }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };
  
  // Columns Generation
  const columns = useMemo(() => {
    if (viewMode === 'daily') {
        return Array.from({ length: daysInMonth }, (_, i) => addDays(startDate, i));
    } else {
        return eachMonthOfInterval({
            start: startYear,
            end: endOfYear(currentDate)
        });
    }
  }, [startDate, daysInMonth, viewMode, startYear, currentDate]);

  // Data Structure: category -> list of { subcategoryName, concepts } (so we can show subcategory in the grid)
  type SubcategoryRow = { subcategoryName: string; concepts: ConceptDefinition[] };
  const { incomeStructure, expenseStructure } = useMemo(() => {
    const incStructure = new Map<string, SubcategoryRow[]>();
    const expStructure = new Map<string, SubcategoryRow[]>();
    Object.entries(config).forEach(([cat, def]) => {
      const targetMap = def.type === 'income' ? incStructure : expStructure;
      const subs = getSubcategories(def, cat);
      targetMap.set(cat, subs.map(s => ({ subcategoryName: s.name, concepts: s.concepts })));
    });
    return { incomeStructure: incStructure, expenseStructure: expStructure };
  }, [config]);

  // Helper: match row by concept (new) or by subcategory when concept is legacy
  const getAmount = (category: string, conceptName: string, date: Date) => {
    const dateMatch = viewMode === 'daily'
      ? (t: Transaction) => isSameDay(new Date(t.date), date)
      : (t: Transaction) => isSameMonth(new Date(t.date), date);
    return transactions
      .filter(t =>
        t.category === category &&
        (t.concept === conceptName || (!t.concept && t.subcategory === conceptName)) &&
        dateMatch(t)
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };

  const getPeriodTotal = (type: 'income' | 'expense', date: Date) => {
    if (viewMode === 'daily') {
        return transactions
        .filter(t => t.type === type && isSameDay(new Date(t.date), date))
        .reduce((sum, t) => sum + Number(t.amount), 0);
    } else {
        return transactions
        .filter(t => t.type === type && isSameMonth(new Date(t.date), date))
        .reduce((sum, t) => sum + Number(t.amount), 0);
    }
  };

  // Projected invoice expenses by due date (unpaid invoices)
  const getProjectedInvoiceExpense = (date: Date): number => {
    if (invoices.length === 0) return 0;
    return invoices
      .filter(inv => {
        if (inv.status === 'paid') return false;
        const dueDate = new Date(inv.dueDate);
        if (viewMode === 'daily') return isSameDay(dueDate, date);
        return isSameMonth(dueDate, date);
      })
      .reduce((sum, inv) => sum + Number(inv.total), 0);
  };

  const getNetPeriodTotal = (date: Date) => {
      const inc = getPeriodTotal('income', date);
      const exp = getPeriodTotal('expense', date);
      const projected = getProjectedInvoiceExpense(date);
      return inc - exp - projected;
  };

  // Balance Calculations
  const initialBalance = useMemo(() => {
    // Determine the effective start date based on view mode
    const calculationStartDate = viewMode === 'daily' ? startDate : startYear;

    if (systemSettings?.initialBalanceDate && systemSettings.initialBalance !== undefined) {
        const balanceDate = parseISO(systemSettings.initialBalanceDate);
        const manualBalance = Number(systemSettings.initialBalance);
        
        // Case 1: Manual balance is in the future relative to view start
        if (calculationStartDate < balanceDate) {
             return transactions
              .filter(t => {
                  const d = new Date(t.date);
                  return !isNaN(d.getTime()) && d < calculationStartDate;
              })
              .reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
        }

        // Case 2: Manual balance is in the past or same
        const delta = transactions
            .filter(t => {
                const d = new Date(t.date);
                const dTime = d.getTime();
                const bTime = balanceDate.getTime();
                const sTime = calculationStartDate.getTime();
                return !isNaN(dTime) && dTime >= bTime && dTime < sTime;
            })
            .reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
            
        return manualBalance + delta;
    }

    // Default: Sum everything before start date
    return transactions
      .filter(t => {
          const d = new Date(t.date);
          return !isNaN(d.getTime()) && d < calculationStartDate;
      })
      .reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  }, [transactions, startDate, startYear, systemSettings, viewMode]);

  const { startBalances, endBalances, breakPoint, negativePoints } = useMemo(() => {
    let runningBalance = initialBalance;
    const sBalances = [];
    const eBalances = [];
    let firstBreak = null;
    const negatives = [];

    for (const colDate of columns) {
      sBalances.push(runningBalance);
      
      const periodFlow = getNetPeriodTotal(colDate);
      runningBalance += periodFlow;
      
      eBalances.push(runningBalance);

      if (runningBalance < 0) {
        if (!firstBreak) firstBreak = colDate;
        negatives.push(colDate);
      }
    }
    return { startBalances: sBalances, endBalances: eBalances, breakPoint: firstBreak, negativePoints: negatives };
  }, [columns, transactions, initialBalance, viewMode]);

  const handleProjectMonth = () => {
    if (!onAddProjectedTransactions) return;
    if (viewMode === 'annual') {
        toast.info("Cambia a vista diaria para proyectar transacciones.");
        return;
    }

    const newTxs: Transaction[] = [];
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    Object.entries(config).forEach(([catName, catDef]) => {
      const subs = getSubcategories(catDef, catName);
      subs.forEach(sub => {
        sub.concepts.forEach(concept => {
          if (concept.defaultDay) {
            const date = new Date(currentYear, currentMonth, concept.defaultDay);
            if (date.getMonth() !== currentMonth) return;
            newTxs.push({
              id: Math.random().toString(36).substr(2, 9),
              amount: 0,
              type: catDef.type,
              category: catName as any,
              subcategory: subs.length > 1 ? sub.name : undefined,
              concept: concept.name,
              description: 'Proyección Automática',
              date: date
            });
          }
        });
      });
    });

    onAddProjectedTransactions(newTxs);
    toast.success(`${newTxs.length} transacciones proyectadas`, {
      description: "Ajusta los montos en la tabla o formulario."
    });
  };

  const handleExport = () => {
      toast.success(`Exportando Flujo de Caja (${viewMode === 'daily' ? 'Diario' : 'Anual'}) a CSV...`);
  };

  const formatMoney = (amount: number, compact = false) => {
    if (amount === 0) return '-';
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 0 : 2,
    }).format(amount);
  };

  // Row Totals (Always sum horizontal)
  const getRowTotal = (category: string, conceptName: string) => {
      return columns.reduce((sum, date) => sum + getAmount(category, conceptName, date), 0);
  };

  const getCategoryTotal = (category: string, subcategoryRows: SubcategoryRow[]) => {
      return subcategoryRows.reduce((acc, row) => acc + row.concepts.reduce((a, c) => a + getRowTotal(category, c.name), 0), 0);
  };

  const getSectionTotal = (type: 'income' | 'expense') => {
      return columns.reduce((sum, date) => sum + getPeriodTotal(type, date), 0);
  };

  const renderSection = (structure: Map<string, SubcategoryRow[]>, title: string, isIncome: boolean) => {
    const entries = Array.from(structure.entries());
    if (entries.length === 0) return null;

    const sectionTotal = getSectionTotal(isIncome ? 'income' : 'expense');
    const sectionColor = isIncome ? '#22d3ee' : '#fb7185';
    const sectionBg = isIncome ? 'rgba(34,211,238,0.06)' : 'rgba(251,113,133,0.06)';

    return (
      <>
        {/* Section Header */}
        <tbody className="border-t-4 border-border">
            <tr style={{ background: sectionBg }}>
                <td colSpan={2} className="p-3 font-bold text-sm uppercase sticky left-0 z-10 border-r border-border backdrop-blur-sm min-w-[300px]"
                  style={{ color: sectionColor, background: sectionBg }}
                >
                    <div className="flex items-center gap-2">
                      {isIncome
                        ? <TrendingUp className="w-4 h-4" style={{ color: sectionColor, filter: `drop-shadow(0 0 5px ${sectionColor}80)` }} />
                        : <TrendingDown className="w-4 h-4" style={{ color: sectionColor, filter: `drop-shadow(0 0 5px ${sectionColor}80)` }} />
                      }
                      {title}
                    </div>
                </td>
                {columns.map(date => <td key={date.toISOString()} className="border-r border-border/50" style={{ background: sectionBg }}></td>)}
                <td className="sticky right-0 z-10 border-l border-border p-2 text-right font-bold" style={{ background: sectionBg }}></td>
            </tr>
        </tbody>

        {entries.map(([category, subcategoryRows]) => {
          const categoryColor = isIncome ? '#34d399' : '#fb7185';
          const headerBg = isIncome ? 'rgba(34,211,238,0.05)' : 'rgba(251,113,133,0.05)';
          const isExpanded = expandedCategories.has(category);
          const categoryTotal = getCategoryTotal(category, subcategoryRows);

          return (
            <tbody key={category} className="divide-y divide-border border-t border-border">
               <tr 
                className={`hover:bg-muted/40 cursor-pointer transition-colors font-bold text-xs uppercase group`}
                style={{ background: headerBg }}
                onClick={() => toggleCategory(category)}
              >
                <td className="sticky left-0 z-10 p-2 border-r border-border text-foreground flex items-center gap-2 min-w-[300px]" colSpan={2}
                  style={{ background: headerBg }}
                >
                    <button className="p-1 rounded-sm hover:bg-accent transition-colors">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <span style={{ color: categoryColor }}>{category}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-normal normal-case opacity-0 group-hover:opacity-100 transition-opacity">
                        (Ver detalle)
                    </span>
                </td>
                 {columns.map(date => {
                     const val = subcategoryRows.reduce((acc, row) => acc + row.concepts.reduce((a, c) => a + getAmount(category, c.name, date), 0), 0);
                     return (
                      <td key={`total-${category}-${date.toISOString()}`} className="p-2 text-right border-r border-border tabular-nums text-foreground/80">
                         {val !== 0 ? formatMoney(Math.abs(val), true) : ''}
                      </td>
                     );
                 })}
                 <td className="sticky right-0 z-10 p-2 bg-muted/20 border-l border-border tabular-nums font-bold text-foreground text-right">
                     {formatMoney(Math.abs(categoryTotal), true)}
                 </td>
              </tr>

              {isExpanded && subcategoryRows.flatMap((row) =>
                row.concepts.map((concept) => {
                  const rowTotal = getRowTotal(category, concept.name);
                  return (
                    <tr key={`${category}-${row.subcategoryName}-${concept.id}`} className="hover:bg-muted/30 transition-colors group animate-in fade-in slide-in-from-top-1 duration-200">
                      <td className={`sticky left-0 z-10 p-2 border-r border-border w-[40px] ${headerBg} opacity-50`}></td>
                      <td className="sticky left-[40px] z-10 bg-card p-2 border-r border-border font-medium text-foreground truncate w-[260px] pl-6 border-l-4 border-l-transparent group-hover:border-l-primary/50 transition-all text-xs">
                        <div className="flex items-center justify-between">
                          <span className="truncate mr-2" title={`${row.subcategoryName} — ${concept.name}`}>
                            <span className="text-muted-foreground">{row.subcategoryName}</span>
                            <span className="text-foreground ml-1.5">{concept.name}</span>
                          </span>
                          {!isIncome && (
                            <span className={`text-[9px] px-1 py-0.5 rounded border uppercase tracking-wider shrink-0 ${concept.flexibility === 'fixed' ? 'border-red-500/30 text-red-500' : 'border-blue-500/30 text-blue-500'}`}>
                              {concept.flexibility === 'fixed' ? 'Fijo' : 'Flex'}
                            </span>
                          )}
                        </div>
                      </td>
                      {columns.map(date => {
                         const val = getAmount(category, concept.name, date);
                         const isCurrent = viewMode === 'daily' ? isToday(date) : isSameMonth(date, new Date());
                         return (
                          <td key={date.toISOString()} className={clsx(
                              "p-2 text-right border-r border-border/40 tabular-nums text-xs transition-colors",
                              isCurrent && "bg-blue-50/50 dark:bg-blue-900/10"
                          )}>
                            {val !== 0 && (
                              <span className="text-foreground">
                                {formatMoney(Math.abs(val))}
                              </span>
                            )}
                          </td>
                         );
                      })}
                      <td className="sticky right-0 z-10 bg-muted/10 p-2 text-right font-bold border-l border-border text-xs text-foreground/70">
                          {formatMoney(Math.abs(rowTotal))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          );
        })}

        {/* SECTION TOTAL ROW */}
        <tbody className="border-t-2 border-border">
             <tr className="font-bold text-sm" style={{ background: isIncome ? 'rgba(34,211,238,0.1)' : 'rgba(251,113,133,0.1)' }}>
                <td className="sticky left-0 z-10 p-3 border-r border-border uppercase min-w-[300px]" colSpan={2}
                  style={{ color: isIncome ? '#22d3ee' : '#fb7185', background: isIncome ? 'rgba(34,211,238,0.1)' : 'rgba(251,113,133,0.1)' }}
                >
                   TOTAL {title}
                </td>
                {columns.map(date => {
                   const total = getPeriodTotal(isIncome ? 'income' : 'expense', date);
                   return (
                     <td key={`sectotal-${date.toISOString()}`} className="p-2 text-right border-r border-border tabular-nums text-foreground">
                       {total !== 0 ? formatMoney(Math.abs(total), true) : ''}
                     </td>
                   );
                })}
                <td className="sticky right-0 z-10 p-2 bg-muted/30 border-l border-border tabular-nums text-foreground font-bold text-right shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                   {formatMoney(Math.abs(sectionTotal), true)}
                </td>
             </tr>
        </tbody>
      </>
    );
  };

  return (
    <div 
        ref={containerRef} 
        className={clsx(
            "overflow-hidden flex flex-col transition-all duration-300",
            isFullscreen 
              ? "fixed inset-0 z-[100] rounded-none h-screen w-screen" 
              : "h-full rounded-2xl"
        )}
        style={{
          background: 'linear-gradient(145deg, #1A1826 0%, #130F24 100%)',
          border: '1px solid rgba(139,92,246,0.15)',
          boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
        }}
    >
      {/* ── TOOLBAR ─────────────────────────────────────────────── */}
      <div className="p-4 flex justify-between items-center shrink-0 flex-wrap gap-4"
        style={{ borderBottom: '1px solid rgba(139,92,246,0.12)', background: 'rgba(13,11,30,0.6)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
             <h3 className="font-bold text-base uppercase tracking-tight flex items-center gap-2" style={{ color: '#F0EEFF' }}>
                {viewMode === 'daily' ? format(currentDate, 'MMMM yyyy', { locale: es }) : `Flujo Anual ${format(currentDate, 'yyyy')}`}
             </h3>
             <span className="text-xs" style={{ color: '#6b5fa5' }}>
                {viewMode === 'daily' ? 'Vista detallada por días' : 'Vista consolidada por meses'}
             </span>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['daily', 'annual'] as const).map(mode => (
              <button key={mode}
                onClick={() => setViewMode(mode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                style={{
                  background: viewMode === mode ? 'rgba(34,211,238,0.12)' : 'transparent',
                  color: viewMode === mode ? '#22d3ee' : '#6b5fa5',
                  border: viewMode === mode ? '1px solid rgba(34,211,238,0.22)' : '1px solid transparent',
                }}
              >
                {mode === 'daily' ? <CalendarDays className="w-3.5 h-3.5" /> : <CalendarRange className="w-3.5 h-3.5" />}
                {mode === 'daily' ? 'Diario' : 'Anual'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
             {breakPoint && (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full font-medium text-sm animate-pulse mr-2"
                  style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.35)', color: '#fb7185' }}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span className="uppercase tracking-tight text-xs font-bold">Quiebre: {viewMode === 'daily' ? format(breakPoint, 'dd MMM', { locale: es }) : format(breakPoint, 'MMMM', { locale: es })}</span>
                </div>
              )}
            
            <button onClick={toggleFullscreen}
              className="h-8 w-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-white/8"
              style={{ color: '#6b5fa5' }}
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <div className="h-6 w-px mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <button onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all duration-200 hover:bg-white/6"
              style={{ color: '#8b7cf8', border: '1px solid rgba(139,92,246,0.2)' }}
            >
                <Download className="w-3.5 h-3.5" />
                Exportar
            </button>
            {viewMode === 'daily' && (
                <button onClick={handleProjectMonth}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all duration-200 hover:bg-cyan-500/15"
                  style={{ color: '#22d3ee', border: '1px solid rgba(34,211,238,0.22)', background: 'rgba(34,211,238,0.08)' }}
                >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    Proyectar
                </button>
            )}
        </div>
      </div>
      
      <ScrollArea className="w-full whitespace-nowrap h-full">
        <div className="w-max pb-4 min-w-full">
          <table className="w-full text-sm text-left border-collapse">
            {/* ── TABLE HEADER ────────────────────────────────── */}
            <thead className="sticky top-0 z-30"
              style={{ background: 'rgba(19,15,36,0.97)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(139,92,246,0.12)' }}
            >
              <tr>
                <th className="sticky left-0 z-40 p-3 min-w-[300px] font-bold text-xs uppercase tracking-wider border-r"
                  style={{ background: 'rgba(19,15,36,0.99)', borderColor: 'rgba(139,92,246,0.12)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em' }}
                  colSpan={2}
                >
                    Concepto
                </th>
                {columns.map(date => {
                  const isBreak = breakPoint && (viewMode === 'daily' ? isSameDay(date, breakPoint) : isSameMonth(date, breakPoint));
                  const isCurrent = viewMode === 'daily' ? isToday(date) : isSameMonth(date, new Date());
                  
                  return (
                    <th key={date.toISOString()}
                      className="p-2 min-w-[100px] text-center border-r font-normal transition-colors"
                      style={{
                        borderColor: 'rgba(139,92,246,0.1)',
                        background: isBreak 
                          ? 'rgba(251,113,133,0.15)' 
                          : isCurrent 
                            ? 'rgba(34,211,238,0.08)' 
                            : 'rgba(19,15,36,0.97)',
                      }}
                    >
                      <div className="text-[10px] uppercase" style={{ color: isBreak ? '#fb7185' : isCurrent ? '#22d3ee' : 'rgba(255,255,255,0.25)' }}>
                          {viewMode === 'daily' ? format(date, 'EEE', { locale: es }) : format(date, 'yyyy')}
                      </div>
                      <div className="font-bold text-base leading-none uppercase"
                        style={{ color: isBreak ? '#fb7185' : isCurrent ? '#22d3ee' : '#8b7cf8' }}
                      >
                          {viewMode === 'daily' ? format(date, 'd') : format(date, 'MMM', { locale: es })}
                      </div>
                    </th>
                  );
                })}
                <th className="sticky right-0 z-40 p-3 min-w-[120px] text-center font-bold border-l text-xs uppercase tracking-wider"
                  style={{ background: 'rgba(19,15,36,0.99)', borderColor: 'rgba(139,92,246,0.12)', color: 'rgba(255,255,255,0.3)', boxShadow: '-4px 0 16px rgba(0,0,0,0.4)', letterSpacing: '0.12em' }}
                >
                  TOTAL {viewMode === 'daily' ? 'MES' : 'AÑO'}
                </th>
              </tr>
            </thead>
            
            {/* Saldo Inicial */}
            <tbody className="divide-y" style={{ borderColor: 'rgba(139,92,246,0.08)' }}>
              <tr style={{ background: 'rgba(251,191,36,0.04)' }}>
                <td className="sticky left-0 z-10 p-2 border-r min-w-[300px]"
                  style={{ background: 'rgba(19,15,36,0.98)', borderColor: 'rgba(251,191,36,0.15)' }}
                  colSpan={2}
                >
                    <div className="flex items-center justify-between pl-2">
                        <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#fbbf24' }}>SALDO INICIAL</span>
                        {onUpdateSettings && (
                            <button className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-amber-500/15 transition-colors" style={{ color: '#fbbf24' }} onClick={openSettings} title="Ajustar saldo inicial">
                                <SettingsIcon className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </td>
                 {columns.map((date, i) => (
                    <td key={`saldo-${date.toISOString()}`} className="p-2 text-right border-r text-xs font-mono font-medium"
                      style={{ borderColor: 'rgba(251,191,36,0.08)', color: startBalances[i] < 0 ? '#fb7185' : '#8b7cf8' }}
                    >
                      {formatMoney(startBalances[i], true)}
                    </td>
                 ))}
                 <td className="sticky right-0 z-10 p-2 text-right border-l font-mono font-bold"
                   style={{ background: 'rgba(19,15,36,0.98)', borderColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', boxShadow: '-4px 0 16px rgba(0,0,0,0.4)' }}
                 >
                    {formatMoney(initialBalance, true)}
                 </td>
              </tr>
            </tbody>

            {/* INGRESOS SECTION */}
            {renderSection(incomeStructure, "INGRESOS", true)}

            {/* EGRESOS SECTION */}
            {renderSection(expenseStructure, "EGRESOS", false)}

            {/* FACTURAS PROYECTADAS (pending invoices by due date) */}
            {invoices.filter(inv => inv.status !== 'paid').length > 0 && (
              <tbody className="border-t-2" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
                <tr style={{ background: 'rgba(251,191,36,0.05)' }}>
                  <td className="sticky left-0 z-10 p-3 border-r min-w-[300px]"
                    style={{ background: 'rgba(19,15,36,0.98)', borderColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
                    colSpan={2}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider font-bold">FACTURAS POR VENCER (Proyectado)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
                        {invoices.filter(inv => inv.status !== 'paid').length} facturas
                      </span>
                    </div>
                  </td>
                  {columns.map(date => {
                    const val = getProjectedInvoiceExpense(date);
                    return (
                      <td key={`proj-inv-${date.toISOString()}`} className="p-2 text-right border-r font-mono text-xs font-medium"
                        style={{ borderColor: 'rgba(251,191,36,0.08)', color: val > 0 ? '#fbbf24' : 'transparent' }}
                      >
                        {val > 0 ? formatMoney(val, true) : ''}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 p-2 border-l text-right font-mono font-bold"
                    style={{ background: 'rgba(19,15,36,0.98)', borderColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', boxShadow: '-4px 0 16px rgba(0,0,0,0.4)' }}
                  >
                    {formatMoney(invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + Number(inv.total), 0), true)}
                  </td>
                </tr>
              </tbody>
            )}

            <tbody className="divide-y border-t-4" style={{ borderColor: 'rgba(139,92,246,0.15)' }}>
              {/* Net Flow Row */}
              <tr style={{ background: 'rgba(139,92,246,0.05)' }}>
                 <td className="sticky left-0 z-10 p-3 border-r uppercase tracking-wider min-w-[300px] text-xs font-bold"
                   style={{ background: 'rgba(13,11,30,0.98)', borderColor: 'rgba(139,92,246,0.12)', color: 'rgba(255,255,255,0.35)' }}
                   colSpan={2}
                 >
                   VARIACIÓN NETA (I - E - Proyectado)
                 </td>
                 {columns.map(date => {
                    const total = getNetPeriodTotal(date);
                    const hasProjected = getProjectedInvoiceExpense(date) > 0;
                    return (
                      <td key={`net-${date.toISOString()}`} className="p-2 text-right border-r font-mono text-xs font-bold"
                        style={{ 
                          borderColor: 'rgba(139,92,246,0.08)', 
                          color: total < 0 ? '#fb7185' : total > 0 ? '#34d399' : '#6b5fa5',
                          background: hasProjected ? 'rgba(251,191,36,0.04)' : 'transparent'
                        }}
                      >
                        {formatMoney(total, true)}
                      </td>
                    );
                 })}
                 <td className="sticky right-0 z-10 p-2 border-l text-right font-mono font-bold"
                   style={{ background: 'rgba(13,11,30,0.98)', borderColor: 'rgba(139,92,246,0.12)', boxShadow: '-4px 0 16px rgba(0,0,0,0.4)' }}
                 >
                   {(() => {
                        const totalIncome = getSectionTotal('income');
                        const totalExpense = getSectionTotal('expense');
                        const totalProjected = invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + Number(inv.total), 0);
                        const net = totalIncome - totalExpense - totalProjected;
                        return <span style={{ color: net >= 0 ? '#34d399' : '#fb7185' }}>{formatMoney(net, true)}</span>
                   })()}
                 </td>
              </tr>

              {/* Saldo Final Row */}
              <tr style={{ background: 'rgba(34,211,238,0.04)', borderTop: '2px solid rgba(34,211,238,0.15)' }}>
                 <td className="sticky left-0 z-10 p-3 border-r uppercase tracking-wider min-w-[300px] font-bold text-sm"
                   style={{ background: 'rgba(13,11,30,0.98)', borderColor: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}
                   colSpan={2}
                 >
                   SALDO PROYECTADO (DISPONIBLE)
                 </td>
                 {columns.map((date, i) => {
                    const hasRealPayment = transactions.some(t => {
                      const tDate = new Date(t.date);
                      if (viewMode === 'daily') return isSameDay(tDate, date) && t.type === 'expense';
                      return isSameMonth(tDate, date) && t.type === 'expense';
                    });
                    const isInPast = date < new Date();
                    return (
                      <td key={`endbal-${date.toISOString()}`} className="p-2 text-right border-r font-mono font-bold"
                        style={{ borderColor: 'rgba(34,211,238,0.08)', 
                          color: endBalances[i] < 0 ? '#fb7185' : isInPast ? '#34d399' : '#22d3ee',
                          background: endBalances[i] < 0 
                            ? 'rgba(251,113,133,0.06)' 
                            : isInPast && hasRealPayment 
                              ? 'rgba(52,211,153,0.04)' 
                              : 'transparent'
                        }}
                      >
                        {formatMoney(endBalances[i], true)}
                      </td>
                    );
                 })}
                 <td className="sticky right-0 z-10 p-2 border-l text-right font-mono font-bold text-lg"
                   style={{ background: 'rgba(13,11,30,0.98)', borderColor: 'rgba(34,211,238,0.15)', color: '#22d3ee', boxShadow: '-4px 0 16px rgba(0,0,0,0.4)' }}
                 >
                    {formatMoney(endBalances[endBalances.length - 1], true)}
                 </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
        <ScrollBar orientation="vertical" />
      </ScrollArea>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Ajuste de Saldo Inicial</DialogTitle>
                <DialogDescription>
                    Define un punto de partida manual para el flujo de caja. El sistema calculará el saldo sumando las transacciones a partir de esta fecha.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label>Fecha de Inicio (Corte)</Label>
                    <Input type="date" value={tempDate} onChange={(e) => setTempDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Saldo Inicial en esa fecha (S/)</Label>
                    <Input type="number" step="0.01" value={tempBalance} onChange={(e) => setTempBalance(e.target.value)} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancelar</Button>
                <Button onClick={saveSettings}>Guardar Ajuste</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
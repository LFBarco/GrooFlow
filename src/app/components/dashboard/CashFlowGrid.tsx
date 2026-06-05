import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import type { Transaction, SystemSettings, InvoiceDraft } from '../../types';
import {
  format,
  getDaysInMonth,
  startOfMonth,
  addDays,
  isSameDay,
  parseISO,
  isToday,
  startOfYear,
  eachMonthOfInterval,
  endOfYear,
  isSameMonth,
  endOfMonth,
  startOfDay,
  isValid,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ConfigStructure, ConceptDefinition, getSubcategories } from '../../data/initialData';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronUp,
  GripVertical,
  TrendingUp,
  TrendingDown,
  CalendarCheck,
  ChevronRight,
  ChevronDown,
  Settings as SettingsIcon,
  Download,
  Maximize2,
  Minimize2,
  CalendarDays,
  CalendarRange,
  Sparkles,
  Info,
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { clsx } from 'clsx';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { labelsMatch } from '../../utils/labelMatch';
import { formatAxisThousandsPEN, formatCurrencyEs } from '../../utils/numberFormat';
import { generateEntityId } from '../../utils/generateEntityId';
import { downloadCashFlowCsv } from '../../utils/cashFlowExportCsv';
import { goLiveIncludesTreasury } from '../../config/goLive';
import { parseTransactionDate } from '../../utils/transactionDate';
import type { Invoice as TreasuryInvoice } from '../treasury/types';
import {
  buildTripleLayerDailyMatrix,
  cellStorageKey,
  iterConceptRows,
  normalizeTreasuryInvoice,
  projectedDraftInvoicesExpense,
  projectedDraftInvoicesTotal,
  resolvedCell,
  sumIncomeExpenseForDay,
  type LayerVisibility,
  type ResolvedCashCell,
} from '../../utils/tripleLayerCashFlow';
import { buildAIIncomeEstimateMap } from '../../utils/tripleLayerAi';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

interface CashFlowGridProps {
  transactions: Transaction[];
  currentDate?: Date;
  config: ConfigStructure;
  systemSettings?: SystemSettings;
  onUpdateSettings?: (settings: SystemSettings) => void;
  onAddProjectedTransactions?: (txs: Transaction[]) => void;
  invoices?: InvoiceDraft[];
  treasuryInvoices?: Array<TreasuryInvoice | Record<string, unknown>>;
  onViewDateChange?: (d: Date) => void;
  onUpsertProjectedCell?: (payload: {
    category: string;
    subcategory?: string;
    concept?: string;
    type: 'income' | 'expense';
    date: Date;
    amount: number;
  }) => void;
}

type ViewMode = 'daily' | 'annual';

const MONTH_OPTIONS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function formatMoney(amount: number, compact = false) {
  if (Math.abs(amount) < 1e-9) return '—';
  return compact ? formatAxisThousandsPEN(amount) : formatCurrencyEs(amount, 2);
}

function cellClasses(
  colDate: Date,
  TODAY: Date,
  cell: ResolvedCashCell,
  isDaily: boolean
): string {
  if (!isDaily) return 'p-2 text-right border-r border-border/40 tabular-nums text-xs';
  const sod = startOfDay(TODAY);
  const sodCol = startOfDay(colDate);
  const past = sodCol < sod;
  const isCur = sodCol.getTime() === sod.getTime();
  let bg = '';
  if (past) bg = 'bg-zinc-800/85';
  else if (!past && !isCur) bg = 'bg-zinc-100/95 dark:bg-white/[0.04]';

  let text = 'text-muted-foreground';
  if (!past && cell.dominantLayer === 'PROJ' && Math.abs(cell.amount) > 1e-6) text = 'text-sky-500 font-medium';
  else if (!past && cell.dominantLayer === 'EST' && Math.abs(cell.amount) > 1e-6) text = 'text-muted-foreground italic';
  else if (past && Math.abs(cell.amount) > 1e-6) text = 'text-zinc-300';
  else if (!past && Math.abs(cell.amount) > 1e-6) text = 'text-foreground';

  const ring = isCur ? 'ring-2 ring-sky-500 ring-inset z-[1]' : '';

  return clsx(
    'p-1 text-right border-r border-white/10 tabular-nums text-xs transition-colors relative min-h-[38px]',
    bg,
    text,
    ring
  );
}

export function CashFlowGrid({
  transactions,
  currentDate = new Date(),
  config,
  systemSettings,
  onUpdateSettings,
  onAddProjectedTransactions,
  invoices = [],
  treasuryInvoices = [],
  onViewDateChange,
  onUpsertProjectedCell,
}: CashFlowGridProps) {
  const safeCurrentDate = isValid(currentDate) ? currentDate : new Date();
  const TODAY = new Date();
  const treasuryEnabled = goLiveIncludesTreasury();
  const dateKey = (d: Date) => String(d.getTime());
  const safeFormat = (d: Date, pattern: string) => (isValid(d) ? format(d, pattern, { locale: es }) : '—');
  /** Opciones año: debe incluir siempre `currentDate` o Radix Select revienta (pantalla en blanco en el chunk). */
  const yearSelectOptions = useMemo(() => {
    const yNow = new Date().getFullYear();
    const yCur = safeCurrentDate.getFullYear();
    const minY = Math.min(yNow - 10, yCur - 3);
    const maxY = Math.max(yNow + 6, yCur + 3);
    const yrs: number[] = [];
    for (let y = minY; y <= maxY; y++) yrs.push(y);
    return yrs.length ? yrs : [yNow];
  }, [safeCurrentDate]);

  const yearSelectValue =
    yearSelectOptions.includes(safeCurrentDate.getFullYear())
      ? String(safeCurrentDate.getFullYear())
      : String(yearSelectOptions[0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const didInitExpandCategoriesRef = useRef(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempBalance, setTempBalance] = useState<string>('');
  const [tempDate, setTempDate] = useState<string>('');
  const [layerReal, setLayerReal] = useState(true);
  const [layerProj, setLayerProj] = useState(true);
  const [layerEst, setLayerEst] = useState(true);
  const [isDecisionPanelCollapsed, setIsDecisionPanelCollapsed] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<{ kind: 'income' | 'expense'; category: string } | null>(null);
  const [aiEstimates, setAiEstimates] = useState<Map<string, number>>(() => new Map());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editDraftValue, setEditDraftValue] = useState<string>('');
  const persistedAiEstimates = systemSettings?.smartCashFlow?.aiIncomeEstimates;

  useEffect(() => {
    setAiEstimates(new Map(Object.entries(persistedAiEstimates ?? {})));
  }, [persistedAiEstimates]);

  const startDate = startOfMonth(safeCurrentDate);
  const daysInMonth = getDaysInMonth(safeCurrentDate);
  const startYear = startOfYear(safeCurrentDate);

  const visibility: LayerVisibility = useMemo(
    () => ({
      REAL: layerReal,
      PROJ: layerProj,
      EST: layerEst,
    }),
    [layerReal, layerProj, layerEst]
  );

  const treasuryNormalized = useMemo((): TreasuryInvoice[] => {
    return (treasuryInvoices ?? []).map((raw) =>
      typeof raw === 'object' &&
      raw !== null &&
      'providerName' in raw &&
      typeof (raw as TreasuryInvoice).status === 'string'
        ? (raw as TreasuryInvoice)
        : normalizeTreasuryInvoice(raw as Record<string, unknown>)
    );
  }, [treasuryInvoices]);

  const columns = useMemo(() => {
    if (viewMode === 'daily') {
      return Array.from({ length: daysInMonth }, (_, i) => addDays(startDate, i)).filter((d) =>
        isValid(d)
      );
    }
    return eachMonthOfInterval({ start: startYear, end: endOfYear(safeCurrentDate) }).filter((d) =>
      isValid(d)
    );
  }, [startDate, daysInMonth, viewMode, startYear, safeCurrentDate]);

  type SubcategoryRow = { subcategoryName: string; concepts: ConceptDefinition[] };
  const sortEntriesByOrder = useCallback(
    (entries: [string, SubcategoryRow[]][], kind: 'income' | 'expense') => {
      const order = systemSettings?.smartCashFlow?.categoryOrder?.[kind] ?? [];
      const rank = new Map(order.map((category, index) => [category, index]));
      return [...entries].sort((a, b) => {
        const ar = rank.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
        const br = rank.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
        if (ar !== br) return ar - br;
        return a[0].localeCompare(b[0]);
      });
    },
    [systemSettings?.smartCashFlow?.categoryOrder]
  );

  const { incomeStructure, expenseStructure } = useMemo(() => {
    const incStructure = new Map<string, SubcategoryRow[]>();
    const expStructure = new Map<string, SubcategoryRow[]>();
    Object.entries(config).forEach(([cat, def]) => {
      const targetMap = def.type === 'income' ? incStructure : expStructure;
      const subs = getSubcategories(def, cat);
      targetMap.set(
        cat,
        subs.map((s) => ({ subcategoryName: s.name, concepts: s.concepts }))
      );
    });
    return { incomeStructure: incStructure, expenseStructure: expStructure };
  }, [config]);

  /** Sin expandir categorías solo se ven cabeceras; muchos usuarios interpretan «no puedo hacer nada». Una sola vez al tener estructura. */
  useEffect(() => {
    if (didInitExpandCategoriesRef.current) return;
    const names = [...incomeStructure.keys(), ...expenseStructure.keys()];
    if (names.length === 0) return;
    didInitExpandCategoriesRef.current = true;
    setExpandedCategories(new Set(names));
  }, [incomeStructure, expenseStructure]);

  const updateCategoryOrder = useCallback(
    (kind: 'income' | 'expense', orderedCategories: string[]) => {
      if (!systemSettings || !onUpdateSettings) return;
      onUpdateSettings({
        ...systemSettings,
        smartCashFlow: {
          ...(systemSettings.smartCashFlow ?? {}),
          scheduleLines: systemSettings.smartCashFlow?.scheduleLines ?? [],
          categoryOrder: {
            income: systemSettings.smartCashFlow?.categoryOrder?.income ?? [],
            expense: systemSettings.smartCashFlow?.categoryOrder?.expense ?? [],
            [kind]: orderedCategories,
          },
        },
      });
    },
    [onUpdateSettings, systemSettings]
  );

  const moveCategory = useCallback(
    (kind: 'income' | 'expense', category: string, direction: -1 | 1) => {
      const structure = kind === 'income' ? incomeStructure : expenseStructure;
      const currentOrder = sortEntriesByOrder(Array.from(structure.entries()), kind).map(([name]) => name);
      const index = currentOrder.indexOf(category);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentOrder.length) return;
      const next = [...currentOrder];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      updateCategoryOrder(kind, next);
    },
    [expenseStructure, incomeStructure, sortEntriesByOrder, updateCategoryOrder]
  );

  const dropCategory = useCallback(
    (kind: 'income' | 'expense', targetCategory: string) => {
      if (!draggedCategory || draggedCategory.kind !== kind || draggedCategory.category === targetCategory) return;
      const structure = kind === 'income' ? incomeStructure : expenseStructure;
      const currentOrder = sortEntriesByOrder(Array.from(structure.entries()), kind).map(([name]) => name);
      const from = currentOrder.indexOf(draggedCategory.category);
      const to = currentOrder.indexOf(targetCategory);
      if (from < 0 || to < 0) return;
      const next = [...currentOrder];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      updateCategoryOrder(kind, next);
      setDraggedCategory(null);
    },
    [draggedCategory, expenseStructure, incomeStructure, sortEntriesByOrder, updateCategoryOrder]
  );

  const matrixDaily = useMemo(
    () =>
      buildTripleLayerDailyMatrix({
        config,
        transactions,
        treasuryInvoices: treasuryNormalized,
        monthAnchor: safeCurrentDate,
        TODAY,
        aiEstimates,
        applyDefaultDayEstimates: true,
      }),
    [config, transactions, treasuryNormalized, safeCurrentDate, TODAY, aiEstimates]
  );

  const hasTransactionForCell = useCallback(
    (category: string, conceptName: string, date: Date) =>
      transactions.some(
        (t) =>
          labelsMatch(t.category, category) &&
          (labelsMatch(t.concept, conceptName) || (!t.concept && labelsMatch(t.subcategory, conceptName))) &&
          isSameDay(parseTransactionDate(t.date), date)
      ),
    [transactions]
  );

  const getAiEstimateTotal = useCallback(
    (date: Date, filters?: { category?: string; subcategory?: string; conceptName?: string }) => {
      let total = 0;
      aiEstimates.forEach((amount, key) => {
        const [category, subcategory, conceptName, dayKey] = key.split('|');
        if (!category || !subcategory || !conceptName || !dayKey) return;
        if (filters?.category && !labelsMatch(category, filters.category)) return;
        if (filters?.subcategory && !labelsMatch(subcategory, filters.subcategory)) return;
        if (filters?.conceptName && !labelsMatch(conceptName, filters.conceptName)) return;
        const estimateDate = parseTransactionDate(dayKey);
        const samePeriod = viewMode === 'daily'
          ? isSameDay(estimateDate, date)
          : isSameMonth(estimateDate, date);
        if (!samePeriod) return;
        if (hasTransactionForCell(category, conceptName, estimateDate)) return;
        total += amount;
      });
      return total;
    },
    [aiEstimates, hasTransactionForCell, viewMode]
  );

  const getAmountAnnual = useCallback(
    (category: string, subcategory: string, conceptName: string, date: Date) => {
      const actual = transactions
        .filter(
          (t) =>
            labelsMatch(t.category, category) &&
            (!t.subcategory || labelsMatch(t.subcategory, subcategory)) &&
            (labelsMatch(t.concept, conceptName) || (!t.concept && labelsMatch(t.subcategory, conceptName))) &&
            (viewMode === 'daily'
              ? isSameDay(parseTransactionDate(t.date), date)
              : isSameMonth(parseTransactionDate(t.date), date))
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const estimated = getAiEstimateTotal(date, { category, subcategory, conceptName });
      return actual + estimated;
    },
    [getAiEstimateTotal, transactions, viewMode]
  );

  const getPeriodTotal = (type: 'income' | 'expense', date: Date) => {
    if (viewMode === 'daily') {
      return transactions
        .filter((t) => t.type === type && isSameDay(parseTransactionDate(t.date), date))
        .reduce((sum, t) => sum + Number(t.amount), 0);
    }
    const actual = transactions
      .filter((t) => t.type === type && isSameMonth(parseTransactionDate(t.date), date))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return type === 'income' ? actual + getAiEstimateTotal(date) : actual;
  };

  const getProjectedInvoiceExpense = (date: Date): number => {
    if (invoices.length === 0) return 0;
    return invoices
      .filter((inv) => {
        if (inv.status === 'paid') return false;
        const dueDate = new Date(`${String(inv.dueDate)}T12:00:00`);
        if (!isValid(dueDate)) return false;
        return viewMode === 'daily'
          ? isSameDay(dueDate, date)
          : isSameMonth(dueDate, date);
      })
      .reduce((sum, inv) => sum + Number(inv.total), 0);
  };

  /** Net usando triple capa (solo vista diaria) */
  const getNetTripleForDay = (date: Date) => {
    const { income, expense } = sumIncomeExpenseForDay(
      matrixDaily,
      visibility,
      config,
      date,
      TODAY
    );
    const draft = treasuryEnabled
      ? projectedDraftInvoicesExpense(invoices, date, safeCurrentDate)
      : 0;
    return income - expense - draft;
  };

  const getNetPeriodTotal = (date: Date) =>
    viewMode === 'daily'
      ? getNetTripleForDay(date)
      : getPeriodTotal('income', date) -
        getPeriodTotal('expense', date) -
        (treasuryEnabled ? getProjectedInvoiceExpense(date) : 0);

  const initialBalance = useMemo(() => {
    const calculationStartDate = viewMode === 'daily' ? startDate : startYear;

    if (systemSettings?.initialBalanceDate && systemSettings.initialBalance !== undefined) {
      const balanceDate = parseISO(systemSettings.initialBalanceDate);
      if (!isValid(balanceDate)) {
        return Number(systemSettings.initialBalance) || 0;
      }
      const manualBalance = Number(systemSettings.initialBalance);

      if (calculationStartDate < balanceDate) {
        return transactions
          .filter((t) => {
            const d = parseTransactionDate(t.date);
            return !isNaN(d.getTime()) && d < calculationStartDate;
          })
          .reduce(
            (acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
            0
          );
      }

      const delta = transactions
        .filter((t) => {
          const d = parseTransactionDate(t.date);
          const dTime = d.getTime();
          const bTime = balanceDate.getTime();
          const sTime = calculationStartDate.getTime();
          return !isNaN(dTime) && dTime >= bTime && dTime < sTime;
        })
        .reduce(
          (acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
          0
        );

      return manualBalance + delta;
    }

    return transactions
      .filter((t) => {
        const d = parseTransactionDate(t.date);
        return !isNaN(d.getTime()) && d < calculationStartDate;
      })
      .reduce(
        (acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
        0
      );
  }, [transactions, startDate, startYear, systemSettings, viewMode]);

  const { startBalances, endBalances } = useMemo(() => {
    let runningBalance = initialBalance;
    const sBalances: number[] = [];
    const eBalances: number[] = [];
    for (const colDate of columns) {
      sBalances.push(runningBalance);

      let periodFlow: number;
      if (viewMode === 'daily') {
        periodFlow = getNetTripleForDay(colDate);
      } else {
        periodFlow =
          getPeriodTotal('income', colDate) -
          getPeriodTotal('expense', colDate) -
          getProjectedInvoiceExpense(colDate);
      }

      runningBalance += periodFlow;
      eBalances.push(runningBalance);

    }

    return {
      startBalances: sBalances,
      endBalances: eBalances,
    };
  }, [
    columns,
    initialBalance,
    viewMode,
    matrixDaily,
    visibility,
    config,
    transactions,
    invoices,
    safeCurrentDate,
    TODAY,
    treasuryEnabled,
  ]);

  const chartDataDaily = useMemo(() => {
    if (viewMode !== 'daily') return [];
    return columns.map((d, i) => ({
      day: safeFormat(d, 'd'),
      saldo: endBalances[i],
    }));
  }, [viewMode, columns, endBalances]);

  const toggleCategory = (category: string) => {
    const next = new Set(expandedCategories);
    next.has(category) ? next.delete(category) : next.add(category);
    setExpandedCategories(next);
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
        initialBalanceDate: tempDate,
      });
      setIsSettingsOpen(false);
      toast.success('Saldo inicial actualizado');
    }
  };

  const handleProjectMonth = () => {
    if (!onAddProjectedTransactions) return;
    if (viewMode === 'annual') {
      toast.info('Cambia a vista diaria para proyectar transacciones.');
      return;
    }

    const newTxs: Transaction[] = [];
    const y = safeCurrentDate.getFullYear();
    const m = safeCurrentDate.getMonth();

    Object.entries(config).forEach(([catName, catDef]) => {
      const subs = getSubcategories(catDef, catName);
      subs.forEach((sub) => {
        sub.concepts.forEach((concept) => {
          if (concept.defaultDay) {
            const date = new Date(y, m, concept.defaultDay);
            if (date.getMonth() !== m) return;
            newTxs.push({
              id: generateEntityId('tx'),
              amount: 0,
              type: catDef.type,
              category: catName as Transaction['category'],
              subcategory: subs.length > 1 ? sub.name : undefined,
              concept: concept.name,
              description: 'Proyección Automática',
              date,
            });
          }
        });
      });
    });

    onAddProjectedTransactions(newTxs);
    toast.success(`${newTxs.length} transacciones proyectadas`);
  };

  const handleRunAI = () => {
    const incomeRows = iterConceptRows(config).filter((r) => r.kind === 'income');
    const map = buildAIIncomeEstimateMap(transactions, TODAY, incomeRows, {
      lookbackWeekdays: 12,
      minSamples: 12,
    });
    setAiEstimates(map);
    if (systemSettings && onUpdateSettings) {
      onUpdateSettings({
        ...systemSettings,
        smartCashFlow: {
          ...(systemSettings.smartCashFlow ?? { scheduleLines: [] }),
          scheduleLines: systemSettings.smartCashFlow?.scheduleLines ?? [],
          categoryOrder: systemSettings.smartCashFlow?.categoryOrder ?? { income: [], expense: [] },
          aiIncomeEstimates: Object.fromEntries(map),
          aiIncomeProjectionUpdatedAt: new Date().toISOString(),
        },
      });
    }
    toast.success(`Proyección de ingresos actualizada: ${map.size} día(s) estimado(s)`, {
      description: 'Promedio simple por concepto usando exactamente los últimos 12 días equivalentes.',
    });
  };

  const startEditCell = (key: string, current: number) => {
    setEditingCell(key);
    setEditDraftValue(current > 0 ? String(current) : '');
  };

  const commitEditCell = (payload: {
    category: string;
    subcategory: string;
    conceptName: string;
    type: 'income' | 'expense';
    date: Date;
  }) => {
    if (!onUpsertProjectedCell) return;
    const raw = editDraftValue.replace(',', '.').trim();
    const amt = raw === '' ? 0 : parseFloat(raw);
    if (Number.isNaN(amt) || amt < 0) {
      toast.error('Monto inválido');
      return;
    }
    onUpsertProjectedCell({
      category: payload.category,
      subcategory: payload.subcategory,
      concept: payload.conceptName,
      type: payload.type,
      date: payload.date,
      amount: amt,
    });
    setEditingCell(null);
  };

  const getRowTotalTriple = (
    category: string,
    subcategory: string,
    conceptName: string,
    isIncome: boolean
  ) => {
    return columns.reduce((sum, date) => {
      if (viewMode !== 'daily') {
        return sum + Math.abs(getAmountAnnual(category, subcategory, conceptName, date));
      }
      const cell = resolvedCell(
        matrixDaily,
        visibility,
        category,
        subcategory,
        conceptName,
        date,
        TODAY
      );
      return sum + cell.amount;
    }, 0);
  };

  const getCategoryTotalTriple = (category: string, subcategoryRows: SubcategoryRow[], isIncome: boolean) => {
    return subcategoryRows.reduce(
      (acc, row) =>
        acc +
        row.concepts.reduce(
          (a, c) => a + getRowTotalTriple(category, row.subcategoryName, c.name, isIncome),
          0
        ),
      0
    );
  };

  const renderSectionAnnual = (
    structure: Map<string, SubcategoryRow[]>,
    title: string,
    isIncome: boolean
  ) => {
    const entries = sortEntriesByOrder(Array.from(structure.entries()), isIncome ? 'income' : 'expense');
    if (entries.length === 0) return null;

    const sectionTotalForDate = (date: Date) =>
      entries.reduce(
        (categorySum, [category, subcategoryRows]) =>
          categorySum +
          subcategoryRows.reduce(
            (subcategorySum, row) =>
              subcategorySum +
              row.concepts.reduce(
                (conceptSum, concept) =>
                  conceptSum + getAmountAnnual(category, row.subcategoryName, concept.name, date),
                0
              ),
            0
          ),
        0
      );

    const st = columns.reduce((sum, date) => sum + sectionTotalForDate(date), 0);

    const sectionColor = isIncome ? '#22d3ee' : '#fb7185';
    const sectionBg = isIncome ? 'rgba(34,211,238,0.06)' : 'rgba(251,113,133,0.06)';

    return (
      <>
        <tbody className="border-t-4 border-border">
          <tr style={{ background: sectionBg }}>
            <td
              colSpan={2}
              className="p-3 font-bold text-sm uppercase sticky left-0 z-10 border-r border-border backdrop-blur-sm min-w-[300px]"
              style={{ color: sectionColor, background: sectionBg }}
            >
              <div className="flex items-center gap-2">
                {isIncome ? (
                  <TrendingUp className="w-4 h-4" style={{ color: sectionColor }} />
                ) : (
                  <TrendingDown className="w-4 h-4" style={{ color: sectionColor }} />
                )}
                {title}
              </div>
            </td>
            {columns.map((date) => (
              <td key={dateKey(date)} className="border-r border-border/50" style={{ background: sectionBg }} />
            ))}
            <td
              className="sticky right-0 z-10 border-l border-border p-2 text-right font-bold"
              style={{ background: sectionBg }}
            />
          </tr>
        </tbody>

        {entries.map(([category, subcategoryRows]) => {
          const categoryColor = isIncome ? '#34d399' : '#fb7185';
          const headerBg = isIncome ? 'rgba(34,211,238,0.05)' : 'rgba(251,113,133,0.05)';
          const isExpanded = expandedCategories.has(category);
          return (
            <tbody key={category} className="divide-y divide-border border-t border-border">
              <tr
                className="hover:bg-muted/40 cursor-pointer transition-colors font-bold text-xs uppercase group"
                style={{ background: headerBg }}
                onClick={() => toggleCategory(category)}
                draggable
                onDragStart={() => setDraggedCategory({ kind: isIncome ? 'income' : 'expense', category })}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  dropCategory(isIncome ? 'income' : 'expense', category);
                }}
                onDragEnd={() => setDraggedCategory(null)}
              >
                <td
                  className="sticky left-0 z-10 w-[120px] max-w-[120px] p-2 border-r border-border text-foreground"
                  style={{ background: headerBg }}
                  title={category}
                >
                  <div className="flex items-center gap-1">
                    <button type="button" className="p-1 rounded-sm hover:bg-accent transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate" style={{ color: categoryColor }}>{category}</span>
                  </div>
                </td>
                <td
                  className="sticky left-[120px] z-10 w-[180px] max-w-[180px] p-2 border-r border-border"
                  style={{ background: headerBg }}
                >
                  <span className="ml-auto flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      className="rounded border border-border px-1 text-[10px] hover:bg-accent"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveCategory(isIncome ? 'income' : 'expense', category, -1);
                      }}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border px-1 text-[10px] hover:bg-accent"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveCategory(isIncome ? 'income' : 'expense', category, 1);
                      }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </span>
                </td>
                {columns.map((date) => (
                  <td
                    key={`total-${category}-${dateKey(date)}`}
                    className="p-2 text-right border-r border-border tabular-nums text-foreground/80"
                  />
                ))}
                <td className="sticky right-0 z-10 p-2 bg-muted/20 border-l border-border tabular-nums font-bold text-foreground text-right">
                </td>
              </tr>

              {isExpanded &&
                subcategoryRows.flatMap((row) =>
                  row.concepts.map((concept) => {
                    const rowTotal = columns.reduce(
                      (s, date) => s + getAmountAnnual(category, row.subcategoryName, concept.name, date),
                      0
                    );
                    return (
                      <tr
                        key={`${category}-${row.subcategoryName}-${concept.id}`}
                        className="hover:bg-muted/30 transition-colors group animate-in fade-in slide-in-from-top-1 duration-200"
                      >
                        <td
                          className={clsx(
                            'sticky left-0 z-10 w-[120px] max-w-[120px] p-2 border-r border-border bg-card text-xs font-medium text-foreground',
                            headerBg
                          )}
                          title={row.subcategoryName}
                        >
                          <span className="block truncate">{row.subcategoryName}</span>
                        </td>
                        <td
                          className="sticky left-[120px] z-10 w-[180px] max-w-[180px] bg-card p-2 border-r border-border font-medium text-foreground border-l-4 border-l-transparent group-hover:border-l-primary/50 transition-all text-xs"
                          title={concept.name}
                        >
                          <span className="block truncate text-foreground">{concept.name}</span>
                          {!isIncome && (
                            <span
                              className={clsx(
                                'ml-2 text-[9px] px-1 py-0.5 rounded border uppercase shrink-0',
                                concept.flexibility === 'fixed'
                                  ? 'border-red-600/70 text-red-500 bg-red-950/40'
                                  : 'border-amber-500/50 text-amber-400 bg-amber-950/30'
                              )}
                            >
                              {concept.flexibility === 'fixed' ? 'Fijo' : 'Flexible'}
                            </span>
                          )}
                        </td>
                        {columns.map((date) => {
                          const val = getAmountAnnual(category, row.subcategoryName, concept.name, date);
                          const isCurrent = isSameMonth(date, new Date());
                          return (
                            <td
                              key={dateKey(date)}
                              className={clsx(
                                'p-2 text-right border-r border-border/40 tabular-nums text-xs',
                                isCurrent && 'bg-blue-50/50 dark:bg-blue-900/10'
                              )}
                            >
                              {val !== 0 && (
                                <span className="text-foreground">{formatMoney(Math.abs(val))}</span>
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

        <tbody className="border-t-2 border-border">
          <tr className="font-bold text-sm" style={{ background: isIncome ? 'rgba(34,211,238,0.1)' : 'rgba(251,113,133,0.1)' }}>
            <td className="sticky left-0 z-10 p-3 border-r border-border uppercase min-w-[300px]" colSpan={2} style={{ color: sectionColor }}>
              TOTAL {title}
            </td>
            {columns.map((date) => {
              const total = sectionTotalForDate(date);
              const displayTotal = isIncome
                ? total + (startBalances[columns.findIndex((d) => d.getTime() === date.getTime())] ?? 0)
                : total;
              return (
                <td key={`sectotal-${dateKey(date)}`} className="p-2 text-right border-r border-border tabular-nums">
                  {displayTotal !== 0 ? formatMoney(Math.abs(displayTotal), true) : ''}
                </td>
              );
            })}
            <td className="sticky right-0 z-10 p-2 bg-muted/30 border-l border-border tabular-nums font-bold text-right">
              {formatMoney(Math.abs(isIncome ? initialBalance + st : st), true)}
            </td>
          </tr>
        </tbody>
      </>
    );
  };

  const renderDailyRow = (
    category: string,
    row: SubcategoryRow,
    concept: ConceptDefinition,
    headerBg: string,
    categoryColorVar: string,
    isIncome: boolean
  ) => {
    const type = isIncome ? 'income' : ('expense' as const);
    const rowTotal = getRowTotalTriple(category, row.subcategoryName, concept.name, isIncome);

    return (
      <tr
        key={`${category}-${row.subcategoryName}-${concept.id}-daily`}
        className="hover:bg-white/5 transition-colors group animate-in fade-in duration-150"
      >
        <td
          className={clsx(
            'sticky left-0 z-20 w-[120px] max-w-[120px] p-2 border-r border-white/10 font-medium text-[11px] bg-[#161222]/95 backdrop-blur',
            headerBg
          )}
          title={row.subcategoryName}
        >
          <span className="block truncate text-zinc-100">{row.subcategoryName}</span>
        </td>
        <td
          className="sticky left-[120px] z-20 w-[180px] max-w-[180px] p-2 border-r border-white/10 font-medium text-[11px] bg-[#161222]/95 backdrop-blur"
          style={{ boxShadow: '4px 0 12px rgba(0,0,0,0.35)' }}
          title={concept.name}
        >
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <span className="min-w-0 truncate text-zinc-100">
              {concept.name}
            </span>
            {!isIncome && (
              <span
                className={clsx(
                  'text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap',
                  concept.flexibility === 'fixed'
                    ? 'bg-red-600/25 text-red-300 border border-red-600/40'
                    : 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                )}
              >
                {concept.flexibility === 'fixed' ? 'Fijo' : 'Flexible'}
              </span>
            )}
          </div>
        </td>

        {columns.map((colDate) => {
          const key = `${cellStorageKey(category, row.subcategoryName, concept.name, colDate)}`;
          const cell = resolvedCell(
            matrixDaily,
            visibility,
            category,
            row.subcategoryName,
            concept.name,
            colDate,
            TODAY
          );
          const sod = startOfDay(TODAY);
          const sodCol = startOfDay(colDate);
          const past = sodCol < sod;
          const editable =
            !!onUpsertProjectedCell &&
            !past &&
            viewMode === 'daily' &&
            !cell.locked &&
            sodCol >= sod &&
            !(Math.abs(cell.breakdown.REAL ?? 0) > 1e-6);

          const layerHint =
            cell.dominantLayer === 'PROJ'
              ? 'Proyectado/Tesorería: puede no aparecer igual que en Historial de transacciones.'
              : cell.dominantLayer === 'EST'
                ? 'Estimado: configuración/proyección, no solo historial.'
                : cell.dominantLayer === 'REAL'
                  ? 'Importe real: transacciones o pagos conciliados.'
                  : '';
          const instructional = editable
            ? 'Clic o doble clic para editar proyección del día.'
            : past
              ? 'Solo lectura: día pasado.'
              : Math.abs(cell.breakdown.REAL ?? 0) > 1e-6
                ? 'Solo lectura: hay movimiento real; use «Transacciones».'
                : cell.locked
                  ? 'Solo lectura: celda bloqueada.'
                  : '';
          const cellTitle = [layerHint, instructional].filter(Boolean).join(' — ');

          if (editingCell === key && editable) {
            return (
              <td key={key} className={cellClasses(colDate, TODAY, cell, true)}>
                <Input
                  className="h-7 text-xs text-right tabular-nums bg-white/95 text-slate-900 border-sky-500"
                  type="number"
                  step="0.01"
                  min={0}
                  autoFocus
                  value={editDraftValue}
                  onChange={(e) => setEditDraftValue(e.target.value)}
                  onBlur={() =>
                    commitEditCell({
                      category,
                      subcategory: row.subcategoryName,
                      conceptName: concept.name,
                      type,
                      date: colDate,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === 'Escape') setEditingCell(null);
                  }}
                />
              </td>
            );
          }

          return (
            <td
              key={key}
              role="gridcell"
              className={clsx(cellClasses(colDate, TODAY, cell, true), editable && 'cursor-pointer select-none')}
              title={cellTitle || undefined}
              onClick={
                editable
                  ? () => {
                      if (editingCell === key) return;
                      startEditCell(key, Math.abs(cell.amount));
                    }
                  : undefined
              }
              onDoubleClick={
                editable
                  ? () => startEditCell(key, Math.abs(cell.amount))
                  : undefined
              }
            >
              {!past && editable && Math.abs(cell.amount) < 1e-9 && (
                <span className="text-[10px] text-zinc-500 opacity-70">editar</span>
              )}
              {Math.abs(cell.amount) > 1e-9 ? (
                <span>{formatMoney(Math.abs(cell.amount), true)}</span>
              ) : (
                ''
              )}
            </td>
          );
        })}

        <td className="sticky right-0 z-20 p-2 text-right font-semibold border-l border-white/10 bg-[#161222]/98 text-[11px] text-zinc-200 tabular-nums shadow-[-8px_0_16px_rgba(0,0,0,0.55)]">
          {formatMoney(Math.abs(rowTotal), true)}
        </td>
      </tr>
    );
  };

  const renderSectionDaily = (structure: Map<string, SubcategoryRow[]>, title: string, isIncome: boolean) => {
    const entries = sortEntriesByOrder(Array.from(structure.entries()), isIncome ? 'income' : 'expense');
    if (!entries.length) return null;

    const sectionColor = isIncome ? '#38bdf8' : '#fb7185';
    const sectionBg = isIncome ? 'rgba(56,189,248,0.06)' : 'rgba(251,113,133,0.06)';

    return (
      <>
        <tbody className="border-t-4 border-white/10">
          <tr style={{ background: sectionBg }}>
            <td
              colSpan={2}
              className="sticky left-0 z-20 p-3 font-bold text-xs uppercase min-w-[300px] border-r border-white/10"
              style={{
                background: '#13101f',
                color: sectionColor,
                boxShadow: '4px 0 24px rgba(0,0,0,0.45)',
              }}
            >
              <div className="flex items-center gap-2">
                {isIncome ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {title}
              </div>
            </td>
            {columns.map((d) => (
              <td key={String(d)} className="border-r border-white/5 bg-[#161222]/95" />
            ))}
            <td className="sticky right-0 z-20 bg-[#13101f] border-l border-white/10" />
          </tr>
        </tbody>

        {entries.map(([category, subcategoryRows]) => {
          const categoryColorVis = sectionColor;
          const headerBg = isIncome ? 'rgba(56,189,248,0.05)' : 'rgba(251,113,133,0.05)';
          const isExpanded = expandedCategories.has(category);
          return (
            <tbody key={`d-${category}`} className="border-t border-white/5">
              <tr
                className="group cursor-pointer hover:bg-white/5 transition-colors font-bold text-[11px] uppercase"
                style={{ background: headerBg }}
                onClick={() => toggleCategory(category)}
                draggable
                onDragStart={() => setDraggedCategory({ kind: isIncome ? 'income' : 'expense', category })}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  dropCategory(isIncome ? 'income' : 'expense', category);
                }}
                onDragEnd={() => setDraggedCategory(null)}
              >
                <td
                  className="sticky left-0 z-20 w-[120px] max-w-[120px] p-2 border-r border-white/10 bg-[#161222]"
                  style={{ color: categoryColorVis }}
                  title={category}
                >
                  <div className="flex items-center gap-1">
                    <button type="button" className="p-1 rounded hover:bg-white/10">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate">{category}</span>
                  </div>
                </td>
                <td className="sticky left-[120px] z-20 w-[180px] max-w-[180px] p-2 border-r border-white/10 bg-[#161222]">
                  <span className="ml-auto flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      className="rounded border border-white/10 px-1 text-[10px] hover:bg-white/10"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveCategory(isIncome ? 'income' : 'expense', category, -1);
                      }}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="rounded border border-white/10 px-1 text-[10px] hover:bg-white/10"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveCategory(isIncome ? 'income' : 'expense', category, 1);
                      }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </span>
                </td>
                {columns.map((date) => {
                  const sodCol = startOfDay(date);
                  const sodToday = startOfDay(TODAY);
                  const cls = sodCol < sodToday ? 'bg-zinc-800/70' : 'bg-transparent';
                  return (
                    <td
                      key={`cat-tot-${category}-${dateKey(date)}`}
                      className={clsx('p-2 text-right border-r border-white/10 text-[10px] tabular-nums text-zinc-400', cls)}
                    />
                  );
                })}
                <td className="sticky right-0 z-20 bg-[#161222] border-l border-white/10 font-bold tabular-nums text-right text-xs text-white">
                </td>
              </tr>

              {isExpanded &&
                subcategoryRows.flatMap((row) =>
                  row.concepts.map((concept) =>
                    renderDailyRow(category, row, concept, headerBg, categoryColorVis, isIncome)
                  )
                )}
            </tbody>
          );
        })}

        <tbody className="border-t-2 border-white/10">
          <tr className="font-bold text-[11px] uppercase" style={{ background: sectionBg }}>
            <td
              colSpan={2}
              className="sticky left-0 z-20 p-2 border-r border-white/10 min-w-[300px] bg-[#13101f]"
              style={{ color: sectionColor }}
            >
              TOTAL {title}
            </td>
            {columns.map((date, index) => {
              const { income, expense } = sumIncomeExpenseForDay(matrixDaily, visibility, config, date, TODAY);
              const total = isIncome ? income + (startBalances[index] ?? 0) : expense;
              return (
                <td
                  key={`daily-section-total-${title}-${dateKey(date)}`}
                  className="p-2 text-right border-r border-white/10 text-[10px] tabular-nums"
                  style={{ color: sectionColor }}
                >
                  {total !== 0 ? formatMoney(Math.abs(total), true) : ''}
                </td>
              );
            })}
            <td
              className="sticky right-0 z-20 p-2 bg-[#13101f] border-l border-white/10 tabular-nums font-bold text-right"
              style={{ color: sectionColor }}
            >
              {formatMoney(
                Math.abs(
                  (isIncome ? initialBalance : 0) +
                    columns.reduce((total, date) => {
                      const { income, expense } = sumIncomeExpenseForDay(
                        matrixDaily,
                        visibility,
                        config,
                        date,
                        TODAY
                      );
                      return total + (isIncome ? income : expense);
                    }, 0)
                ),
                true
              )}
            </td>
          </tr>
        </tbody>
      </>
    );
  };

  const liquidityAlerts =
    viewMode === 'daily'
      ? columns
          .map((d, i) => ({ d, i }))
          .filter(({ i }) => endBalances[i]! < -0.01)
          .slice(0, 4)
      : [];

  /** Serie diaria ingresos / egresos (matriz triple capa) para mini gráficos sidebar */
  const sidebarDailyFlow = useMemo(() => {
    if (viewMode !== 'daily') return [];
    return columns.map((d) => {
      const { income, expense } = sumIncomeExpenseForDay(matrixDaily, visibility, config, d, TODAY);
      const draft = treasuryEnabled
        ? projectedDraftInvoicesExpense(invoices, d, safeCurrentDate)
        : 0;
      return { income, expense: expense + draft };
    });
  }, [viewMode, columns, matrixDaily, visibility, config, TODAY, invoices, safeCurrentDate, treasuryEnabled]);

  /** Tendencias % comparando mitades del mes hasta hoy */
  const sidebarBudgetTrend = useMemo(() => {
    if (sidebarDailyFlow.length === 0) return { incPct: 0, expPct: 0 };
    const todayIx = columns.findIndex((d) => isToday(d));
    const upto = todayIx >= 0 ? todayIx + 1 : sidebarDailyFlow.length;
    const slice = sidebarDailyFlow.slice(0, upto);
    const mid = Math.max(1, Math.floor(slice.length / 2));
    const aI = slice.slice(0, mid).reduce((s, x) => s + x.income, 0) / mid;
    const bI = slice.slice(mid).length
      ? slice.slice(mid).reduce((s, x) => s + x.income, 0) / (slice.length - mid)
      : aI;
    const aE = slice.slice(0, mid).reduce((s, x) => s + x.expense, 0) / mid;
    const bE = slice.slice(mid).length
      ? slice.slice(mid).reduce((s, x) => s + x.expense, 0) / (slice.length - mid)
      : aE;
    const incPct = aI > 10 ? ((bI - aI) / aI) * 100 : 0;
    const expPct = aE > 10 ? ((bE - aE) / aE) * 100 : 0;
    return { incPct: Math.round(incPct * 10) / 10, expPct: Math.round(expPct * 10) / 10 };
  }, [sidebarDailyFlow, columns]);

  const monthSummary = viewMode === 'daily' &&
    ({
      ti: iterConceptRows(config)
        .filter((r) => r.kind === 'income')
        .reduce(
          (s, r) =>
            s +
            columns.reduce(
              (s2, date) =>
                s2 +
                resolvedCell(matrixDaily, visibility, r.category, r.subcategory, r.conceptName, date, TODAY)
                  .amount,
              0
            ),
          0
        ),
      te: iterConceptRows(config)
        .filter((r) => r.kind === 'expense')
        .reduce(
          (s, r) =>
            s +
            columns.reduce(
              (s2, date) =>
                s2 +
                resolvedCell(matrixDaily, visibility, r.category, r.subcategory, r.conceptName, date, TODAY)
                  .amount,
              0
            ),
          0
        ),
      draftTotal: treasuryEnabled ? projectedDraftInvoicesTotal(invoices, safeCurrentDate) : 0,
    });

  const viewIsEntirelyPastMonth =
    viewMode === 'daily' && endOfMonth(safeCurrentDate) < startOfDay(TODAY);

  const handleExportCsv = () => {
    if (viewMode !== 'daily') {
      toast.info('Cambia a vista diaria para exportar la matriz del mes.');
      return;
    }
    const monthLabel = format(safeCurrentDate, 'yyyy-MM', { locale: es });
    downloadCashFlowCsv({
      filename: `flujo-caja-${monthLabel}.csv`,
      columns,
      matrixDaily,
      visibility,
      config,
      today: TODAY,
      endBalances,
      initialBalance,
    });
    toast.success('CSV exportado correctamente');
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        'flex min-h-0 w-full flex-1 overflow-hidden transition-all duration-300',
        isFullscreen
          ? 'fixed inset-0 z-[45] h-screen w-screen rounded-none flex-col lg:flex-row max-md:inset-0 md:top-0 md:right-0 md:bottom-0 md:left-[var(--grooflow-sidebar-w,256px)] md:w-auto'
          : 'h-full max-h-full min-h-[280px] flex-col gap-4 rounded-2xl lg:flex-row lg:gap-4'
      )}
      style={{
        background: 'linear-gradient(155deg,#141226 0%,#0f0d1a 100%)',
        border: '1px solid rgba(99,102,241,0.18)',
      }}
    >
      <div className={clsx('flex min-h-0 w-full flex-1 min-w-0 flex-col', isFullscreen && 'w-full')}>
        {/* Toolbar */}
        <div
          className="p-3 md:p-4 flex flex-wrap justify-between gap-4 shrink-0 items-start"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}
        >
          <div className="space-y-1">
            <h3 className="font-bold text-base md:text-lg text-white tracking-tight">Flujo de Caja · Triple Capa</h3>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-violet-200/75">
              <span className="font-mono">TODAY:</span>
              <span className="rounded bg-sky-500/20 px-2 py-0.5 border border-sky-500/30 text-sky-200">{format(TODAY, "dd/MM/yyyy EEE", { locale: es })}</span>
              <span className="opacity-75 max-w-[min(100%,520px)]">
                Días pasados solo lectura · Filas bajo cada categoría (plegar con la fila gris) · Celda editable: día de hoy o futuro y sin
                movimiento real; un clic o doble clic.
              </span>
            </div>
            {viewIsEntirelyPastMonth && (
              <p className="text-[11px] text-amber-200/95 rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-2 max-w-2xl">
                Este mes es anterior al actual: toda la grilla es solo revisión. Elige el mes vigente o uno con fechas futuras para poder
                proyectar importes en la matriz.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            {viewMode === 'daily' && onViewDateChange && (
              <div className="flex gap-2 items-center">
                <Select
                  value={String(safeCurrentDate.getMonth())}
                  onValueChange={(v) =>
                    onViewDateChange(new Date(safeCurrentDate.getFullYear(), Number(v), 1))
                  }
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs bg-zinc-900/80 border-violet-500/30 text-white">
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[220px]">
                    {MONTH_OPTIONS.map((m, mi) => (
                      <SelectItem key={String(mi)} value={String(mi)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={yearSelectValue}
                  onValueChange={(v) =>
                    onViewDateChange(new Date(Number(v), safeCurrentDate.getMonth(), 1))
                  }
                >
                  <SelectTrigger className="h-8 w-[100px] text-xs bg-zinc-900/80 border-violet-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    {yearSelectOptions.map((yy) => (
                      <SelectItem key={yy} value={String(yy)}>
                        {yy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-4 items-center text-[11px] text-zinc-300">
              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <Checkbox checked={layerEst} onCheckedChange={(v) => setLayerEst(!!v)} />
                Estimado
              </label>
              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <Checkbox checked={layerReal} onCheckedChange={(v) => setLayerReal(!!v)} />
                Real
              </label>
              <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <Checkbox checked={layerProj} onCheckedChange={(v) => setLayerProj(!!v)} />
                Proyectado
              </label>
            </div>

            <Button
              type="button"
              size="sm"
              className="h-9 gap-1 bg-violet-600 hover:bg-violet-500 border border-violet-400/30 text-white"
              onClick={handleRunAI}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Actualizar proyección ingresos
            </Button>

            <div className="flex gap-1 p-1 rounded-lg bg-zinc-900/80 border border-white/10">
              {(['daily', 'annual'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    viewMode === mode
                      ? 'bg-sky-600/50 text-sky-50 border border-sky-500/40'
                      : 'text-zinc-500 border border-transparent'
                  )}
                >
                  {mode === 'daily' ? (
                    <>
                      <CalendarDays className="inline w-3.5 h-3.5 mr-1" />
                      Diario
                    </>
                  ) : (
                    <>
                      <CalendarRange className="inline w-3.5 h-3.5 mr-1" />
                      Anual
                    </>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              title={isFullscreen ? 'Salir de vista ampliada' : 'Ampliar vista'}
              aria-label={isFullscreen ? 'Salir de vista ampliada' : 'Ampliar vista'}
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs border-violet-500/30 text-violet-200"
              onClick={handleExportCsv}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Exportar
            </Button>
            {viewMode === 'daily' && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs bg-cyan-900/40 text-cyan-100 border border-cyan-600/30"
                onClick={handleProjectMonth}
              >
                <CalendarCheck className="w-3.5 h-3.5 mr-1" />
                Proyectar
              </Button>
            )}
          </div>
        </div>

        {viewMode === 'daily' && chartDataDaily.length > 0 && (
          <div className="h-[120px] min-h-[120px] shrink-0 px-4 pt-2">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Evolución saldo final (mes)</p>
            <div style={{ width: '100%', height: 96 }}>
              <ResponsiveContainer width="100%" height={96}>
                <LineChart data={chartDataDaily}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} width={44} tickFormatter={(v) => formatMoney(Number(v), true)} />
                  <Tooltip
                    formatter={(v: number) => [formatMoney(v), 'Saldo']}
                    contentStyle={{ background: '#1e1b2e', border: '1px solid #4c1d95', fontSize: 11 }}
                  />
                  <Line type="monotone" dataKey="saldo" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 w-full overflow-auto">
          <div className="w-max min-w-full pb-4">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 z-30 border-b border-white/10" style={{ background: '#120f1c' }}>
                <tr>
                  <th className="sticky left-0 z-40 w-[120px] min-w-[120px] p-2 text-[10px] font-bold uppercase tracking-widest border-r border-white/10 text-zinc-500 bg-[#120f1c]">
                    Categoría
                  </th>
                  <th className="sticky left-[120px] z-40 w-[180px] min-w-[180px] p-2 text-[10px] font-bold uppercase tracking-widest border-r border-white/10 text-zinc-500 bg-[#120f1c]">
                    Detalle
                  </th>
                  {columns.map((date) => {
                    const isDaily = viewMode === 'daily';
                    const todayCol = isDaily && isToday(date);
                    const sod = startOfDay(TODAY);
                    const past = isDaily && startOfDay(date) < sod;
                    return (
                      <th
                        key={dateKey(date)}
                        className={clsx(
                          'p-1.5 min-w-[72px] text-center border-r border-white/10 font-medium',
                          todayCol && 'bg-sky-900/30',
                          past && 'bg-zinc-800/90'
                        )}
                      >
                        <div className={clsx('text-[10px]', todayCol ? 'text-sky-300' : past ? 'text-zinc-500' : 'text-zinc-400')}>
                          {isDaily ? safeFormat(date, 'EEE').slice(0, 3) : safeFormat(date, 'yyyy')}
                        </div>
                        <div className={clsx('text-sm font-bold', todayCol ? 'text-sky-200' : 'text-violet-200')}>
                          {isDaily ? safeFormat(date, 'd') : safeFormat(date, 'MMM')}
                        </div>
                      </th>
                    );
                  })}
                  <th className="sticky right-0 z-40 p-2 min-w-[100px] text-center text-[10px] font-bold uppercase tracking-widest border-l border-white/10 text-zinc-500 bg-[#120f1c]">
                    Total
                  </th>
                </tr>
              </thead>

              {/* Saldo inicial */}
              <tbody>
                <tr className="border-b border-amber-500/20">
                  <td
                    colSpan={2}
                    className="sticky left-0 z-20 p-2 border-r border-white/10 bg-[#1a1528]"
                  >
                    <div className="flex items-center justify-between pl-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Saldo inicial</span>
                      {onUpdateSettings && (
                        <button type="button" className="text-amber-400 hover:bg-amber-500/10 rounded p-1" onClick={openSettings}>
                          <SettingsIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  {columns.map((date, i) => (
                    <td
                      key={`s-${i}`}
                      className="p-2 text-right border-r border-white/10 text-[11px] font-mono text-amber-200/90 bg-zinc-900/40"
                    >
                      {formatMoney(startBalances[i] ?? 0, true)}
                    </td>
                  ))}
                  <td className="sticky right-0 z-20 p-2 text-right font-mono font-bold text-amber-200 border-l border-white/10 bg-[#1a1528]">
                    {formatMoney(initialBalance, true)}
                  </td>
                </tr>
              </tbody>

              {viewMode === 'daily' ? (
                <>
                  {renderSectionDaily(incomeStructure, 'Ingresos', true)}
                  {renderSectionDaily(expenseStructure, 'Egresos', false)}
                </>
              ) : (
                <>
                  {renderSectionAnnual(incomeStructure, 'Ingresos', true)}
                  {renderSectionAnnual(expenseStructure, 'Egresos', false)}
                </>
              )}

              {treasuryEnabled &&
                invoices.filter((inv) => inv.status !== 'paid').length > 0 &&
                viewMode === 'daily' && (
                <tbody className="border-t border-amber-500/30">
                  <tr>
                    <td colSpan={2} className="sticky left-0 z-20 p-2 border-r border-white/10 text-amber-200 text-[10px] font-bold uppercase bg-[#1e1830]">
                      Facturas por vencer (capa proyectada)
                    </td>
                    {columns.map((date) => {
                      const v = projectedDraftInvoicesExpense(invoices, date, safeCurrentDate);
                      return (
                        <td key={String(date)} className="p-2 text-right border-r border-white/10 text-amber-200/90 text-[11px] tabular-nums bg-zinc-900/25">
                          {v > 0 ? formatMoney(v, true) : ''}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-20 text-right p-2 border-l border-white/10 text-amber-200 font-bold">
                      {formatMoney(projectedDraftInvoicesTotal(invoices, safeCurrentDate), true)}
                    </td>
                  </tr>
                </tbody>
              )}

              <tbody className="border-t-2 border-violet-500/30">
                <tr>
                  <td colSpan={2} className="sticky left-0 z-20 p-2 text-[10px] font-bold uppercase text-zinc-400 bg-[#141022] border-r border-white/10">
                    Variación neta
                  </td>
                  {columns.map((date, i) => {
                    const total = getNetPeriodTotal(date);
                    return (
                      <td
                        key={`n-${i}`}
                        className={clsx(
                          'p-2 text-right border-r border-white/10 text-[11px] font-bold font-mono',
                          total < 0 ? 'text-red-400' : total > 0 ? 'text-emerald-400' : 'text-zinc-500'
                        )}
                      >
                        {formatMoney(total, true)}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-20 p-2 text-right font-mono font-bold border-l border-white/10 bg-[#141022] text-zinc-200">
                    {formatMoney(
                      columns.reduce((s, d) => s + getNetPeriodTotal(d), 0),
                      true
                    )}
                  </td>
                </tr>

                <tr className="border-t border-sky-500/30">
                  <td colSpan={2} className="sticky left-0 z-20 p-2 text-xs font-bold uppercase text-sky-300 bg-[#0f1628] border-r border-white/10">
                    Saldo final
                  </td>
                  {columns.map((date, i) => {
                    const bal = endBalances[i] ?? 0;
                    const neg = bal < -0.01;
                    return (
                      <td
                        key={`e-${i}`}
                        className={clsx(
                          'p-2 text-right border-r border-white/10 text-[11px] font-bold font-mono',
                          neg ? 'text-red-400 bg-red-950/30' : 'text-sky-200'
                        )}
                      >
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{formatMoney(bal, true)}</span>
                          {neg && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-20 p-2 text-right text-sm font-bold font-mono border-l border-white/10 bg-[#0f1628] text-sky-100">
                    {formatMoney(endBalances[endBalances.length - 1] ?? 0, true)}
                  </td>
                </tr>
              </tbody>
          </table>
        </div>
      </div>

        <div className="px-4 py-2 text-[10px] text-zinc-500 flex flex-wrap gap-4 border-t border-white/10">
          <span>
            <span className="inline-block w-3 h-3 bg-zinc-800 mr-1 align-middle rounded-sm" /> Pasado (solo lectura; use otro mes para
            proyectar)
          </span>
          <span>
            <span className="inline-block w-3 h-3 ring-2 ring-sky-500 mr-1 align-middle rounded-sm" /> Hoy
          </span>
          <span>
            <span className="italic text-zinc-400 mr-1">Aa</span> Capa estimada
          </span>
          <span className="text-sky-400">Azul = proyectado</span>
        </div>
      </div>

      {viewMode === 'daily' && !isFullscreen && (
        <aside
          className={clsx(
            'shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#110e1a] lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto transition-all duration-300',
            isDecisionPanelCollapsed
              ? 'w-full lg:w-12 p-2'
              : 'w-full lg:w-[min(100%,clamp(268px,34vw,420px))] p-4 space-y-4'
          )}
        >
          {isDecisionPanelCollapsed ? (
            <button
              type="button"
              onClick={() => setIsDecisionPanelCollapsed(false)}
              className="flex h-9 w-full items-center justify-center rounded-lg border border-violet-500/30 bg-violet-950/30 text-violet-200 hover:bg-violet-900/40 lg:h-10"
              title="Mostrar asistente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
              <p className="text-sm font-bold text-white tracking-tight">Asistente de decisiones</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDecisionPanelCollapsed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-cyan-200"
              title="Ocultar asistente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-950/25 p-3 space-y-3">
            <p className="text-[11px] font-bold text-red-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Alertas de liquidez
            </p>
            {liquidityAlerts.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Sin quiebres de saldo detectados este mes con las capas activas.</p>
            ) : (
              <>
                <p className="text-[12px] text-red-100/95 leading-snug">
                  Falta de fondos proyectada el día <strong>{safeFormat(liquidityAlerts[0]!.d, 'dd/MM')}</strong>.
                </p>
                <p className="text-[11px] text-zinc-300">
                  Saldo proyectado ese día:{' '}
                  <span className="text-red-300 font-mono font-semibold tabular-nums">
                    {formatMoney(endBalances[liquidityAlerts[0]!.i] ?? 0)}
                  </span>
                </p>
                <p className="text-[11px] text-amber-200/90">
                  <span className="font-semibold text-amber-300">Sugerencia:</span> revisa pagos proyectados después de esa fecha;
                  mueve cargos flexibles hacia fechas con mayor saldo o reduce capa proyectada en la matriz.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 border-white/15 bg-zinc-900/90 text-[11px] text-white hover:bg-zinc-800"
                  onClick={() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  Ver matriz / filas de egreso <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </>
            )}
          </div>

          {sidebarDailyFlow.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-3 space-y-3">
              <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
                Cumplimiento del presupuesto
                <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                    <span className="text-emerald-300">Ingresos</span>
                    <span className={clsx('font-mono font-semibold', sidebarBudgetTrend.incPct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                      {sidebarBudgetTrend.incPct >= 0 ? '+' : ''}
                      {sidebarBudgetTrend.incPct}%
                    </span>
                  </div>
                  <div className="h-[44px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sidebarDailyFlow.map((x, ix) => ({ ix, inc: x.income }))} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <Line type="monotone" dataKey="inc" stroke="#34d399" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                    <span className="text-amber-200">Gastos</span>
                    <span className={clsx('font-mono font-semibold', sidebarBudgetTrend.expPct <= 0 ? 'text-emerald-400' : 'text-amber-300')}>
                      {sidebarBudgetTrend.expPct >= 0 ? '+' : ''}
                      {sidebarBudgetTrend.expPct}%
                    </span>
                  </div>
                  <div className="h-[44px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sidebarDailyFlow.map((x, ix) => ({ ix, ex: x.expense }))} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <Line type="monotone" dataKey="ex" stroke="#fbbf24" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-3 space-y-2">
            <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
              Proyección de saldo final
              <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            </p>
            <p
              className={clsx(
                'text-2xl font-bold font-mono',
                (endBalances[endBalances.length - 1] ?? 0) < 0 ? 'text-red-400' : 'text-sky-200'
              )}
            >
              {formatMoney(endBalances[endBalances.length - 1] ?? 0, true)}
            </p>
            <p className="text-[10px] text-zinc-500">
              Saldo proyectado al fin de mes · {safeFormat(endOfMonth(safeCurrentDate), 'dd/MM/yyyy')}
            </p>
            <div className="h-[40px] pt-1">
              {chartDataDaily.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataDaily} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <Line type="monotone" dataKey="saldo" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {monthSummary && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-950/15 p-3 space-y-2 text-[11px] text-zinc-300">
              <p className="text-[10px] font-bold uppercase text-violet-300">Resumen del mes</p>
              <div className="flex justify-between">
                <span>Ingresos (reales/matriz)</span>
                <span className="text-emerald-400 tabular-nums">{formatMoney(monthSummary.ti, true)}</span>
              </div>
              <div className="flex justify-between">
                <span>Egresos (matriz)</span>
                <span className="text-rose-400 tabular-nums">{formatMoney(monthSummary.te, true)}</span>
              </div>
              {treasuryEnabled && monthSummary.draftTotal > 0 && (
                <div className="flex justify-between text-amber-200/90">
                  <span>+ Facturas borrador</span>
                  <span className="tabular-nums">−{formatMoney(monthSummary.draftTotal, true)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-amber-200 border-t border-white/10 pt-2">
                <span>Saldo final (reales)</span>
                <span className="tabular-nums">{formatMoney(endBalances[endBalances.length - 1] ?? 0, true)}</span>
              </div>
            </div>
          )}
            </>
          )}
        </aside>
      )}

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste de saldo inicial</DialogTitle>
            <DialogDescription>
              Punto de partida para el flujo. El sistema acumula transacciones y capas a partir de la fecha de corte.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Fecha de corte</Label>
              <Input type="date" value={tempDate} onChange={(e) => setTempDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Saldo en esa fecha (S/)</Label>
              <Input type="number" step="0.01" value={tempBalance} onChange={(e) => setTempBalance(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveSettings}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

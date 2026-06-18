import { useEffect, useMemo, useState } from "react";
import { Transaction } from "../../types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { formatNumberEs } from "../../utils/numberFormat";
import { parseTransactionDate } from "../../utils/transactionDate";
import { formatBankAccountLabel, resolveBankAccount } from "../../utils/bankAccounts";
import type { BankAccountConfig } from "../../types";

interface RecentTransactionsProps {
  transactions: Transaction[];
  bankAccounts?: BankAccountConfig[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
  onBulkDelete?: (transactionIds: string[]) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type SortKey =
  | 'account'
  | 'currency'
  | 'date'
  | 'type'
  | 'location'
  | 'category'
  | 'subcategory'
  | 'concept'
  | 'amount'
  | 'operation'
  | 'reference';
type SortDirection = 'asc' | 'desc';

export function RecentTransactions({ transactions, bankAccounts = [], onEdit, onDelete, onBulkDelete }: RecentTransactionsProps) {
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const accountLabel = (transaction: Transaction) => {
    const acc = resolveBankAccount(bankAccounts, transaction.account);
    if (acc) return formatBankAccountLabel(acc);
    return transaction.account || '-';
  };

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const sortedTransactions = useMemo(() => {
    const valueFor = (transaction: Transaction, key: SortKey): string | number => {
      if (key === 'date') return parseTransactionDate(transaction.date).getTime();
      if (key === 'amount') return Number(transaction.amount) || 0;
      if (key === 'concept') return transaction.concept || transaction.description || '';
      return String(transaction[key] ?? '').toLowerCase();
    };
    return [...transactions].sort((a, b) => {
      const av = valueFor(a, sortKey);
      const bv = valueFor(b, sortKey);
      const result =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'es');
      return sortDirection === 'asc' ? result : -result;
    });
  }, [sortDirection, sortKey, transactions]);
  const paginatedTransactions = useMemo(
    () => sortedTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, pageSize, sortedTransactions],
  );
  const selectedOnPage =
    paginatedTransactions.length > 0 &&
    paginatedTransactions.every((transaction) => selectedIds.has(transaction.id));
  const selectionCount = selectedIds.size;

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(transactions.map((transaction) => transaction.id));
      return new Set([...current].filter((id) => validIds.has(id)));
    });
  }, [transactions]);

  const toggleSelected = (transactionId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(transactionId);
      else next.delete(transactionId);
      return next;
    });
  };

  const togglePageSelected = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      paginatedTransactions.forEach((transaction) => {
        if (checked) next.add(transaction.id);
        else next.delete(transaction.id);
      });
      return next;
    });
  };

  const handleDeleteOne = (transaction: Transaction) => {
    if (!onDelete) return;
    const ok = window.confirm(`¿Eliminar la transacción "${transaction.description}"?`);
    if (!ok) return;
    onDelete(transaction.id);
  };

  const handleBulkDelete = () => {
    if (!onBulkDelete || selectionCount === 0) return;
    const ok = window.confirm(`¿Eliminar ${selectionCount} transacción(es) seleccionada(s)?`);
    if (!ok) return;
    onBulkDelete([...selectedIds]);
    setSelectedIds(new Set());
  };

  const toggleSort = (key: SortKey) => {
    setCurrentPage(1);
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'date' || key === 'amount' ? 'desc' : 'asc');
  };

  const SortHeader = ({ label, column }: { label: string; column: SortKey }) => {
    const active = sortKey === column;
    const Icon = active ? (sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-white/5"
        title={`Ordenar por ${label}`}
      >
        <span>{label}</span>
        <Icon className="h-3 w-3" />
      </button>
    );
  };

  const firstRecord = transactions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRecord = Math.min(currentPage * pageSize, transactions.length);

  return (
    <div className="space-y-3" data-testid="transactions-list">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs" style={{ color: '#6b5fa5' }}>
          {selectionCount > 0 ? `${selectionCount} seleccionada(s)` : 'Selecciona filas para eliminar en bloque'}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBulkDelete}
          disabled={!onBulkDelete || selectionCount === 0}
          className="border-red-500/30 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-100"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar seleccionadas
        </Button>
      </div>

      <div className="rounded-xl overflow-auto" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
        <table className="min-w-[1280px] w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(139,92,246,0.08)', borderBottom: '1px solid rgba(139,92,246,0.12)' }}>
              <th className="h-10 w-10 px-4 text-left align-middle">
                <Checkbox
                  checked={selectedOnPage}
                  onCheckedChange={(checked) => togglePageSelected(checked === true)}
                  aria-label="Seleccionar página"
                />
              </th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Cuenta" column="account" /></th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Moneda" column="currency" /></th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Fecha" column="date" /></th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Tipo" column="type" /></th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Sede" column="location" /></th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Categoría" column="category" /></th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Subcategoría" column="subcategory" /></th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Concepto" column="concept" /></th>
              <th className="h-10 px-4 text-right align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Monto" column="amount" /></th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Operación" column="operation" /></th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}><SortHeader label="Referencia" column="reference" /></th>
              <th className="h-10 px-4 text-right align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map((transaction) => (
              <tr
                key={transaction.id}
                className="transition-colors"
                style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.05)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <td className="p-4 align-middle">
                  <Checkbox
                    checked={selectedIds.has(transaction.id)}
                    onCheckedChange={(checked) => toggleSelected(transaction.id, checked === true)}
                    aria-label={`Seleccionar ${transaction.description}`}
                  />
                </td>
                <td className="p-4 align-middle text-xs" style={{ color: '#B8B0E8' }}>
                  {accountLabel(transaction)}
                </td>
                <td className="p-4 align-middle text-xs" style={{ color: '#B8B0E8' }}>
                  {transaction.currency || '-'}
                </td>
                <td className="p-4 align-middle text-xs" style={{ color: '#8b7cf8', fontFamily: "'JetBrains Mono', monospace" }}>
                  {format(parseTransactionDate(transaction.date), "dd/MM/yyyy", { locale: es })}
                </td>
                <td className="p-4 align-middle text-xs font-bold" style={{ color: transaction.type === 'income' ? '#22d3ee' : '#fb7185' }}>
                  {transaction.type === 'income' ? 'Ingreso' : 'Egreso'}
                </td>
                <td className="p-4 align-middle text-xs" style={{ color: '#B8B0E8' }}>
                  {transaction.location || '-'}
                </td>
                <td className="p-4 align-middle">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                    style={transaction.type === 'income'
                      ? { background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee' }
                      : { background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.2)', color: '#fb7185' }
                    }
                  >
                    {transaction.category}
                  </span>
                </td>
                <td className="p-4 align-middle text-xs" style={{ color: '#B8B0E8' }}>
                  {transaction.subcategory || '-'}
                </td>
                <td className="p-4 align-middle text-xs font-medium" style={{ color: '#E4E0FF' }}>
                  {transaction.concept || transaction.description || '-'}
                </td>
                <td className="p-4 align-middle text-right font-bold text-sm"
                  style={{ color: transaction.type === 'income' ? '#22d3ee' : '#fb7185', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {transaction.type === 'income' ? '+' : '-'} {formatNumberEs(Math.abs(transaction.amount), 2)}
                </td>
                <td className="p-4 align-middle text-xs" style={{ color: '#B8B0E8' }}>
                  {transaction.operation || '-'}
                </td>
                <td className="p-4 align-middle text-xs" style={{ color: '#B8B0E8' }}>
                  {transaction.reference || '-'}
                </td>
                <td className="p-4 align-middle text-right">
                    {onEdit && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onEdit(transaction)}
                            title="Editar transacción"
                            className="h-8 w-8 hover:text-cyan-400 hover:bg-cyan-500/10"
                            style={{ color: 'rgba(255,255,255,0.2)' }}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteOne(transaction)}
                        title="Eliminar transacción"
                        className="h-8 w-8 hover:text-red-400 hover:bg-red-500/10"
                        style={{ color: 'rgba(255,255,255,0.2)' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
                <tr>
                    <td colSpan={13} className="p-8 text-center text-sm" style={{ color: '#6b5fa5' }}>
                        No hay transacciones registradas
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-xl px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#6b5fa5' }}>
        <div className="flex items-center gap-2">
          <span>Mostrar</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[86px] border-white/10 bg-transparent text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>por página</span>
        </div>

        <span>
          Página {currentPage} de {totalPages} | Registros {firstRecord}-{lastRecord} de {transactions.length}
        </span>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 border-white/10 bg-transparent" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
            Primera
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-white/10 bg-transparent" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-white/10 bg-transparent" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
            Siguiente
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-white/10 bg-transparent" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
            Última
          </Button>
        </div>
      </div>
    </div>
  );
}
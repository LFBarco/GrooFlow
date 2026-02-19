import { Transaction } from "../../types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Pencil } from "lucide-react";

interface RecentTransactionsProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
}

export function RecentTransactions({ transactions, onEdit }: RecentTransactionsProps) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(139,92,246,0.08)', borderBottom: '1px solid rgba(139,92,246,0.12)' }}>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>Fecha</th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>Descripción</th>
              <th className="h-10 px-4 text-left align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>Categoría</th>
              <th className="h-10 px-4 text-right align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>Monto</th>
              <th className="h-10 px-4 text-right align-middle font-bold text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr
                key={transaction.id}
                className="transition-colors"
                style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.05)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <td className="p-4 align-middle text-xs" style={{ color: '#8b7cf8', fontFamily: "'JetBrains Mono', monospace" }}>
                  {format(transaction.date, "dd/MM/yyyy", { locale: es })}
                </td>
                <td className="p-4 align-middle font-medium text-sm" style={{ color: '#E4E0FF' }}>{transaction.description}</td>
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
                <td className="p-4 align-middle text-right font-bold text-sm"
                  style={{ color: transaction.type === 'income' ? '#22d3ee' : '#fb7185', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {transaction.type === 'income' ? '+' : '-'} S/ {Math.abs(transaction.amount).toFixed(2)}
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
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-8 text-center text-sm" style={{ color: '#6b5fa5' }}>
                        No hay transacciones registradas
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
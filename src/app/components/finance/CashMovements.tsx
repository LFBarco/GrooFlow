import { useState } from "react";
import { PettyCashTransaction } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUpCircle, ArrowDownCircle, Wallet, Filter, Building2, Calendar, FileText, User } from "lucide-react";

interface CashMovementsProps {
  transactions: PettyCashTransaction[];
}

export function CashMovements({ transactions }: CashMovementsProps) {
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [sede, setSede] = useState("consolidated"); // consolidated, Principal, Norte, Sur

  // Filter Logic
  const filteredTransactions = transactions.filter(t => {
    // Exclude voided/rejected from calculation/view
    if (t.status === 'voided' || t.status === 'rejected') return false;

    const tDate = new Date(t.date);
    const start = dateStart ? new Date(dateStart) : null;
    if(start) start.setHours(0,0,0,0);
    
    const end = dateEnd ? new Date(dateEnd) : null;
    if(end) end.setHours(23,59,59,999);

    const dateMatch = (!start || tDate >= start) && (!end || tDate <= end);
    const sedeMatch = sede === "consolidated" || (t.location || 'Principal') === sede; // Default to Principal if no location

    return dateMatch && sedeMatch;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate Totals
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense' || !t.type) // Default to expense if undefined (backward compatibility)
    .reduce((sum, t) => sum + t.amount, 0);
    
  const net = totalIncome - totalExpense;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row justify-end gap-4">
            <div className="flex flex-wrap items-center gap-2 bg-card p-2 rounded-lg border shadow-sm">
                <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <Select value={sede} onValueChange={setSede}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Seleccionar Sede" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="consolidated">Consolidado (Todas)</SelectItem>
                            <SelectItem value="Principal">Sede Principal</SelectItem>
                            <SelectItem value="Norte">Sede Norte</SelectItem>
                            <SelectItem value="Sur">Sede Sur</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="h-4 w-px bg-border mx-2 hidden md:block"></div>

                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Input 
                        type="date" 
                        className="w-[140px]" 
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                        type="date" 
                        className="w-[140px]" 
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                    />
                </div>

                {(dateStart || dateEnd || sede !== 'consolidated') && (
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                            setDateStart("");
                            setDateEnd("");
                            setSede("consolidated");
                        }}
                        className="ml-2 text-muted-foreground hover:text-primary"
                    >
                        Limpiar
                    </Button>
                )}
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Reposiciones (Ingresos)</p>
                            <h3 className="text-2xl font-bold text-green-600">S/ {totalIncome.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                        </div>
                        <div className="p-2 bg-green-100 rounded-full">
                            <ArrowUpCircle className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Gastos Registrados</p>
                            <h3 className="text-2xl font-bold text-red-600">S/ {totalExpense.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                        </div>
                        <div className="p-2 bg-red-100 rounded-full">
                            <ArrowDownCircle className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className={`border-l-4 ${net >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
                <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Movimiento Neto</p>
                            <h3 className={`text-2xl font-bold ${net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                S/ {Math.abs(net).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                {net < 0 ? 'Mayor salida de efectivo' : 'Mayor ingreso de fondos'}
                            </p>
                        </div>
                        <div className={`p-2 rounded-full ${net >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                            <Wallet className={`w-6 h-6 ${net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Transactions Table */}
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Registros Detallados {sede !== 'consolidated' ? ` - ${sede}` : ' - Consolidado'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Sede</TableHead>
                            <TableHead>Descripción / Comprobante</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Solicitante</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No se encontraron movimientos de caja chica con los filtros seleccionados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTransactions.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium text-xs">
                                        {format(new Date(t.date), "dd/MM/yyyy HH:mm", { locale: es })}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-normal bg-muted">
                                            {t.location || 'Principal'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{t.description}</div>
                                        {t.receiptNumber && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <FileText className="w-3 h-3" />
                                                Ref: {t.receiptNumber}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-normal">
                                            {t.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                            <User className="w-3 h-3" />
                                            {t.requester}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge 
                                            variant={t.type === 'income' ? 'default' : 'destructive'}
                                            className={t.type === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                                        >
                                            {t.type === 'income' ? 'Reposición' : 'Gasto'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={`text-right font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'income' ? '+' : '-'} S/ {t.amount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}

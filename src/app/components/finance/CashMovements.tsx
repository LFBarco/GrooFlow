import { useState, useMemo, useEffect } from "react";
import type { PettyCashTransaction, PettyCashWeekClosure, User } from "../../types";
import { getOpeningFundForWeek } from "../../utils/pettyCashWeekOpening";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUpCircle, ArrowDownCircle, Wallet, Filter, Building2, Calendar, Tag, Layers } from "lucide-react";
import {
  getPettyCashRowType,
  isReplenishmentIncome,
  isAdminTopUpIncome,
} from "../../utils/pettyCashAudit";

interface CashMovementsProps {
  transactions: PettyCashTransaction[];
  /** Sedes que el usuario puede ver (catálogo habilitado ∩ asignadas). */
  visibleSedes: string[];
  /** Si false, no se ofrece opción "Consolidado (todas)" en el filtro. */
  canUseConsolidatedOption?: boolean;
  commercialCategories?: string[];
  commercialAreas?: string[];
  /** Cierres de semana (para sumar fondo de apertura en la tarjeta de asignaciones). */
  weekClosures?: PettyCashWeekClosure[];
  /** Usuarios con límite de caja chica por responsable. */
  custodianUsers?: User[];
  /** Límite global de fondo si el responsable no tiene límite propio. */
  defaultFundLimit?: number;
}

function auditStatusLabel(s: PettyCashTransaction["status"]): string {
  switch (s) {
    case "approved":
      return "Aprobado";
    case "pending_audit":
      return "Pend. aud.";
    case "rejected":
      return "Rechazado";
    case "voided":
      return "Anulado";
    default:
      return s;
  }
}

export function CashMovements({
  transactions,
  visibleSedes,
  canUseConsolidatedOption = true,
  commercialCategories = [],
  commercialAreas = [],
  weekClosures,
  custodianUsers,
  defaultFundLimit,
}: CashMovementsProps) {
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const defaultSede =
    canUseConsolidatedOption && visibleSedes.length > 1
      ? "consolidated"
      : visibleSedes[0] || "Principal";
  const [sede, setSede] = useState(defaultSede);

  const sedeFilterList = useMemo(() => {
    const bases = visibleSedes.length > 0 ? visibleSedes : ["Principal"];
    if (canUseConsolidatedOption && bases.length > 1) {
      return [{ value: "consolidated", label: "Consolidado (todas)" }, ...bases.map((s) => ({ value: s, label: s }))];
    }
    return bases.map((s) => ({ value: s, label: s }));
  }, [visibleSedes, canUseConsolidatedOption]);

  useEffect(() => {
    const allowed = new Set(sedeFilterList.map((x) => x.value));
    if (!allowed.has(sede)) {
      setSede(sedeFilterList[0]?.value ?? "Principal");
    }
  }, [sedeFilterList, sede]);

  // Filter Logic
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (t.status === "voided" || t.status === "rejected") return false;

        const tDate = new Date(t.date);
        const start = dateStart ? new Date(dateStart) : null;
        if (start) start.setHours(0, 0, 0, 0);

        const end = dateEnd ? new Date(dateEnd) : null;
        if (end) end.setHours(23, 59, 59, 999);

        const dateMatch = (!start || tDate >= start) && (!end || tDate <= end);
        const loc = (t.location || "Principal").trim();
        const sedeMatch =
          sede === "consolidated"
            ? visibleSedes.length === 0 || visibleSedes.includes(loc)
            : loc === sede;

        if (areaFilter !== "all" && (t.area || "") !== areaFilter) return false;
        if (categoryFilter !== "all" && (t.category || "") !== categoryFilter) return false;

        return dateMatch && sedeMatch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    transactions,
    dateStart,
    dateEnd,
    sede,
    visibleSedes,
    areaFilter,
    categoryFilter,
  ]);

  const includeOpeningInAssignments =
    Array.isArray(weekClosures) &&
    (custodianUsers?.length ?? 0) > 0 &&
    typeof defaultFundLimit === "number" &&
    defaultFundLimit > 0 &&
    areaFilter === "all" &&
    categoryFilter === "all";

  const openingFundsTotal = useMemo(() => {
    if (!includeOpeningInAssignments || !custodianUsers?.length) return 0;
    const uniq = new Map<string, { cid: string; w: string }>();
    for (const t of filteredTransactions) {
      if (!t.custodianId) continue;
      const k = `${t.custodianId}|${String(t.weekNumber)}`;
      if (!uniq.has(k)) uniq.set(k, { cid: t.custodianId, w: String(t.weekNumber) });
    }
    let sum = 0;
    for (const { cid, w } of uniq.values()) {
      const u = custodianUsers.find((x) => x.id === cid);
      const lim =
        u?.pettyCashLimit && u.pettyCashLimit > 0 ? u.pettyCashLimit : defaultFundLimit!;
      sum += getOpeningFundForWeek(cid, w, weekClosures, lim);
    }
    return sum;
  }, [
    includeOpeningInAssignments,
    filteredTransactions,
    custodianUsers,
    weekClosures,
    defaultFundLimit,
  ]);

  // Calculate Totals (ingresos = fila normalizada; incluye legado KV)
  const replenishmentIncome = filteredTransactions
    .filter((t) => isReplenishmentIncome(t))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const adminTopupIncome = filteredTransactions
    .filter((t) => isAdminTopUpIncome(t))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const explicitIncomeTotal = filteredTransactions
    .filter((t) => getPettyCashRowType(t) === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const otherIncomeTotal = Math.max(0, explicitIncomeTotal - replenishmentIncome - adminTopupIncome);

  const totalAssignments = explicitIncomeTotal + openingFundsTotal;

  const totalExpense = filteredTransactions
    .filter((t) => getPettyCashRowType(t) === "expense")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const net = totalAssignments - totalExpense;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:justify-end gap-4 w-full">
            <div className="flex flex-wrap items-center gap-2 bg-card p-2 rounded-lg border shadow-sm w-full md:w-auto">
                <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <Select value={sede} onValueChange={setSede}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Seleccionar Sede" />
                        </SelectTrigger>
                        <SelectContent>
                            {sedeFilterList.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="h-4 w-px bg-border mx-2 hidden md:block"></div>

                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <Select value={areaFilter} onValueChange={setAreaFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Área" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las áreas</SelectItem>
                            {commercialAreas.map((a) => (
                                <SelectItem key={a} value={a}>
                                    {a}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las categorías</SelectItem>
                            {commercialCategories.map((c) => (
                                <SelectItem key={c} value={c}>
                                    {c}
                                </SelectItem>
                            ))}
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

                {(dateStart ||
                    dateEnd ||
                    areaFilter !== "all" ||
                    categoryFilter !== "all" ||
                    sede !== defaultSede) && (
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                            setDateStart("");
                            setDateEnd("");
                            setAreaFilter("all");
                            setCategoryFilter("all");
                            setSede(defaultSede);
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
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                                Asignaciones al fondo (total)
                            </p>
                            <h3 className="text-2xl font-bold text-green-600">
                                S/ {totalAssignments.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </h3>
                            <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                                {openingFundsTotal > 0 ? (
                                    <p>
                                        Apertura de fondo (semanas en vista): S/{" "}
                                        {openingFundsTotal.toLocaleString("es-PE", {
                                            minimumFractionDigits: 2,
                                        })}
                                    </p>
                                ) : null}
                                {explicitIncomeTotal > 0 ? (
                                    <p>
                                        Ingresos registrados (reposición / refuerzos): S/{" "}
                                        {explicitIncomeTotal.toLocaleString("es-PE", {
                                            minimumFractionDigits: 2,
                                        })}
                                    </p>
                                ) : null}
                                {replenishmentIncome > 0 ? (
                                    <p>— Reposiciones: S/ {replenishmentIncome.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                                ) : null}
                                {adminTopupIncome > 0 ? (
                                    <p className="text-amber-700 dark:text-amber-400">
                                        — Refuerzos admin.: S/ {adminTopupIncome.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </p>
                                ) : null}
                                {otherIncomeTotal > 0 ? (
                                    <p>— Otros ingresos: S/ {otherIncomeTotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
                                ) : null}
                                {totalAssignments === 0 ? (
                                    <p>Sin asignaciones con los filtros actuales (ni aperturas ni ingresos).</p>
                                ) : null}
                                {!includeOpeningInAssignments &&
                                (areaFilter !== "all" || categoryFilter !== "all") ? (
                                    <p className="text-[11px] pt-1 italic">
                                        Con filtro por área o categoría no se suma el fondo de apertura de semana (solo ingresos
                                        registrados).
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="p-2 bg-green-100 rounded-full shrink-0">
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
            <CardContent className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Sede</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Tipo Doc.</TableHead>
                            <TableHead>Serie</TableHead>
                            <TableHead>Nro documento</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Auditoría</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                    No se encontraron movimientos de caja chica con los filtros seleccionados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTransactions.map((t) => {
                                const rowType = getPettyCashRowType(t);
                                const tipoDoc =
                                    t.receiptType || (rowType === "income" ? "Reposición" : "—");
                                const serie = t.docSeries?.trim() || '—';
                                const nroDoc =
                                    t.voucherNumber?.trim() || t.receiptNumber?.trim() || '—';
                                const nombre =
                                    t.providerName?.trim() || t.requester || '—';
                                return (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium text-xs whitespace-nowrap">
                                        {format(new Date(t.date), "dd/MM/yyyy HH:mm", { locale: es })}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-normal bg-muted">
                                            {t.location || 'Principal'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[120px] truncate" title={t.category}>
                                        {t.category}
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[100px] truncate" title={t.area}>
                                        {t.area || '—'}
                                    </TableCell>
                                    <TableCell className="text-xs">{tipoDoc}</TableCell>
                                    <TableCell className="text-xs font-mono">{serie}</TableCell>
                                    <TableCell className="text-xs font-mono">{nroDoc}</TableCell>
                                    <TableCell className="text-sm max-w-[220px]">
                                        <div className="truncate font-medium" title={nombre}>{nombre}</div>
                                        {t.description ? (
                                            <div className="text-[11px] text-muted-foreground truncate" title={t.description}>
                                                {t.description}
                                            </div>
                                        ) : null}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] font-normal">
                                            {auditStatusLabel(t.status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={`text-right font-bold whitespace-nowrap ${rowType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {rowType === 'income' ? '+' : '-'} S/ {(Number(t.amount) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}

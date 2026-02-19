import { 
    Transaction, 
    InvoiceDraft, 
    SystemAlert, 
    AlertSeverity, 
    PurchaseRequest,
    PettyCashTransaction,
    User,
    AlertThresholds
} from "../../types";
import { 
    addDays, 
    isBefore, 
    isAfter, 
    subMonths, 
    startOfMonth, 
    endOfMonth, 
    differenceInDays,
    isSameMonth,
    subDays,
    isSameDay
} from "date-fns";

// Configuración por defecto si no se provee
const DEFAULT_THRESHOLDS: AlertThresholds = {
    liquidityMinDays: 3,
    invoiceDueDays: 7,
    spendingSpikePercent: 30,
    pettyCashLowBalance: 20,
    staleRequestDays: 3
};

interface AlertContext {
    transactions: Transaction[];
    invoices: InvoiceDraft[];
    requests: PurchaseRequest[];
    pettyCash: PettyCashTransaction[];
    users?: User[]; // Opcional, para análisis de personal
    thresholds?: Partial<AlertThresholds>;
}

export function generateAlerts(context: AlertContext): SystemAlert[] {
    const alerts: SystemAlert[] = [];
    const today = new Date();
    const thresholds = { ...DEFAULT_THRESHOLDS, ...context.thresholds };
    
    // --- 1. FINANCIERO: LIQUIDEZ Y VENCIMIENTOS ---
    const pendingInvoices = context.invoices.filter(inv => 
        inv.status === 'approved' || inv.status === 'pending_approval'
    );

    let totalDueNextWeek = 0;
    const dueByDate: Record<string, number> = {};

    pendingInvoices.forEach(inv => {
        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(23, 59, 59);
        const daysUntilDue = differenceInDays(dueDate, today);
        const dateKey = inv.dueDate; 

        // A. Facturas Vencidas (CRÍTICO)
        if (daysUntilDue < 0) {
            alerts.push({
                id: `due-critical-${inv.id}`,
                title: 'Factura Vencida',
                message: `La factura ${inv.invoiceNumber} de ${inv.provider} venció hace ${Math.abs(daysUntilDue)} días.`,
                severity: 'critical',
                type: 'expiration',
                category: 'financial',
                date: today,
                actionLink: 'audit',
                actionLabel: 'Pagar ahora',
                read: false,
                metadata: { invoiceId: inv.id, amount: inv.total }
            });
        } 
        // B. Próximas a vencer (ADVERTENCIA)
        else if (daysUntilDue <= thresholds.invoiceDueDays) {
             alerts.push({
                id: `due-warning-${inv.id}`,
                title: 'Vencimiento Próximo',
                message: `Factura de ${inv.provider} vence en ${daysUntilDue === 0 ? 'hoy' : daysUntilDue + ' días'} (S/${inv.total}).`,
                severity: daysUntilDue <= 2 ? 'warning' : 'info',
                type: 'expiration',
                category: 'financial',
                date: today,
                actionLink: 'audit',
                read: false,
                metadata: { invoiceId: inv.id }
            });
            totalDueNextWeek += inv.total;
            dueByDate[dateKey] = (dueByDate[dateKey] || 0) + inv.total;
        }
    });

    // C. Alerta de Concentración de Pagos (Cuello de Botella)
    Object.entries(dueByDate).forEach(([dateStr, amount]) => {
        if (amount > 5000) { // Umbral fijo por ahora, podría ser dinámico
            alerts.push({
                id: `bottleneck-${dateStr}`,
                title: 'Concentración de Pagos',
                message: `El día ${dateStr} vencen facturas por un total de S/${amount}. Asegure liquidez.`,
                severity: 'critical',
                type: 'liquidity',
                category: 'financial',
                date: today,
                read: false
            });
        }
    });

    // --- 2. OPERATIVO: CAJA CHICA Y SOLICITUDES ---
    
    // A. Caja Chica: Saldo Bajo (Simulado, ya que necesitaríamos el saldo actual real)
    // Asumimos un fondo fijo total de 2000 soles como ejemplo si no hay config
    // En una app real, esto vendría de un estado global de "Caja"
    // Pero podemos detectar anomalías: Muchas reposiciones en poco tiempo.
    const last7DaysPettyCash = context.pettyCash.filter(t => 
        isAfter(new Date(t.date), subDays(today, 7))
    );
    
    const repositionsCount = last7DaysPettyCash.filter(t => t.type === 'income').length;
    if (repositionsCount >= 2) {
        alerts.push({
            id: `petty-cash-freq-${today.toISOString()}`,
            title: 'Alta Rotación de Caja Chica',
            message: `Se han realizado ${repositionsCount} reposiciones de caja chica en los últimos 7 días. Revisar flujo.`,
            severity: 'warning',
            type: 'operational',
            category: 'operational',
            date: today,
            actionLink: 'pettycash',
            read: false
        });
    }

    // B. Solicitudes Estancadas
    context.requests.forEach(req => {
        if (req.status === 'pending') {
            const daysPending = differenceInDays(today, new Date(req.requestDate));
            if (daysPending >= thresholds.staleRequestDays) {
                 alerts.push({
                    id: `stale-request-${req.id}`,
                    title: 'Solicitud Demorada',
                    message: `Solicitud de ${req.requesterName} lleva ${daysPending} días esperando aprobación.`,
                    severity: 'info',
                    type: 'operational',
                    category: 'operational',
                    date: today,
                    actionLink: 'requests',
                    read: false
                });
            }
        }
    });

    // --- 3. ANÁLISIS DE DATOS Y RIESGOS (AUDITORÍA) ---
    
    // A. Detección de posibles duplicados (Mismo monto, mismo día, gasto)
    const expenseTx = context.transactions.filter(t => t.type === 'expense');
    const txMap: Record<string, Transaction[]> = {};
    
    expenseTx.forEach(t => {
        const dateStr = t.date instanceof Date ? t.date.toISOString().split('T')[0] : new Date(t.date).toISOString().split('T')[0];
        const key = `${t.amount}-${dateStr}`; // Clave simple: Monto + Fecha
        if (!txMap[key]) txMap[key] = [];
        txMap[key].push(t);
    });

    Object.values(txMap).forEach(group => {
        if (group.length > 1) {
            // Posible duplicado
            alerts.push({
                id: `dup-suspect-${group[0].id}`,
                title: 'Posible Duplicidad',
                message: `Se detectaron ${group.length} transacciones de S/${group[0].amount} el día ${group[0].date instanceof Date ? group[0].date.toLocaleDateString() : new Date(group[0].date).toLocaleDateString()}.`,
                severity: 'warning',
                type: 'audit',
                category: 'system',
                date: today,
                actionLink: 'audit',
                read: false,
                metadata: { ids: group.map(g => g.id) }
            });
        }
    });

    // B. Gasto inusual en categoría (Desviación)
    // Comparar gasto de ESTE mes vs Promedio 3 meses anteriores
    const currentMonthStart = startOfMonth(today);
    const threeMonthsAgoStart = subMonths(currentMonthStart, 3);
    
    const currentMonthTx = context.transactions.filter(t => 
        t.type === 'expense' && isSameMonth(new Date(t.date), today)
    );
    
    const historyTx = context.transactions.filter(t => 
        t.type === 'expense' && 
        isAfter(new Date(t.date), threeMonthsAgoStart) && 
        isBefore(new Date(t.date), currentMonthStart)
    );

    const currentCatTotals: Record<string, number> = {};
    currentMonthTx.forEach(t => {
        const cat = typeof t.category === 'string' ? t.category : 'Otros';
        currentCatTotals[cat] = (currentCatTotals[cat] || 0) + t.amount;
    });

    const historyCatTotals: Record<string, number> = {};
    historyTx.forEach(t => {
        const cat = typeof t.category === 'string' ? t.category : 'Otros';
        historyCatTotals[cat] = (historyCatTotals[cat] || 0) + t.amount;
    });

    Object.entries(currentCatTotals).forEach(([cat, amount]) => {
        const historicalTotal = historyCatTotals[cat] || 0;
        const historicalAvg = historicalTotal / 3; 
        
        if (historicalAvg > 200 && amount > historicalAvg * (1 + (thresholds.spendingSpikePercent || 30)/100)) {
             const increase = ((amount - historicalAvg) / historicalAvg) * 100;
             alerts.push({
                id: `spending-spike-${cat}`,
                title: 'Desviación de Presupuesto',
                message: `El gasto en "${cat}" excede el promedio histórico en un ${increase.toFixed(0)}%.`,
                severity: 'warning',
                type: 'spending_deviation',
                category: 'financial',
                date: today,
                actionLink: 'pnl',
                read: false
            });
        }
    });

    // --- 4. RRHH / USUARIOS (Si hay usuarios) ---
    if (context.users) {
        // Ejemplo: Alerta si hay usuarios sin actividad reciente o sin iniciales configuradas (calidad de datos)
        // O usuarios con exceso de caja chica pendiente
        const pettyCashPendingByUser: Record<string, number> = {};
        context.pettyCash.forEach(t => {
            if (t.status === 'pending_audit') {
                pettyCashPendingByUser[t.requester] = (pettyCashPendingByUser[t.requester] || 0) + t.amount;
            }
        });

        Object.entries(pettyCashPendingByUser).forEach(([user, amount]) => {
            if (amount > 500) { // Umbral arbitrario de riesgo
                 alerts.push({
                    id: `risk-user-petty-${user}`,
                    title: 'Riesgo en Caja Chica',
                    message: `El usuario ${user} tiene S/${amount} pendientes de rendir/auditar.`,
                    severity: 'info',
                    type: 'personnel',
                    category: 'hr',
                    date: today,
                    actionLink: 'pettycash',
                    read: false
                });
            }
        });
    }

    return alerts.sort((a, b) => {
        // Ordenar primero por severidad, luego por fecha
        const severityScore = { critical: 3, warning: 2, info: 1, success: 0 };
        const scoreDiff = severityScore[b.severity] - severityScore[a.severity];
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}

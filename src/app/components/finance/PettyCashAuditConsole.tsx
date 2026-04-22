import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
    Building2,
    CheckCircle2,
    Filter,
    Search,
    ShieldCheck,
    XCircle,
    Eye,
    User as UserIcon,
} from 'lucide-react';
import type { PettyCashTransaction, User } from '../../types';
import type { Role } from '../users/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { canApprovePettyCashMovements } from '../../utils/pettyCashAudit';
import { getSuperAdminEmails } from '../../config/superAdmins';
import { filterPettyCashCustodianUsersForViewer } from '../../utils/pettyCashCustodianVisibility';

type StatusFilter = 'pending' | 'all' | 'approved' | 'rejected';

interface PettyCashAuditConsoleProps {
    transactions: PettyCashTransaction[];
    users: User[];
    currentUser: User;
    roles?: Role[];
    visibleSedes: string[];
    onUpdateTransactions: (txs: PettyCashTransaction[]) => void;
    commercialCategories: string[];
    commercialAreas: string[];
}

function statusLabel(s: PettyCashTransaction['status']): string {
    switch (s) {
        case 'approved':
            return 'Aprobado';
        case 'pending_audit':
            return 'Pendiente';
        case 'rejected':
            return 'Rechazado';
        case 'voided':
            return 'Anulado';
        default:
            return s;
    }
}

export function PettyCashAuditConsole({
    transactions,
    users,
    currentUser,
    roles = [],
    visibleSedes,
    onUpdateTransactions,
    commercialCategories,
    commercialAreas,
}: PettyCashAuditConsoleProps) {
    const [sede, setSede] = useState<string>('all');
    const [custodianId, setCustodianId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
    const [areaFilter, setAreaFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [detail, setDetail] = useState<PettyCashTransaction | null>(null);

    const viewerSeesAllSedes = useMemo(
        () =>
            currentUser.role === 'super_admin' ||
            currentUser.allSedes === true ||
            !!(currentUser.email && getSuperAdminEmails().has(currentUser.email.trim().toLowerCase())),
        [currentUser]
    );

    const custodians = useMemo(
        () => filterPettyCashCustodianUsersForViewer(users, currentUser, visibleSedes, viewerSeesAllSedes, roles),
        [users, currentUser, visibleSedes, viewerSeesAllSedes, roles]
    );

    const canAct = canApprovePettyCashMovements(currentUser, roles);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return transactions.filter((t) => {
            const loc = (t.location || 'Principal').trim();
            if (sede !== 'all' && loc !== sede) return false;
            if (custodianId !== 'all' && t.custodianId !== custodianId) return false;
            if (areaFilter !== 'all' && (t.area || '') !== areaFilter) return false;
            if (categoryFilter !== 'all' && (t.category || '') !== categoryFilter) return false;

            if (statusFilter === 'pending' && t.status !== 'pending_audit') return false;
            if (statusFilter === 'approved' && t.status !== 'approved') return false;
            if (statusFilter === 'rejected' && t.status !== 'rejected') return false;
            if (statusFilter === 'all' && t.status === 'voided') return false;

            if (!q) return true;
            const blob = [
                t.description,
                t.requester,
                t.providerName,
                t.docNumber,
                t.docSeries,
                t.voucherNumber,
                t.receiptNumber,
                t.category,
                t.area,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return blob.includes(q);
        })
            .filter((t) => visibleSedes.length === 0 || visibleSedes.includes((t.location || 'Principal').trim()))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [
        transactions,
        sede,
        custodianId,
        statusFilter,
        areaFilter,
        categoryFilter,
        search,
        visibleSedes,
    ]);

    const pendingCount = useMemo(
        () =>
            transactions.filter(
                (t) =>
                    t.status === 'pending_audit' &&
                    (visibleSedes.length === 0 ||
                        visibleSedes.includes((t.location || 'Principal').trim()))
            ).length,
        [transactions, visibleSedes]
    );

    const approve = (row: PettyCashTransaction) => {
        if (!canAct || row.status !== 'pending_audit') return;
        onUpdateTransactions(
            transactions.map((t) => (t.id === row.id ? { ...t, status: 'approved' as const } : t))
        );
        toast.success('Movimiento aprobado');
        if (detail?.id === row.id) setDetail({ ...row, status: 'approved' });
    };

    const reject = (row: PettyCashTransaction) => {
        if (!canAct || row.status !== 'pending_audit') return;
        if (
            !window.confirm(
                `¿Rechazar este movimiento?\n\n${(row.description || '').slice(0, 160)}\n\nEl responsable podrá corregir, anular o volver a registrar.`
            )
        )
            return;
        const note = window.prompt('Motivo del rechazo (opcional, queda en historial):', row.auditComment ?? '') ?? '';
        onUpdateTransactions(
            transactions.map((t) =>
                t.id === row.id
                    ? {
                          ...t,
                          status: 'rejected' as const,
                          auditComment: note.trim() || t.auditComment,
                      }
                    : t
            )
        );
        toast.message('Movimiento rechazado');
        if (detail?.id === row.id) setDetail({ ...row, status: 'rejected', auditComment: note.trim() || row.auditComment });
    };

    const sedeOptions = visibleSedes.length > 0 ? visibleSedes : ['Principal'];

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <Card className="border-emerald-500/30 bg-emerald-950/10">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <ShieldCheck className="h-5 w-5 text-emerald-500" />
                        Consola de auditoría — Caja chica
                    </CardTitle>
                    <CardDescription>
                        Revise por sede y responsable cada comprobante: <strong>ver detalle</strong>,{' '}
                        <strong>aprobar</strong> o <strong>rechazar</strong>. Cuando todos los movimientos vigentes de
                        la semana estén aprobados, el responsable podrá ejecutar el <strong>cierre definitivo</strong>{' '}
                        en «Mi Caja / Sede» (arrastre de saldo).
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3 items-center text-sm">
                    <Badge variant={pendingCount > 0 ? 'destructive' : 'secondary'}>
                        {pendingCount} pendiente{pendingCount === 1 ? '' : 's'} de auditoría
                    </Badge>
                    {!canAct ? (
                        <span className="text-muted-foreground">Solo lectura: su rol no incluye aprobación.</span>
                    ) : null}
                </CardContent>
            </Card>

            <div className="flex flex-wrap items-end gap-2 bg-card p-3 rounded-lg border">
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Sede
                    </Label>
                    <Select value={sede} onValueChange={setSede}>
                        <SelectTrigger className="w-[170px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas (visibles)</SelectItem>
                            {sedeOptions.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserIcon className="h-3 w-3" /> Responsable
                    </Label>
                    <Select value={custodianId} onValueChange={setCustodianId}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {custodians.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Filter className="h-3 w-3" /> Estado
                    </Label>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                        <SelectTrigger className="w-[170px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Solo pendientes</SelectItem>
                            <SelectItem value="approved">Aprobados</SelectItem>
                            <SelectItem value="rejected">Rechazados</SelectItem>
                            <SelectItem value="all">Activos (sin anulados)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Área</Label>
                    <Select value={areaFilter} onValueChange={setAreaFilter}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Área" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {commercialAreas.map((a) => (
                                <SelectItem key={a} value={a}>
                                    {a}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Categoría</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {commercialCategories.map((c) => (
                                <SelectItem key={c} value={c}>
                                    {c}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Search className="h-3 w-3" /> Buscar
                    </Label>
                    <Input placeholder="RUC, serie, descripción…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
            </div>

            <Card>
                <CardContent className="p-0 pt-4 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Sede</TableHead>
                                <TableHead>Responsable</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Doc.</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead>Área</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right w-[200px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                                        No hay movimientos con estos filtros.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((t) => {
                                    const custName = users.find((u) => u.id === t.custodianId)?.name ?? '—';
                                    const nro = (t.voucherNumber || t.receiptNumber || '—').trim();
                                    const serie = t.docSeries?.trim() || '—';
                                    return (
                                        <TableRow key={t.id}>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {format(new Date(t.date), 'dd/MM/yyyy HH:mm', { locale: es })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {t.location || 'Principal'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm max-w-[120px] truncate">{custName}</TableCell>
                                            <TableCell className="text-xs">
                                                {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                                            </TableCell>
                                            <TableCell className="text-xs font-mono max-w-[140px]">
                                                <div>{serie}</div>
                                                <div className="text-muted-foreground">{nro}</div>
                                            </TableCell>
                                            <TableCell className="text-xs max-w-[100px] truncate">{t.category}</TableCell>
                                            <TableCell className="text-xs max-w-[100px] truncate">{t.area || '—'}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">
                                                S/ {Number(t.amount).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        t.status === 'approved'
                                                            ? 'default'
                                                            : t.status === 'pending_audit'
                                                              ? 'secondary'
                                                              : t.status === 'rejected'
                                                                ? 'destructive'
                                                                : 'outline'
                                                    }
                                                    className="text-[10px]"
                                                >
                                                    {statusLabel(t.status)}
                                                </Badge>
                                                {t.status === 'rejected' && t.auditComment ? (
                                                    <p className="text-[10px] text-muted-foreground mt-1 max-w-[160px] truncate" title={t.auditComment}>
                                                        {t.auditComment}
                                                    </p>
                                                ) : null}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1 flex-wrap">
                                                    <Button type="button" size="sm" variant="outline" onClick={() => setDetail(t)}>
                                                        <Eye className="h-3.5 w-3.5 mr-1" />
                                                        Ver
                                                    </Button>
                                                    {canAct && t.status === 'pending_audit' ? (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                className="bg-emerald-600 hover:bg-emerald-700"
                                                                onClick={() => approve(t)}
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                                Aprobar
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => reject(t)}
                                                            >
                                                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                                                Rechazar
                                                            </Button>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalle para auditoría</DialogTitle>
                        <DialogDescription>
                            Campos registrados por el responsable. Los sustentos físicos/digitalizados siguen el flujo
                            acordado con contabilidad.
                        </DialogDescription>
                    </DialogHeader>
                    {detail ? (
                        <div className="grid gap-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-muted-foreground text-xs">Estado</span>
                                    <p className="font-medium">{statusLabel(detail.status)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs">Monto</span>
                                    <p className="font-mono font-semibold">S/ {Number(detail.amount).toFixed(2)}</p>
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Descripción</span>
                                <p>{detail.description}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-muted-foreground text-xs">Sede</span>
                                    <p>{detail.location || 'Principal'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs">Solicitante</span>
                                    <p>{detail.requester}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs">Categoría</span>
                                    <p>{detail.category}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs">Área</span>
                                    <p>{detail.area || '—'}</p>
                                </div>
                            </div>
                            <div className="border-t pt-2 mt-2 space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Comprobante</p>
                                <p className="text-xs">
                                    Tipo: {detail.receiptType || '—'} · Doc ID: {detail.docType || '—'} ·{' '}
                                    {detail.docNumber || '—'}
                                </p>
                                <p className="text-xs">
                                    Serie: {detail.docSeries || '—'} · Nro: {detail.voucherNumber || detail.receiptNumber || '—'}
                                </p>
                                <p className="text-xs">Proveedor/emisor: {detail.providerName || '—'}</p>
                            </div>
                            {detail.auditComment ? (
                                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2 text-xs">
                                    <span className="font-medium text-destructive">Obs. auditoría:</span> {detail.auditComment}
                                </div>
                            ) : null}
                            {canAct && detail.status === 'pending_audit' ? (
                                <div className="flex gap-2 pt-2">
                                    <Button className="flex-1 bg-emerald-600" onClick={() => { approve(detail); setDetail(null); }}>
                                        Aprobar desde detalle
                                    </Button>
                                    <Button variant="destructive" className="flex-1" onClick={() => { reject(detail); setDetail(null); }}>
                                        Rechazar
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}

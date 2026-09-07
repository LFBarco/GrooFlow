import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import type { BukPeEmployeeRow, RrhhUserLink } from '../../types/rrhh';
import { RRHH_COLUMN_DEFS, findUserIdForEmployee, getEmployeeCellValue } from '../../utils/bukPeEmployeeUtils';
import {
  RRHH_IDENTITY_STATUS_LABELS,
  resolveIdentityStatus,
} from '../../utils/rrhhIdentityPolicy';
import type { User } from '../../types';
import { downloadRrhhExcel, fetchRrhhEmployeesPage } from '../../utils/rrhhApi';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DataTablePaginationBar, DataTableToolbar } from '../data-table/ClientDataTable';
import { toast } from 'sonner';

function identityBadgeClass(status: string): string {
  switch (status) {
    case 'linked':
      return 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300';
    case 'pending_access':
      return 'border-amber-500/40 text-amber-700 dark:text-amber-300';
    case 'terminated_still_active':
      return 'border-rose-500/40 text-rose-700 dark:text-rose-300';
    case 'terminated':
      return 'border-slate-400/40 text-slate-600 dark:text-slate-300';
    case 'unmatched_doc':
      return 'border-orange-500/40 text-orange-700 dark:text-orange-300';
    default:
      return 'border-muted-foreground/30 text-muted-foreground';
  }
}

type Props = {
  visibleColumns: string[];
  links: RrhhUserLink[];
  users: User[];
  tab: 'activos' | 'bajas' | 'all';
  refreshKey?: number;
  canEdit?: boolean;
  onDisableUser?: (userId: string) => void;
};

export function RrhhEmployeesDataTable({
  visibleColumns,
  links,
  users,
  tab,
  refreshKey = 0,
  canEdit = false,
  onDisableUser,
}: Props) {
  const cols = useMemo(
    () => RRHH_COLUMN_DEFS.filter((c) => visibleColumns.includes(c.id)),
    [visibleColumns]
  );
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [items, setItems] = useState<BukPeEmployeeRow[]>([]);
  const [filtered, setFiltered] = useState(0);
  const [total, setTotal] = useState(0);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, tab, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const data = await fetchRrhhEmployeesPage({
        page,
        pageSize,
        search: searchDebounced,
        tab,
        orderBy: 'full_name',
        orderDir: 'ASC',
      });
      if (reqId !== reqIdRef.current) return;
      setItems(data.items);
      setFiltered(data.filtered);
      setTotal(data.total);
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar colaboradores');
      setItems([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [page, pageSize, searchDebounced, tab]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadRrhhExcel({ search: searchDebounced, tab });
      toast.success('Excel descargado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre, email, documento, cargo…"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizes={[10, 15, 25, 50]}
        filtered={filtered}
        total={total}
        totalLabel="en BD"
        trailing={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={exporting}
            onClick={() => void onExport()}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            Excel
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {total === 0
                ? 'Sin datos en BD. Pulsa «Sincronizar» para traer Buk.pe.'
                : 'No hay resultados con el filtro actual.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {cols.map((c) => (
                    <TableHead key={c.id} className="whitespace-nowrap text-xs">
                      {c.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs">Identidad</TableHead>
                  <TableHead className="text-xs">Usuario GrooFlow</TableHead>
                  {tab === 'bajas' ? <TableHead className="text-xs text-right">Acciones</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((emp) => {
                  const userId = findUserIdForEmployee(emp, links) ?? emp.linkedUsuarioId ?? undefined;
                  const user = userId ? users.find((u) => u.id === String(userId)) : undefined;
                  const idStatus = resolveIdentityStatus(emp, userId);
                  return (
                    <TableRow key={emp.bukId}>
                      {cols.map((c) => (
                        <TableCell key={c.id} className="text-xs max-w-[220px] truncate">
                          {c.id === 'status' ? (
                            <Badge
                              variant="outline"
                              className={
                                emp.isActive
                                  ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                                  : 'border-rose-500/40 text-rose-700 dark:text-rose-300'
                              }
                            >
                              {getEmployeeCellValue(emp, c.id)}
                            </Badge>
                          ) : (
                            getEmployeeCellValue(emp, c.id) || '—'
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={identityBadgeClass(idStatus)}>
                          {RRHH_IDENTITY_STATUS_LABELS[idStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {user ? user.name : <span className="text-muted-foreground">Sin vincular</span>}
                      </TableCell>
                      {tab === 'bajas' ? (
                        <TableCell className="text-right">
                          {canEdit && onDisableUser && user && user.status !== 'inactive' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onDisableUser(user.id)}
                            >
                              Deshabilitar
                            </Button>
                          ) : user?.status === 'inactive' ? (
                            <Badge variant="secondary">ya inactivo</Badge>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DataTablePaginationBar
        page={Math.min(page, totalPages)}
        totalPages={totalPages}
        onPageChange={setPage}
        disabled={loading}
      />
    </div>
  );
}

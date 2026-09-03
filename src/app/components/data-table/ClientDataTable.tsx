import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';

export const DATA_TABLE_PAGE_SIZES = [10, 15, 25, 50, 100] as const;

export type ClientDataTableColumn<T> = {
  id: string;
  header: ReactNode;
  className?: string;
  cell: (row: T) => ReactNode;
};

type ToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  pageSizes?: readonly number[];
  filtered: number;
  total: number;
  totalLabel?: string;
  trailing?: ReactNode;
  className?: string;
};

/** Barra común (buscar + tamaño página + contador) — misma UX que RRHH. */
export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  pageSize,
  onPageSizeChange,
  pageSizes = DATA_TABLE_PAGE_SIZES,
  filtered,
  total,
  totalLabel = 'registros',
  trailing,
  className,
}: ToolbarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Input
        className="max-w-md"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value) || 25)}
      >
        {pageSizes.map((n) => (
          <option key={n} value={n}>
            {n} por página
          </option>
        ))}
      </select>
      {trailing}
      <span className="text-xs text-muted-foreground ml-auto">
        {filtered} de {total} {totalLabel}
      </span>
    </div>
  );
}

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
};

export function DataTablePaginationBar({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  className,
}: PaginationProps) {
  const safePages = Math.max(1, totalPages);
  return (
    <div className={cn('flex items-center justify-between gap-2 text-sm', className)}>
      <span className="text-muted-foreground">
        Página {page} / {safePages}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page >= safePages}
          onClick={() => onPageChange(Math.min(safePages, page + 1))}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}

export function useClientDataTableState(opts?: {
  initialPageSize?: number;
  /** Clave estable (string/number) para resetear página; evita JSON.stringify de objetos. */
  resetKey?: string | number;
  filteredCount?: number;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(opts?.initialPageSize ?? 25);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, opts?.resetKey]);

  const totalPages = Math.max(1, Math.ceil(Math.max(0, opts?.filteredCount ?? 0) / pageSize));
  useEffect(() => {
    if (opts?.filteredCount == null) return;
    setPage((p) => Math.min(p, totalPages));
  }, [opts?.filteredCount, totalPages]);

  return { search, setSearch, page, setPage, pageSize, setPageSize, totalPages };
}

type ClientDataTableProps<T> = {
  rows: T[];
  columns: ClientDataTableColumn<T>[];
  getRowId: (row: T) => string;
  emptyMessage?: string;
  page: number;
  pageSize: number;
  /** Si true, `rows` ya es la página del servidor (no se vuelve a recortar). */
  serverPaged?: boolean;
  className?: string;
  tableClassName?: string;
};

/** Tabla paginada (cliente o servidor). */
export function ClientDataTable<T>({
  rows,
  columns,
  getRowId,
  emptyMessage = 'Sin datos.',
  page,
  pageSize,
  serverPaged = false,
  className,
  tableClassName,
}: ClientDataTableProps<T>) {
  const pageItems = useMemo(() => {
    if (serverPaged) return rows;
    const start = (Math.max(1, page) - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize, serverPaged]);

  return (
    <div className={cn('rounded-md border overflow-x-auto', className)}>
      <Table className={tableClassName}>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.id} className={cn('whitespace-nowrap text-xs', c.className)}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={Math.max(1, columns.length)} className="text-center text-muted-foreground py-10">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            pageItems.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((c) => (
                  <TableCell key={c.id} className={cn('text-xs', c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

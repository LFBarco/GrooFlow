import type { BukPeEmployeeRow, RrhhUserLink } from '../../types/rrhh';
import { RRHH_COLUMN_DEFS, findUserIdForEmployee, getEmployeeCellValue } from '../../utils/bukPeEmployeeUtils';
import type { User } from '../../types';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type Props = {
  employees: BukPeEmployeeRow[];
  visibleColumns: string[];
  links: RrhhUserLink[];
  users: User[];
  search: string;
};

export function RrhhEmployeesTable({ employees, visibleColumns, links, users, search }: Props) {
  const cols = RRHH_COLUMN_DEFS.filter((c) => visibleColumns.includes(c.id));
  const q = search.trim().toLowerCase();

  const filtered = employees.filter((e) => {
    if (!q) return true;
    const hay = [
      e.fullName,
      e.email,
      e.documentNumber,
      e.cargo,
      e.area,
      e.status,
      String(e.bukId),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  if (filtered.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {employees.length === 0
            ? 'Sin datos. Sincroniza desde Buk.pe para ver colaboradores.'
            : 'No hay resultados con el filtro actual.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c.id} className="whitespace-nowrap text-xs">
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="text-xs">Usuario GrooFlow</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((emp) => {
              const userId = findUserIdForEmployee(emp, links);
              const user = userId ? users.find((u) => u.id === userId) : undefined;
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
                        getEmployeeCellValue(emp, c.id)
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-xs">
                    {user ? (
                      <span>
                        {user.name}
                        {user.status === 'inactive' ? (
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            inactivo
                          </Badge>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sin vincular</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

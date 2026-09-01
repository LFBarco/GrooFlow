import { UserX } from 'lucide-react';

import type { BukPeEmployeeRow, RrhhUserLink } from '../../types/rrhh';
import type { User } from '../../types';
import { findUserIdForEmployee } from '../../utils/bukPeEmployeeUtils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type Props = {
  employees: BukPeEmployeeRow[];
  links: RrhhUserLink[];
  users: User[];
  canEdit: boolean;
  onDisableUser: (userId: string) => void;
  onDisableAllPending: () => void;
};

export function RrhhBajasPanel({
  employees,
  links,
  users,
  canEdit,
  onDisableUser,
  onDisableAllPending,
}: Props) {
  const terminated = employees.filter((e) => e.isTerminated);

  const rows = terminated.map((emp) => {
    const userId = findUserIdForEmployee(emp, links);
    const user = userId ? users.find((u) => u.id === userId) : undefined;
    const pending = user != null && user.status !== 'inactive';
    return { emp, user, pending };
  });

  const pendingCount = rows.filter((r) => r.pending).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserX className="h-5 w-5" />
              Bajas detectadas en Buk.pe
            </CardTitle>
            <CardDescription>
              Colaboradores con estado <code className="text-xs">inactivo</code> o desvinculado en Buk.
              Puedes deshabilitar su usuario en GrooFlow automáticamente al sincronizar.
            </CardDescription>
          </div>
          {canEdit && pendingCount > 0 ? (
            <Button type="button" variant="destructive" size="sm" onClick={onDisableAllPending}>
              Deshabilitar {pendingCount} usuario(s)
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No hay bajas en el último sync.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Estado Buk</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Usuario GrooFlow</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ emp, user, pending }) => (
                  <TableRow key={emp.bukId}>
                    <TableCell>
                      <p className="font-medium text-sm">{emp.fullName}</p>
                      <p className="text-xs text-muted-foreground">{emp.email ?? emp.documentNumber}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-rose-500/40 text-rose-700">
                        {emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{emp.endDate ?? emp.activeUntil ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {user ? (
                        <span>
                          {user.name}
                          {user.status === 'inactive' ? (
                            <Badge className="ml-1" variant="secondary">
                              ya inactivo
                            </Badge>
                          ) : (
                            <Badge className="ml-1" variant="destructive">
                              activo
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin usuario vinculado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && pending && user ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => onDisableUser(user.id)}>
                          Deshabilitar
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

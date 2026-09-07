import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Link2, Loader2, RefreshCw, ShieldAlert, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { User } from '../../types';
import {
  applyRrhhTerminations,
  fetchRrhhIdentityDiagnosis,
  linkRrhhUser,
  type RrhhIdentityDiagnosis,
} from '../../utils/rrhhApi';
import {
  RRHH_IDENTITY_POLICY,
  RRHH_IDENTITY_POLICY_LABELS,
} from '../../utils/rrhhIdentityPolicy';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

function Kpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
  hint?: string;
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'bad'
          ? 'text-red-600'
          : 'text-foreground';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${toneClass}`}>{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}
    </Card>
  );
}

function SampleTable({
  rows,
  columns,
  actionCol,
}: {
  rows: Array<Record<string, unknown>>;
  columns: { key: string; label: string }[];
  actionCol?: (row: Record<string, unknown>) => ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sin registros en esta categoría.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key}>{c.label}</TableHead>
            ))}
            {actionCol ? <TableHead className="text-right">Acción</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c.key} className="text-sm max-w-[220px] truncate">
                  {String(row[c.key] ?? '—')}
                </TableCell>
              ))}
              {actionCol ? <TableCell className="text-right">{actionCol(row)}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type Props = {
  users?: User[];
  onDisableUser?: (userId: string) => void;
  canEdit?: boolean;
  onLinksChanged?: () => void;
  onProjectOrganigrama?: () => void;
  projecting?: boolean;
};

export function RrhhIdentityDiagnosisPanel({
  users = [],
  onDisableUser,
  canEdit,
  onLinksChanged,
  onProjectOrganigrama,
  projecting,
}: Props) {
  const [data, setData] = useState<RrhhIdentityDiagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [linkingBukId, setLinkingBukId] = useState<number | null>(null);
  const [linkPick, setLinkPick] = useState<Record<number, string>>({});

  const activeUsers = useMemo(
    () => users.filter((u) => u.status !== 'inactive').slice().sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [users]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchRrhhIdentityDiagnosis(50));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el diagnóstico');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onApplyTerminations = async () => {
    if (!canEdit) return;
    setApplying(true);
    try {
      const result = await applyRrhhTerminations({ dryRun: false });
      toast.success(
        `Bajas aplicadas: ${result.usersDisabled} acceso(s), ${result.staffRemoved} del organigrama`
      );
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} error(es) parciales`);
      }
      await reload();
      onLinksChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron aplicar las bajas');
    } finally {
      setApplying(false);
    }
  };

  const onLink = async (bukId: number) => {
    const userId = linkPick[bukId];
    if (!userId || !canEdit) return;
    setLinkingBukId(bukId);
    try {
      await linkRrhhUser({ bukId, userId, matchMethod: 'manual' });
      toast.success('Vínculo guardado');
      setLinkPick((prev) => {
        const next = { ...prev };
        delete next[bukId];
        return next;
      });
      await reload();
      onLinksChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo vincular');
    } finally {
      setLinkingBukId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculando diagnóstico de identidad…
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="border-amber-200">
        <CardContent className="pt-6 flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <p className="text-sm flex-1">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void reload()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;
  const c = data.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Diagnóstico de identidad
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Maestro de persona → organigrama Asistencia (Fase 4). Generado{' '}
            {new Date(data.generatedAt).toLocaleString('es-PE')}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && onProjectOrganigrama ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={projecting}
              onClick={() => onProjectOrganigrama()}
            >
              {projecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Users className="h-4 w-4 mr-1" />}
              Proyectar organigrama
            </Button>
          ) : null}
          {canEdit && c.terminatedStillActive > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={applying}
              onClick={() => void onApplyTerminations()}
            >
              {applying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserX className="h-4 w-4 mr-1" />}
              Aplicar bajas ({c.terminatedStillActive})
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void reload()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Actualizar
          </Button>
        </div>
      </div>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reglas de negocio (Fase 0)</CardTitle>
          <CardDescription>Acta fijada con el equipo — guía el maestro de persona.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            Origen: {RRHH_IDENTITY_POLICY_LABELS[RRHH_IDENTITY_POLICY.sourceOfTruth]}
          </Badge>
          <Badge variant="secondary">
            Alta sin usuario: {RRHH_IDENTITY_POLICY_LABELS[RRHH_IDENTITY_POLICY.altaSinUsuario]}
          </Badge>
          <Badge variant="secondary">Cesado → desactiva acceso + organigrama</Badge>
          <Badge variant="secondary">
            Turnos: {RRHH_IDENTITY_POLICY_LABELS[RRHH_IDENTITY_POLICY.turnosPublica]}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Vinculados (Buk→usuario)" value={c.matched} tone="ok" hint={`${c.bukActivos} activos Buk.pe`} />
        <Kpi
          label="Pendientes de acceso"
          value={c.pendingAccess}
          tone={c.pendingAccess > 0 ? 'warn' : 'ok'}
          hint="Activos Buk sin usuario Gestión"
        />
        <Kpi
          label="Usuarios sin DNI"
          value={c.usersWithoutDni}
          tone={c.usersWithoutDni > 0 ? 'warn' : 'ok'}
        />
        <Kpi
          label="Cesados aún activos"
          value={c.terminatedStillActive}
          tone={c.terminatedStillActive > 0 ? 'bad' : 'ok'}
          hint="Aplicar bajas: acceso + organigrama"
        />
        <Kpi
          label="Staff sin RUT"
          value={c.staffWithoutRut}
          tone={c.staffWithoutRut > 0 ? 'warn' : 'neutral'}
          hint={`${c.staffMatchedBuk}/${c.staffWithRut} con RUT cruzan Buk`}
        />
      </div>

      {c.pendingAccess > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100 flex gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Hay <strong>{c.pendingAccess}</strong> persona(s) activa(s) en Buk.pe sin acceso a Gestión.
            No se crea usuario automático: vincula un usuario existente o créalo en Gestión primero.
          </span>
        </div>
      ) : null}

      <Tabs defaultValue="pending">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="pending">
            <UserX className="h-3.5 w-3.5 mr-1" />
            Pendientes ({c.pendingAccess})
          </TabsTrigger>
          <TabsTrigger value="terminated">Cesados activos ({c.terminatedStillActive})</TabsTrigger>
          <TabsTrigger value="no-dni">Usuarios sin DNI ({c.usersWithoutDni})</TabsTrigger>
          <TabsTrigger value="staff">
            <Users className="h-3.5 w-3.5 mr-1" />
            Staff sin RUT ({c.staffWithoutRut})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-3">
          <SampleTable
            rows={data.samples.pendingAccess}
            columns={[
              { key: 'fullName', label: 'Nombre' },
              { key: 'documentNumber', label: 'DNI' },
              { key: 'email', label: 'Email' },
              { key: 'sede', label: 'Sede' },
              { key: 'cargo', label: 'Cargo' },
            ]}
            actionCol={
              canEdit
                ? (row) => {
                    const bukId = Number(row.bukId ?? 0);
                    if (bukId <= 0) return null;
                    return (
                      <div className="flex items-center justify-end gap-2 min-w-[220px]">
                        <Select
                          value={linkPick[bukId]}
                          onValueChange={(v) => setLinkPick((p) => ({ ...p, [bukId]: v }))}
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue placeholder="Usuario…" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeUsers.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!linkPick[bukId] || linkingBukId === bukId}
                          onClick={() => void onLink(bukId)}
                        >
                          {linkingBukId === bukId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Vincular'
                          )}
                        </Button>
                      </div>
                    );
                  }
                : undefined
            }
          />
        </TabsContent>

        <TabsContent value="terminated" className="mt-3 space-y-2">
          <SampleTable
            rows={data.samples.terminatedStillActive}
            columns={[
              { key: 'fullName', label: 'Colaborador Buk' },
              { key: 'documentNumber', label: 'DNI' },
              { key: 'userName', label: 'Usuario Gestión' },
              { key: 'userEmail', label: 'Email' },
              { key: 'linkedUsuarioId', label: 'User ID' },
            ]}
            actionCol={
              canEdit && onDisableUser
                ? (row) => {
                    const uid = String(row.linkedUsuarioId ?? '');
                    if (!uid) return null;
                    return (
                      <Button type="button" size="sm" variant="outline" onClick={() => onDisableUser(uid)}>
                        Desactivar
                      </Button>
                    );
                  }
                : undefined
            }
          />
          {canEdit && c.terminatedStillActive > 0 ? (
            <p className="text-xs text-muted-foreground">
              «Aplicar bajas» desactiva todos los accesos vinculados y los saca del organigrama Asistencia.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="no-dni" className="mt-3">
          <SampleTable
            rows={data.samples.usersWithoutDni}
            columns={[
              { key: 'name', label: 'Nombre' },
              { key: 'email', label: 'Email' },
              { key: 'userId', label: 'User ID' },
            ]}
          />
        </TabsContent>

        <TabsContent value="staff" className="mt-3">
          <SampleTable
            rows={data.samples.staffWithoutRut}
            columns={[
              { key: 'fullName', label: 'Nombre' },
              { key: 'sedeName', label: 'Sede' },
              { key: 'cargoLabel', label: 'Cargo' },
              { key: 'staffId', label: 'Staff ID' },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

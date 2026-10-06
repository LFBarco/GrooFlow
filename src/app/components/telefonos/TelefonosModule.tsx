import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Bot,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  UserX,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Telefono, TelefonosResponse, TelefonoTipo } from '../../types/telefonos';
import { deleteTelefono, fetchTelefonos } from '../../utils/telefonosApi';
import {
  computeTelefonosStats,
  formatPhone,
  suggestColaborador,
  TELEFONO_TIPO_LABEL,
  telefonoTitular,
} from '../../utils/telefonosRules';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { TelefonoDialog } from './TelefonoDialog';
import { TelefonosImportDialog } from './TelefonosImportDialog';

const TIPO_BADGE: Record<TelefonoTipo, string> = {
  persona: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  bot: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  especial: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  sin_asignar: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const ESTADO_LABEL = { activo: 'Activo', suspendido: 'Suspendido', baja: 'De baja' } as const;

const ALL = '__all__';
const money = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function TelefonosModule() {
  const [data, setData] = useState<TelefonosResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<string>(ALL);
  const [sede, setSede] = useState<string>(ALL);
  const [estado, setEstado] = useState<string>('vigentes');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Telefono | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Telefono | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchTelefonos());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el directorio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];
  const colaboradores = data?.colaboradores ?? [];
  const stats = useMemo(() => computeTelefonosStats(items), [items]);
  const sedes = useMemo(
    () => [...new Set(items.map((t) => t.colaborador?.sede).filter((s): s is string => !!s))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return items.filter((t) => {
      if (tipo !== ALL && t.tipo !== tipo) return false;
      if (sede !== ALL && t.colaborador?.sede !== sede) return false;
      if (estado === 'vigentes' && t.estado === 'baja') return false;
      if (estado !== 'vigentes' && estado !== ALL && t.estado !== estado) return false;
      if (!term) return true;
      if (digits.length >= 3 && t.numero.includes(digits)) return true;
      return [telefonoTitular(t), t.colaborador?.cargo, t.colaborador?.area, t.responsable, t.operador, t.plan, t.equipo, t.imei, t.notas]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(term));
    });
  }, [items, q, tipo, sede, estado]);

  const exportExcel = () => {
    const rows = filtered.map((t) => ({
      Número: t.numero,
      Tipo: TELEFONO_TIPO_LABEL[t.tipo],
      Nombres: t.tipo === 'persona' ? (t.colaborador?.nombres ?? '') : '',
      Apellidos: t.tipo === 'persona' ? (t.colaborador?.apellidos ?? '') : '',
      'Titular / uso': telefonoTitular(t),
      Cargo: t.colaborador?.cargo ?? '',
      Área: t.colaborador?.area ?? '',
      Sede: t.colaborador?.sede ?? '',
      Responsable: t.responsable ?? '',
      Operador: t.operador ?? '',
      Plan: t.plan ?? '',
      'Costo mensual': t.costoMensual ?? '',
      Equipo: t.equipo ?? '',
      IMEI: t.imei ?? '',
      ICCID: t.iccid ?? '',
      Estado: ESTADO_LABEL[t.estado],
      Notas: t.notas ?? '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Directorio');
    XLSX.writeFile(wb, `directorio-telefonico-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteTelefono(toDelete.id);
      toast.success('Línea eliminada');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar.');
    } finally {
      setToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando directorio…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>{error || 'No se pudo cargar el directorio.'}</p>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-4 w-4" /> Reintentar
        </Button>
      </div>
    );
  }

  const { capabilities } = data;
  const kpis = [
    { label: 'Líneas vigentes', value: stats.total, icon: Phone, tone: 'text-foreground', filter: ALL },
    { label: 'Personas', value: stats.porTipo.persona, icon: UserRound, tone: 'text-sky-600 dark:text-sky-300', filter: 'persona' },
    { label: 'Bots / sistemas', value: stats.porTipo.bot, icon: Bot, tone: 'text-violet-600 dark:text-violet-300', filter: 'bot' },
    { label: 'Casos especiales', value: stats.porTipo.especial, icon: Star, tone: 'text-amber-600 dark:text-amber-300', filter: 'especial' },
    { label: 'Sin asignar', value: stats.porTipo.sin_asignar, icon: UserX, tone: 'text-slate-600 dark:text-slate-300', filter: 'sin_asignar' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm dark:border-slate-700">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-300">
            <Phone className="h-5 w-5" />
            <span className="text-sm font-medium">Recursos Humanos · Telefonía corporativa</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Directorio telefónico</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Números corporativos asignados a colaboradores (datos de Buk), bots y casos especiales, con su operador, plan,
            costo y equipo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Actualizar
          </Button>
          {capabilities.exportar ? (
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filtered.length}>
              <Download className="mr-1 h-4 w-4" /> Exportar
            </Button>
          ) : null}
          {capabilities.agregar ? (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Importar
            </Button>
          ) : null}
          {capabilities.agregar ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Nueva línea
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => setTipo(k.filter)}
            className={cn(
              'rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/50',
              tipo === k.filter && 'border-primary ring-1 ring-primary/40'
            )}
          >
            <div className={cn('flex items-center gap-2 text-xs font-medium', k.tone)}>
              <k.icon className="h-4 w-4" /> {k.label}
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">{k.value}</div>
          </button>
        ))}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">
            <Wallet className="h-4 w-4" /> Costo mensual
          </div>
          <div className="mt-1 text-2xl font-bold text-foreground">{money(stats.costoMensual)}</div>
        </div>
      </div>

      {stats.cesados ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {stats.cesados} {stats.cesados === 1 ? 'línea sigue asignada' : 'líneas siguen asignadas'} a colaboradores cesados
          en Buk. Recupera el equipo o reasigna el número.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar número, nombre, cargo, equipo…"
            className="pl-8"
          />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {(Object.keys(TELEFONO_TIPO_LABEL) as TelefonoTipo[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TELEFONO_TIPO_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sede} onValueChange={setSede}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las sedes</SelectItem>
            {sedes.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vigentes">Vigentes</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="suspendido">Suspendidos</SelectItem>
            <SelectItem value="baja">De baja</SelectItem>
            <SelectItem value={ALL}>Todos</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} líneas</span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Número</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Nombres y apellidos / uso</th>
              <th className="px-3 py-2">Cargo</th>
              <th className="px-3 py-2">Área / sede</th>
              <th className="px-3 py-2">Operador / plan</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2">Equipo</th>
              <th className="px-3 py-2">Estado</th>
              {capabilities.editar || capabilities.eliminar ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                  {items.length ? 'Sin resultados para los filtros.' : 'Aún no hay líneas. Importa la lista del operador o agrega una.'}
                </td>
              </tr>
            ) : null}
            {filtered.map((t) => {
              const c = t.colaborador;
              const hint = t.tipo === 'sin_asignar' ? suggestColaborador(t.numero, colaboradores) : null;
              return (
                <tr key={t.id} className={cn('border-t align-top', t.estado === 'baja' && 'opacity-60')}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{formatPhone(t.numero)}</td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TIPO_BADGE[t.tipo])}>
                      {TELEFONO_TIPO_LABEL[t.tipo]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{telefonoTitular(t)}</div>
                    {c && !c.activo ? (
                      <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3" /> Cesado en Buk
                      </div>
                    ) : null}
                    {t.responsable ? <div className="text-xs text-muted-foreground">Resp.: {t.responsable}</div> : null}
                    {hint ? (
                      <div className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-300">
                        <Sparkles className="h-3 w-3" /> En Buk: {hint.nombreCompleto}
                      </div>
                    ) : null}
                    {t.tipo === 'sin_asignar' && t.notas ? (
                      <div className="text-xs text-muted-foreground">{t.notas}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{c?.cargo ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {[c?.area, c?.sede].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">{[t.operador, t.plan].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {t.costoMensual != null ? money(t.costoMensual) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div>{t.equipo || '—'}</div>
                    {t.imei ? <div className="font-mono text-muted-foreground">IMEI {t.imei}</div> : null}
                    {t.iccid ? <div className="font-mono text-muted-foreground">Chip {t.iccid}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-xs">{ESTADO_LABEL[t.estado]}</td>
                  {capabilities.editar || capabilities.eliminar ? (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {capabilities.editar ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Editar / asignar"
                          onClick={() => {
                            setEditing(t);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {capabilities.eliminar ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          title="Eliminar"
                          onClick={() => setToDelete(t)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TelefonoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        colaboradores={colaboradores}
        onSaved={() => void load()}
      />
      <TelefonosImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void load()} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la línea {toDelete ? formatPhone(toDelete.numero) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quita del directorio. Si solo dejó de usarse, mejor edítala y márcala «De baja» para conservar el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

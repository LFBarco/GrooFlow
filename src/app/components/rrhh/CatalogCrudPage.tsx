import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { rrhhCatalogApi, type CatalogItem } from '../../utils/rrhhApi';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  ClientDataTable,
  DataTablePaginationBar,
  DataTableToolbar,
  useClientDataTableState,
  type ClientDataTableColumn,
} from '../data-table/ClientDataTable';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { appConfirm } from '../ui/app-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export type CatalogKind = 'areas' | 'puestos' | 'turnos';

type Props = {
  kind: CatalogKind;
  canEdit?: boolean;
};

const TITLES: Record<CatalogKind, { title: string; description: string }> = {
  areas: {
    title: 'Áreas',
    description: 'Catálogo de áreas operativas (compartido con Gestión). Se alimenta también desde el sync Buk.',
  },
  puestos: {
    title: 'Puestos',
    description: 'Cargos / puestos laborales usados en RRHH y usuarios.',
  },
  turnos: {
    title: 'Turnos (catálogo)',
    description: 'Códigos y horarios de turno (Buk / planificación). Distinto del módulo de agenda de turnos.',
  },
};

export function CatalogCrudPage({ kind, canEdit = false }: Props) {
  const meta = TITLES[kind];
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    codigo: '',
    horario: '',
    estado: 'activo',
  });
  const { search, setSearch, page, setPage, pageSize, setPageSize } = useClientDataTableState({
    initialPageSize: 25,
    resetKey: kind,
  });

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.nombre, it.descripcion, it.codigo, it.horario, it.estado]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const load = async () => {
    setLoading(true);
    try {
      const list =
        kind === 'areas'
          ? await rrhhCatalogApi.listAreas()
          : kind === 'puestos'
            ? await rrhhCatalogApi.listPuestos()
            : await rrhhCatalogApi.listTurnos();
      setItems(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [kind]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: '', descripcion: '', codigo: '', horario: '', estado: 'activo' });
    setOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setForm({
      nombre: item.nombre ?? '',
      descripcion: item.descripcion ?? '',
      codigo: item.codigo ?? '',
      horario: item.horario ?? '',
      estado: item.estado ?? 'activo',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!canEdit) return;
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        estado: form.estado,
      };
      if (kind === 'turnos') {
        payload.codigo = form.codigo.trim();
        payload.horario = form.horario.trim();
      }
      if (kind === 'areas') {
        await rrhhCatalogApi.saveArea(payload, editing?.id);
      } else if (kind === 'puestos') {
        await rrhhCatalogApi.savePuesto(payload, editing?.id);
      } else {
        await rrhhCatalogApi.saveTurno(payload, editing?.id);
      }
      toast.success(editing ? 'Actualizado' : 'Creado');
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: CatalogItem) => {
    if (!canEdit) return;
    if (!await appConfirm(`¿Eliminar «${item.nombre}»?`)) return;
    try {
      if (kind === 'areas') await rrhhCatalogApi.deleteArea(item.id);
      else if (kind === 'puestos') await rrhhCatalogApi.deletePuesto(item.id);
      else await rrhhCatalogApi.deleteTurno(item.id);
      toast.success('Eliminado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  const columns = useMemo<ClientDataTableColumn<CatalogItem>[]>(() => {
    const cols: ClientDataTableColumn<CatalogItem>[] = [];
    if (kind === 'turnos') {
      cols.push({ id: 'codigo', header: 'Código', className: 'font-mono', cell: (r) => r.codigo || '—' });
    }
    cols.push({ id: 'nombre', header: 'Nombre', cell: (r) => <span className="font-medium">{r.nombre}</span> });
    if (kind === 'turnos') {
      cols.push({ id: 'horario', header: 'Horario', cell: (r) => r.horario || '—' });
    } else {
      cols.push({
        id: 'desc',
        header: 'Descripción',
        className: 'text-muted-foreground',
        cell: (r) => r.descripcion || '—',
      });
    }
    cols.push({ id: 'estado', header: 'Estado', cell: (r) => r.estado ?? 'activo' });
    if (canEdit) {
      cols.push({
        id: 'actions',
        header: <span className="block text-right">Acciones</span>,
        className: 'text-right',
        cell: (r) => (
          <span className="space-x-1">
            <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => void remove(r)}>
              <Trash2 className="h-4 w-4 text-rose-500" />
            </Button>
          </span>
        ),
      });
    }
    return cols;
  }, [kind, canEdit]);

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{meta.title}</CardTitle>
            <CardDescription>{meta.description}</CardDescription>
          </div>
          {canEdit ? (
            <Button type="button" size="sm" className="gap-1" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin registros. Crea uno o sincroniza RRHH.</p>
          ) : (
            <>
              <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Buscar…"
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                filtered={filteredItems.length}
                total={items.length}
                totalLabel="registros"
              />
              <ClientDataTable
                rows={filteredItems}
                columns={columns}
                getRowId={(r) => String(r.id)}
                page={Math.min(page, totalPages)}
                pageSize={pageSize}
                emptyMessage="Sin resultados para la búsqueda."
              />
              <DataTablePaginationBar
                page={Math.min(page, totalPages)}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Nuevo'} {meta.title.slice(0, -1).toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {kind === 'turnos' ? (
              <div className="space-y-1">
                <Label>Código</Label>
                <Input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} placeholder="MEM01" />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            {kind === 'turnos' ? (
              <div className="space-y-1">
                <Label>Horario</Label>
                <Input value={form.horario} onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))} placeholder="08:30-19:30" />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Descripción</Label>
                <Input value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm((f) => ({ ...f, estado: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import {
  createMenuItem,
  deleteMenuItem,
  fetchMenuTree,
  notifyMenuChanged,
  reorderMenuItems,
  updateMenuItem,
  type MenuItem,
  type MenuSectionVm,
} from '../../services/menuApi';
import { normalizeMenuIcon } from '../../utils/menuIcon';
import { Button } from '../ui/button';
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
import { MenuIconPicker } from './MenuIconPicker';
import { MenuIconColorPicker } from './MenuIconColorPicker';
import { defaultMenuIconColorForModulo } from '../../utils/menuIconColors';
import '../../styles/menu-config.css';

interface MenuDraft {
  texto: string;
  icono: string;
  icon_color: string;
  ruta: string;
  estado: string;
}

type IconPickerTarget =
  | { kind: 'item'; item: MenuItem }
  | { kind: 'draft'; draft: MenuDraft };

type ContainerId = 'sections' | 'orphans' | `section-${number}`;

export type MenuConfigPageProps = {
  onMenuChanged?: () => void | Promise<void>;
};

function sectionSortId(id: number) {
  return `s-${id}`;
}

function childSortId(id: number) {
  return `c-${id}`;
}

function parseSortId(id: UniqueIdentifier): { kind: 'section' | 'child'; numericId: number } | null {
  const raw = String(id);
  if (raw.startsWith('s-')) return { kind: 'section', numericId: Number(raw.slice(2)) };
  if (raw.startsWith('c-')) return { kind: 'child', numericId: Number(raw.slice(2)) };
  return null;
}

function emptyDraft(isSection: boolean, moduloKey = ''): MenuDraft {
  return {
    texto: '',
    icono: isSection ? 'fa-folder' : 'fa-link',
    icon_color: isSection ? '' : defaultMenuIconColorForModulo(moduloKey),
    ruta: isSection ? '' : '/',
    estado: 'activo',
  };
}

function iconClass(item: Pick<MenuItem, 'icono' | 'icono_fa' | 'es_padre'> | MenuDraft): string {
  const raw = String('icono_fa' in item ? (item.icono ?? item.icono_fa ?? '') : item.icono);
  const esPadre = 'es_padre' in item ? Number(item.es_padre) === 1 : raw === 'fa-folder';
  return normalizeMenuIcon(raw, esPadre);
}

function rebuildView(allItems: MenuItem[]): { sections: MenuSectionVm[]; orphans: MenuItem[] } {
  const parents = allItems
    .filter((m) => Number(m.es_padre) === 1)
    .sort((a, b) => a.orden - b.orden || a.texto.localeCompare(b.texto));
  const parentIds = new Set(parents.map((p) => p.id));
  const sections = parents.map((section) => ({
    section,
    children: allItems
      .filter((m) => Number(m.es_padre) === 0 && m.padre_id === section.id)
      .sort((a, b) => a.orden - b.orden || a.texto.localeCompare(b.texto)),
  }));
  const orphans = allItems
    .filter(
      (m) =>
        Number(m.es_padre) === 0 &&
        (m.padre_id === null || m.padre_id === undefined || !parentIds.has(m.padre_id)),
    )
    .sort((a, b) => a.orden - b.orden || a.texto.localeCompare(b.texto));
  return { sections, orphans };
}

function syncSidebar(onMenuChanged?: () => void | Promise<void>) {
  notifyMenuChanged();
  void onMenuChanged?.();
}

function SortableHandle({
  id,
  disabled,
  children,
  className,
}: {
  id: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id, disabled });
  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : undefined,
  };
  return (
    <span ref={setNodeRef} style={style} className={className} {...attributes} {...listeners}>
      {children}
    </span>
  );
}

function DragRow({
  id,
  disabled,
  className,
  children,
}: {
  id: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children}
    </div>
  );
}

function DraftForm({
  draft,
  kind,
  routeSuggestions,
  onOpenIcon,
  onSuggestRoute,
  onChange,
}: {
  draft: MenuDraft;
  kind: 'section' | 'child';
  routeSuggestions: string[];
  onOpenIcon: () => void;
  onSuggestRoute: () => void;
  onChange: (draft: MenuDraft) => void;
}) {
  return (
    <>
      <div className={`menu-builder__row${kind === 'child' ? ' menu-builder__row--child' : ''}`}>
        <span className="menu-builder__drag opacity-30">
          <i className="fa-solid fa-sparkles" aria-hidden />
        </span>
        <button type="button" className="menu-builder__icon-btn" onClick={onOpenIcon}>
          <i className={`fa-solid ${iconClass(draft)}`} aria-hidden />
        </button>
        {kind === 'child' ? (
          <MenuIconColorPicker
            value={draft.icon_color}
            onChange={(icon_color) => onChange({ ...draft, icon_color })}
          />
        ) : (
          <span />
        )}
        <input
          className="menu-builder__input"
          value={draft.texto}
          onChange={(e) => onChange({ ...draft, texto: e.target.value })}
          placeholder="Nombre"
        />
        {kind === 'child' ? (
          <div className="menu-builder__route-wrap">
            <input
              className="menu-builder__input menu-builder__input--route"
              value={draft.ruta}
              list="menu-route-suggestions"
              onChange={(e) => onChange({ ...draft, ruta: e.target.value })}
              placeholder="/ruta"
            />
            <button type="button" className="menu-builder__route-suggest" onClick={onSuggestRoute} title="Sugerir ruta desde el nombre">
              <i className="fa-solid fa-wand-magic-sparkles" aria-hidden />
            </button>
          </div>
        ) : (
          <span />
        )}
        <span className="text-xs text-gray-400">Nuevo</span>
        <span />
      </div>
      <p className="menu-builder__icon-hint">
        <i className="fa-solid fa-icons mr-1" aria-hidden />
        Pulsa el icono para abrir el catálogo completo
      </p>
      <datalist id="menu-route-suggestions">
        {routeSuggestions.map((route) => (
          <option key={route} value={route} />
        ))}
      </datalist>
    </>
  );
}

export function MenuConfigPage({ onMenuChanged }: MenuConfigPageProps) {
  const [sections, setSections] = useState<MenuSectionVm[]>([]);
  const [orphans, setOrphans] = useState<MenuItem[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState('');
  const [treeSearch, setTreeSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [newSectionDraft, setNewSectionDraft] = useState<MenuDraft | null>(null);
  const [newChildDraft, setNewChildDraft] = useState<{ padreId: number; draft: MenuDraft } | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerSelected, setIconPickerSelected] = useState('fa-circle');
  const [iconPickerTarget, setIconPickerTarget] = useState<IconPickerTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
  const treeRef = useRef<{ sections: MenuSectionVm[]; orphans: MenuItem[] }>({
    sections: [],
    orphans: [],
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchMenuTree();
      const items = (res.items ?? []).map((item) => ({ ...item }));
      setAllItems(items);
      const view = rebuildView(items);
      treeRef.current = view;
      setSections(view.sections);
      setOrphans(view.orphans);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el menú');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const routeSuggestions = useMemo(() => {
    const routes = new Set<string>();
    for (const item of allItems) {
      const ruta = (item.ruta ?? '').trim();
      if (ruta && ruta !== '/') routes.add(ruta);
    }
    return [...routes].sort();
  }, [allItems]);

  const visibleSections = useMemo(() => {
    const q = treeSearch.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (block) =>
        block.section.texto.toLowerCase().includes(q) ||
        block.children.some(
          (c) => c.texto.toLowerCase().includes(q) || (c.ruta ?? '').toLowerCase().includes(q),
        ),
    );
  }, [sections, treeSearch]);

  const visibleOrphans = useMemo(() => {
    const q = treeSearch.trim().toLowerCase();
    if (!q) return orphans;
    return orphans.filter(
      (c) => c.texto.toLowerCase().includes(q) || (c.ruta ?? '').toLowerCase().includes(q),
    );
  }, [orphans, treeSearch]);

  const filteredChildren = useCallback(
    (block: MenuSectionVm) => {
      const q = treeSearch.trim().toLowerCase();
      if (!q || block.section.texto.toLowerCase().includes(q)) return block.children;
      return block.children.filter(
        (c) => c.texto.toLowerCase().includes(q) || (c.ruta ?? '').toLowerCase().includes(q),
      );
    },
    [treeSearch],
  );

  const sectionSortIds = useMemo(() => sections.map((b) => sectionSortId(b.section.id)), [sections]);

  function findChildContainer(childId: number, sourceSections = sections, sourceOrphans = orphans): ContainerId {
    for (const block of sourceSections) {
      if (block.children.some((c) => c.id === childId)) return `section-${block.section.id}`;
    }
    if (sourceOrphans.some((c) => c.id === childId)) return 'orphans';
    return 'orphans';
  }

  function getChildList(containerId: ContainerId, sourceSections = sections, sourceOrphans = orphans): MenuItem[] {
    if (containerId === 'orphans') return sourceOrphans;
    const padreId = Number(String(containerId).replace('section-', ''));
    return sourceSections.find((b) => b.section.id === padreId)?.children ?? [];
  }

  function setChildList(containerId: ContainerId, list: MenuItem[], sourceSections: MenuSectionVm[], sourceOrphans: MenuItem[]) {
    if (containerId === 'orphans') {
      return { sections: sourceSections, orphans: list };
    }
    const padreId = Number(String(containerId).replace('section-', ''));
    return {
      sections: sourceSections.map((b) =>
        b.section.id === padreId ? { ...b, children: list } : b,
      ),
      orphans: sourceOrphans,
    };
  }

  async function persistOrder(nextSections = sections, nextOrphans = orphans) {
    setReordering(true);
    const payload: Array<{ id: number; orden: number; padre_id: number | null; es_padre: number }> = [];
    nextSections.forEach((block, sectionIndex) => {
      const sectionOrder = (sectionIndex + 1) * 10;
      payload.push({
        id: block.section.id,
        orden: sectionOrder,
        padre_id: block.section.padre_id ?? null,
        es_padre: 1,
      });
      block.children.forEach((child, childIndex) => {
        payload.push({
          id: child.id,
          orden: (childIndex + 1) * 10,
          padre_id: block.section.id,
          es_padre: 0,
        });
      });
    });
    nextOrphans.forEach((child, index) => {
      payload.push({
        id: child.id,
        orden: (index + 1) * 10,
        padre_id: null,
        es_padre: 0,
      });
    });
    try {
      const items = await reorderMenuItems(payload);
      setAllItems(items.map((item) => ({ ...item })));
      const view = rebuildView(items);
      treeRef.current = view;
      setSections(view.sections);
      setOrphans(view.orphans);
      toast.success('Orden guardado');
      syncSidebar(onMenuChanged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el orden');
      await loadTree();
    } finally {
      setReordering(false);
    }
  }

  function moveSection(sectionId: number, delta: number) {
    const { sections: curSections, orphans: curOrphans } = treeRef.current;
    const idx = curSections.findIndex((b) => b.section.id === sectionId);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= curSections.length) return;
    const nextSections = arrayMove(curSections, idx, next);
    treeRef.current = { sections: nextSections, orphans: curOrphans };
    setSections(nextSections);
    void persistOrder(nextSections, curOrphans);
  }

  function moveChild(childId: number, padreId: number | null, delta: number) {
    const { sections: curSections, orphans: curOrphans } = treeRef.current;
    const containerId: ContainerId = padreId === null ? 'orphans' : `section-${padreId}`;
    const list = [...getChildList(containerId, curSections, curOrphans)];
    const idx = list.findIndex((c) => c.id === childId);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= list.length) return;
    const moved = arrayMove(list, idx, next);
    const updated = setChildList(containerId, moved, curSections, curOrphans);
    treeRef.current = updated;
    setSections(updated.sections);
    setOrphans(updated.orphans);
    void persistOrder(updated.sections, updated.orphans);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id);
  }

  function handleDragOver(event: DragOverEvent) {
    const active = parseSortId(event.active.id);
    const over = event.over?.id ? parseSortId(event.over.id) : null;
    if (!active || !over) return;

    if (active.kind === 'section' && over.kind === 'section') return;

    if (active.kind === 'child') {
      const { sections: curSections, orphans: curOrphans } = treeRef.current;
      const activeContainer = findChildContainer(active.numericId, curSections, curOrphans);
      let overContainer: ContainerId;
      if (over.kind === 'section') {
        overContainer = `section-${over.numericId}`;
      } else {
        overContainer = findChildContainer(over.numericId, curSections, curOrphans);
      }
      if (activeContainer === overContainer) return;

      const activeItems = [...getChildList(activeContainer, curSections, curOrphans)];
      const overItems = [...getChildList(overContainer, curSections, curOrphans)];
      const activeIndex = activeItems.findIndex((c) => c.id === active.numericId);
      if (activeIndex < 0) return;
      const [moved] = activeItems.splice(activeIndex, 1);
      moved.padre_id = overContainer === 'orphans' ? null : Number(String(overContainer).replace('section-', ''));
      moved.es_padre = 0;
      const overIndex = over.kind === 'child' ? overItems.findIndex((c) => c.id === over.numericId) : overItems.length;
      overItems.splice(overIndex >= 0 ? overIndex : overItems.length, 0, moved);
      const removed = setChildList(activeContainer, activeItems, curSections, curOrphans);
      const added = setChildList(overContainer, overItems, removed.sections, removed.orphans);
      treeRef.current = added;
      setSections(added.sections);
      setOrphans(added.orphans);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const active = parseSortId(event.active.id);
    const over = event.over?.id ? parseSortId(event.over.id) : null;
    if (!active) return;

    const { sections: curSections, orphans: curOrphans } = treeRef.current;

    if (active.kind === 'section' && over?.kind === 'section') {
      const oldIndex = curSections.findIndex((b) => b.section.id === active.numericId);
      const newIndex = curSections.findIndex((b) => b.section.id === over.numericId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        const nextSections = arrayMove(curSections, oldIndex, newIndex);
        treeRef.current = { sections: nextSections, orphans: curOrphans };
        setSections(nextSections);
        void persistOrder(nextSections, curOrphans);
      }
      return;
    }

    if (active.kind === 'child') {
      if (over?.kind === 'section') {
        void persistOrder(curSections, curOrphans);
        return;
      }

      if (over?.kind === 'child') {
        const container = findChildContainer(active.numericId, curSections, curOrphans);
        const list = [...getChildList(container, curSections, curOrphans)];
        const oldIndex = list.findIndex((c) => c.id === active.numericId);
        const newIndex = list.findIndex((c) => c.id === over.numericId);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          const moved = arrayMove(list, oldIndex, newIndex);
          const updated = setChildList(container, moved, curSections, curOrphans);
          treeRef.current = updated;
          setSections(updated.sections);
          setOrphans(updated.orphans);
          void persistOrder(updated.sections, updated.orphans);
        } else {
          void persistOrder(curSections, curOrphans);
        }
        return;
      }

      void persistOrder(curSections, curOrphans);
    }
  }

  async function saveRow(item: MenuItem, toastLabel = 'Guardado') {
    try {
      const updated = await updateMenuItem(item.id, {
        texto: item.texto.trim(),
        icono: item.icono,
        icon_color: item.icon_color ?? '',
        ruta: Number(item.es_padre) === 1 ? '' : (item.ruta ?? '').trim(),
        es_padre: item.es_padre,
        padre_id: item.padre_id ?? null,
        orden: item.orden,
        estado: item.estado,
      });
      Object.assign(item, updated, { icono_fa: updated.icono_fa ?? updated.icono });
      toast.success(toastLabel);
      syncSidebar(onMenuChanged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  function openIconPicker(target: IconPickerTarget) {
    setIconPickerTarget(target);
    setIconPickerSelected(
      target.kind === 'item' ? iconClass(target.item) : target.draft.icono || 'fa-circle',
    );
    setIconPickerOpen(true);
  }

  function onIconPicked(icon: string) {
    if (!iconPickerTarget) return;
    if (iconPickerTarget.kind === 'item') {
      iconPickerTarget.item.icono = icon;
      iconPickerTarget.item.icono_fa = icon;
      void saveRow(iconPickerTarget.item, 'Icono actualizado');
    } else {
      iconPickerTarget.draft.icono = icon;
      if (iconPickerTarget.kind === 'draft') {
        if (newSectionDraft && iconPickerTarget.draft === newSectionDraft) {
          setNewSectionDraft({ ...newSectionDraft, icono: icon });
        }
        if (newChildDraft && iconPickerTarget.draft === newChildDraft.draft) {
          setNewChildDraft({ ...newChildDraft, draft: { ...newChildDraft.draft, icono: icon } });
        }
      }
    }
    setIconPickerOpen(false);
    setIconPickerTarget(null);
  }

  function suggestRouteFromName(draft: MenuDraft) {
    const slug = draft.texto
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (slug) draft.ruta = `/${slug}`;
  }

  async function saveNewSection() {
    if (!newSectionDraft?.texto.trim()) {
      toast.error('Escribe un nombre para la sección');
      return;
    }
    setSaving(true);
    try {
      const orden = (sections.at(-1)?.section.orden ?? 0) + 10;
      await createMenuItem({
        texto: newSectionDraft.texto.trim(),
        icono: newSectionDraft.icono,
        ruta: '',
        es_padre: 1,
        padre_id: null,
        orden,
        estado: newSectionDraft.estado,
      });
      setNewSectionDraft(null);
      toast.success('Sección creada');
      await loadTree();
      syncSidebar(onMenuChanged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  }

  async function saveNewChild() {
    if (!newChildDraft) return;
    if (!newChildDraft.draft.texto.trim()) {
      toast.error('Escribe un nombre para la opción');
      return;
    }
    const ruta = newChildDraft.draft.ruta.trim();
    if (!ruta || ruta === '/') {
      toast.error('La ruta es obligatoria (ej. /config/usuarios)');
      return;
    }
    const block = sections.find((s) => s.section.id === newChildDraft.padreId);
    const orden = (block?.children.at(-1)?.orden ?? 0) + 10;
    setSaving(true);
    try {
      await createMenuItem({
        texto: newChildDraft.draft.texto.trim(),
        icono: newChildDraft.draft.icono,
        icon_color: newChildDraft.draft.icon_color,
        ruta,
        es_padre: 0,
        padre_id: newChildDraft.padreId,
        orden,
        estado: newChildDraft.draft.estado,
      });
      setNewChildDraft(null);
      toast.success('Opción creada');
      await loadTree();
      syncSidebar(onMenuChanged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMenuItem(deleteTarget.id);
      toast.success('Eliminado');
      await loadTree();
      syncSidebar(onMenuChanged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setDeleteTarget(null);
    }
  }

  function renderChildRow(child: MenuItem, padreId: number | null) {
    return (
      <DragRow
        key={child.id}
        id={childSortId(child.id)}
        disabled={reordering}
        className="menu-builder__row menu-builder__row--child"
      >
        <SortableHandle id={childSortId(child.id)} disabled={reordering} className="menu-builder__drag">
          <i className="fa-solid fa-grip-lines" aria-hidden />
        </SortableHandle>
        <span className="menu-builder__reorder">
          <button
            type="button"
            className="menu-builder__reorder-btn"
            disabled={reordering || !moveChildEnabled(child.id, padreId, -1)}
            onClick={() => moveChild(child.id, padreId, -1)}
          >
            <i className="fa-solid fa-chevron-up" aria-hidden />
          </button>
          <button
            type="button"
            className="menu-builder__reorder-btn"
            disabled={reordering || !moveChildEnabled(child.id, padreId, 1)}
            onClick={() => moveChild(child.id, padreId, 1)}
          >
            <i className="fa-solid fa-chevron-down" aria-hidden />
          </button>
        </span>
        <button
          type="button"
          className="menu-builder__icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            openIconPicker({ kind: 'item', item: child });
          }}
        >
          <i className={`fa-solid ${iconClass(child)}`} aria-hidden />
        </button>
        <MenuIconColorPicker
          value={child.icon_color}
          disabled={reordering}
          onChange={(icon_color) => {
            child.icon_color = icon_color;
            setSections([...sections]);
            void saveRow(child, 'Color actualizado');
          }}
        />
        <input
          className="menu-builder__input"
          value={child.texto}
          onChange={(e) => {
            child.texto = e.target.value;
            setSections([...sections]);
          }}
          onBlur={() => void saveRow(child)}
          placeholder="Nombre visible"
        />
        <input
          className="menu-builder__input menu-builder__input--route"
          value={child.ruta ?? ''}
          list="menu-route-suggestions"
          onChange={(e) => {
            child.ruta = e.target.value;
            setSections([...sections]);
          }}
          onBlur={() => void saveRow(child)}
          placeholder="/ruta/angular"
        />
        <button
          type="button"
          className={`menu-builder__toggle${child.estado === 'activo' ? ' is-on' : ''}`}
          onClick={() => {
            child.estado = child.estado === 'activo' ? 'inactivo' : 'activo';
            void saveRow(child);
          }}
        >
          {child.estado === 'activo' ? 'Activa' : 'Inactiva'}
        </button>
        <span className="menu-builder__row-actions">
          <button type="button" className="g-icon-btn text-emerald-600 dark:text-emerald-400" onClick={() => void saveRow(child)}>
            <i className="fa-solid fa-floppy-disk" aria-hidden />
          </button>
          <button type="button" className="g-icon-btn text-red-500" onClick={() => setDeleteTarget(child)}>
            <i className="fa-solid fa-trash" aria-hidden />
          </button>
        </span>
      </DragRow>
    );
  }

  function moveChildEnabled(childId: number, padreId: number | null, delta: number) {
    const container: ContainerId = padreId === null ? 'orphans' : `section-${padreId}`;
    const list = getChildList(container);
    const idx = list.findIndex((c) => c.id === childId);
    const next = idx + delta;
    return idx >= 0 && next >= 0 && next < list.length;
  }

  return (
    <div className="g-page g-page--compact g-page-config-menu menu-builder">
      <div className="menu-builder__hero">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Opciones de menú</h1>
          <p className="menu-builder__hint">
            Arrastra o usa las flechas para ordenar. Edita en línea y pulsa el disco para guardar.
          </p>
        </div>
        <div className="menu-builder__actions">
          <div className="menu-builder__search-wrap">
            <i className="fa-solid fa-search menu-builder__search-icon" aria-hidden />
            <input
              type="search"
              className="g-input g-input--soft menu-builder__search"
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              placeholder="Buscar sección u opción…"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setCollapsedSections(new Set())}>
            <i className="fa-solid fa-angles-down mr-1" aria-hidden /> Expandir
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCollapsedSections(new Set(sections.map((s) => s.section.id)))}>
            <i className="fa-solid fa-angles-up mr-1" aria-hidden /> Colapsar
          </Button>
          <Button type="button" variant="outline" onClick={() => { setNewChildDraft(null); setNewSectionDraft(emptyDraft(true)); }}>
            <i className="fa-solid fa-folder-plus mr-1" aria-hidden /> Nueva sección
          </Button>
        </div>
      </div>

      <datalist id="menu-route-suggestions">
        {routeSuggestions.map((route) => (
          <option key={route} value={route} />
        ))}
      </datalist>

      <div className="menu-config-state-panel">
        {loading ? (
          <div className="menu-config-state-panel__loading">
            <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden /> Cargando menú…
          </div>
        ) : error ? (
          <div className="menu-config-state-panel__error">{error}</div>
        ) : (
          <>
            {newSectionDraft ? (
              <div className="menu-builder__draft mb-4">
                <p className="mb-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                  <i className="fa-solid fa-wand-magic-sparkles mr-1" aria-hidden /> Nueva sección
                </p>
                <DraftForm
                  draft={newSectionDraft}
                  kind="section"
                  routeSuggestions={routeSuggestions}
                  onOpenIcon={() => openIconPicker({ kind: 'draft', draft: newSectionDraft })}
                  onSuggestRoute={() => suggestRouteFromName(newSectionDraft)}
                  onChange={setNewSectionDraft}
                />
                <div className="menu-builder__draft-actions">
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewSectionDraft(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" disabled={saving} onClick={() => void saveNewSection()}>
                    <i className="fa-solid fa-check mr-1" aria-hidden /> Crear sección
                  </Button>
                </div>
              </div>
            ) : null}

            {!sections.length && !newSectionDraft ? (
              <div className="menu-builder__empty">
                <i className="fa-solid fa-layer-group mb-3 text-3xl text-indigo-400" aria-hidden />
                <p className="font-medium">Aún no hay secciones</p>
                <p className="mt-1 text-sm">Crea la primera sección y arrastra opciones dentro.</p>
              </div>
            ) : null}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sectionSortIds} strategy={verticalListSortingStrategy}>
                <div className="menu-builder__sections">
                  {visibleSections.map((block) => {
                    const collapsed = collapsedSections.has(block.section.id);
                    const childIds = block.children.map((c) => childSortId(c.id));
                    return (
                      <DragRow
                        key={block.section.id}
                        id={sectionSortId(block.section.id)}
                        disabled={reordering}
                        className="menu-builder__section"
                      >
                        <div className="menu-builder__section-head">
                          <SortableHandle id={sectionSortId(block.section.id)} disabled={reordering} className="menu-builder__drag">
                            <i className="fa-solid fa-grip-vertical" aria-hidden />
                          </SortableHandle>
                          <span className="menu-builder__reorder">
                            <button
                              type="button"
                              className="menu-builder__reorder-btn"
                              disabled={
                                reordering ||
                                sections.findIndex((b) => b.section.id === block.section.id) <= 0
                              }
                              onClick={() => moveSection(block.section.id, -1)}
                            >
                              <i className="fa-solid fa-chevron-up" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="menu-builder__reorder-btn"
                              disabled={
                                reordering ||
                                sections.findIndex((b) => b.section.id === block.section.id) >= sections.length - 1
                              }
                              onClick={() => moveSection(block.section.id, 1)}
                            >
                              <i className="fa-solid fa-chevron-down" aria-hidden />
                            </button>
                          </span>
                          <button
                            type="button"
                            className="menu-builder__collapse-btn"
                            onClick={() => {
                              setCollapsedSections((prev) => {
                                const next = new Set(prev);
                                if (next.has(block.section.id)) next.delete(block.section.id);
                                else next.add(block.section.id);
                                return next;
                              });
                            }}
                          >
                            <i className={`fa-solid ${collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}`} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="menu-builder__icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openIconPicker({ kind: 'item', item: block.section });
                            }}
                          >
                            <i className={`fa-solid ${iconClass(block.section)}`} aria-hidden />
                          </button>
                          <input
                            className="menu-builder__input flex-1 font-semibold"
                            value={block.section.texto}
                            onChange={(e) => {
                              block.section.texto = e.target.value;
                              setSections([...sections]);
                            }}
                            onBlur={() => void saveRow(block.section)}
                            placeholder="Nombre de la sección"
                          />
                          <span className="menu-builder__badge">{block.children.length} opc.</span>
                          <button
                            type="button"
                            className={`menu-builder__toggle${block.section.estado === 'activo' ? ' is-on' : ''}`}
                            onClick={() => {
                              block.section.estado = block.section.estado === 'activo' ? 'inactivo' : 'activo';
                              void saveRow(block.section);
                            }}
                          >
                            {block.section.estado === 'activo' ? 'Activa' : 'Inactiva'}
                          </button>
                          <span className="menu-builder__row-actions">
                            <button type="button" className="g-icon-btn text-emerald-600 dark:text-emerald-400" onClick={() => void saveRow(block.section)}>
                              <i className="fa-solid fa-floppy-disk" aria-hidden />
                            </button>
                            <button type="button" className="g-icon-btn text-red-500" onClick={() => setDeleteTarget(block.section)}>
                              <i className="fa-solid fa-trash" aria-hidden />
                            </button>
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNewSectionDraft(null);
                              setNewChildDraft({ padreId: block.section.id, draft: emptyDraft(false) });
                              setCollapsedSections((prev) => {
                                const next = new Set(prev);
                                next.delete(block.section.id);
                                return next;
                              });
                            }}
                          >
                            <i className="fa-solid fa-plus mr-1" aria-hidden /> Opción
                          </Button>
                        </div>

                        {!collapsed ? (
                          <>
                            {newChildDraft?.padreId === block.section.id ? (
                              <div className="menu-builder__draft mx-3 mb-2 mt-2">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                                  Nueva opción
                                </p>
                                <DraftForm
                                  draft={newChildDraft.draft}
                                  kind="child"
                                  routeSuggestions={routeSuggestions}
                                  onOpenIcon={() => openIconPicker({ kind: 'draft', draft: newChildDraft.draft })}
                                  onSuggestRoute={() => suggestRouteFromName(newChildDraft.draft)}
                                  onChange={(draft) => setNewChildDraft({ ...newChildDraft, draft })}
                                />
                                <div className="menu-builder__draft-actions">
                                  <Button type="button" variant="outline" size="sm" onClick={() => setNewChildDraft(null)}>
                                    Cancelar
                                  </Button>
                                  <Button type="button" size="sm" disabled={saving} onClick={() => void saveNewChild()}>
                                    <i className="fa-solid fa-check mr-1" aria-hidden /> Crear opción
                                  </Button>
                                </div>
                              </div>
                            ) : null}

                            <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
                              <div
                                className={`menu-builder__children${!block.children.length ? ' menu-builder__children--empty' : ''}`}
                                data-container={`section-${block.section.id}`}
                              >
                                {!block.children.length && newChildDraft?.padreId !== block.section.id ? (
                                  <span>Suelta aquí una opción o pulsa «Opción»</span>
                                ) : null}
                                {filteredChildren(block).map((child) => renderChildRow(child, block.section.id))}
                              </div>
                            </SortableContext>
                          </>
                        ) : null}
                      </DragRow>
                    );
                  })}
                </div>
              </SortableContext>

              {visibleOrphans.length ? (
                <div className="menu-builder__section mt-3">
                  <div className="menu-builder__section-head">
                    <i className="fa-solid fa-box-open text-amber-500" aria-hidden />
                    <span className="font-semibold">Sin sección</span>
                  </div>
                  <SortableContext
                    items={orphans.map((c) => childSortId(c.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="menu-builder__children" data-container="orphans">
                      {visibleOrphans.map((child) => renderChildRow(child, null))}
                    </div>
                  </SortableContext>
                </div>
              ) : null}

              <DragOverlay>
                {activeDragId ? (
                  <div className="menu-builder__sortable-drag menu-builder__section-head">
                    <i className="fa-solid fa-grip-vertical" aria-hidden />
                    <span>Arrastrando…</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
        )}
      </div>

      <MenuIconPicker
        open={iconPickerOpen}
        selected={iconPickerSelected}
        onIconSelected={onIconPicked}
        onClosed={() => {
          setIconPickerOpen(false);
          setIconPickerTarget(null);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget && Number(deleteTarget.es_padre) === 1 ? '¿Eliminar sección?' : '¿Eliminar opción?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && Number(deleteTarget.es_padre) === 1
                ? 'Primero mueve o elimina las opciones dentro de la sección.'
                : 'Se quitará del menú de navegación.'}
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

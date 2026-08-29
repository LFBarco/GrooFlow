import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { toast } from 'sonner';
import {
  applyNivelMenuToUsers,
  assignUsuarioMenuDashboard,
  fetchNivelMenu,
  fetchNivelMenuMatrix,
  fetchNiveles,
  fetchUsuarioMenuForUser,
  fetchUsuarioMenuUnassigned,
  fetchUsuariosList,
  syncNivelMenu,
  syncUsuarioMenu,
  type MenuActionKey,
  type MenuActionOption,
  type MenuActionPermissions,
  type MenuItem,
  type NivelMenuMatrixRow,
  type UnassignedUser,
  type UsuarioItem,
} from '../../services/menuApi';
import { normalizeMenuIcon } from '../../utils/menuIcon';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import '../../styles/menu-config.css';

type AssignmentMode = 'user' | 'nivel';

interface PreviewItem {
  id: number;
  texto: string;
  ruta?: string;
  inherited: boolean;
  extra: boolean;
  actions: string[];
}

interface PreviewGroup {
  parentId: number;
  parentTexto: string;
  parentIcon?: string | null;
  items: PreviewItem[];
}

function isDashboardMenu(item: MenuItem): boolean {
  const texto = item.texto.trim().toLowerCase();
  const ruta = (item.ruta ?? '').trim().replace(/^\//, '').toLowerCase();
  const modulo = (item.modulo_key ?? '').trim().toLowerCase();
  return (
    texto === 'dashboard' ||
    modulo === 'dashboard' ||
    ruta === 'dashboard' ||
    ruta === 'grooflow' ||
    ruta === ''
  );
}

export function MenuAssignmentPage() {
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('nivel');
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [niveles, setNiveles] = useState<Awaited<ReturnType<typeof fetchNiveles>>>([]);
  const [loadingNiveles, setLoadingNiveles] = useState(true);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [unassignedUsers, setUnassignedUsers] = useState<UnassignedUser[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(true);
  const [assigningDashboard, setAssigningDashboard] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState<number | null>(null);
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedNivelId, setSelectedNivelId] = useState<number | null>(null);
  const [nivelUserCount, setNivelUserCount] = useState(0);
  const [applyingToUsers, setApplyingToUsers] = useState(false);
  const [onlyWithExtras, setOnlyWithExtras] = useState(true);

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<number>>(new Set());
  const [inheritedMenuIds, setInheritedMenuIds] = useState<Set<number>>(new Set());
  const [menuPermissions, setMenuPermissions] = useState<Map<number, Set<MenuActionKey>>>(new Map());
  const [fullAccess, setFullAccess] = useState(false);
  const [menuSource, setMenuSource] = useState<'personal' | 'nivel' | 'merged' | 'none'>('none');
  const [inheritedNivelNombre, setInheritedNivelNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixNiveles, setMatrixNiveles] = useState<Awaited<ReturnType<typeof fetchNivelMenuMatrix>>['niveles']>([]);
  const [matrixRows, setMatrixRows] = useState<NivelMenuMatrixRow[]>([]);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);

  const matrixScrollRef = useRef<HTMLDivElement>(null);

  const hasTarget = assignmentMode === 'user' ? !!selectedUserId : !!selectedNivelId;

  const usuarioSelectOptions: SearchableSelectOption[] = useMemo(
    () =>
      usuarios.map((u) => ({
        value: u.id,
        label: u.nombre_completo || u.username,
        sublabel: u.username,
        meta: u.nivel_nombre || 'Sin nivel',
        searchText: `${u.nombre_completo ?? ''} ${u.username} ${u.email ?? ''} ${u.nivel_nombre ?? ''}`.toLowerCase(),
      })),
    [usuarios],
  );

  const nivelSelectOptions: SearchableSelectOption[] = useMemo(
    () =>
      niveles.map((n) => ({
        value: n.id,
        label: n.nombre,
        sublabel: n.descripcion || 'Perfil de usuario',
        meta: n.estado === 'activo' ? 'Activo' : 'Inactivo',
        searchText: `${n.nombre} ${n.descripcion ?? ''}`.toLowerCase(),
      })),
    [niveles],
  );

  const loadUsuarios = useCallback(async (preselectId = 0) => {
    setLoadingUsuarios(true);
    try {
      const items = await fetchUsuariosList();
      setUsuarios(items);
      if (preselectId > 0) {
        setAssignmentMode('user');
        setSelectedUserId(preselectId);
      }
    } catch {
      toast.error('No se pudieron cargar los usuarios');
    } finally {
      setLoadingUsuarios(false);
    }
  }, []);

  const loadNiveles = useCallback(async (preselectNivel = 0) => {
    setLoadingNiveles(true);
    try {
      const items = await fetchNiveles();
      setNiveles(items);
      if (preselectNivel > 0) {
        setSelectedNivelId(preselectNivel);
      }
    } catch {
      toast.error('No se pudieron cargar los perfiles');
    } finally {
      setLoadingNiveles(false);
    }
  }, []);

  const loadUnassigned = useCallback(async () => {
    setLoadingUnassigned(true);
    try {
      setUnassignedUsers(await fetchUsuarioMenuUnassigned());
    } finally {
      setLoadingUnassigned(false);
    }
  }, []);

  useEffect(() => {
    void loadUsuarios();
    void loadNiveles();
    void loadUnassigned();
  }, [loadUsuarios, loadNiveles, loadUnassigned]);

  const filteredUnassignedUsers = useMemo(() => {
    const q = unassignedSearch.trim().toLowerCase();
    if (!q) return unassignedUsers;
    return unassignedUsers.filter(
      (u) =>
        u.nombre_completo.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [unassignedSearch, unassignedUsers]);

  const isAssignable = useCallback((item: MenuItem) => {
    if (Number(item.es_padre) === 1) return false;
    const ruta = (item.ruta ?? '').trim();
    if (ruta === '' || ruta.toLowerCase() === 'null') return false;
    if (isDashboardMenu(item)) return true;
    return item.estado !== 'inactivo';
  }, []);

  const sanitizedMenuIds = useCallback(
    (source?: Iterable<number>) => {
      const assignable = new Set(menus.filter((m) => isAssignable(m)).map((m) => m.id));
      const ids = source ?? selectedMenuIds;
      return [...ids].filter((id) => assignable.has(id));
    },
    [isAssignable, menus, selectedMenuIds],
  );

  const parentMenus = useCallback(
    () => menus.filter((m) => Number(m.es_padre) === 1 && m.estado === 'activo'),
    [menus],
  );

  const allParentMenuIds = useCallback(
    () => new Set(menus.filter((m) => Number(m.es_padre) === 1).map((m) => m.id)),
    [menus],
  );

  const assignableChildMenus = useCallback(
    (padreId: number) => menus.filter((m) => m.padre_id === padreId && isAssignable(m)),
    [isAssignable, menus],
  );

  const orphanMenus = useCallback(() => {
    const parentIds = allParentMenuIds();
    return menus.filter((m) => !m.es_padre && (m.padre_id === null || !parentIds.has(m.padre_id ?? 0)));
  }, [allParentMenuIds, menus]);

  const availableActions = (item: MenuItem): MenuActionOption[] =>
    (item.acciones_disponibles ?? []).filter((action) => action.clave !== 'ver');

  const matchesMenuSearch = useCallback(
    (item: MenuItem) => {
      const q = menuSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        item.texto.toLowerCase().includes(q) ||
        (item.ruta ?? '').toLowerCase().includes(q) ||
        (item.padre_texto ?? '').toLowerCase().includes(q) ||
        availableActions(item).some(
          (action) => action.texto.toLowerCase().includes(q) || action.clave.toLowerCase().includes(q),
        )
      );
    },
    [menuSearch],
  );

  const filteredParentMenus = useCallback(
    () =>
      parentMenus().filter(
        (m) =>
          assignableChildMenus(m.id).length > 0 &&
          (matchesMenuSearch(m) || assignableChildMenus(m.id).some((c) => matchesMenuSearch(c))),
      ),
    [assignableChildMenus, matchesMenuSearch, parentMenus],
  );

  const filteredChildMenus = useCallback(
    (padreId: number) => assignableChildMenus(padreId).filter((m) => matchesMenuSearch(m)),
    [assignableChildMenus, matchesMenuSearch],
  );

  const filteredOrphanMenus = useCallback(
    () => orphanMenus().filter((m) => isAssignable(m) && matchesMenuSearch(m)),
    [isAssignable, matchesMenuSearch, orphanMenus],
  );

  const filterAssignableIds = useCallback((menuList: MenuItem[], ids: number[]) => {
    const assignable = new Set(menuList.filter((m) => isAssignable(m)).map((m) => m.id));
    return ids.filter((id) => assignable.has(id));
  }, [isAssignable]);

  const defaultDashboardFromMenus = useCallback((menuList: MenuItem[], ids: number[]) => {
    const filtered = filterAssignableIds(menuList, ids);
    if (filtered.length > 0) return filtered;
    const match = menuList.find((m) => Number(m.es_padre) === 0 && isDashboardMenu(m));
    return match ? [match.id] : [];
  }, [filterAssignableIds]);

  const loadTargetMenus = useCallback(async () => {
    if (assignmentMode === 'user' && !selectedUserId) return;
    if (assignmentMode === 'nivel' && !selectedNivelId) return;
    setLoading(true);
    setError('');
    try {
      if (assignmentMode === 'user') {
        const res = await fetchUsuarioMenuForUser(selectedUserId!);
        setMenus(res.menus);
        setNivelUserCount(0);
        setMenuSource(res.menu_source ?? 'none');
        setInheritedNivelNombre(res.nivel_nombre ?? '');
        setInheritedMenuIds(new Set(res.nivel_menu_ids ?? []));
        setMenuPermissions(new Map());
        setFullAccess(false);
        setSelectedMenuIds(new Set(defaultDashboardFromMenus(res.menus, res.menu_ids)));
      } else {
        const res = await fetchNivelMenu(selectedNivelId!);
        setMenus(res.menus);
        setNivelUserCount(Number(res.usuarios_activos ?? 0));
        setMenuSource('none');
        setInheritedNivelNombre('');
        setSelectedMenuIds(new Set(defaultDashboardFromMenus(res.menus, res.menu_ids)));
        setFullAccess(res.full_access === true);
        const perms = new Map<number, Set<MenuActionKey>>();
        for (const menu of res.menus) {
          perms.set(
            menu.id,
            new Set(
              availableActions(menu)
                .filter((action) => menu.permisos?.[action.clave] === true)
                .map((action) => action.clave),
            ),
          );
        }
        setMenuPermissions(perms);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  }, [assignmentMode, defaultDashboardFromMenus, selectedNivelId, selectedUserId]);

  useEffect(() => {
    if (!hasTarget) {
      setMenus([]);
      setSelectedMenuIds(new Set());
      setInheritedMenuIds(new Set());
      setMenuPermissions(new Map());
      setFullAccess(false);
      return;
    }
    void loadTargetMenus();
  }, [hasTarget, loadTargetMenus, selectedNivelId, selectedUserId, assignmentMode]);

  function setMode(mode: AssignmentMode) {
    if (assignmentMode === mode) return;
    setAssignmentMode(mode);
    setMenus([]);
    setSelectedMenuIds(new Set());
    setInheritedMenuIds(new Set());
    setMenuPermissions(new Map());
    setFullAccess(false);
    setMenuSource('none');
    setInheritedNivelNombre('');
    setError('');
    setMenuSearch('');
    setCollapsedSections(new Set());
    if (mode === 'user') {
      setSelectedNivelId(null);
    } else {
      setSelectedUserId(null);
    }
  }

  function selectUser(userId: number) {
    setMode('user');
    setSelectedUserId(userId);
    queueMicrotask(() =>
      document.getElementById('permisos-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  async function assignDashboardToUser(user: UnassignedUser) {
    setAssigningUserId(user.id);
    try {
      await assignUsuarioMenuDashboard(user.id);
      toast.success(`Menú Dashboard asignado a ${user.nombre_completo || user.username}`);
      await loadUnassigned();
      if (selectedUserId === user.id) await loadTargetMenus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar Dashboard');
    } finally {
      setAssigningUserId(null);
    }
  }

  async function assignDashboardToAll() {
    if (!unassignedUsers.length) return;
    setAssigningDashboard(true);
    try {
      const res = await assignUsuarioMenuDashboard();
      toast.success(`Menú Dashboard asignado a ${res.assigned} usuario(s)`);
      await loadUnassigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar Dashboard');
    } finally {
      setAssigningDashboard(false);
    }
  }

  const selectedUser = selectedUserId ? usuarios.find((u) => u.id === selectedUserId) ?? null : null;
  const selectedNivel = selectedNivelId ? niveles.find((n) => n.id === selectedNivelId) ?? null : null;

  const selectedTargetLabel = assignmentMode === 'user'
    ? selectedUser?.nombre_completo || selectedUser?.username || ''
    : selectedNivel?.nombre ?? '';

  const selectedTargetMeta = assignmentMode === 'user'
    ? selectedUser?.nivel_nombre?.trim() || '—'
    : nivelUserCount === 1
      ? '1 usuario activo'
      : `${nivelUserCount} usuarios activos`;

  function isInherited(menuId: number) {
    return assignmentMode === 'user' && inheritedMenuIds.has(menuId);
  }

  function isChecked(menuId: number) {
    return selectedMenuIds.has(menuId);
  }

  function toggleMenu(menuId: number, checked: boolean) {
    if (fullAccess || isInherited(menuId)) return;
    if (!menus.some((m) => m.id === menuId && isAssignable(m))) return;
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(menuId);
      else {
        next.delete(menuId);
        setMenuPermissions((p) => {
          const copy = new Map(p);
          copy.delete(menuId);
          return copy;
        });
      }
      return next;
    });
  }

  function isActionChecked(menuId: number, action: MenuActionKey) {
    return fullAccess || menuPermissions.get(menuId)?.has(action) === true;
  }

  function toggleAction(item: MenuItem, action: MenuActionKey, checked: boolean) {
    if (assignmentMode !== 'nivel' || fullAccess) return;
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      if (!next.has(item.id)) next.add(item.id);
      return next;
    });
    setMenuPermissions((prev) => {
      const next = new Map(prev);
      const selected = new Set(next.get(item.id) ?? []);
      if (checked) selected.add(action);
      else selected.delete(action);
      next.set(item.id, selected);
      return next;
    });
  }

  function selectedActionCount() {
    return [...menuPermissions.entries()]
      .filter(([menuId]) => selectedMenuIds.has(menuId))
      .reduce((total, [, actions]) => total + actions.size, 0);
  }

  function toPreviewItem(item: MenuItem): PreviewItem {
    const actions =
      assignmentMode === 'nivel'
        ? availableActions(item)
            .filter((action) => isActionChecked(item.id, action.clave))
            .map((action) => action.texto)
        : [];
    return {
      id: item.id,
      texto: item.texto,
      ruta: item.ruta,
      inherited: isInherited(item.id),
      extra: assignmentMode === 'user' && isChecked(item.id) && !isInherited(item.id),
      actions,
    };
  }

  function previewGroups(): PreviewGroup[] {
    const groups: PreviewGroup[] = [];
    for (const parent of parentMenus()) {
      const items = assignableChildMenus(parent.id)
        .filter((child) => isChecked(child.id))
        .map((child) => toPreviewItem(child));
      if (!items.length) continue;
      groups.push({
        parentId: parent.id,
        parentTexto: parent.texto,
        parentIcon: parent.icono,
        items,
      });
    }
    const orphans = orphanMenus()
      .filter((item) => isAssignable(item) && isChecked(item.id))
      .map((item) => toPreviewItem(item));
    if (orphans.length) {
      groups.push({ parentId: 0, parentTexto: 'Sin sección', parentIcon: null, items: orphans });
    }
    return groups;
  }

  function toggleSection(padreId: number, checked: boolean) {
    if (fullAccess) return;
    for (const child of assignableChildMenus(padreId).filter((c) => !isInherited(c.id))) {
      toggleMenu(child.id, checked);
    }
  }

  function sectionChecked(padreId: number) {
    const children = assignableChildMenus(padreId);
    return children.length > 0 && children.every((c) => selectedMenuIds.has(c.id));
  }

  function sectionPartial(padreId: number) {
    const children = assignableChildMenus(padreId);
    const selected = children.filter((c) => selectedMenuIds.has(c.id)).length;
    return selected > 0 && selected < children.length;
  }

  function onSectionCheckboxChange(padreId: number, event: ChangeEvent<HTMLInputElement>) {
    const children = assignableChildMenus(padreId);
    const allSelected = children.every((c) => selectedMenuIds.has(c.id));
    const next = sectionPartial(padreId) ? true : event.target.checked;
    toggleSection(padreId, allSelected && !next ? false : next);
    event.target.indeterminate = sectionPartial(padreId);
    event.target.checked = sectionChecked(padreId);
  }

  function selectAllVisible() {
    if (fullAccess) return;
    const visible = [
      ...filteredParentMenus().flatMap((p) => filteredChildMenus(p.id)),
      ...filteredOrphanMenus(),
    ];
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      for (const item of visible) {
        if (isAssignable(item)) next.add(item.id);
      }
      return next;
    });
  }

  function clearAll() {
    if (fullAccess) return;
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      for (const id of [...next]) {
        if (!isInherited(id)) next.delete(id);
      }
      return next;
    });
  }

  function extraCount() {
    return sanitizedMenuIds().filter((id) => !isInherited(id)).length;
  }

  function selectedCount() {
    return sanitizedMenuIds().length;
  }

  async function save() {
    if (!hasTarget) {
      toast.error(assignmentMode === 'user' ? 'Seleccione un usuario' : 'Seleccione un perfil');
      return;
    }
    const menuIds = sanitizedMenuIds();
    if (menuIds.length === 0) {
      toast.error('Seleccione al menos una opción de menú con ruta (las secciones padre no se asignan solas)');
      return;
    }
    setSaving(true);
    try {
      if (assignmentMode === 'user') {
        await syncUsuarioMenu(selectedUserId!, menuIds);
        setSelectedMenuIds(new Set(menuIds));
        await loadTargetMenus();
        toast.success('Permisos guardados');
        await loadUnassigned();
      } else {
        const perms = Object.fromEntries(
          menuIds.map((menuId) => {
            const selected = menuPermissions.get(menuId) ?? new Set<MenuActionKey>();
            const permissions: MenuActionPermissions = {
              ver: true,
              agregar: selected.has('agregar'),
              editar: selected.has('editar'),
              eliminar: selected.has('eliminar'),
              exportar: selected.has('exportar'),
              configurar: selected.has('configurar'),
            };
            return [menuId, permissions];
          }),
        );
        await syncNivelMenu(selectedNivelId!, menuIds, perms);
        setSelectedMenuIds(new Set(menuIds));
        toast.success('Perfil actualizado');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function applyToUsers() {
    if (!selectedNivelId) return;
    setApplyingToUsers(true);
    try {
      const res = await applyNivelMenuToUsers(selectedNivelId, onlyWithExtras);
      toast.success(
        res.applied > 0
          ? `Listo: ${res.applied} usuario(s) volvieron al menú del perfil`
          : 'No había usuarios con menús personales para restablecer',
      );
      await loadUnassigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo restablecer los menús personales');
    } finally {
      setApplyingToUsers(false);
      setApplyConfirmOpen(false);
    }
  }

  async function openMatrix() {
    setMatrixOpen(true);
    setMatrixSearch('');
    setMatrixError('');
    setMatrixLoading(true);
    try {
      const res = await fetchNivelMenuMatrix();
      setMatrixNiveles(res.niveles);
      setMatrixRows(res.rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo cargar el mapeo de menús';
      setMatrixNiveles([]);
      setMatrixRows([]);
      setMatrixError(message);
      toast.error(message);
    } finally {
      setMatrixLoading(false);
    }
  }

  function filteredMatrixRows() {
    const q = matrixSearch.trim().toLowerCase();
    if (!q) return matrixRows;
    const matchedChildIds = new Set<number>();
    const matchedParentIds = new Set<number>();
    for (const row of matrixRows) {
      if (row.kind !== 'child') continue;
      const hay = `${row.texto} ${row.ruta ?? ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
      matchedChildIds.add(row.id);
      if (row.padre_id != null) matchedParentIds.add(row.padre_id);
    }
    for (const row of matrixRows) {
      if (row.kind !== 'parent') continue;
      if (row.texto.toLowerCase().includes(q)) matchedParentIds.add(row.id);
    }
    return matrixRows.filter((row) => {
      if (row.kind === 'parent') return matchedParentIds.has(row.id);
      return matchedChildIds.has(row.id);
    });
  }

  function matrixIsAssigned(row: NivelMenuMatrixRow, nivelId: number) {
    return row.assigned?.[String(nivelId)] === true;
  }

  function matrixNivelCount(nivelId: number) {
    return matrixRows.filter((row) => row.kind === 'child' && matrixIsAssigned(row, nivelId)).length;
  }

  function matrixChildTotal() {
    return matrixRows.filter((row) => row.kind === 'child').length;
  }

  function openNivelFromMatrix(nivelId: number) {
    setMatrixOpen(false);
    setMode('nivel');
    setSelectedNivelId(nivelId);
    queueMicrotask(() =>
      document.getElementById('permisos-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  useEffect(() => {
    if (!matrixOpen || !matrixScrollRef.current) return;
    const root = matrixScrollRef.current;
    const thead = root.querySelector('thead');
    if (!thead) return;
    const apply = () => {
      const h = Math.ceil(Math.max(thead.offsetHeight, thead.getBoundingClientRect().height));
      if (h > 0) root.style.setProperty('--matrix-header-h', `${h + 1}px`);
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(thead);
    return () => ro?.disconnect();
  }, [matrixOpen, matrixRows, matrixNiveles]);

  return (
    <div className="g-page g-page--compact g-page-config g-page-config-asignacion">
      <header className="g-page-header">
        <div>
          <h1 className="g-page-title">Asignación de menú</h1>
          <p className="g-page-sub">
            Elige qué páginas ve cada perfil o usuario. Marca opciones, revisa la vista previa y guarda.
          </p>
        </div>
      </header>

      {!loadingUnassigned && unassignedUsers.length > 0 ? (
        <section className="asignacion-alert g-card">
          <div className="asignacion-alert__head">
            <span className="asignacion-alert__icon">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden />
            </span>
            <div className="asignacion-alert__copy">
              <h2 className="asignacion-alert__title">{unassignedUsers.length} usuario(s) sin menú asignado</h2>
              <p className="asignacion-alert__sub">
                Puedes asignarles el menú <strong>Dashboard</strong> con un clic o revisar cada usuario en el panel inferior.
              </p>
            </div>
            <div className="asignacion-alert__actions">
              <Button type="button" size="sm" disabled={assigningDashboard} onClick={() => void assignDashboardToAll()}>
                <i className="fa-solid fa-gauge mr-1" aria-hidden /> Asignar Dashboard a todos
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setUnassignedExpanded((v) => !v)}>
                <i className={`fa-solid ${unassignedExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} mr-1`} aria-hidden />
                {unassignedExpanded ? 'Ocultar lista' : 'Ver lista'}
              </Button>
            </div>
          </div>

          {unassignedExpanded ? (
            <>
              <div className="asignacion-alert__toolbar">
                <div className="asignacion-alert__search-wrap">
                  <i className="fa-solid fa-search asignacion-alert__search-icon" aria-hidden />
                  <input
                    type="search"
                    className="g-input g-input--soft asignacion-alert__search"
                    value={unassignedSearch}
                    onChange={(e) => setUnassignedSearch(e.target.value)}
                    placeholder="Buscar por nombre, usuario o correo…"
                  />
                </div>
                <span className="asignacion-alert__count">{filteredUnassignedUsers.length} resultado(s)</span>
              </div>
              <div className="asignacion-alert__table-wrap">
                <table className="asignacion-alert__table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Usuario</th>
                      <th className="text-end">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnassignedUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.nombre_completo || '—'}</td>
                        <td>
                          <code>{user.username}</code>
                          {user.email ? <span className="asignacion-alert__email">{user.email}</span> : null}
                        </td>
                        <td className="text-end">
                          <div className="asignacion-alert__row-actions">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={assigningUserId === user.id}
                              onClick={() => void assignDashboardToUser(user)}
                            >
                              <i className="fa-solid fa-gauge mr-1" aria-hidden /> Asignar Dashboard
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => selectUser(user.id)}>
                              <i className="fa-solid fa-sliders mr-1" aria-hidden /> Personalizar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredUnassignedUsers.length ? (
                      <tr>
                        <td colSpan={3} className="asignacion-alert__empty">
                          No hay coincidencias con la búsqueda.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="g-config-permissions g-card" id="permisos-panel">
        <div className="g-config-permissions__head">
          <div>
            <h2 className="g-config-permissions__title">
              <i className="fa-solid fa-user-lock text-groomers-purple" aria-hidden /> Permisos de menú
            </h2>
            <p className="g-config-permissions__sub">
              {assignmentMode === 'user'
                ? 'El usuario hereda el menú de su perfil. Aquí solo puedes sumar páginas adicionales para esa persona.'
                : 'Define el menú base del perfil. Todos los usuarios con ese perfil lo heredan automáticamente.'}
            </p>
          </div>
          <div className="asignacion-head-actions">
            <Button type="button" variant="outline" size="sm" onClick={() => void openMatrix()}>
              <i className="fa-solid fa-table-cells mr-1" aria-hidden /> Vista general
            </Button>
            <div className="asignacion-mode-tabs">
              <button
                type="button"
                className={`asignacion-mode-tab${assignmentMode === 'user' ? ' is-active' : ''}`}
                onClick={() => setMode('user')}
              >
                <i className="fa-solid fa-user" aria-hidden /> Por usuario
              </button>
              <button
                type="button"
                className={`asignacion-mode-tab${assignmentMode === 'nivel' ? ' is-active' : ''}`}
                onClick={() => setMode('nivel')}
              >
                <i className="fa-solid fa-layer-group" aria-hidden /> Por perfil
              </button>
            </div>
          </div>
        </div>

        <div className="g-config-permissions__toolbar">
          {assignmentMode === 'user' ? (
            <div className="g-config-permissions__user g-config-permissions__user--picker">
              <SearchableSelect
                label="Usuario"
                placeholder="Buscar y seleccionar usuario…"
                searchPlaceholder="Nombre, usuario, correo o nivel…"
                options={usuarioSelectOptions}
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                disabled={loadingUsuarios}
              />
            </div>
          ) : loadingNiveles ? (
            <div className="g-config-permissions__user g-config-permissions__user--picker">
              <span className="g-field-label">Perfil / nivel</span>
              <div className="asignacion-select-loading mt-1">
                <i className="fa-solid fa-spinner fa-spin" aria-hidden /> Cargando perfiles…
              </div>
            </div>
          ) : (
            <div className="g-config-permissions__user g-config-permissions__user--picker">
              <SearchableSelect
                label="Perfil / nivel"
                placeholder="Buscar y seleccionar perfil…"
                searchPlaceholder="Nombre o descripción del perfil…"
                options={nivelSelectOptions}
                value={selectedNivelId}
                onValueChange={setSelectedNivelId}
              />
            </div>
          )}

          {hasTarget ? (
            <>
              <label className="g-config-permissions__search">
                <span className="g-field-label">Buscar opción</span>
                <div className="relative mt-1">
                  <i className="fa-solid fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" aria-hidden />
                  <input
                    type="search"
                    className="g-input g-input--soft pl-10"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Filtrar por nombre o ruta…"
                  />
                </div>
              </label>
              <div className="g-config-permissions__bulk">
                <Button type="button" variant="outline" size="sm" onClick={() => setCollapsedSections(new Set())}>
                  <i className="fa-solid fa-angles-down mr-1" aria-hidden /> Expandir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCollapsedSections(new Set(parentMenus().map((m) => m.id)))}
                >
                  <i className="fa-solid fa-angles-up mr-1" aria-hidden /> Colapsar
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
                  <i className="fa-solid fa-check-double mr-1" aria-hidden /> Marcar visibles
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                  <i className="fa-solid fa-eraser mr-1" aria-hidden /> Quitar todo
                </Button>
              </div>
            </>
          ) : null}
        </div>

        <div className="menu-config-state-panel">
          {loading ? (
            <div className="menu-config-state-panel__loading">
              <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden /> Cargando permisos…
            </div>
          ) : error ? (
            <div className="menu-config-state-panel__error">{error}</div>
          ) : hasTarget && menus.length ? (
            <>
              <p className="g-config-permissions__count">
                <i className="fa-solid fa-check-double mr-1 text-groomers-purple" aria-hidden />
                <strong>{selectedTargetLabel}</strong>
                <span className="asignacion-user-meta__inline">{selectedTargetMeta}</span>
                — {selectedCount()} página(s) seleccionada(s)
                {assignmentMode === 'nivel' ? (
                  <span className="asignacion-user-meta__inline">· {selectedActionCount()} acción(es)</span>
                ) : null}
                {assignmentMode === 'user' && inheritedMenuIds.size ? (
                  <span className="asignacion-user-meta__inline">
                    ({inheritedMenuIds.size} del perfil · {extraCount()} personal(es))
                  </span>
                ) : null}
              </p>

              {assignmentMode === 'user' && (menuSource === 'nivel' || menuSource === 'merged') ? (
                <div className="asignacion-inherit-banner">
                  <i className="fa-solid fa-layer-group" aria-hidden />
                  <span>
                    {menuSource === 'merged' ? (
                      <>
                        Este usuario ya tiene el menú del perfil <strong>{inheritedNivelNombre || 'asignado'}</strong>
                        (<strong>{inheritedMenuIds.size}</strong> páginas). Las etiquetadas como <em>Perfil</em> no se pueden quitar aquí;
                        solo puedes añadir o quitar páginas personales.
                      </>
                    ) : (
                      <>
                        Este usuario usa el menú del perfil <strong>{inheritedNivelNombre || 'asignado'}</strong>.
                        Marca páginas adicionales y guarda para dárselas solo a esta persona.
                      </>
                    )}
                  </span>
                </div>
              ) : null}

              {assignmentMode === 'nivel' && fullAccess ? (
                <div className="asignacion-inherit-banner">
                  <i className="fa-solid fa-shield-halved" aria-hidden />
                  <span>Este perfil de administrador tiene acceso completo a todas las páginas. No se puede restringir desde aquí.</span>
                </div>
              ) : null}

              {assignmentMode === 'nivel' && !fullAccess ? (
                <details className="asignacion-reset-card">
                  <summary>
                    <i className="fa-solid fa-user-gear" aria-hidden />
                    <span>Restablecer menús personales de usuarios</span>
                  </summary>
                  <div className="asignacion-reset-card__body">
                    <p>
                      A veces un usuario tiene páginas añadidas solo para él (además del perfil).
                      Usa esto para borrar esas excepciones y dejarlo solo con el menú de este perfil.
                    </p>
                    <div className="asignacion-reset-card__scopes" role="radiogroup" aria-label="Alcance del restablecimiento">
                      <label className="asignacion-reset-card__scope">
                        <input type="radio" name="onlyWithExtras" checked={onlyWithExtras} onChange={() => setOnlyWithExtras(true)} />
                        <span>
                          <strong>Solo quienes tienen menús personales</strong>
                          <small>Recomendado. No toca a quienes ya usan solo el perfil.</small>
                        </span>
                      </label>
                      <label className="asignacion-reset-card__scope">
                        <input type="radio" name="onlyWithExtras" checked={!onlyWithExtras} onChange={() => setOnlyWithExtras(false)} />
                        <span>
                          <strong>Todos los usuarios de este perfil</strong>
                          <small>Limpia excepciones personales en todo el grupo.</small>
                        </span>
                      </label>
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={applyingToUsers} onClick={() => setApplyConfirmOpen(true)}>
                      <i className="fa-solid fa-rotate-left mr-1" aria-hidden /> Restablecer menús personales
                    </Button>
                  </div>
                </details>
              ) : null}

              <div className="asignacion-workspace">
                <div className="asignacion-workspace__tree">
                  <div className="g-config-permissions__tree">
                    {filteredParentMenus().map((parent) => (
                      <div key={parent.id} className="g-config-permissions__section" id={`menu-section-${parent.id}`}>
                        <div className="g-config-permissions__section-head-row">
                          <button
                            type="button"
                            className="asignacion-collapse-btn"
                            onClick={() => {
                              setCollapsedSections((prev) => {
                                const next = new Set(prev);
                                if (next.has(parent.id)) next.delete(parent.id);
                                else next.add(parent.id);
                                return next;
                              });
                            }}
                          >
                            <i
                              className={`fa-solid ${collapsedSections.has(parent.id) ? 'fa-chevron-right' : 'fa-chevron-down'}`}
                              aria-hidden
                            />
                          </button>
                          <label className="g-config-permissions__section-head">
                            <input
                              type="checkbox"
                              checked={sectionChecked(parent.id)}
                              disabled={fullAccess}
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate = sectionPartial(parent.id);
                                  el.checked = sectionChecked(parent.id);
                                }
                              }}
                              onChange={(e) => onSectionCheckboxChange(parent.id, e)}
                            />
                            <i className={`fa-solid ${normalizeMenuIcon(parent.icono, true)} text-groomers-purple`} aria-hidden />
                            <span>{parent.texto}</span>
                            <span className="g-config-permissions__section-meta">
                              {assignableChildMenus(parent.id).filter((c) => selectedMenuIds.has(c.id)).length}/
                              {assignableChildMenus(parent.id).length}
                            </span>
                          </label>
                        </div>
                        {!collapsedSections.has(parent.id) ? (
                          <div className="g-config-permissions__children">
                            {filteredChildMenus(parent.id).map((child) => (
                              <div key={child.id} className="asignacion-menu-option">
                                <label
                                  className={`g-config-permissions__item${isInherited(child.id) ? ' g-config-permissions__item--inherited' : ''}`}
                                >
                                  <Checkbox
                                    checked={isChecked(child.id)}
                                    disabled={isInherited(child.id) || fullAccess}
                                    onCheckedChange={(checked) => toggleMenu(child.id, checked === true)}
                                  />
                                  <i className={`fa-solid ${normalizeMenuIcon(child.icono, false)} text-gray-400`} aria-hidden />
                                  <span>{child.texto}</span>
                                  {isInherited(child.id) ? (
                                    <span className="asignacion-menu-badge">Del perfil</span>
                                  ) : isChecked(child.id) && assignmentMode === 'user' ? (
                                    <span className="asignacion-menu-badge asignacion-menu-badge--extra">Personal</span>
                                  ) : null}
                                  {child.ruta ? <code className="dt-menu-ruta">{child.ruta}</code> : null}
                                </label>
                                {assignmentMode === 'nivel' && availableActions(child).length ? (
                                  <div className={`asignacion-menu-actions${!isChecked(child.id) ? ' is-disabled' : ''}`}>
                                    <span className="asignacion-menu-actions__label">Acciones:</span>
                                    {availableActions(child).map((action) => (
                                      <label key={action.clave} className="asignacion-menu-action">
                                        <input
                                          type="checkbox"
                                          checked={isActionChecked(child.id, action.clave)}
                                          disabled={!isChecked(child.id) || fullAccess}
                                          onChange={(e) => toggleAction(child, action.clave, e.target.checked)}
                                        />
                                        <span>{action.texto}</span>
                                      </label>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}

                    {filteredOrphanMenus().length ? (
                      <div className="g-config-permissions__section g-config-permissions__section--orphan" id="menu-section-orphan">
                        <p className="g-config-permissions__section-label">Sin sección</p>
                        {filteredOrphanMenus().map((item) => (
                          <div key={item.id} className="asignacion-menu-option">
                            <label
                              className={`g-config-permissions__item${isInherited(item.id) ? ' g-config-permissions__item--inherited' : ''}`}
                            >
                              <Checkbox
                                checked={isChecked(item.id)}
                                disabled={isInherited(item.id) || fullAccess}
                                onCheckedChange={(checked) => toggleMenu(item.id, checked === true)}
                              />
                              <span>{item.texto}</span>
                              {isInherited(item.id) ? (
                                <span className="asignacion-menu-badge">Del perfil</span>
                              ) : isChecked(item.id) && assignmentMode === 'user' ? (
                                <span className="asignacion-menu-badge asignacion-menu-badge--extra">Personal</span>
                              ) : null}
                            </label>
                            {assignmentMode === 'nivel' && availableActions(item).length ? (
                              <div className={`asignacion-menu-actions${!isChecked(item.id) ? ' is-disabled' : ''}`}>
                                <span className="asignacion-menu-actions__label">Acciones:</span>
                                {availableActions(item).map((action) => (
                                  <label key={action.clave} className="asignacion-menu-action">
                                    <input
                                      type="checkbox"
                                      checked={isActionChecked(item.id, action.clave)}
                                      disabled={!isChecked(item.id) || fullAccess}
                                      onChange={(e) => toggleAction(item, action.clave, e.target.checked)}
                                    />
                                    <span>{action.texto}</span>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <aside className="asignacion-preview" aria-label="Vista previa de opciones asignadas">
                  <div className="asignacion-preview__head">
                    <div>
                      <h3 className="asignacion-preview__title">
                        <i className="fa-solid fa-eye" aria-hidden /> Vista previa
                      </h3>
                      <p className="asignacion-preview__sub">
                        {selectedCount()} página(s) asignada(s)
                        {assignmentMode === 'nivel' && selectedActionCount() ? ` · ${selectedActionCount()} acción(es)` : ''}
                      </p>
                    </div>
                  </div>
                  {!previewGroups().length ? (
                    <p className="asignacion-preview__empty">
                      Todavía no hay páginas marcadas. Selecciónalas a la izquierda para verlas aquí.
                    </p>
                  ) : (
                    <div className="asignacion-preview__list">
                      {previewGroups().map((group) => (
                        <section key={group.parentId} className="asignacion-preview__group">
                          <button
                            type="button"
                            className="asignacion-preview__group-head"
                            onClick={() => {
                              if (group.parentId > 0) {
                                setCollapsedSections((prev) => {
                                  const next = new Set(prev);
                                  next.delete(group.parentId);
                                  return next;
                                });
                              }
                              document
                                .getElementById(group.parentId > 0 ? `menu-section-${group.parentId}` : 'menu-section-orphan')
                                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                          >
                            <i className={`fa-solid ${normalizeMenuIcon(group.parentIcon, true)}`} aria-hidden />
                            <span>{group.parentTexto}</span>
                            <em>{group.items.length}</em>
                          </button>
                          <ul className="asignacion-preview__items">
                            {group.items.map((item) => (
                              <li key={item.id} className="asignacion-preview__item">
                                <div className="asignacion-preview__item-main">
                                  <strong>{item.texto}</strong>
                                  {item.inherited ? <span className="asignacion-menu-badge">Del perfil</span> : null}
                                  {item.extra ? (
                                    <span className="asignacion-menu-badge asignacion-menu-badge--extra">Personal</span>
                                  ) : null}
                                  {item.ruta ? <code>{item.ruta}</code> : null}
                                  {item.actions.length ? (
                                    <span className="asignacion-preview__actions">{item.actions.join(' · ')}</span>
                                  ) : null}
                                </div>
                                {!item.inherited && !fullAccess ? (
                                  <button
                                    type="button"
                                    className="asignacion-preview__remove"
                                    title="Quitar"
                                    onClick={() => toggleMenu(item.id, false)}
                                  >
                                    <i className="fa-solid fa-xmark" aria-hidden />
                                  </button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  )}
                </aside>
              </div>

              <div className="g-config-permissions__footer">
                <Button type="button" disabled={saving || fullAccess} onClick={() => void save()}>
                  <i className="fa-solid fa-floppy-disk mr-1" aria-hidden />
                  {assignmentMode === 'user' ? 'Guardar permisos' : 'Guardar perfil'}
                </Button>
              </div>
            </>
          ) : hasTarget ? (
            <div className="asignacion-empty-state">
              <p className="asignacion-empty-state__text">No hay opciones de menú configuradas.</p>
            </div>
          ) : (
            <div className="asignacion-empty-state">
              <p className="asignacion-empty-state__text">
                Seleccione un {assignmentMode === 'user' ? 'usuario' : 'perfil'} o use la alerta superior para asignar Dashboard.
              </p>
            </div>
          )}
        </div>
      </section>

      <Dialog open={matrixOpen} onOpenChange={setMatrixOpen}>
        <DialogContent className="flex max-h-[96vh] w-[96vw] max-w-[96vw] flex-col">
          <DialogHeader>
            <DialogTitle>Mapeo de menús por perfil</DialogTitle>
          </DialogHeader>
          <div className="asignacion-matrix flex min-h-0 flex-1 flex-col">
            <div className="asignacion-matrix__toolbar">
              <label className="asignacion-matrix__search">
                <span className="g-field-label">Filtrar</span>
                <div className="relative mt-1">
                  <i className="fa-solid fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" aria-hidden />
                  <input
                    type="search"
                    className="g-input g-input--soft pl-10"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Buscar menú o ruta…"
                  />
                </div>
              </label>
              <p className="asignacion-matrix__hint">
                Filas = menús (padres e hijos). Columnas = perfiles. Haz clic en un perfil para editarlo.
              </p>
            </div>
            {matrixLoading ? (
              <div className="asignacion-matrix__state">
                <i className="fa-solid fa-spinner fa-spin" aria-hidden /> Cargando mapeo…
              </div>
            ) : matrixError ? (
              <div className="asignacion-matrix__state asignacion-matrix__state--error">{matrixError}</div>
            ) : !matrixNiveles.length ? (
              <div className="asignacion-matrix__state">No hay perfiles activos para mostrar.</div>
            ) : (
              <div className="asignacion-matrix__scroll" ref={matrixScrollRef}>
                <table className="asignacion-matrix__table">
                  <thead>
                    <tr>
                      <th className="asignacion-matrix__menu-col">Menú</th>
                      {matrixNiveles.map((nivel) => (
                        <th key={nivel.id} className="asignacion-matrix__nivel-col">
                          <button
                            type="button"
                            className={`asignacion-matrix__nivel-btn${nivel.full_access ? ' is-full' : ''}`}
                            title={nivel.descripcion || nivel.nombre}
                            onClick={() => openNivelFromMatrix(nivel.id)}
                          >
                            <span className="asignacion-matrix__nivel-name">{nivel.nombre}</span>
                            <span className="asignacion-matrix__nivel-count">
                              {nivel.full_access ? 'Todo' : `${matrixNivelCount(nivel.id)}/${matrixChildTotal()}`}
                            </span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatrixRows().map((row) =>
                      row.kind === 'parent' ? (
                        <tr key={`parent-${row.id}`} className="asignacion-matrix__parent">
                          <td colSpan={1 + matrixNiveles.length}>
                            <div className="asignacion-matrix__parent-inner">
                              <i className={`fa-solid ${normalizeMenuIcon(row.icono_fa || row.icono, true)}`} aria-hidden />
                              <strong>{row.texto}</strong>
                              <span className="asignacion-matrix__child-count">{row.child_count} opción(es)</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={`child-${row.id}`} className="asignacion-matrix__child">
                          <td className="asignacion-matrix__menu-col">
                            <div className="asignacion-matrix__child-label">
                              <span className="asignacion-matrix__child-name">{row.texto}</span>
                              {row.ruta ? <code className="asignacion-matrix__ruta">{row.ruta}</code> : null}
                            </div>
                          </td>
                          {matrixNiveles.map((nivel) => (
                            <td
                              key={nivel.id}
                              className={`asignacion-matrix__cell${matrixIsAssigned(row, nivel.id) ? ' is-on' : ''}`}
                            >
                              {matrixIsAssigned(row, nivel.id) ? (
                                <i className="fa-solid fa-check" aria-label="Asignado" />
                              ) : (
                                <span className="asignacion-matrix__dash" aria-hidden>·</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                    {!filteredMatrixRows().length ? (
                      <tr>
                        <td colSpan={1 + matrixNiveles.length} className="asignacion-matrix__empty">
                          No hay coincidencias con el filtro.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMatrixOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={applyConfirmOpen} onOpenChange={setApplyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restablecer menús personales?</AlertDialogTitle>
            <AlertDialogDescription>
              {onlyWithExtras
                ? 'Solo se afectará a usuarios de este perfil que tengan menús personales añadidos.'
                : 'Se afectará a TODOS los usuarios activos de este perfil.'}{' '}
              Esas excepciones se borrarán y volverán a ver únicamente el menú del perfil «
              {selectedNivel?.nombre || 'este perfil'}».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyToUsers()}>Sí, restablecer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

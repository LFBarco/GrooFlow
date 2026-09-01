/** Paleta editable en /config/menu (clases Tailwind para el sidebar). */
export const MENU_ICON_COLOR_OPTIONS = [
  { id: 'sky', label: 'Cielo', classes: 'text-sky-400 group-hover/btn:text-sky-300', swatch: 'bg-sky-400' },
  { id: 'cyan', label: 'Cian', classes: 'text-cyan-400 group-hover/btn:text-cyan-300', swatch: 'bg-cyan-400' },
  { id: 'teal', label: 'Teal', classes: 'text-teal-400 group-hover/btn:text-teal-300', swatch: 'bg-teal-400' },
  { id: 'emerald', label: 'Esmeralda', classes: 'text-emerald-400 group-hover/btn:text-emerald-300', swatch: 'bg-emerald-400' },
  { id: 'amber', label: 'Ámbar', classes: 'text-amber-400 group-hover/btn:text-amber-300', swatch: 'bg-amber-400' },
  { id: 'orange', label: 'Naranja', classes: 'text-orange-400 group-hover/btn:text-orange-300', swatch: 'bg-orange-400' },
  { id: 'rose', label: 'Rosa', classes: 'text-rose-400 group-hover/btn:text-rose-300', swatch: 'bg-rose-400' },
  { id: 'pink', label: 'Pink', classes: 'text-pink-400 group-hover/btn:text-pink-300', swatch: 'bg-pink-400' },
  { id: 'fuchsia', label: 'Fucsia', classes: 'text-fuchsia-400 group-hover/btn:text-fuchsia-300', swatch: 'bg-fuchsia-400' },
  { id: 'violet', label: 'Violeta', classes: 'text-violet-400 group-hover/btn:text-violet-300', swatch: 'bg-violet-400' },
  { id: 'purple', label: 'Púrpura', classes: 'text-purple-400 group-hover/btn:text-purple-300', swatch: 'bg-purple-400' },
  { id: 'indigo', label: 'Índigo', classes: 'text-indigo-400 group-hover/btn:text-indigo-300', swatch: 'bg-indigo-400' },
  { id: 'slate', label: 'Gris', classes: 'text-slate-400 group-hover/btn:text-slate-300', swatch: 'bg-slate-400' },
] as const;

/** Colores por defecto al crear opciones nuevas en el editor (se guardan en BD). */
const SEED_BY_MODULO: Record<string, string> = {
  Dashboard: 'text-sky-400 group-hover/btn:text-sky-300',
  Alertas: 'text-rose-400 group-hover/btn:text-rose-300',
  Analítica: 'text-violet-400 group-hover/btn:text-violet-300',
  Tesorería: 'text-amber-400 group-hover/btn:text-amber-300',
  Transacciones: 'text-emerald-400 group-hover/btn:text-emerald-300',
  'Flujo de Caja': 'text-cyan-400 group-hover/btn:text-cyan-300',
  'Estado de Resultados': 'text-pink-400 group-hover/btn:text-pink-300',
  Reportes: 'text-amber-400 group-hover/btn:text-amber-300',
  'Caja Chica': 'text-teal-400 group-hover/btn:text-teal-300',
  Honorarios: 'text-violet-400 group-hover/btn:text-violet-300',
  Proveedores: 'text-indigo-400 group-hover/btn:text-indigo-300',
  Contabilidad: 'text-sky-400 group-hover/btn:text-sky-300',
  'Gestión Vehicular': 'text-cyan-400 group-hover/btn:text-cyan-300',
  'Gestión de Inventario': 'text-sky-400 group-hover/btn:text-sky-300',
  Asistencia: 'text-indigo-400 group-hover/btn:text-indigo-300',
  Turnos: 'text-violet-400 group-hover/btn:text-violet-300',
  'Accidentes de Trabajo': 'text-rose-400 group-hover/btn:text-rose-300',
  'Entrega de Uniformes': 'text-indigo-400 group-hover/btn:text-indigo-300',
  'Recursos Humanos': 'text-blue-400 group-hover/btn:text-blue-300',
  Productos: 'text-fuchsia-400 group-hover/btn:text-fuchsia-300',
  Compras: 'text-purple-400 group-hover/btn:text-purple-300',
  Auditoría: 'text-orange-400 group-hover/btn:text-orange-300',
  Conciliación: 'text-emerald-400 group-hover/btn:text-emerald-300',
  Configuración: 'text-slate-400 group-hover/btn:text-slate-300',
  'Admin Menú GrooFlow': 'text-cyan-400 group-hover/btn:text-cyan-300',
  'Asignación Menú GrooFlow': 'text-emerald-400 group-hover/btn:text-emerald-300',
};

const SEED_DEFAULT = 'text-indigo-400 group-hover/btn:text-indigo-300';

/** Solo el color guardado en BD (sin mapa local de fallback). */
export function resolveMenuIconColorClass(stored?: string | null): string {
  return (stored ?? '').trim();
}

/** Color inicial al crear una opción nueva (se persiste en BD). */
export function defaultMenuIconColorForModulo(moduloKey?: string): string {
  if (moduloKey && SEED_BY_MODULO[moduloKey]) return SEED_BY_MODULO[moduloKey];
  return SEED_DEFAULT;
}

export function menuIconColorSwatchClass(stored?: string | null): string {
  const classes = resolveMenuIconColorClass(stored);
  const match = MENU_ICON_COLOR_OPTIONS.find((opt) => opt.classes === classes);
  return match?.swatch ?? 'bg-slate-400';
}

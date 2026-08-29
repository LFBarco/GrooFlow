export interface MenuIconGroup {
  label: string;
  icons: string[];
}

export const MENU_ICON_GROUPS: MenuIconGroup[] = [
  {
    label: 'General',
    icons: ['fa-house', 'fa-grip', 'fa-bars', 'fa-ellipsis', 'fa-circle', 'fa-star', 'fa-bookmark', 'fa-link'],
  },
  {
    label: 'Dashboard y datos',
    icons: ['fa-chart-line', 'fa-chart-pie', 'fa-chart-bar', 'fa-chart-simple', 'fa-gauge', 'fa-ranking-star', 'fa-arrow-trend-up'],
  },
  {
    label: 'Usuarios y equipos',
    icons: ['fa-users', 'fa-user', 'fa-user-plus', 'fa-user-gear', 'fa-user-shield', 'fa-user-doctor', 'fa-id-badge'],
  },
  {
    label: 'Mascotas y salud',
    icons: ['fa-paw', 'fa-cat', 'fa-dog', 'fa-heart-pulse', 'fa-file-medical', 'fa-stethoscope', 'fa-syringe', 'fa-hospital'],
  },
  {
    label: 'Negocio',
    icons: ['fa-building', 'fa-briefcase', 'fa-scissors', 'fa-store', 'fa-money-bill', 'fa-coins', 'fa-credit-card', 'fa-receipt'],
  },
  {
    label: 'Calendario y ubicación',
    icons: ['fa-calendar', 'fa-calendar-days', 'fa-calendar-xmark', 'fa-clock', 'fa-location-dot', 'fa-map', 'fa-map-pin'],
  },
  {
    label: 'Archivos y listas',
    icons: ['fa-folder', 'fa-folder-open', 'fa-list', 'fa-list-check', 'fa-table', 'fa-file-lines', 'fa-file-excel', 'fa-download'],
  },
  {
    label: 'Comunicación',
    icons: ['fa-phone', 'fa-envelope', 'fa-comments', 'fa-bell', 'fa-bullhorn', 'fa-globe', 'fa-wifi'],
  },
  {
    label: 'Herramientas',
    icons: ['fa-gear', 'fa-sliders', 'fa-screwdriver-wrench', 'fa-wrench', 'fa-filter', 'fa-magnifying-glass', 'fa-key', 'fa-lock'],
  },
  {
    label: 'Ciencia y auditoría',
    icons: ['fa-flask', 'fa-fire', 'fa-microscope', 'fa-magnifying-glass-chart', 'fa-shield-halved', 'fa-square-plus'],
  },
];

export const ALL_MENU_ICONS: string[] = MENU_ICON_GROUPS.flatMap((g) => g.icons);

/** Convierte iconos legacy (uil-*, fa fa-*) a clases Font Awesome fa-* para la UI. */
export function normalizeMenuIcon(icon?: string | null, esPadre?: boolean): string {
  const raw = (icon ?? '').trim();
  if (!raw) {
    return esPadre ? 'fa-folder' : 'fa-link';
  }

  const faMatch = raw.match(/\bfa-([a-z0-9-]+)\b/i);
  if (faMatch) {
    const fa = `fa-${faMatch[1].toLowerCase()}`;
    return fa === 'fa-cut' ? 'fa-scissors' : fa;
  }

  let key = raw;
  const uilMatch = raw.match(/\buil-([a-z0-9-]+)\b/i);
  if (uilMatch) {
    key = `uil-${uilMatch[1].toLowerCase()}`;
  }

  const map: Record<string, string> = {
    'uil-apps': 'fa-grip',
    'uil-chart-pie': 'fa-chart-pie',
    'uil-chart-bar': 'fa-chart-bar',
    'uil-chart-line': 'fa-chart-line',
    'uil-users-alt': 'fa-users',
    'uil-list-ul': 'fa-list',
    'uil-cog': 'fa-gear',
    'uil-setting': 'fa-sliders',
    'uil-heart-medical': 'fa-heart-pulse',
    'uil-building': 'fa-building',
    'uil-briefcase': 'fa-briefcase',
    'uil-user-plus': 'fa-user-plus',
    'uil-layer-group': 'fa-layer-group',
    'uil-estate': 'fa-chart-line',
    'uil-file-medical': 'fa-file-medical',
    'uil-map-marker-alt': 'fa-location-dot',
    'uil-calendar-alt': 'fa-calendar',
    'uil-money-bill': 'fa-money-bill',
    'uil-calendar-slash': 'fa-calendar-xmark',
    'uil-globe': 'fa-globe',
    'uil-user-md': 'fa-user-doctor',
    'uil-hospital': 'fa-hospital',
    'uil-flask': 'fa-flask',
    'uil-fire': 'fa-fire',
    'uil-search-alt': 'fa-magnifying-glass',
    'uil-dashboard': 'fa-gauge',
    'uil-file-alt': 'fa-file-lines',
    'uil-clock': 'fa-clock',
    'uil-desktop': 'fa-desktop',
    'uil-tools': 'fa-screwdriver-wrench',
    'uil-coins': 'fa-coins',
    'uil-phone': 'fa-phone',
    'uil-medical-square': 'fa-square-plus',
  };

  return map[key] ?? (esPadre ? 'fa-folder' : 'fa-link');
}

/** Limpia locks de UI que pueden quedar al desmontar Asistencia (DnD / diálogos). */
export function resetAsistenciaUiLocks(): void {
  if (typeof document === 'undefined') return;
  const { body, documentElement } = document;
  if (body.style.pointerEvents === 'none') {
    body.style.pointerEvents = '';
  }
  if (body.style.overflow === 'hidden') {
    body.style.overflow = '';
  }
  body.removeAttribute('data-scroll-locked');
  documentElement.style.removeProperty('overflow');
  // Fantasmas / previews residuales de drag
  document.querySelectorAll('[data-dnd-preview], .asistencia-dnd-ghost').forEach((el) => {
    el.remove();
  });
}

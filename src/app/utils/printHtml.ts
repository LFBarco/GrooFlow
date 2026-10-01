/**
 * Imprime un documento HTML completo por iframe oculto.
 * `window.open(..., 'noopener')` devuelve null y los popups suelen bloquearse; el iframe no.
 */
export async function printHtmlDocument(html: string): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('No se pudo preparar la impresión.');
  }
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((r) => setTimeout(r, 200));
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  win.addEventListener('afterprint', cleanup, { once: true });
  win.focus();
  win.print();
  setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
}

export function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

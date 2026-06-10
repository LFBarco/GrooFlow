import type { User } from '../types';

/** Avatar personalizado o ilustración generada por email/id. */
export function getUserAvatarSrc(user: User | null | undefined): string {
  if (user?.avatarUrl?.trim()) return user.avatarUrl.trim();
  const seed = encodeURIComponent(user?.email || user?.id || 'user');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('invalid image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Reduce una imagen a data URL JPEG para guardar en KV/SQL (perfil).
 */
export async function resizeImageFileToAvatarDataUrl(
  file: File,
  maxPx = 256,
  maxEncodedChars = 420_000
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('not an image');
  }
  const img = await loadImageFromFile(file);
  const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.9;
  let dataUrl = canvasToJpegDataUrl(canvas, quality);
  while (dataUrl.length > maxEncodedChars && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvasToJpegDataUrl(canvas, quality);
  }
  if (dataUrl.length > maxEncodedChars) {
    throw new Error('image too large after resize');
  }
  return dataUrl;
}

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { fetchReceiptPhoto, type ReceiptPhotoModule } from '../../utils/receiptPhotosApi';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

type Props = {
  module: ReceiptPhotoModule;
  /** Id del registro; null cierra el diálogo. */
  refId: string | null;
  title?: string;
  onClose: () => void;
};

export function ReceiptPhotoDialog({ module, refId, title = 'Comprobante', onClose }: Props) {
  const [photo, setPhoto] = useState<{ dataUrl: string; mime: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!refId) return;
    let active = true;
    setPhoto(null);
    setError('');
    fetchReceiptPhoto(module, refId)
      .then((p) => active && setPhoto(p))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'No se pudo cargar el comprobante.'));
    return () => {
      active = false;
    };
  }, [module, refId]);

  const isPdf = photo?.mime === 'application/pdf';

  return (
    <Dialog open={refId !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Foto o PDF adjuntado al registrar el gasto.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !photo ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isPdf ? (
          <iframe title={title} src={photo.dataUrl} className="h-[70vh] w-full rounded-md border" />
        ) : (
          <img src={photo.dataUrl} alt={title} className="mx-auto max-h-[70vh] rounded-md object-contain" />
        )}
        {photo ? (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={photo.dataUrl} download={`comprobante-${refId}.${isPdf ? 'pdf' : 'jpg'}`}>
                <Download className="mr-1 h-4 w-4" />
                Descargar
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

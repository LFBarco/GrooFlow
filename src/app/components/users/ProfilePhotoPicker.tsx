import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { User } from '../../types';
import { getUserAvatarSrc, resizeImageFileToAvatarDataUrl } from '../../utils/userAvatar';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';

const MAX_INPUT_BYTES = 5 * 1024 * 1024;

type ProfilePhotoPickerProps = {
  user: User;
  onAvatarChange: (avatarUrl: string | undefined) => void;
  size?: 'md' | 'lg';
  disabled?: boolean;
};

export function ProfilePhotoPicker({
  user,
  onAvatarChange,
  size = 'lg',
  disabled = false,
}: ProfilePhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const avatarClass = size === 'lg' ? 'h-24 w-24' : 'h-16 w-16';
  const fallbackClass = size === 'lg' ? 'text-2xl' : 'text-lg';

  const handleFile = async (file: File) => {
    if (file.size > MAX_INPUT_BYTES) {
      toast.error('La imagen es muy grande', {
        description: 'Usa una foto menor a 5 MB.',
      });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await resizeImageFileToAvatarDataUrl(file);
      onAvatarChange(dataUrl);
      toast.success('Foto de perfil actualizada');
    } catch {
      toast.error('No se pudo procesar la imagen', {
        description: 'Prueba con JPG o PNG.',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar
          className={`${avatarClass} ring-4 ring-background border-2 border-border shadow-xl`}
        >
          <AvatarImage src={getUserAvatarSrc(user)} alt={user.name} />
          <AvatarFallback className={`${fallbackClass} bg-primary/10 text-primary font-bold`}>
            {user.initials}
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
        {!disabled && !uploading && (
          <button
            type="button"
            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted transition-colors"
            title="Cambiar foto"
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
          </button>
        )}
      </div>

      {!disabled && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-1.5" />
            {user.avatarUrl ? 'Cambiar foto' : 'Agregar foto'}
          </Button>
          {user.avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              className="text-muted-foreground"
              onClick={() => {
                onAvatarChange(undefined);
                toast.success('Foto de perfil eliminada');
              }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Quitar
            </Button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <p className="text-[11px] text-muted-foreground text-center max-w-xs">
        JPG o PNG, máx. 5 MB. Se optimiza automáticamente para la app.
      </p>
    </div>
  );
}

import React, { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { supabase } from '../../../utils/supabase/client';
import { validatePasswordClient } from '../utils/userSessionGuard';

type PasswordRecoveryPageProps = {
  currentTheme: 'dark' | 'light';
  onToggleTheme: () => void;
  onComplete: () => void;
};

export function PasswordRecoveryPage({
  currentTheme,
  onToggleTheme,
  onComplete,
}: PasswordRecoveryPageProps) {
  const isDark = currentTheme === 'dark';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwdErr = validatePasswordClient(password);
    if (pwdErr) {
      toast.error(pwdErr);
      return;
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      toast.success('Contraseña actualizada', {
        description: 'Ya puedes usar tu nueva contraseña en GrooFlow.',
        duration: 8000,
      });
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.';
      toast.error('Error al restablecer', { description: message, duration: 10000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 font-sans"
      style={{
        background: isDark ? '#0B0F19' : '#f8fafc',
        color: isDark ? '#e2e8f0' : '#0f172a',
      }}
      data-testid="password-recovery-page"
    >
      <button
        type="button"
        onClick={onToggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Cambiar tema"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div
        className="w-full max-w-md rounded-2xl border p-8 shadow-xl"
        style={{
          borderColor: isDark ? 'rgba(139,92,246,0.25)' : 'rgba(109,40,217,0.15)',
          background: isDark ? 'rgba(15,23,42,0.85)' : '#fff',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="p-3 rounded-xl"
            style={{ background: isDark ? 'rgba(34,211,238,0.12)' : 'rgba(109,40,217,0.1)' }}
          >
            <LockKeyhole className="w-6 h-6" style={{ color: isDark ? '#22d3ee' : '#7c3aed' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Nueva contraseña</h1>
            <p className="text-sm opacity-70">Define una clave segura para tu cuenta GrooFlow.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="password-recovery-form">
          <div className="space-y-2">
            <Label htmlFor="recovery-password">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="recovery-password"
                data-testid="recovery-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres, letra y número"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recovery-confirm">Confirmar contraseña</Label>
            <Input
              id="recovery-confirm"
              data-testid="recovery-password-confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita la contraseña"
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 font-semibold"
            disabled={isSubmitting}
            data-testid="recovery-submit"
          >
            {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Detecta enlace de recuperación Supabase en el hash de la URL. */
export function isPasswordRecoveryUrl(
  hash: string = typeof window !== 'undefined' ? window.location.hash : ''
): boolean {
  const normalized = hash.toLowerCase();
  return normalized.includes('type=recovery') || normalized.includes('type=signup');
}

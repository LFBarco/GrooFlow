import { useState, useEffect, useMemo, useRef } from 'react';
import {
  User as UserIcon,
  Lock,
  Image as ImageIcon,
  Upload,
  Laptop,
  Check,
  Eye,
  EyeOff,
  Save,
  Shield,
  Clock,
  Sparkles,
  Trash2,
  Calendar,
  Phone,
  Mail,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { restFetch } from '../../services/repository/rest';
import { getGrooflowBackend } from '../../config/backend';

import type { User } from '../../types';
import { useApp } from '../../context/AppContext';
import { getUserAvatarSrc, isUsableAvatarUrl } from '../../utils/userAvatar';
import { getUserRoleLabel, resolveGrooflowMediaUrl } from '../../utils/userDisplay';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface UserProfilePageProps {
  onUpdateUser?: (updated: Partial<User>) => void;
  onLogout?: () => void;
}

const COVER_GRADIENTS = [
  { id: 'rose-amber', name: 'Rosa & Ámbar', style: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #eab308 100%)' },
  { id: 'indigo-cyan', name: 'Índigo & Cian', style: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #06b6d4 100%)' },
  { id: 'emerald-teal', name: 'Esmeralda & Turquesa', style: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #06b6d4 100%)' },
  { id: 'amber-orange', name: 'Fuego & Naranja', style: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)' },
  { id: 'blue-purple', name: 'Zafiro & Violeta', style: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #c084fc 100%)' },
  { id: 'obsidian-dark', name: 'Obsidiana Cyber', style: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #164e63 100%)' },
];

export function UserProfilePage({ onUpdateUser, onLogout }: UserProfilePageProps) {
  const { currentUser: user, roles = [], theme } = useApp();
  const roleLabel = getUserRoleLabel(user, roles);
  const isDark = theme === 'dark';

  // Load saved profile extras from localStorage
  const remote = getGrooflowBackend() === 'rest';
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionError, setSessionError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const loadSessions = async () => {
    if (!remote) { setSessionError('Sesiones disponibles con el backend REST'); return; }
    try { const data = await restFetch<{items: any[]}>('/auth/sessions'); setSessions(data.items); setSessionError(''); }
    catch (e) { setSessionError(e instanceof Error ? e.message : 'No se pudieron cargar las sesiones'); }
  };
  useEffect(() => { void loadSessions(); }, [user.id]);
  const revokeOthers = async () => {
    setSaving(true);
    try { await restFetch('/auth/sessions/revoke-others', {method: 'POST'}); await loadSessions(); toast.success('Otras sesiones cerradas'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudieron cerrar las sesiones'); }
    finally { setSaving(false); }
  };
  const storageKey = `grooflow_user_profile_extras_${user.id || 'current'}`;
  const savedExtras = useMemo(() => {
    if (remote) {
      const profile = user.personalProfile;
      if (profile && !Array.isArray(profile) && typeof profile === 'object') {
        return profile as Record<string, unknown>;
      }
      return {};
    }
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [storageKey, remote, user.personalProfile]);

  // Form states
  const [firstName, setFirstName] = useState(
    String(savedExtras.firstName || user.name?.split(' ')[0] || user.name || ''),
  );
  const [lastName, setLastName] = useState(
    String(savedExtras.lastName || user.name?.split(' ').slice(1).join(' ') || ''),
  );
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(String(savedExtras.phone || user.phone || ''));
  const [documentNumber, setDocumentNumber] = useState(
    String(savedExtras.documentNumber || user.documentNumber || ''),
  );
  const [gender, setGender] = useState(String(savedExtras.gender || 'Masculino'));
  const [birthDate, setBirthDate] = useState(String(savedExtras.birthDate || ''));
  const [userStatus, setUserStatus] = useState(String(savedExtras.userStatus || 'Disponible'));

  // Cover & Photo state
  const [selectedCover, setSelectedCover] = useState<string>(
    String(savedExtras.coverGradient || COVER_GRADIENTS[0].style),
  );
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(() => {
    const fromProfile =
      typeof savedExtras.customPhotoUrl === 'string' ? savedExtras.customPhotoUrl : '';
    const candidate = fromProfile || user.avatarUrl || '';
    return isUsableAvatarUrl(candidate) ? candidate : null;
  });
  const [photoBroken, setPhotoBroken] = useState(false);

  useEffect(() => {
    const fromProfile =
      typeof savedExtras.customPhotoUrl === 'string' ? savedExtras.customPhotoUrl : '';
    const candidate = fromProfile || user.avatarUrl || '';
    setCustomPhotoUrl(isUsableAvatarUrl(candidate) ? candidate : null);
    setPhotoBroken(false);
    if (user.email) setEmail(user.email);
  }, [user.id, user.avatarUrl, user.email, savedExtras.customPhotoUrl]);

  const avatarSrc = useMemo(() => {
    if (photoBroken) return '';
    const raw = (customPhotoUrl || '').trim();
    if (isUsableAvatarUrl(raw)) return resolveGrooflowMediaUrl(raw);
    return getUserAvatarSrc(user);
  }, [customPhotoUrl, photoBroken, user]);

  const avatarInitials = user.initials || user.name?.slice(0, 2)?.toUpperCase() || '?';
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(
    typeof savedExtras.customCoverUrl === 'string' ? savedExtras.customCoverUrl : null,
  );

  // Security password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // File input refs
  const coverInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEmail(user.email || '');
  }, [user.email]);

  const handleSavePersonalData = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || user.name;
    const extras = {
      firstName,
      lastName,
      phone,
      documentNumber,
      gender,
      birthDate,
      userStatus,
      coverGradient: selectedCover,
      customCoverUrl,
      customPhotoUrl,
    };
    setSaving(true);
    try {
      if (remote) {
        const result = await restFetch<{profile: User}>('/auth/profile', {method: 'PUT', body: JSON.stringify({...extras, email})});
        onUpdateUser?.(result.profile);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(extras));
        onUpdateUser?.({name: fullName, phone, documentNumber, avatarUrl: customPhotoUrl || undefined});
      }
      toast.success(remote ? 'Perfil guardado' : 'Perfil guardado en este dispositivo');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar el perfil'); }
    finally { setSaving(false); }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Ingrese su contraseña actual');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres, una letra y un número');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('La nueva contraseña y la confirmación no coinciden');
      return;
    }

    if (!remote) { toast.error('El cambio de contraseña requiere conexión REST'); return; }
    setSaving(true);
    try {
      await restFetch('/auth/own-password', {method: 'POST', body: JSON.stringify({currentPassword, newPassword, confirmPassword})});
      await loadSessions();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña'); return; }
    finally { setSaving(false); }
    toast.success('Contraseña actualizada; otras sesiones cerradas');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error('La portada supera los 3 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomCoverUrl(result);
      toast.success('Portada actualizada');
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La foto supera los 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomPhotoUrl(result);
      toast.info('Foto seleccionada. Guarda el perfil para aplicar el cambio.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setCustomPhotoUrl(null);
    toast.info('Guarda el perfil para restablecer la foto');
  };

  const activeCoverStyle = customCoverUrl
    ? `url(${customCoverUrl}) center/cover no-repeat`
    : selectedCover;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ── Breadcrumb & Page Title ────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Mi perfil
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          Datos personales, contraseña y preferencias de cuenta
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left Column: Profile Summary & Appearance ───────────────── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Cover & Avatar Summary Card */}
          <div
            className="rounded-2xl overflow-hidden border border-border shadow-sm bg-card"
          >
            {/* Banner Cover Header */}
            <div
              className="h-28 w-full transition-all duration-300 relative"
              style={{ background: activeCoverStyle }}
            />

            {/* Avatar & User Details */}
            <div className="px-5 pb-5 text-center relative">
              <div className="-mt-12 mb-3 inline-block relative">
                <div
                  className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-card shadow-md mx-auto bg-muted flex items-center justify-center relative"
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={user.name}
                      className="w-full h-full object-cover"
                      onError={() => setPhotoBroken(true)}
                    />
                  ) : (
                    <span className="text-2xl font-bold text-muted-foreground">{avatarInitials}</span>
                  )}
                </div>
              </div>

              <h2 className="text-lg font-bold text-foreground truncate">{user.name}</h2>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Shield className="w-3.5 h-3.5" />
                <span>{roleLabel}</span>
              </div>
            </div>
          </div>

          {/* Apariencia Card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <ImageIcon className="w-5 h-5 text-cyan-500" />
              <h3 className="font-bold text-foreground">Apariencia</h3>
            </div>

            {/* Portada Selector */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Portada
              </Label>
              <p className="text-xs text-muted-foreground">
                Elija un gradiente o suba una imagen personalizada.
              </p>

              {/* Gradient Swatches */}
              <div className="grid grid-cols-3 gap-2">
                {COVER_GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedCover(g.style);
                      setCustomCoverUrl(null);
                    }}
                    className={`h-10 rounded-xl transition-all border-2 relative overflow-hidden ${
                      !customCoverUrl && selectedCover === g.style
                        ? 'border-cyan-500 ring-2 ring-cyan-500/20 scale-[1.03]'
                        : 'border-transparent hover:scale-95'
                    }`}
                    style={{ background: g.style }}
                    title={g.name}
                  >
                    {!customCoverUrl && selectedCover === g.style && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Cover Upload Box */}
              <input
                type="file"
                ref={coverInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleCoverUpload}
              />
              <div
                onClick={() => coverInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-cyan-500/60 rounded-xl p-3 text-center cursor-pointer transition-all hover:bg-cyan-500/5 group"
              >
                <Upload className="w-5 h-5 mx-auto text-muted-foreground group-hover:text-cyan-500 mb-1 transition-colors" />
                <p className="text-xs font-medium text-foreground">
                  Arrastra o haz clic
                </p>
                <p className="text-[11px] text-muted-foreground">
                  JPG, PNG, WebP o GIF - máx. 3 MB
                </p>
              </div>
            </div>

            {/* Foto de Perfil Upload */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Foto de perfil
              </Label>

              <input
                type="file"
                ref={photoInputRef}
                className="hidden"
                accept="image/*"
                onChange={handlePhotoUpload}
              />

              <div className="flex items-center gap-3">
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-border hover:border-cyan-500/60 rounded-xl p-3 text-center cursor-pointer transition-all hover:bg-cyan-500/5 group"
                >
                  <Upload className="w-5 h-5 mx-auto text-muted-foreground group-hover:text-cyan-500 mb-1 transition-colors" />
                  <p className="text-xs font-medium text-foreground">
                    Arrastra o haz clic
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    JPG, PNG, WebP o GIF - máx. 2 MB
                  </p>
                </div>

                {customPhotoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemovePhoto}
                    className="text-rose-500 hover:text-rose-600 border-rose-300 dark:border-rose-900/50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Quitar
                  </Button>
                )}
              </div>
            </div>

            {/* Estado Selector */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Estado
              </Label>
              <Select value={userStatus} onValueChange={setUserStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Disponible">🟢 Disponible</SelectItem>
                  <SelectItem value="En reunión">🟡 En reunión</SelectItem>
                  <SelectItem value="Fuera de oficina...">🔴 Fuera de oficina...</SelectItem>
                  <SelectItem value="En atención">🔵 En atención</SelectItem>
                  <SelectItem value="Almuerzo">🍕 Almuerzo</SelectItem>
                  <SelectItem value="De vacaciones">🌴 De vacaciones</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Right Column: Personal Data, Security & Sessions ───────── */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Datos Personales Card */}
          <form
            onSubmit={handleSavePersonalData}
            className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm"
          >
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <UserIcon className="w-5 h-5 text-cyan-500" />
              <h3 className="font-bold text-foreground text-lg">Datos personales</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prof-name">NOMBRES *</Label>
                <Input
                  id="prof-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ingrese nombres"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-lastname">APELLIDOS *</Label>
                <Input
                  id="prof-lastname"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ingrese apellidos"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-email">EMAIL</Label>
                <div className="relative">
                  <Input
                    id="prof-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="pl-9"
                  />
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-phone">CELULAR</Label>
                <div className="relative">
                  <Input
                    id="prof-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9XXXXXXXX"
                    className="pl-9"
                  />
                  <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-doc">IDENTIFICACIÓN</Label>
                <div className="relative">
                  <Input
                    id="prof-doc"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="DNI / RUC / Carné"
                    className="pl-9"
                  />
                  <CreditCard className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-gender">SEXO</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="prof-gender">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Femenino">Femenino</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="prof-birthdate">FECHA DE NACIMIENTO</Label>
                <Input
                  id="prof-birthdate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button disabled={saving} type="submit" className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white">
                <Save className="w-4 h-4" />
                Guardar datos personales
              </Button>
            </div>
          </form>

          {/* 2. Seguridad Card */}
          <form
            onSubmit={handleSavePassword}
            className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm"
          >
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <Lock className="w-5 h-5 text-cyan-500" />
              <h3 className="font-bold text-foreground text-lg">Seguridad</h3>
            </div>

            <div className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <Label htmlFor="curr-pass">CONTRASEÑA ACTUAL</Label>
                <div className="relative">
                  <Input
                    id="curr-pass"
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-pass">NUEVA CONTRASEÑA</Label>
                  <div className="relative">
                    <Input
                      id="new-pass"
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="conf-pass">CONFIRMAR CONTRASEÑA</Label>
                  <div className="relative">
                    <Input
                      id="conf-pass"
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button disabled={saving} type="submit" variant="outline" className="gap-2 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10">
                <Lock className="w-4 h-4" />
                Cambiar contraseña
              </Button>
            </div>
          </form>

          {sessionError && <p role="alert">{sessionError} <Button onClick={() => void loadSessions()}>Reintentar</Button></p>}
          {showHistory && <div className="space-y-2" aria-label="Historial de sesiones">{sessions.map(s => <div key={s.id}>{s.device_label || s.browser_name || 'Dispositivo'} · {s.created_at} · {s.ended_at ? 'Cerrada' : 'Activa'}</div>)}</div>}
          {/* 3. Sesiones y dispositivos Card */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-cyan-500" />
                <h3 className="font-bold text-foreground text-lg">Sesiones y dispositivos</h3>
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {sessions.filter(s => !s.ended_at).length} activa(s) · {sessions.length} en el historial reciente
              </span>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {sessions.find(s => Number(s.current) === 1)?.device_label || 'Dispositivo actual'}
                    </span>
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                      SESIÓN ACTUAL
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Última actividad: {sessions.find(s => Number(s.current) === 1)?.last_seen_at || 'No disponible'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowHistory(v => !v); void loadSessions(); }}
                  className="text-xs"
                >
                  Ver historial
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || !remote}
                  onClick={() => void revokeOthers()}
                  className="text-xs text-rose-500 hover:text-rose-600 border-rose-300 dark:border-rose-900/50"
                >
                  Cerrar otras
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

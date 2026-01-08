import { useEffect, useState } from 'react';
import { Alert, Avatar, Badge, Button, Card, Label, TextInput } from 'flowbite-react';
import { useRef } from 'react';
import { supabase } from '../supabaseClient';
import UserStatCard from './UserStatCard';

const Icons = {
  projects: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  tasks: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  completed: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  collaborators: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  activity: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  sync: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  plan: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>
};

function getInitials(name = '') {
  const [first = '', second = ''] = name.split(' ');
  const initials = `${first.charAt(0)}${second.charAt(0)}`.trim();
  if (initials) {
    return initials.toUpperCase();
  }
  return name.charAt(0).toUpperCase() || '?';
}

function ToggleRow({ id, label, checked, onChange, className = '', icon }) {
  return (
    <label
      htmlFor={id}
      className={`group relative flex cursor-pointer flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 rounded-[1.25rem] border p-4 transition-all duration-300 ${checked
        ? 'border-primary/40 bg-primary/[0.03] shadow-lg shadow-primary/[0.02]'
        : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
        } ${className}`}
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 ${checked ? 'bg-primary/20 text-primary-600 shadow-inner' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
            }`}>
            {icon}
          </div>
        )}
        <div className="flex flex-col">
          <span className={`text-sm font-semibold tracking-tight transition-colors duration-300 ${checked ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
            }`}>
            {label}
          </span>
          {arguments[0].description && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1">
              {arguments[0].description}
            </span>
          )}
        </div>
      </div>

      <div className="relative isolate">
        <div className={`h-6 w-11 rounded-full border transition-all duration-300 ${checked
          ? 'bg-primary-500 border-primary-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)]'
          : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-500 shadow-inner dark:shadow-none'
          }`}>
          <div className={`h-5 w-5 mt-[1px] ml-[1px] transform rounded-full bg-white shadow-lg ring-1 ring-slate-200/50 dark:ring-0 transition-transform duration-300 ease-in-out ${checked ? 'translate-x-[1.25rem]' : 'translate-x-0'
            }`} />
        </div>
      </div>

      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
    </label>
  );
}

function makeAvatarRenderer(src) {
  if (!src) {
    return undefined;
  }

  return ({ className: innerClassName = '', alt, ...rest }) => {
    const composedClassName = ['h-full w-full rounded-full object-cover object-center', innerClassName]
      .filter(Boolean)
      .join(' ');

    return <img alt={alt} src={src} className={composedClassName} {...rest} />;
  };
}

export default function UserPanel({ user, onSignOut, authLoading, stats = { projects: 0, tasks: 0, completed: 0, collaborators: 0 } }) {
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario';
  const email = user?.email ?? 'Sin email';
  const avatarUrl = user?.user_metadata?.avatar_url ?? undefined;
  const avatarPath = user?.user_metadata?.avatar_path ?? null;
  const role = user?.user_metadata?.role ?? 'Miembro';
  const company = user?.user_metadata?.company ?? 'Organización no definida';
  const bio = user?.user_metadata?.bio ?? '';
  const authProvider = user?.app_metadata?.provider ?? 'email';
  const canManagePassword = true;

  const initials = getInitials(displayName);

  const plans = [
    { id: 'profile', label: 'Editar perfil', hint: 'Actualiza nombre, avatar y bio' },
    { id: 'security', label: 'Seguridad y contraseñas', hint: 'Gestiona autenticación y sesiones' },
    { id: 'notifications', label: 'Notificaciones', hint: 'Configura alertas y resúmenes por correo' }
  ];

  const [activePreference, setActivePreference] = useState(plans[0].id);
  const [profileDraft, setProfileDraft] = useState({
    name: displayName,
    company,
    bio
  });
  const [securitySettings, setSecuritySettings] = useState({
    mfa: user?.user_metadata?.mfa ?? true,
    newDeviceAlerts: user?.user_metadata?.newDeviceAlerts ?? true,
    autoSignOut: user?.user_metadata?.autoSignOut ?? false
  });
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: ''
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailUpdates: user?.user_metadata?.emailUpdates ?? true,
    weeklySummary: user?.user_metadata?.weeklySummary ?? true,
    productNews: user?.user_metadata?.productNews ?? false
  });
  const [feedback, setFeedback] = useState(null);
  const [securityError, setSecurityError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);
  const [profileAvatar, setProfileAvatar] = useState(avatarUrl);
  const [profileAvatarPath, setProfileAvatarPath] = useState(avatarPath);
  const [profileSaving, setProfileSaving] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);

  const profileAvatarRenderer = makeAvatarRenderer(profileAvatar);
  const headerAvatarRenderer = makeAvatarRenderer(profileAvatar || avatarUrl);

  useEffect(() => {
    setProfileDraft({
      name: displayName,
      company,
      bio
    });
  }, [bio, company, displayName]);

  useEffect(() => {
    setProfileAvatar(avatarUrl);
    setProfileAvatarPath(avatarPath);
  }, [avatarPath, avatarUrl]);

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) {
      return;
    }

    setAvatarError('');
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('La imagen debe pesar menos de 2MB.');
      event.target.value = '';
      return;
    }

    setAvatarUploading(true);

    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const storagePath = `avatars/${user.id}/${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (uploadError) {
        setAvatarError(uploadError.message);
        return;
      }

      if (profileAvatarPath) {
        await supabase.storage.from('avatars').remove([profileAvatarPath]);
      }

      const { data: publicUrlData, error: publicUrlError } = supabase.storage
        .from('avatars')
        .getPublicUrl(storagePath);

      if (publicUrlError) {
        setAvatarError(publicUrlError.message);
        return;
      }

      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: publicUrl,
          avatar_path: storagePath
        }
      });

      if (updateError) {
        setAvatarError(updateError.message);
        return;
      }

      setProfileAvatar(publicUrl);
      setProfileAvatarPath(storagePath);
      setFeedback({ section: 'profile', message: 'Avatar actualizado correctamente.' });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Error al subir la imagen.');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAvatarRemove = async () => {
    if (!user?.id) return;
    setAvatarError('');
    setAvatarUploading(true);

    try {
      if (profileAvatarPath) {
        await supabase.storage.from('avatars').remove([profileAvatarPath]);
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: null,
          avatar_path: null
        }
      });

      if (updateError) {
        setAvatarError(updateError.message);
        return;
      }

      setProfileAvatar(undefined);
      setProfileAvatarPath(null);
      setFeedback({ section: 'profile', message: 'Avatar eliminado.' });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'No se pudo eliminar el avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const now = new Date();
  const formattedAccess = new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(now);

  const preferencePanel = () => {
    switch (activePreference) {
      case 'profile':
        return (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="relative h-24 w-24">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/60"></div>
                  <Avatar
                    img={profileAvatarRenderer}
                    alt={`Avatar de ${displayName}`}
                    rounded
                    size="lg"
                    placeholderInitials={initials}
                    className="aspect-square h-full w-full overflow-hidden rounded-full shadow-lg shadow-primary/20"
                  />
                </div>
                <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Personaliza tu imagen de perfil</p>
                  <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <Button
                      size="xs"
                      color="info"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="px-4"
                    >
                      {avatarUploading ? 'Subiendo…' : 'Subir nueva imagen'}
                    </Button>
                    {profileAvatar ? (
                      <Button
                        size="xs"
                        color="light"
                        onClick={handleAvatarRemove}
                        disabled={avatarUploading}
                        className="px-4"
                      >
                        Quitar
                      </Button>
                    ) : null}
                  </div>
                  {avatarError ? <p className="text-xs text-amber-300">{avatarError}</p> : null}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Nombre visible
                </Label>
                <TextInput
                  id="profile-name"
                  value={profileDraft.name}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Tu nombre"
                  className="overflow-hidden rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-company" className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Compañía
                </Label>
                <TextInput
                  id="profile-company"
                  value={profileDraft.company}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, company: event.target.value }))}
                  placeholder="Organización"
                  className="overflow-hidden rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-bio" className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Bio breve
                </Label>
                <textarea
                  id="profile-bio"
                  value={profileDraft.bio}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, bio: event.target.value }))}
                  className="h-32 w-full rounded-2xl border border-none bg-white dark:bg-slate-900/10 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Cuenta algo sobre ti"
                />
              </div>
            </div>
            <Button
              color="info"
              type="button"
              onClick={() => handleSavePreference('profile')}
              disabled={profileSaving}
              className="w-full rounded-[1.25rem] bg-gradient-to-br from-primary-600 to-indigo-700 px-8 py-1.5 font-bold uppercase tracking-[0.1em] shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-primary/40 active:scale-95 disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                {profileSaving ? (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Procesando...</span>
                  </div>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Guardar Cambios</span>
                  </>
                )}
              </div>
            </Button>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-6 text-sm text-slate-700 dark:text-slate-200">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary-500"></div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Protocolos de acceso</h4>
              </div>
              {authProvider !== 'email' && authProvider !== 'password' ? (
                <Alert color="info" className="border-none bg-primary/5 text-xs">
                  Inicias sesión con <span className="font-bold uppercase">{authProvider}</span>.
                </Alert>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleRow
                  id="mfa-checkbox"
                  label="Doble factor (MFA)"
                  checked={securitySettings.mfa}
                  onChange={(value) => setSecuritySettings((prev) => ({ ...prev, mfa: value }))}
                  icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 21.248a11.955 11.955 0 01-7.618-13.264A12.062 12.062 0 0112 3c1.768 0 3.423.388 4.906 1.082" /></svg>}
                />
                <ToggleRow
                  id="alerts-checkbox"
                  label="Alertas de acceso"
                  checked={securitySettings.newDeviceAlerts}
                  onChange={(value) => setSecuritySettings((prev) => ({ ...prev, newDeviceAlerts: value }))}
                  icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                />
                <ToggleRow
                  id="signout-checkbox"
                  label="Cierre automático (30 min)"
                  checked={securitySettings.autoSignOut}
                  onChange={(value) => setSecuritySettings((prev) => ({ ...prev, autoSignOut: value }))}
                  className="sm:col-span-2"
                  icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/40 p-6 backdrop-blur-sm">
              <div className="flex flex-col gap-1">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Credenciales Locales</h4>
                <p className="text-[10px] text-slate-400">Cambia tu contraseña para mantener la cuenta segura.</p>
              </div>

              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password-current" className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Contraseña actual</Label>
                  <TextInput
                    id="password-current"
                    type="password"
                    value={passwordForm.current}
                    onChange={(event) => {
                      setPasswordForm((prev) => ({ ...prev, current: event.target.value }));
                      setSecurityError('');
                    }}
                    placeholder="••••••••"
                    className="overflow-hidden rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="password-new" className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Nueva contraseña</Label>
                    <TextInput
                      id="password-new"
                      type="password"
                      value={passwordForm.next}
                      onChange={(event) => {
                        setPasswordForm((prev) => ({ ...prev, next: event.target.value }));
                        setSecurityError('');
                      }}
                      placeholder="Mínimo 8 car."
                      disabled={!canManagePassword}
                      className="overflow-hidden rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password-confirm" className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Confirmar</Label>
                    <TextInput
                      id="password-confirm"
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(event) => {
                        setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }));
                        setSecurityError('');
                      }}
                      placeholder="Repite nueva"
                      className="overflow-hidden rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {securityError ? (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-medium text-red-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {securityError}
                </div>
              ) : null}

              <Button
                color="info"
                type="button"
                onClick={() => handleSavePreference('security')}
                disabled={securitySaving}
                className="w-full rounded-[1.25rem] bg-gradient-to-br from-primary-600 to-indigo-700 px-8 py-1.5 font-bold uppercase tracking-[0.1em] shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-primary/40 active:scale-95 disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  {securitySaving ? (
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>Procesando...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      <span>Actualizar Seguridad</span>
                    </>
                  )}
                </div>
              </Button>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Canales de comunicación</h4>
              </div>
              <div className="grid gap-3">
                <ToggleRow
                  id="notify-email"
                  label="Notificaciones por Correo Electrónico"
                  description="Recibe alertas sobre actividad importante del sistema"
                  checked={notificationSettings.emailUpdates}
                  onChange={(value) => setNotificationSettings((prev) => ({ ...prev, emailUpdates: value }))}
                  icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 00-2 2z" /></svg>}
                />
                <ToggleRow
                  id="notify-summary"
                  label="Resumen Semanal Digest"
                  description="Informe consolidado de tus proyectos y tareas"
                  checked={notificationSettings.weeklySummary}
                  onChange={(value) => setNotificationSettings((prev) => ({ ...prev, weeklySummary: value }))}
                  icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                />
                <ToggleRow
                  id="notify-news"
                  label="Novedades y Actualizaciones"
                  description="Prueba nuevas funciones antes que nadie"
                  checked={notificationSettings.productNews}
                  onChange={(value) => setNotificationSettings((prev) => ({ ...prev, productNews: value }))}
                  icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
              </div>
            </div>
            <Button
              color="info"
              type="button"
              onClick={() => handleSavePreference('notifications')}
              className="w-full rounded-[1.25rem] bg-gradient-to-br from-indigo-600 to-purple-700 px-8 py-1.5 font-bold uppercase tracking-[0.1em] shadow-xl shadow-indigo-500/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-indigo-500/40 active:scale-95"
            >
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                <span>Guardar Preferencias</span>
              </div>
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  async function handleSavePreference(section) {
    if (section === 'security') {
      const requiresCurrentPassword = authProvider === 'email' || authProvider === 'password';

      if (requiresCurrentPassword && !passwordForm.current) {
        setSecurityError('Introduce tu contraseña actual.');
        return;
      }
      if (!passwordForm.next || !passwordForm.confirm) {
        setSecurityError('Introduce y confirma la nueva contraseña.');
        return;
      }
      if (passwordForm.next.length < 8) {
        setSecurityError('La nueva contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (passwordForm.next !== passwordForm.confirm) {
        setSecurityError('Las contraseñas no coinciden.');
        return;
      }

      setSecurityError('');
      setSecuritySaving(true);

      try {
        if (requiresCurrentPassword) {
          const { error: reauthError } = await supabase.auth.signInWithPassword({
            email,
            password: passwordForm.current
          });

          if (reauthError) {
            setSecurityError('La contraseña actual no es válida.');
            return;
          }
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: passwordForm.next || undefined,
          data: {
            mfa: securitySettings.mfa,
            newDeviceAlerts: securitySettings.newDeviceAlerts,
            autoSignOut: securitySettings.autoSignOut
          }
        });

        if (updateError) {
          setSecurityError(updateError.message);
          return;
        }

        setPasswordForm({ current: '', next: '', confirm: '' });
        setFeedback({ section: 'security', message: 'Configuración de seguridad actualizada correctamente.' });
      } finally {
        setSecuritySaving(false);
      }
      return;
    }

    const timestamp = new Intl.DateTimeFormat('es-ES', { timeStyle: 'medium' }).format(new Date());
    const sectionLabels = {
      profile: 'Perfil',
      security: 'Seguridad',
      notifications: 'Notificaciones'
    };

    setFeedback({
      section,
      message: `${sectionLabels[section] ?? section} actualizado (demo) a las ${timestamp}.`
    });

    if (section === 'profile') {
      setProfileSaving(true);
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            full_name: profileDraft.name,
            company: profileDraft.company,
            bio: profileDraft.bio,
            avatar_url: profileAvatar ?? null,
            avatar_path: profileAvatarPath ?? null
          }
        });

        if (updateError) {
          setFeedback({ section, message: `No se pudo actualizar el perfil: ${updateError.message}` });
          return;
        }

        setFeedback({ section, message: `${sectionLabels[section] ?? section} guardado correctamente.` });
      } finally {
        setProfileSaving(false);
      }
      return;
    }

    if (section === 'notifications') {
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            emailUpdates: notificationSettings.emailUpdates,
            weeklySummary: notificationSettings.weeklySummary,
            productNews: notificationSettings.productNews
          }
        });

        if (updateError) {
          setFeedback({ section, message: `No se pudieron guardar las preferencias: ${updateError.message}` });
          return;
        }

        setFeedback({ section, message: 'Preferencias de notificación guardadas.' });
      } catch (err) {
        console.error(err);
      }
    }
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/90 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col gap-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-transparent p-6 sm:p-8">
          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <div className="relative h-24 w-24 shrink-0">
              <div className="absolute inset-0 rounded-full border-4 border-white/20 dark:border-slate-700/50 shadow-xl"></div>
              <Avatar
                img={headerAvatarRenderer}
                alt={`Avatar de ${displayName}`}
                rounded
                size="xl"
                placeholderInitials={initials}
                className="aspect-square h-full w-full overflow-hidden rounded-full shadow-2xl ring-4 ring-primary/20 transition-transform hover:scale-105"
              />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white" aria-live="polite" title={displayName}>
                {displayName}
              </h1>
              <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400 opacity-80" title={email}>
                {email}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <Badge color="info" size="sm" className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                  {role}
                </Badge>
                <Badge color="gray" size="sm" className="rounded-full border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 px-3 py-1 text-[10px] font-medium" title={company}>
                  {company}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
          <UserStatCard title="Proyectos" value={stats.projects} description="Participando" icon={Icons.projects} color="blue" />
          <UserStatCard title="Tareas" value={stats.tasks} description="Asignadas" icon={Icons.tasks} color="indigo" />
          <UserStatCard title="Completadas" value={stats.completed} description="Histórico" icon={Icons.completed} color="emerald" />
          <UserStatCard title="Colaboradores" value={stats.collaborators} description="Trabajando contigo" icon={Icons.collaborators} color="amber" />
        </div>

        <section className="space-y-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Preferencias del sistema</h2>
            <div className="flex flex-wrap gap-3">
              {plans.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePreference(item.id)}
                  className={`group relative flex items-center gap-3 rounded-2xl border px-5 py-3 text-left transition-all duration-300 ${activePreference === item.id
                    ? 'border-primary/50 bg-primary/10 ring-4 ring-primary/5'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                >
                  <div className={`rounded-xl p-2 transition-colors ${activePreference === item.id ? 'bg-primary/20 text-primary-600 dark:text-primary-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-primary-500'}`}>
                    {item.id === 'profile' && <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                    {item.id === 'security' && <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                    {item.id === 'notifications' && <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold ${activePreference === item.id ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300'}`}>{item.label}</p>
                    <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{item.hint}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 p-1 shadow-2xl backdrop-blur-xl">
            <div className="rounded-[2.2rem] bg-white/50 dark:bg-slate-950/20 p-6 sm:p-8 shadow-inner">
              <div className="mb-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800/50 pb-6 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20 text-primary-600 shadow-lg shadow-primary/10">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Configuración</h3>
                    <p className="text-[10px] text-slate-400">Personaliza tu experiencia y seguridad</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-500 ring-1 ring-emerald-500/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  ACTIVO
                </div>
              </div>

              <div className="relative z-10">
                {preferencePanel()}
              </div>

              {feedback ? (
                <Alert color="info" onDismiss={() => setFeedback(null)} className="mt-8 border border-cyan-500/20 bg-cyan-500/5 text-xs text-cyan-900 dark:text-cyan-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <span className="font-medium">{feedback.message}</span>
                  </div>
                </Alert>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Estado de cuenta</h2>
              {Icons.sync}
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Último acceso</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formattedAccess}</span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Ubicación</span>
                <span className="font-semibold text-slate-900 dark:text-white">España (Madrid)</span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Plan actual</span>
                <Badge color="info" className="uppercase">Professional</Badge>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Conectividad</h2>
              {Icons.plan}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Sincronización en tiempo real</span>
              </div>
              <p className="text-xs text-slate-500">Tu cuenta está vinculada y protegida por encriptación avanzada de extremo a extremo.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-primary/20 bg-primary/5 p-6 shadow-inner shadow-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-300">Novedades exclusivas</h2>
            </div>
            <Badge color="info" className="rounded-full px-3 animate-bounce">TOP</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: 'IA Sugerencias', desc: 'Basado en historial', icon: '🤖' },
              { title: 'Automatización', desc: 'Tareas recurrentes', icon: '⚡' },
              { title: 'Panel Público', desc: 'Enlaces externos', icon: '🌐' }
            ].map((item, idx) => (
              <div key={idx} className="group relative flex flex-col gap-2 rounded-2xl border border-white/50 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 p-3 transition hover:bg-white/80 dark:hover:bg-slate-800">
                <span className="text-xl">{item.icon}</span>
                <p className="text-xs font-bold text-slate-800 dark:text-white">{item.title}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{item.desc}</p>
              </div>
            ))}
          </div>

          <Button
            color="info"
            className="w-full rounded-[1.25rem] bg-gradient-to-br from-primary-600 to-indigo-700 px-8 py-1.5 font-bold uppercase tracking-[0.1em] shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-primary/40 active:scale-95"
            onClick={async () => {
              const updatedSettings = { ...notificationSettings, productNews: true };
              setNotificationSettings(updatedSettings);
              setFeedback({ section: 'news', message: 'Activando alertas de novedades...' });
              try {
                const { error } = await supabase.auth.updateUser({ data: { productNews: true } });
                if (error) throw error;
                setFeedback({ section: 'news', message: '¡Perfecto! Te avisaremos vía email de estas y otras novedades.' });
              } catch (err) {
                setFeedback({ section: 'news', message: 'Acción no completada. Intenta en Notificaciones.' });
              }
            }}
          >
            Suscribirse a novedades
          </Button>
        </section>

        <Button
          color="gray"
          onClick={onSignOut}
          disabled={authLoading}
          className="group flex w-full items-center justify-center rounded-[1.25rem] border-none bg-slate-100 dark:bg-slate-900/40 text-slate-500 transition-all duration-300 hover:bg-red-500/10 hover:text-red-500 ring-1 ring-slate-200 dark:ring-slate-800 hover:ring-red-500/50"
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 transition-transform group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span className="font-bold uppercase tracking-widest">{authLoading ? 'Desconectando...' : 'Cerrar sesión'}</span>
          </div>
        </Button>
      </div>
    </Card>
  );
}







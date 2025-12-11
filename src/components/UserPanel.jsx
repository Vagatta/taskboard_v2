import { useEffect, useState } from 'react';
import { Alert, Avatar, Badge, Button, Card, Checkbox, Label, TextInput, Tooltip } from 'flowbite-react';
import { useRef } from 'react';
import { supabase } from '../supabaseClient';
import UserStatCard from './UserStatCard';

function getInitials(name = '') {
  const [first = '', second = ''] = name.split(' ');
  const initials = `${first.charAt(0)}${second.charAt(0)}`.trim();
  if (initials) {
    return initials.toUpperCase();
  }
  return name.charAt(0).toUpperCase() || '?';
}

function ToggleRow({ id, label, checked, onChange, className = '' }) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/40 backdrop-blur-sm px-4 py-3 text-left transition hover:border-primary/40 ${className}`}
    >
      <Checkbox
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 shrink-0"
      />
      <span className="text-sm leading-snug text-slate-700 dark:text-slate-200 break-words">{label}</span>
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

export default function UserPanel({ user, onSignOut, authLoading }) {
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
    mfa: true,
    newDeviceAlerts: true,
    autoSignOut: false
  });
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: ''
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailUpdates: true,
    weeklySummary: true,
    productNews: false
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
                <div className="flex flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
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

            <div className="space-y-3">
              <div>
                <Label htmlFor="profile-name" className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Nombre visible
                </Label>
                <TextInput
                  id="profile-name"
                  value={profileDraft.name}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <Label htmlFor="profile-company" className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Compañía
                </Label>
                <TextInput
                  id="profile-company"
                  value={profileDraft.company}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, company: event.target.value }))}
                  placeholder="Organización"
                />
              </div>
              <div>
                <Label htmlFor="profile-bio" className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Bio breve
                </Label>
                <textarea
                  id="profile-bio"
                  value={profileDraft.bio}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, bio: event.target.value }))}
                  className="h-40 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 px-3 py-3 text-sm text-slate-700 dark:text-slate-200 shadow-inner shadow-slate-200/50 dark:shadow-slate-950/50 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Cuenta algo sobre ti"
                />
              </div>
            </div>
            <Button
              color="info"
              type="button"
              onClick={() => handleSavePreference('profile')}
              disabled={profileSaving}
              className="w-full sm:w-auto font-semibold uppercase tracking-wide shadow-lg shadow-primary/30"
            >
              {profileSaving ? 'Guardando…' : 'Guardar cambios de perfil'}
            </Button>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-5 text-sm text-slate-700 dark:text-slate-200">
            <div className="grid gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Modos de acceso</p>
              {authProvider !== 'email' && authProvider !== 'password' ? (
                <Alert color="info" className="text-xs text-slate-100">
                  Inicias sesión con {authProvider}. Puedes definir una contraseña local para usarla como respaldo.
                </Alert>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  id="mfa-checkbox"
                  label="Habilitar factor doble (MFA)"
                  checked={securitySettings.mfa}
                  onChange={(value) => setSecuritySettings((prev) => ({ ...prev, mfa: value }))}
                />
                <ToggleRow
                  id="alerts-checkbox"
                  label="Recibir alertas de nuevos dispositivos"
                  checked={securitySettings.newDeviceAlerts}
                  onChange={(value) => setSecuritySettings((prev) => ({ ...prev, newDeviceAlerts: value }))}
                />
                <ToggleRow
                  id="signout-checkbox"
                  label="Cerrar sesión tras 30 minutos de inactividad"
                  checked={securitySettings.autoSignOut}
                  onChange={(value) => setSecuritySettings((prev) => ({ ...prev, autoSignOut: value }))}
                  className="md:col-span-2"
                />
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Actualiza tu contraseña</p>
                <p className="text-xs leading-snug text-slate-500 sm:max-w-xs sm:text-right">
                  Asegúrate de usar una contraseña única y fuerte.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-current" className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Contraseña actual
                </Label>
                <TextInput
                  id="password-current"
                  type="password"
                  value={passwordForm.current}
                  onChange={(event) => {
                    setPasswordForm((prev) => ({ ...prev, current: event.target.value }));
                    setSecurityError('');
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password-new" className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Nueva contraseña
                  </Label>
                  <TextInput
                    id="password-new"
                    type="password"
                    value={passwordForm.next}
                    onChange={(event) => {
                      setPasswordForm((prev) => ({ ...prev, next: event.target.value }));
                      setSecurityError('');
                    }}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    disabled={!canManagePassword}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-confirm" className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Confirmar
                  </Label>
                  <TextInput
                    id="password-confirm"
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(event) => {
                      setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }));
                      setSecurityError('');
                    }}
                    placeholder="Repite la nueva contraseña"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {securityError ? <p className="text-xs text-amber-300">{securityError}</p> : null}
              <Button
                color="info"
                type="button"
                onClick={() => handleSavePreference('security')}
                disabled={securitySaving}
                className="w-full sm:w-auto font-semibold uppercase tracking-wide shadow-lg shadow-primary/30"
              >
                {securitySaving ? 'Actualizando…' : 'Actualizar seguridad'}
              </Button>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex items-start gap-3">
              <Checkbox
                id="notify-email"
                checked={notificationSettings.emailUpdates}
                onChange={(event) =>
                  setNotificationSettings((prev) => ({ ...prev, emailUpdates: event.target.checked }))
                }
              />
              <Label htmlFor="notify-email" className="text-sm text-slate-700 dark:text-slate-300">
                Recibir actualizaciones por correo
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="notify-summary"
                checked={notificationSettings.weeklySummary}
                onChange={(event) =>
                  setNotificationSettings((prev) => ({ ...prev, weeklySummary: event.target.checked }))
                }
              />
              <Label htmlFor="notify-summary" className="text-sm text-slate-700 dark:text-slate-300">
                Enviar resumen semanal
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="notify-news"
                checked={notificationSettings.productNews}
                onChange={(event) =>
                  setNotificationSettings((prev) => ({ ...prev, productNews: event.target.checked }))
                }
              />
              <Label htmlFor="notify-news" className="text-sm text-slate-700 dark:text-slate-300">
                Mantenerme al tanto de novedades del producto
              </Label>
            </div>
            <Button
              color="info"
              type="button"
              onClick={() => handleSavePreference('notifications')}
              className="w-full sm:w-auto font-semibold uppercase tracking-wide shadow-lg shadow-primary/30"
            >
              Guardar preferencias de notificación
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

        const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.next });
        if (updateError) {
          setSecurityError(updateError.message);
          return;
        }

        setPasswordForm({ current: '', next: '', confirm: '' });
        setFeedback({ section: 'security', message: 'Contraseña actualizada correctamente.' });
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
      setFeedback({ section, message: `${sectionLabels[section] ?? section} actualizado (demo) a las ${timestamp}.` });
    }
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl shadow-slate-200/40 dark:shadow-slate-950/40">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700"></div>
            <Avatar
              img={headerAvatarRenderer}
              alt={`Avatar de ${displayName}`}
              rounded
              size="lg"
              placeholderInitials={initials}
              className="aspect-square h-full w-full overflow-hidden rounded-full shadow-lg shadow-slate-900/40"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900 dark:text-white" aria-live="polite" title={displayName}>
              {displayName}
            </p>
            <p className="truncate text-sm text-slate-600 dark:text-slate-400" title={email}>
              {email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge color="info" className="text-xs uppercase">
                {role}
              </Badge>
              <Badge color="gray" className="text-xs" title={company}>
                {company}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
          <UserStatCard title="Proyectos" value="3" description="Activos" />
          <UserStatCard title="Tareas" value="12" description="Asignadas esta semana" />
          <UserStatCard title="Completadas" value="48" description="Últimos 30 días" />
          <UserStatCard title="Colaboradores" value="8" description="En tus proyectos" />
        </div>

        <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/10 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Preferencias rápidas</h2>
          <div className="flex flex-wrap gap-2">
            {plans.map((item) => (
              <Tooltip content={item.hint} key={item.id} placement="bottom">
                <button
                  type="button"
                  onClick={() => setActivePreference(item.id)}
                  aria-pressed={activePreference === item.id}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:min-w-[15rem] ${activePreference === item.id
                    ? 'border-primary/60 bg-primary/10 text-primary-700 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-200 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/80'
                    }`}
                >
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                  <span aria-hidden className="text-xs text-slate-500">
                    →
                  </span>
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Configuración</h3>
            <div className="mt-3">{preferencePanel()}</div>
          </div>
          {feedback ? (
            <Alert color="info" onDismiss={() => setFeedback(null)} className="text-xs text-cyan-900 dark:text-cyan-100">
              {feedback.message}
            </Alert>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/10 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Actividad reciente</h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-start justify-between gap-4">
              <span>Último acceso</span>
              <span className="font-medium text-slate-900 dark:text-white">{formattedAccess}</span>
            </li>
            <li className="flex items-start justify-between gap-4">
              <span>Sincronización</span>
              <span className="font-medium text-emerald-300">Al día</span>
            </li>
            <li className="flex items-start justify-between gap-4">
              <span>Plan</span>
              <span className="font-medium text-slate-900 dark:text-white">Free</span>
            </li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/10 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Novedades del producto</h2>
            <Badge color="info" size="sm" className="uppercase">Nuevo</Badge>
          </div>
          <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <li className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-3">
              <p className="font-medium text-slate-900 dark:text-white">Integración con IA para sugerir tareas</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Estamos probando sugerencias automáticas según el historial del proyecto. ¡Únete a la beta! </p>
            </li>
            <li className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-3">
              <p className="font-medium text-slate-900 dark:text-white">Automatizaciones programadas</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Configura recordatorios semanales y tareas recurrentes. Disponible a partir de diciembre.</p>
            </li>
            <li className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-3">
              <p className="font-medium text-slate-900 dark:text-white">Panel público compartible</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Comparte el progreso del proyecto con tu equipo externo mediante enlaces públicos.</p>
            </li>
          </ul>
          <Button color="light" size="xs" className="w-full sm:w-auto" onClick={() => setFeedback({ section: 'news', message: 'Te avisaremos cuando haya novedades.' })}>
            Avísame cuando estén disponibles
          </Button>
        </section>

        <Button color="light" onClick={onSignOut} disabled={authLoading} className="justify-center">
          {authLoading ? 'Saliendo...' : 'Cerrar sesión'}
        </Button>
      </div>
    </Card>
  );
}







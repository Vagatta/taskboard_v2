import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUserGlobalStats } from './hooks/useSupabaseQueries';
import { Alert, Button, Card, Checkbox, Label, Spinner, TextInput } from 'flowbite-react';
import './App.css';
import AppLayout from './components/AppLayout';
import WorkspaceManagementPanel from './components/WorkspaceManagementPanel';
import ProjectsManagementPanel from './components/ProjectsManagementPanel';
import TasksManagementPanel from './components/TasksManagementPanel';
import MyTasksPanel from './components/MyTasksPanel';
import WorkspacePeopleDashboard from './components/WorkspacePeopleDashboard';
import UserPanel from './components/UserPanel';
import NotificationPanel from './components/NotificationPanel';
import ThemeToggle from './components/ThemeToggle';
import AcceptInvitation from './components/AcceptInvitation';
import StatsDashboard from './components/StatsDashboard';
import { supabase } from './supabaseClient';
import QuickSearchModal from './components/QuickSearchModal';
import { useAuth } from './context/AuthContext';
import CookieConsent from './components/CookieConsent';

const navIcons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3.75 3.75h6.5v6.5h-6.5zM13.75 3.75h6.5v9.5h-6.5zM13.75 15.75h6.5v4.5h-6.5zM3.75 12.25h6.5v8h-6.5z" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  )
};

// Formulario de login/registro con email y contraseña.
function AuthForm() {
  const { signIn, signUp, authLoading, error, successMessage, setError, setSuccessMessage, requiresMFA, verifyMFA, cancelMFA, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' o 'signup'

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      if (requiresMFA) {
        await verifyMFA(mfaCode, rememberDevice);
        setMfaCode('');
      } else if (mode === 'login') {
        await signIn({ email: email.trim(), password });
      } else {
        await signUp({ email: email.trim(), password });
      }
      if (!requiresMFA) {
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      // El mensaje de error ya se gestiona en AuthContext
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="space-y-6">
      <Card
        className="border border-white/20 bg-white/10 bg-clip-padding backdrop-blur-xl shadow-2xl shadow-slate-950/50"
        aria-labelledby="auth-card-heading"
      >
        <div className="mb-6 space-y-2 text-center sm:text-left">
          <h1 id="auth-card-heading" className="text-3xl font-bold tracking-tight text-white">
            {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
          </h1>
          <p className="text-sm text-slate-300/90">
            {mode === 'login'
              ? 'Inicia sesión para acceder a tus tableros y proyectos.'
              : 'Únete a Taskboard y empieza a organizar tus tareas hoy mismo.'}
          </p>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {requiresMFA ? (
            <div>
              <Label htmlFor="mfa-code" value="Código de Verificación (MFA)" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-sky-300" />
              <TextInput
                id="mfa-code"
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Ingresa cualquier código de 6 dígitos"
                required
                maxLength={6}
                className="bg-white/5"
              />
              <div className="mt-4 flex items-center gap-3">
                <Checkbox
                  id="remember-device"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                />
                <Label htmlFor="remember-device" className="text-sm font-medium text-slate-300 cursor-pointer">
                  Confiar en este dispositivo (No pedir código en 30 días)
                </Label>
              </div>
              <button
                type="button"
                onClick={cancelMFA}
                className="mt-2 text-xs text-slate-400 hover:text-white underline"
              >
                Cancelar y volver al login
              </button>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="email" value="Email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300" />
                <TextInput
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  placeholder="nombre@ejemplo.com"
                  required
                  autoComplete="email"
                  className="bg-white/5"
                />
              </div>
              <div>
                <Label htmlFor="password" value="Contraseña" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300" />
                <TextInput
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="bg-white/5"
                />
              </div>
            </>
          )}

          {error && (
            <Alert
              color="failure"
              className="border border-red-500/40 bg-red-500/10 text-sm text-red-100 backdrop-blur-sm"
              aria-live="polite"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </Alert>
          )}

          {successMessage && (
            <Alert
              color="success"
              className="border border-emerald-500/40 bg-emerald-500/10 text-sm text-emerald-100 backdrop-blur-sm"
              aria-live="polite"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {successMessage}
              </div>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={authLoading}
            size="lg"
            className="mt-2 bg-gradient-to-r from-sky-500 to-indigo-600 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-sky-500/25 active:scale-[0.98]"
          >
            {authLoading ? (
              <div className="flex items-center gap-3">
                <Spinner size="sm" />
                <span>Procesando...</span>
              </div>
            ) : (
              <span>
                {requiresMFA
                  ? 'Verificar código'
                  : (mode === 'login' ? 'Iniciar sesión' : 'Registrarse')}
              </span>
            )}
          </Button>

          {!requiresMFA && (
            <Button
              type="button"
              onClick={loginWithGoogle}
              disabled={authLoading}
              size="lg"
              className="mt-2 flex items-center justify-center gap-2 border border-white/20 bg-white/5 transition-all hover:bg-white/10 active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{mode === 'login' ? 'Iniciar sesión con Google' : 'Registrarse con Google'}</span>
            </Button>
          )}
        </form>
      </Card>

      <div className="flex justify-center">
        <button
          onClick={toggleMode}
          className="group flex flex-col items-center gap-1 text-slate-400 transition-colors hover:text-white"
        >
          <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
            {mode === 'login' ? '¿No tienes una cuenta?' : '¿Ya eres usuario?'}
          </span>
          <span className="text-sm font-semibold underline decoration-sky-500/30 decoration-2 underline-offset-4 group-hover:decoration-sky-500">
            {mode === 'login' ? 'Regístrate aquí' : 'Inicia sesión ahora'}
          </span>
        </button>
      </div>
    </div>
  );
}

function WelcomeSplashScreen({ theme, onComplete }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Definimos un tiempo mínimo de visualización para que el efecto se aprecie bien (mínimo 2.5s)
    const timer = setTimeout(() => {
      setIsExiting(true);
      // Esperamos a que la animación de salida termine antes de llamar a onComplete
      setTimeout(() => {
        onComplete();
      }, 600);
    }, 2800);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`splash-container ${theme} ${isExiting ? 'fade-out-splash' : ''}`}>
      <div className="splash-content">
        <div className="splash-logo-container">
          <div className="splash-logo-glow"></div>
          <svg
            className="splash-logo"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <h2 className="splash-text">Taskboard</h2>
          <div className="splash-loading-bar">
            <div className="splash-loading-progress"></div>
          </div>
        </div>
      </div>
    </div>
  );
}


// Contenedor principal de la app: navegación, paneles de gestión y estado global.
function App() {
  const { user, initializing, authLoading, signOut } = useAuth();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceMembers, setWorkspaceMembers] = useState({});
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectMembers, setProjectMembers] = useState({});
  const [isContrastTheme, setIsContrastTheme] = useState(() => {
    // Inicializar desde localStorage o preferir modo oscuro (false = oscuro por defecto en este código)
    // NOTA: En este código, isContrastTheme = true IMPLICA modo CLARO.
    const saved = localStorage.getItem('theme-preference');
    if (saved) {
      return saved === 'light'; // Si guardó 'light', isContrastTheme es true.
    }
    return false; // Por defecto oscuro
  });
  const [activeManagementTab, setActiveManagementTab] = useState('workspace');
  const [activePrimaryView, setActivePrimaryView] = useState('dashboard');
  const [statsWorkspaceId, setStatsWorkspaceId] = useState(null);
  const [assigneePreset, setAssigneePreset] = useState(null);
  const [taskSummary, setTaskSummary] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    completedOnTime: 0,
    completedLate: 0
  });
  const taskListRef = useRef(null);

  // Detectar si estamos en la página de aceptar invitación
  const [invitationToken, setInvitationToken] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [initialTaskId, setInitialTaskId] = useState(null);

  const { data: userGlobalStats = { workspaces: 0, projects: 0, tasks: 0, completed: 0, collaborators: 0 } } = useUserGlobalStats(user);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setInvitationToken(token);
    }
  }, []);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const selectedProjectMembers = useMemo(
    () => (selectedProjectId ? projectMembers[selectedProjectId] ?? [] : []),
    [projectMembers, selectedProjectId]
  );

  useEffect(() => {
    if (!user || !user.user_metadata?.autoSignOut) return;

    let idleTimer;
    const timeout = 30 * 60 * 1000; // 30 minutos

    const resetTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        signOut();
      }, timeout);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user, signOut]);

  useEffect(() => {
    // Atajos de teclado globales (Ctrl+G para nueva tarea rápida, Ctrl+V para cambiar vista).
    const handleGlobalShortcut = (event) => {
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (!isCtrlOrMeta || event.repeat || event.altKey) {
        return;
      }

      const key = event.key?.toLowerCase() ?? '';

      if (key === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      if (!user) {
        return;
      }

      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase()));

      if (key === 'g') {
        event.preventDefault();
        if (selectedProjectId) {
          taskListRef.current?.focusNewTaskInput?.();
        }
        return;
      }

      if (key === 'v' && !event.shiftKey && !isEditableTarget) {
        event.preventDefault();
        if (selectedProjectId) {
          taskListRef.current?.toggleViewMode?.();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [selectedProjectId, user]);

  useEffect(() => {
    const loadProjectStats = async () => {
      if (!selectedProjectId) {
        setTaskSummary({ total: 0, pending: 0, completed: 0, completedOnTime: 0, completedLate: 0 });
        return;
      }

      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('completed, due_date, completed_at')
          .eq('project_id', selectedProjectId);

        if (error) throw error;

        if (data) {
          const total = data.length;
          const completedCount = data.filter((t) => t.completed).length;
          const pendingCount = total - completedCount;
          let onTime = 0;
          let late = 0;

          data.filter((t) => t.completed).forEach((t) => {
            if (!t.due_date) {
              onTime++;
            } else {
              const compDate = t.completed_at ? new Date(t.completed_at) : new Date();
              const dueDate = new Date(t.due_date);
              if (compDate <= dueDate) {
                onTime++;
              } else {
                late++;
              }
            }
          });

          setTaskSummary({
            total,
            pending: pendingCount,
            completed: completedCount,
            completedOnTime: onTime,
            completedLate: late
          });
        }
      } catch (err) {
        console.error('Error cargando stats de proyecto:', err);
      }
    };

    void loadProjectStats();
  }, [selectedProjectId]);

  const handleWorkspaceSelect = useCallback((workspaceId) => {
    setSelectedWorkspaceId(workspaceId || null);
    setSelectedProjectId(null);
    setAssigneePreset(null);
  }, []);

  const handleWorkspacesChange = useCallback((workspaceList) => {
    setWorkspaces(workspaceList);
    if (workspaceList.length === 0) {
      setSelectedWorkspaceId(null);
      setStatsWorkspaceId(null);
    } else if (workspaceList.every((workspace) => workspace.id !== selectedWorkspaceId)) {
      setSelectedWorkspaceId(workspaceList[0].id);
      setStatsWorkspaceId(workspaceList[0].id);
    } else if (!statsWorkspaceId) {
      setStatsWorkspaceId(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId, statsWorkspaceId]);

  const handleWorkspaceMembersChange = useCallback((memberMap) => {
    setWorkspaceMembers(memberMap);
  }, []);

  const handleProjectSelect = useCallback((projectId) => {
    setSelectedProjectId(projectId);
    if (projectId) {
      setActiveManagementTab('tareas');
    }
  }, []);

  const handleProjectsChange = useCallback((projectList) => {
    setProjects(projectList);
    if (projectList.length === 0) {
      setSelectedProjectId(null);
    }
  }, []);

  const handleProjectMembersChange = useCallback((memberMap) => {
    setProjectMembers(memberMap);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.ResizeObserver === 'undefined') {
      return undefined;
    }

    const OriginalResizeObserver = window.ResizeObserver;
    if (OriginalResizeObserver.__patchedForTaskboard) {
      return undefined;
    }

    class PatchedResizeObserver extends OriginalResizeObserver {
      constructor(callback) {
        super((entries, observer) => {
          window.requestAnimationFrame(() => callback(entries, observer));
        });
      }
    }

    PatchedResizeObserver.__patchedForTaskboard = true;
    window.ResizeObserver = PatchedResizeObserver;

    return () => {
      window.ResizeObserver = OriginalResizeObserver;
    };
  }, []);

  const updateTheme = (isLight) => {
    setIsContrastTheme(isLight);
    localStorage.setItem('theme-preference', isLight ? 'light' : 'dark');
  };

  useEffect(() => {
    if (isContrastTheme) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [isContrastTheme]);

  const handleQuickNewTask = useCallback(() => {
    setActivePrimaryView('dashboard');
    setActiveManagementTab('workspace');

    // Pequeño hack: simular clic en la pestaña "Workspace" para forzar que Flowbite actualice su estado interno.
    setTimeout(() => {
      try {
        const tabs = document.querySelectorAll('button[role="tab"]');
        for (const tab of tabs) {
          if (tab.textContent?.trim() === 'Workspace') {
            tab.click();
            break;
          }
        }
      } catch (error) {
        // Ignorar si el DOM aún no está listo o no existe la pestaña.
      }
    }, 0);
  }, []);

  const breadcrumbs = useMemo(() => {
    const base = [
      {
        label: 'Inicio',
        onClick: () => {
          setActivePrimaryView('dashboard');
          setActiveManagementTab('workspace');
        }
      }
    ];

    if (activeWorkspace) {
      base.push({
        label: activeWorkspace.name,
        onClick: () => {
          setActivePrimaryView('dashboard');
          setActiveManagementTab('workspace');
        }
      });
    }

    base.push({
      label: 'Proyectos',
      onClick: () => {
        setActivePrimaryView('dashboard');
        setActiveManagementTab('proyectos');
      }
    });

    if (selectedProject) {
      base.push({ label: selectedProject.name });
    }
    return base;
  }, [activeWorkspace, selectedProject]);

  const statusItems = useMemo(
    () => [
      {
        label: 'Workspace activo',
        value: activeWorkspace ? activeWorkspace.name : 'Ninguno',
        helper: activeWorkspace ? 'Gestionando proyectos compartidos' : 'Selecciona o crea uno',
        onClick: () => {
          setActivePrimaryView('dashboard');
          setActiveManagementTab('proyectos');
        }
      },
      {
        label: 'Proyecto activo',
        value: selectedProject ? selectedProject.name : 'Ninguno',
        helper: selectedProject ? 'Gestionando tareas' : 'Elige un proyecto',
        onClick: () => {
          setActivePrimaryView('dashboard');
          if (selectedProject) {
            setActiveManagementTab('tareas');
          } else {
            setActiveManagementTab('proyectos');
          }
        }
      }
    ],
    [activeWorkspace, selectedProject]
  );

  const layoutTheme = isContrastTheme ? 'light' : 'dark';

  const userDisplayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? 'Usuario';
  const userAvatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const userInitials = useMemo(() => {
    if (!userDisplayName) {
      return 'U';
    }
    return userDisplayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('') || 'U';
  }, [userDisplayName]);

  if (showSplash || initializing || authLoading) {
    return <WelcomeSplashScreen theme={layoutTheme} onComplete={() => setShowSplash(false)} />;
  }

  // Si hay un token de invitación en la URL, mostrar la página de aceptación
  if (invitationToken) {
    return <AcceptInvitation />;
  }

  if (!user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-sky-900 to-indigo-900 px-4 text-slate-50">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-400/30 blur-3xl" />
          <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-64 w-64 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-lg">
          <AuthForm />
        </div>
      </div>
    );
  }

  const layoutActions =
    user && (
      <div className="flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/50 p-1.5 pl-4 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-md hover:bg-white/80 dark:hover:bg-slate-900/80">
        <div className="flex flex-col items-end text-right mr-2 hidden sm:flex">
          <div className="flex items-center gap-2">
            <p className="max-w-[12rem] truncate text-sm font-semibold text-slate-700 dark:text-slate-200" title={user.email}>
              {user.email}
            </p>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">En línea</p>
        </div>

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

        <ThemeToggle isDark={!isContrastTheme} onToggle={(val) => updateTheme(!val)} />

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

        <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
          {userAvatarUrl ? (
            <img src={userAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
              {userInitials}
            </div>
          )}
        </div>
      </div>
    );

  const navigationItems = user
    ? [
      {
        id: 'dashboard',
        label: 'Tablero',
        description: 'Workspaces, proyectos y tareas',
        active: activePrimaryView === 'dashboard',
        badge: projects.length > 0 ? `${projects.length} prj.` : undefined,
        icon: navIcons.dashboard,
        onClick: () => setActivePrimaryView('dashboard')
      },
      {
        id: 'my-tasks',
        label: 'Mis tareas',
        description: 'Todas las tareas asignadas a ti',
        active: activePrimaryView === 'my-tasks',
        icon: navIcons.dashboard,
        onClick: () => setActivePrimaryView('my-tasks')
      },
      {
        id: 'notifications',
        label: 'Notificaciones',
        description: 'Menciones y actividad reciente',
        active: activePrimaryView === 'notifications',
        icon: navIcons.notifications,
        onClick: () => setActivePrimaryView('notifications')
      },
      {
        id: 'profile',
        label: 'Perfil',
        description: 'Preferencias y sesión',
        active: activePrimaryView === 'profile',
        icon: navIcons.profile,
        onClick: () => setActivePrimaryView('profile')
      }
    ]
    : [];

  const sidebarActions =
    user && (
      <div className="space-y-4">
        <Button color="info" className="w-full" onClick={handleQuickNewTask}>
          Crear workspace
        </Button>
      </div>
    );

  const sidebarFooter =
    user && (
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-lg font-semibold text-slate-700 dark:text-slate-100">
          {userAvatarUrl ? <img src={userAvatarUrl} alt={`Avatar de ${userDisplayName}`} className="h-full w-full object-cover" /> : userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={userDisplayName}>
            {userDisplayName}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={user?.email}>
            {user?.email}
          </p>
        </div>
        <Button size="xs" color="failure" onClick={signOut} pill>
          Salir
        </Button>
      </div>
    );

  const dashboardSection = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-4 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-950/40 p-2 backdrop-blur-xl shadow-lg shadow-slate-200/20 dark:shadow-black/20">
        {[
          {
            id: 'workspace', label: 'Workspace', icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5M12 6.75h1.5M15 6.75h1.5M9 10.5h1.5M12 10.5h1.5M15 10.5h1.5M9 14.25h1.5M12 14.25h1.5M15 14.25h1.5M9 18h1.5M12 18h1.5M15 18h1.5" />
              </svg>
            )
          },
          {
            id: 'proyectos', label: 'Proyectos', icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>
            )
          },
          {
            id: 'tareas', label: 'Tareas', icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
            )
          },
          {
            id: 'stats', label: 'Estadísticas', icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            )
          }
        ].map((tab) => {
          const isActive = activeManagementTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveManagementTab(tab.id)}
              className={`flex min-w-[140px] flex-1 items-center justify-center gap-3 rounded-2xl border px-6 py-4 text-sm font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${isActive
                ? 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 text-cyan-700 shadow-lg shadow-cyan-900/10 dark:border-cyan-400/30 dark:from-cyan-400/10 dark:to-blue-600/10 dark:text-cyan-300'
                : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                }`}
              type="button"
            >
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110 text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                {tab.icon}
              </div>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div>
        {activeManagementTab === 'workspace' && (
          <WorkspaceManagementPanel
            user={user}
            selectedWorkspaceId={selectedWorkspaceId}
            onSelect={handleWorkspaceSelect}
            onWorkspacesChange={handleWorkspacesChange}
            onWorkspaceMembersChange={handleWorkspaceMembersChange}
          />
        )}
        {activeManagementTab === 'proyectos' && (
          <ProjectsManagementPanel
            user={user}
            selectedWorkspaceId={selectedWorkspaceId}
            selectedProjectId={selectedProjectId}
            projects={projects}
            onProjectSelect={handleProjectSelect}
            onProjectsChange={handleProjectsChange}
            onProjectMembersChange={handleProjectMembersChange}
            workspaceMembers={workspaceMembers}
          />
        )}
        {activeManagementTab === 'tareas' && (
          <TasksManagementPanel
            user={user}
            selectedWorkspaceId={selectedWorkspaceId}
            selectedProjectId={selectedProjectId}
            selectedProject={selectedProject}
            selectedProjectMembers={selectedProjectMembers}
            projects={projects}
            taskListRef={taskListRef}

            onTaskSummaryChange={setTaskSummary}
            assigneePreset={assigneePreset}
            initialTaskId={initialTaskId}
          />
        )}
        {activeManagementTab === 'stats' && (
          <StatsDashboard
            workspaces={workspaces}
            projects={projects}
            activeWorkspace={activeWorkspace}
            workspaceMembers={workspaceMembers}
            selectedProjectMembers={selectedProjectMembers}
            selectedProject={selectedProject}
            statsWorkspaceId={statsWorkspaceId}
            setStatsWorkspaceId={setStatsWorkspaceId}
            selectedWorkspaceId={selectedWorkspaceId}
            taskSummary={taskSummary}
            authProvider={user?.app_metadata?.provider || 'email'}
            globalStats={userGlobalStats}
          />
        )}
        <WorkspacePeopleDashboard
          workspaceId={statsWorkspaceId ?? selectedWorkspaceId}
          workspaceMembers={workspaceMembers}
          onPersonClick={(personId) => {
            setActivePrimaryView('dashboard');
            setActiveManagementTab('tareas');
            setAssigneePreset(personId === null ? 'unassigned' : personId);
          }}
          onTaskClick={(task) => {
            setSelectedProjectId(task.project_id);
            setActivePrimaryView('dashboard');
            setActiveManagementTab('tareas');
            setAssigneePreset('all');
            setInitialTaskId(task.id);
            // Resetear el ID inicial después de un momento para permitir clics repetidos si fuera necesario
            setTimeout(() => setInitialTaskId(null), 500);
          }}
        />
      </div>
    </div>
  );

  const notificationsSection = (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Centro de notificaciones</p>
          <p className="text-xs text-slate-500">Revisa tus menciones y alertas del workspace.</p>
        </div>
        <NotificationPanel userId={user?.id ?? null} workspaceId={selectedWorkspaceId} />
      </div>
    </Card>
  );

  const profileSection = (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Perfil y ajustes</p>
          <p className="text-xs text-slate-500">Configura preferencias rápidas, avatar y sesión.</p>
        </div>
        <UserPanel
          user={user}
          authLoading={authLoading}
          onSignOut={signOut}
          stats={userGlobalStats}
        />
      </div>
    </Card>
  );

  const unauthenticatedContent = (
    <div className="space-y-6">
      <AuthForm />
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 p-8 text-center text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
        Inicia sesión para gestionar tus tareas.
      </div>
    </div>
  );

  const authenticatedContent =
    activePrimaryView === 'dashboard'
      ? dashboardSection
      : activePrimaryView === 'my-tasks'
        ? <MyTasksPanel user={user} />
        : activePrimaryView === 'notifications'
          ? notificationsSection
          : profileSection;

  return (
    <AppLayout
      heading="Taskboard"
      actions={layoutActions}
      breadcrumbs={breadcrumbs}
      statusItems={statusItems}
      theme={layoutTheme}
      navigationItems={navigationItems}
      sidebarActions={sidebarActions}
      sidebarFooter={sidebarFooter}
    >
      {user ? authenticatedContent : unauthenticatedContent}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        selectedWorkspaceId={selectedWorkspaceId}
        onSelectTask={(task) => {
          setSelectedProjectId(task.project_id);
          setActivePrimaryView('dashboard');
          setActiveManagementTab('tareas');
          setAssigneePreset('all');
          setInitialTaskId(task.id);
          setTimeout(() => setInitialTaskId(null), 500);
        }}
      />
      <CookieConsent />
    </AppLayout>
  );
}

export default App;

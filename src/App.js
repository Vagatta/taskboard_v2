import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Label, Select, Spinner, Tabs, TabItem, TextInput, ToggleSwitch } from 'flowbite-react';
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
import { useAuth } from './context/AuthContext';

const navIcons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3.75 3.75h6.5v6.5h-6.5zM13.75 3.75h6.5v9.5h-6.5zM13.75 15.75h6.5v4.5h-6.5zM3.75 12.25h6.5v8h-6.5z" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M12 3.75a4.5 4.5 0 0 0-4.5 4.5v2.07c0 .52-.17 1.02-.48 1.43L5.4 14.53a1 1 0 0 0 .78 1.62h11.64a1 1 0 0 0 .78-1.62L16.98 11.8a2.4 2.4 0 0 1-.48-1.43V8.25A4.5 4.5 0 0 0 12 3.75z" />
      <path d="M9.75 17.25a2.25 2.25 0 0 0 4.5 0" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M12 12a4.125 4.125 0 1 0 0-8.25 4.125 4.125 0 0 0 0 8.25z" />
      <path d="M5.25 19.5a6.75 6.75 0 0 1 13.5 0" />
    </svg>
  )
};

// Formulario sencillo de login/registro con email y contraseña.
function AuthForm() {
  const { signIn, signUp, authLoading, error, successMessage, setError, setSuccessMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await signIn({ email: email.trim(), password });
      setEmail('');
      setPassword('');
    } catch (err) {
      // El mensaje de error ya se gestiona en AuthContext mediante handleSupabaseError.
    }
  };

  const handleSignUp = async () => {
    try {
      await signUp({ email: email.trim(), password });
      setEmail('');
      setPassword('');
      // El mensaje de éxito ya se establece en AuthContext
    } catch (err) {
      // El mensaje de error ya se gestiona en AuthContext mediante handleSupabaseError.
    }
  };

  return (
    <Card
      className="border border-white/20 bg-white/10 bg-clip-padding backdrop-blur-xl shadow-xl shadow-slate-950/40"
      aria-labelledby="auth-card-heading"
    >
      <div className="mb-4 space-y-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300/80">Taskboard</p>
        <h1 id="auth-card-heading" className="text-2xl font-semibold text-white">
          Inicia sesión para continuar
        </h1>
        <p className="text-sm text-slate-200/80">
          Organiza tus proyectos, tareas y menciones en un solo lugar. Accede con tu cuenta para ver tu tablero.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="email" value="Email" className="text-xs uppercase tracking-wide text-slate-200" />
          <TextInput
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
              setSuccessMessage(null);
            }}
            placeholder="tu@email.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="password" value="Contraseña" className="text-xs uppercase tracking-wide text-slate-200" />
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
            autoComplete="current-password"
          />
        </div>
        {error && (
          <Alert
            color="failure"
            className="border border-red-500/40 bg-red-500/10 text-sm text-red-100 backdrop-blur-sm"
            aria-live="polite"
          >
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert
            color="success"
            className="border border-emerald-500/40 bg-emerald-500/10 text-sm text-emerald-100 backdrop-blur-sm"
            aria-live="polite"
          >
            {successMessage}
          </Alert>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" disabled={authLoading} color="info">
            {authLoading ? 'Procesando...' : 'Iniciar sesión'}
          </Button>
          <Button type="button" color="light" onClick={handleSignUp} disabled={authLoading}>
            Crear cuenta nueva
          </Button>
        </div>
      </form>
    </Card>
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
  const [activeViewMode, setActiveViewMode] = useState('list');
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
    // Atajos de teclado globales (Ctrl+G para nueva tarea rápida, Ctrl+V para cambiar vista).
    const handleGlobalShortcut = (event) => {
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (!isCtrlOrMeta || event.repeat || event.altKey) {
        return;
      }

      if (!user) {
        return;
      }

      const key = event.key?.toLowerCase() ?? '';
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
    const base = [{ label: 'Inicio', href: '#' }];
    if (activeWorkspace) {
      base.push({ label: activeWorkspace.name });
    }
    base.push({ label: 'Proyectos' });
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
        helper: activeWorkspace ? 'Gestionando proyectos compartidos' : 'Selecciona o crea uno'
      },
      {
        label: 'Proyecto activo',
        value: selectedProject ? selectedProject.name : 'Ninguno',
        helper: selectedProject ? 'Gestionando tareas' : 'Elige un proyecto'
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

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
        <Card className="w-full max-w-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70" aria-live="polite">
          <div className="flex items-center gap-3">
            <Spinner color="info" aria-label="Cargando sesión" />
            <p className="text-sm text-slate-600 dark:text-slate-200">Cargando sesión...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-sky-900 to-indigo-900 px-4 text-slate-50">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-400/30 blur-3xl" />
          <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-64 w-64 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md">
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

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
            onViewModeChange={setActiveViewMode}
            onTaskSummaryChange={setTaskSummary}
            assigneePreset={assigneePreset}
          />
        )}
        {activeManagementTab === 'stats' && (
          <div className="mt-4 space-y-4">
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-500">Workspaces</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{workspaces.length}</p>
                <p className="text-xs text-slate-500">Creados en tu cuenta</p>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
                <p className="text-xs uppercase tracking-wide text-slate-500">Proyectos</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{projects.length}</p>
                <p className="text-xs text-slate-500">Dentro del workspace actual</p>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
                <p className="text-xs uppercase tracking-wide text-slate-500">Miembros workspace</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                  {activeWorkspace ? (workspaceMembers[activeWorkspace.id]?.length ?? 0) : 0}
                </p>
                <p className="text-xs text-slate-500">Colaboradores disponibles</p>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
                <p className="text-xs uppercase tracking-wide text-slate-500">Colaboradores proyecto</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{selectedProjectMembers.length}</p>
                <p className="text-xs text-slate-500">
                  {selectedProject ? 'En el proyecto activo' : 'Selecciona un proyecto'}
                </p>
              </Card>
            </div>

            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs uppercase tracking-wide text-slate-500">Workspace para estadísticas</p>
                <Select
                  sizing="sm"
                  value={statsWorkspaceId ?? selectedWorkspaceId ?? ''}
                  onChange={(event) => setStatsWorkspaceId(event.target.value || null)}
                  className="w-full sm:w-64"
                >
                  {workspaces.length === 0 ? (
                    <option value="">Sin workspaces</option>
                  ) : (
                    workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))
                  )}
                </Select>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
                <p className="text-xs uppercase tracking-wide text-slate-500">Tareas del proyecto activo</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-100">
                  <div className="flex items-center justify-between">
                    <span>Total</span>
                    <span className="font-semibold">{taskSummary.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pendientes</span>
                    <span className="font-semibold text-amber-300">{taskSummary.pending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Completadas</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">{taskSummary.completed}</span>
                  </div>

                  <div className="pt-2 text-xs text-slate-400">Detalle de finalización</div>
                  <div className="space-y-1 text-xs text-slate-500 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>En plazo</span>
                      <span className="font-semibold text-emerald-300">{taskSummary.completedOnTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Fuera de plazo</span>
                      <span className="font-semibold text-red-300">{taskSummary.completedLate}</span>
                    </div>
                    {taskSummary.completed > 0 ? (
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-emerald-400"
                          style={{
                            width: `${Math.min(
                              100,
                              (taskSummary.completedOnTime / Math.max(taskSummary.completed, 1)) * 100
                            )}%`
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
                <p className="text-xs uppercase tracking-wide text-slate-500">Proveedor de acceso</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{user?.app_metadata?.provider ?? 'Desconocido'}</p>
                <p className="text-xs text-slate-500">Método de autenticación actual</p>
              </Card>
            </div>

            <WorkspacePeopleDashboard
              workspaceId={statsWorkspaceId ?? selectedWorkspaceId}
              workspaceMembers={workspaceMembers}
              onPersonClick={(personId) => {
                setActivePrimaryView('dashboard');
                setActiveManagementTab('tareas');
                setAssigneePreset(personId === null ? 'unassigned' : personId);
              }}
            />
          </div>
        )}
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
          stats={{
            projects: projects.length,
            totalTasks: taskSummary.total,
            completedTasks: taskSummary.completed,
            collaborators: selectedProjectMembers.length,
            pendingTasks: taskSummary.pending
          }}
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
    </AppLayout>
  );
}

export default App;

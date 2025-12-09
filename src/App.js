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
  const { signIn, signUp, authLoading, error, setError } = useAuth();
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Taskboard</p>
        <h1 id="auth-card-heading" className="text-2xl font-semibold text-white">
          Inicia sesión para continuar
        </h1>
        <p className="text-sm text-slate-200/80">
          Organiza tus proyectos, tareas y menciones en un solo lugar. Accede con tu cuenta para ver tu tablero.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="email" value="Email" className="text-xs uppercase tracking-wide text-slate-400" />
          <TextInput
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="tu@email.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="password" value="Contraseña" className="text-xs uppercase tracking-wide text-slate-400" />
          <TextInput
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
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
  const [isContrastTheme, setIsContrastTheme] = useState(false);
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <Card className="w-full max-w-sm border-slate-800 bg-slate-900/70" aria-live="polite">
          <div className="flex items-center gap-3">
            <Spinner color="info" aria-label="Cargando sesión" />
            <p className="text-sm text-slate-200">Cargando sesión...</p>
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
      <div className="flex flex-col gap-4 text-left">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sesión iniciada</p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="max-w-[14rem] truncate text-sm font-medium text-slate-200" title={user.email}>
              {user.email}
            </p>
            <Badge color="success" className="uppercase">Activo</Badge>
          </div>
        </div>
        <p className="text-xs text-slate-500">Mantén abierta esta pestaña para recibir actividad en tiempo real.</p>
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
        <ToggleSwitch checked={isContrastTheme} label="Tema claro" onChange={setIsContrastTheme} />
      </div>
    );

  const sidebarFooter =
    user && (
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-lg font-semibold text-slate-100">
          {userAvatarUrl ? <img src={userAvatarUrl} alt={`Avatar de ${userDisplayName}`} className="h-full w-full object-cover" /> : userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white" title={userDisplayName}>
            {userDisplayName}
          </p>
          <p className="truncate text-xs text-slate-400" title={user?.email}>
            {user?.email}
          </p>
        </div>
        <Button size="xs" color="failure" onClick={signOut} pill>
          Salir
        </Button>
      </div>
    );

  const dashboardSection = (
    <Tabs
      key={activeManagementTab}
      aria-label="Gestión de workspace, proyectos y tareas"
      variant="underline"
      className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <TabItem
        title="Workspace"
        active={activeManagementTab === 'workspace'}
        onClick={() => setActiveManagementTab('workspace')}
      >
        <WorkspaceManagementPanel
          user={user}
          selectedWorkspaceId={selectedWorkspaceId}
          onSelect={handleWorkspaceSelect}
          onWorkspacesChange={handleWorkspacesChange}
          onWorkspaceMembersChange={handleWorkspaceMembersChange}
        />
      </TabItem>
      <TabItem
        title="Proyectos"
        active={activeManagementTab === 'proyectos'}
        onClick={() => setActiveManagementTab('proyectos')}
      >
        <ProjectsManagementPanel
          user={user}
          selectedWorkspaceId={selectedWorkspaceId}
          selectedProjectId={selectedProjectId}
          projects={projects}
          onProjectSelect={handleProjectSelect}
          onProjectsChange={handleProjectsChange}
          onProjectMembersChange={handleProjectMembersChange}
        />
      </TabItem>
      <TabItem
        title="Tareas"
        active={activeManagementTab === 'tareas'}
        onClick={() => setActiveManagementTab('tareas')}
      >
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
      </TabItem>
      <TabItem
        title="Estadísticas"
        active={activeManagementTab === 'stats'}
        onClick={() => setActiveManagementTab('stats')}
      >
        <div className="mt-4 space-y-4">
          <Card className="border border-slate-800 bg-slate-950/60">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-500">Workspaces</p>
              <p className="text-lg font-semibold text-white">{workspaces.length}</p>
              <p className="text-xs text-slate-500">Creados en tu cuenta</p>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-slate-800 bg-slate-950/60">
              <p className="text-xs uppercase tracking-wide text-slate-500">Proyectos</p>
              <p className="mt-1 text-2xl font-semibold text-white">{projects.length}</p>
              <p className="text-xs text-slate-500">Dentro del workspace actual</p>
            </Card>

            <Card className="border border-slate-800 bg-slate-950/60">
              <p className="text-xs uppercase tracking-wide text-slate-500">Miembros workspace</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {activeWorkspace ? (workspaceMembers[activeWorkspace.id]?.length ?? 0) : 0}
              </p>
              <p className="text-xs text-slate-500">Colaboradores disponibles</p>
            </Card>

            <Card className="border border-slate-800 bg-slate-950/60">
              <p className="text-xs uppercase tracking-wide text-slate-500">Colaboradores proyecto</p>
              <p className="mt-1 text-2xl font-semibold text-white">{selectedProjectMembers.length}</p>
              <p className="text-xs text-slate-500">
                {selectedProject ? 'En el proyecto activo' : 'Selecciona un proyecto'}
              </p>
            </Card>
          </div>

          <Card className="border border-slate-800 bg-slate-950/60">
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
            <Card className="border border-slate-800 bg-slate-950/60">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tareas del proyecto activo</p>
              <div className="mt-2 space-y-2 text-sm text-slate-100">
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
                  <span className="font-semibold text-emerald-300">{taskSummary.completed}</span>
                </div>

                <div className="pt-2 text-xs text-slate-400">Detalle de finalización</div>
                <div className="space-y-1 text-xs text-slate-300">
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

            <Card className="border border-slate-800 bg-slate-950/60">
              <p className="text-xs uppercase tracking-wide text-slate-500">Proveedor de acceso</p>
              <p className="mt-2 text-lg font-semibold text-white">{user?.app_metadata?.provider ?? 'Desconocido'}</p>
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
      </TabItem>
    </Tabs>
  );

  const notificationsSection = (
    <Card className="border border-slate-800 bg-slate-950/40">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Centro de notificaciones</p>
          <p className="text-xs text-slate-500">Revisa tus menciones y alertas del workspace.</p>
        </div>
        <NotificationPanel userId={user?.id ?? null} workspaceId={selectedWorkspaceId} />
      </div>
    </Card>
  );

  const profileSection = (
    <Card className="border border-slate-800 bg-slate-950/40">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Perfil y ajustes</p>
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
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400" aria-live="polite">
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

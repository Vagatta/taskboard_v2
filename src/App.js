import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Label, Spinner, Tabs, TabItem, TextInput, ToggleSwitch } from 'flowbite-react';
import './App.css';
import AppLayout from './components/AppLayout';
import WorkspaceSelector from './components/WorkspaceSelector';
import ProjectSelector from './components/ProjectSelector';
import UserPanel from './components/UserPanel';
import NotificationPanel from './components/NotificationPanel';
import { useAuth } from './context/AuthContext';
import TaskList from './TaskList';

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
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  const handleSignUp = async () => {
    try {
      await signUp({ email: email.trim(), password });
      setEmail('');
      setPassword('');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60" aria-labelledby="auth-card-heading">
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
          <Alert color="failure" className="text-sm" aria-live="polite">
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
  const [taskSummary, setTaskSummary] = useState({ total: 0, pending: 0, completed: 0 });
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
  }, []);

  const handleWorkspacesChange = useCallback((workspaceList) => {
    setWorkspaces(workspaceList);
    if (workspaceList.length === 0) {
      setSelectedWorkspaceId(null);
    } else if (workspaceList.every((workspace) => workspace.id !== selectedWorkspaceId)) {
      setSelectedWorkspaceId(workspaceList[0].id);
    }
  }, [selectedWorkspaceId]);

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

  const handleQuickNewTask = useCallback(() => {
    setActivePrimaryView('dashboard');
    setActiveManagementTab('tareas');
    if (selectedProjectId) {
      requestAnimationFrame(() => {
        taskListRef.current?.focusNewTaskInput?.();
      });
    }
  }, [selectedProjectId]);

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
        label: 'Proyectos',
        value: projects.length,
        helper: activeWorkspace ? 'Dentro del workspace actual' : 'Selecciona un workspace'
      },
      {
        label: 'Miembros del workspace',
        value: activeWorkspace ? (workspaceMembers[activeWorkspace.id]?.length ?? 0) : 0,
        helper: activeWorkspace ? 'Colaboradores disponibles' : 'Sin workspace activo'
      },
      {
        label: 'Colaboradores',
        value: selectedProjectMembers.length,
        helper: selectedProject ? 'En el proyecto activo' : 'Selecciona un proyecto'
      },
      {
        label: 'Proyecto activo',
        value: selectedProject ? selectedProject.name : 'Ninguno',
        helper: selectedProject ? 'Gestionando tareas' : 'Elige un proyecto'
      },
      {
        label: 'Vista de tareas',
        value: activeViewMode === 'kanban' ? 'Kanban' : 'Lista',
        helper: 'Ctrl + V para alternar'
      },
      {
        label: 'Proveedor de acceso',
        value: user?.app_metadata?.provider ?? 'Desconocido',
        helper: 'Método de autenticación actual'
      }
    ],
    [activeViewMode, activeWorkspace, projects.length, selectedProject, selectedProjectMembers.length, user?.app_metadata?.provider, workspaceMembers]
  );

  const layoutTheme = 'dark';

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
        <Button color="info" className="w-full" disabled={!selectedProjectId} onClick={handleQuickNewTask}>
          Nueva tarea
        </Button>
        <ToggleSwitch checked={isContrastTheme} label="Tema claro" onChange={setIsContrastTheme} disabled />
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
      aria-label="Gestión de workspace, proyectos y tareas"
      variant="underline"
      className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <TabItem
        title="Workspace"
        active={activeManagementTab === 'workspace'}
        onClick={() => setActiveManagementTab('workspace')}
      >
        <div className="space-y-6">
          <WorkspaceSelector
            user={user}
            selectedWorkspaceId={selectedWorkspaceId}
            onSelect={handleWorkspaceSelect}
            onWorkspacesChange={handleWorkspacesChange}
            onWorkspaceMembersChange={handleWorkspaceMembersChange}
          />
        </div>
      </TabItem>
      <TabItem
        title="Proyectos"
        active={activeManagementTab === 'proyectos'}
        onClick={() => setActiveManagementTab('proyectos')}
      >
        <div className="space-y-6">
          {!selectedWorkspaceId ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400" aria-live="polite">
              Selecciona un workspace para gestionar proyectos.
            </div>
          ) : (
            <>
              <ProjectSelector
                user={user}
                workspaceId={selectedWorkspaceId}
                selectedProjectId={selectedProjectId}
                onSelect={handleProjectSelect}
                onProjectsChange={handleProjectsChange}
                onProjectMembersChange={handleProjectMembersChange}
              />
              {projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400" aria-live="polite">
                  Crea tu primer proyecto para gestionar tareas.
                </div>
              ) : null}
            </>
          )}
        </div>
      </TabItem>
      <TabItem
        title="Tareas"
        active={activeManagementTab === 'tareas'}
        onClick={() => setActiveManagementTab('tareas')}
      >
        <div className="space-y-6">
          {!selectedWorkspaceId ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400" aria-live="polite">
              Selecciona un workspace para ver tareas.
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400" aria-live="polite">
              Crea un proyecto antes de gestionar tareas.
            </div>
          ) : selectedProjectId && selectedProject ? (
            <TaskList
              ref={taskListRef}
              user={user}
              projectId={selectedProjectId}
              project={selectedProject}
              members={selectedProjectMembers}
              onViewModeChange={setActiveViewMode}
              onTaskSummaryChange={setTaskSummary}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400" aria-live="polite">
              Selecciona un proyecto para ver sus tareas.
            </div>
          )}
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Select, Spinner, TextInput, Tooltip, Toast } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useProjects, useProjectMembers } from '../hooks/useSupabaseQueries';

export default function ProjectSelector({
  user,
  workspaceId,
  workspaceMembers = {},
  selectedProjectId,
  onSelect,
  onProjectsChange,
  onProjectMembersChange
}) {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading: loadingProjects } = useProjects(workspaceId);
  const { data: members = [] } = useProjectMembers(selectedProjectId);

  // Derive active project members map for compatibility
  const membersByProject = useMemo(() => {
    if (!selectedProjectId) return {};
    return { [selectedProjectId]: members };
  }, [selectedProjectId, members]);


  const [creating, setCreating] = useState(false);
  const [, setError] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  // const [membersByProject, setMembersByProject] = useState({}); // Replaced by hook

  const [inviting, setInviting] = useState(false);
  const [inviteMemberId, setInviteMemberId] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [updatingMemberId, setUpdatingMemberId] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [notifiableProjects, setNotifiableProjects] = useState([]);
  const [notificationBanner, setNotificationBanner] = useState(null);
  const [activeTab, setActiveTab] = useState('projects');
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  // const [initialized, setInitialized] = useState(false); // Handled by React Query loading state

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailRole, setInviteEmailRole] = useState('editor');
  const [invitingEmail, setInvitingEmail] = useState(false);
  const [workspaceInviteEmail, setWorkspaceInviteEmail] = useState('');
  const [invitingToWorkspace, setInvitingToWorkspace] = useState(false);

  // Sync projects with parent
  useEffect(() => {
    if (projects) {
      onProjectsChange?.(projects);
    }
  }, [projects, onProjectsChange]);

  // Sync members with parent
  useEffect(() => {
    if (onProjectMembersChange) {
      onProjectMembersChange(membersByProject);
    }
  }, [membersByProject, onProjectMembersChange]);

  // Notification state
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const workspaceMemberList = useMemo(
    () => (workspaceId ? workspaceMembers[workspaceId] ?? [] : []),
    [workspaceId, workspaceMembers]
  );

  const availableWorkspaceMembers = useMemo(() => {
    if (!workspaceId || !selectedProjectId) {
      return workspaceMemberList;
    }

    const currentProjectMembers = membersByProject[selectedProjectId] ?? [];
    const existingIds = new Set(currentProjectMembers.map((member) => member.member_id));
    return workspaceMemberList.filter((member) => !existingIds.has(member.member_id));
  }, [membersByProject, selectedProjectId, workspaceId, workspaceMemberList]);

  // syncProjects and syncMembers removed as we use hooks now.

  const notificationsStorageKey = useMemo(
    () => (user?.id && workspaceId ? `taskboard:notify:${user.id}:${workspaceId}` : null),
    [user?.id, workspaceId]
  );

  // ... (notifications fetching logic stays same, or could be a hook but fine for now)

  useEffect(() => {
    if (!notificationsStorageKey || typeof window === 'undefined') {
      setNotifiableProjects([]);
      return;
    }
    // ... logic for reading local storage ...
    try {
      const stored = window.localStorage.getItem(notificationsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setNotifiableProjects(parsed);
      }
    } catch (e) { console.warn(e); }
  }, [notificationsStorageKey]);

  useEffect(() => {
    if (!notificationsStorageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(notificationsStorageKey, JSON.stringify(notifiableProjects));
    } catch (e) { console.warn(e); }
  }, [notifiableProjects, notificationsStorageKey]);

  useEffect(() => {
    if (!notificationBanner) return;
    const timeout = window.setTimeout(() => setNotificationBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notificationBanner]);

  useEffect(() => {
    setNotifiableProjects((prev) => prev.filter((projectId) => projects.some((project) => project.id === projectId)));
  }, [projects]);


  const toggleProjectNotification = useCallback((projectId) => {
    // ... logic stays same ...
    setNotifiableProjects((prev) => {
      let next;
      let activated;
      if (prev.includes(projectId)) {
        next = prev.filter((item) => item !== projectId);
        activated = false;
      } else {
        next = [...prev, projectId];
        activated = true;
      }

      setNotificationBanner({
        type: activated ? 'success' : 'warning',
        message: `Notificaciones ${activated ? 'activadas' : 'desactivadas'} para este proyecto.`,
        projectId
      });

      return next;
    });
  }, []);

  // loadProjects function is removed, handled by useProjects hook.


  // No manual load effects. React Query handles it.

  useEffect(() => {
    if (!user) {
      setNewProjectName('');
      setError('');
    }
  }, [user]);

  const hasProjects = useMemo(() => projects.length > 0, [projects.length]);

  const selectedProjectMembers = useMemo(
    () => (selectedProjectId ? membersByProject[selectedProjectId] ?? [] : []),
    [membersByProject, selectedProjectId]
  );

  useEffect(() => {
    if (loadingProjects) return;

    if (!projects || projects.length === 0) {
      if (selectedProjectId !== null) onSelect?.(null);
      return;
    }

    const currentExists = projects.some((project) => project.id === selectedProjectId);
    if (!selectedProjectId || !currentExists) {
      // Don't auto-select a project, users might want "No project" view?
      // But for consistency:
      onSelect?.(null);
    }
  }, [loadingProjects, projects, selectedProjectId, onSelect]);

  const handleSelectProject = (projectId) => {
    onSelect(projectId);
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name || !user || !workspaceId) {
      setError('Selecciona un workspace válido antes de crear un proyecto.');
      return;
    }

    setCreating(true);
    setError('');

    const insertWithPayload = (payload) =>
      supabase
        .from('projects')
        .insert([payload])
        .select()
        .maybeSingle();

    let insertResult = await insertWithPayload({
      name,
      user_id: user.id,
      owner_email: user.email ?? null,
      workspace_id: workspaceId
    });

    if (insertResult.error && insertResult.error.code === '42703') {
      insertResult = await insertWithPayload({ name, user_id: user.id, workspace_id: workspaceId });
    }

    if (insertResult.error) {
      setError(insertResult.error.message);
      setCreating(false);
      return;
    }

    if (insertResult.data) {
      await supabase
        .from('project_members')
        .upsert({
          project_id: insertResult.data.id,
          member_id: user.id,
          member_email: user.email ?? user.id,
          role: 'owner'
        });

      queryClient.invalidateQueries(['projects', workspaceId]);
      queryClient.invalidateQueries(['projectMembers', insertResult.data.id]);
      onSelect(insertResult.data.id);
      setNewProjectName('');
    }

    setCreating(false);
  };



  const handleMemberRoleUpdate = useCallback(
    async (projectId, memberId, nextRole) => {
      if (!user?.id || !projectId || !memberId || !nextRole) {
        return;
      }

      const memberList = membersByProject[projectId] ?? [];
      const targetMember = memberList.find((entry) => entry.member_id === memberId);

      if (!targetMember) {
        return;
      }

      if (targetMember.role === 'owner') {
        setError('No puedes modificar el rol del propietario.');
        return;
      }

      if (targetMember.role === nextRole) {
        return;
      }

      setUpdatingMemberId(memberId);
      setError('');

      try {
        const { error: updateError } = await supabase
          .from('project_members')
          .update({ role: nextRole })
          .eq('project_id', projectId)
          .eq('member_id', memberId);

        if (updateError) {
          if (updateError.code === '42P01') {
            setError('La tabla project_members no existe. Revisa las migraciones en el README.');
          } else {
            setError(updateError.message);
          }
          return;
        }

        await queryClient.invalidateQueries(['projectMembers', projectId]);
      } finally {
        setUpdatingMemberId(null);
      }
    },
    [membersByProject, user?.id, queryClient]
  );

  const handleMemberRemoval = useCallback(
    async (projectId, memberId) => {
      if (!user?.id || !projectId || !memberId) {
        return;
      }

      const memberList = membersByProject[projectId] ?? [];
      const targetMember = memberList.find((entry) => entry.member_id === memberId);

      if (!targetMember) {
        return;
      }

      if (targetMember.role === 'owner') {
        setError('No puedes eliminar al propietario del proyecto.');
        return;
      }

      setRemovingMemberId(memberId);
      setError('');

      try {
        const { error: deleteError } = await supabase
          .from('project_members')
          .delete()
          .eq('project_id', projectId)
          .eq('member_id', memberId);

        if (deleteError) {
          if (deleteError.code === '42P01') {
            setError('La tabla project_members no existe. Revisa las migraciones en el README.');
          } else {
            setError(deleteError.message);
          }
          return;
        }

        await queryClient.invalidateQueries(['projectMembers', projectId]);
      } finally {
        setRemovingMemberId(null);
      }
    },
    [membersByProject, user?.id, queryClient]
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries(['projects', workspaceId]);
  };

  const handleInviteMember = async (event) => {
    event.preventDefault();
    if (!selectedProjectId || !workspaceId || !user) {
      return;
    }

    if (!inviteMemberId) {
      setError('Selecciona un miembro del workspace.');
      return;
    }

    setInviting(true);
    setError('');

    const targetProject = projects.find((project) => project.id === selectedProjectId);
    if (!targetProject) {
      setError('Selecciona un proyecto válido.');
      setInviting(false);
      return;
    }

    const workspaceMember = workspaceMemberList.find((member) => member.member_id === inviteMemberId);
    if (!workspaceMember) {
      setError('No se encontró ese miembro en el workspace.');
      setInviting(false);
      return;
    }

    try {
      const { error: upsertError } = await supabase
        .from('project_members')
        .upsert(
          {
            project_id: selectedProjectId,
            member_id: workspaceMember.member_id,
            member_email: workspaceMember.member_email,
            role: inviteRole
          },
          { onConflict: 'project_id,member_id' }
        )
        .select()
        .maybeSingle();

      if (upsertError) {
        throw upsertError;
      }

      setInviteMemberId('');
      setInviteRole('editor');
      await queryClient.invalidateQueries(['projectMembers', selectedProjectId]);
      setInviteMemberId('');
      setInviteRole('editor');
    } catch (inviteError) {
      if (inviteError instanceof Error) {
        setError(inviteError.message);
      }
    } finally {
      setInviting(false);
    }
  };

  const handleInviteByEmail = async (event) => {
    event.preventDefault();
    if (!selectedProjectId || !user) return;

    const email = inviteEmail.trim();
    if (!email) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    setInvitingEmail(true);
    setError('');

    try {
      const { error: inviteError } = await supabase
        .from('project_invitations')
        .insert({
          project_id: selectedProjectId,
          email: email,
          role: inviteEmailRole,
          invited_by: user.id
        });

      if (inviteError) throw inviteError;

      setInviteEmail('');
      await loadPendingInvitations();
    } catch (err) {
      setError(err.message);
    } finally {
      setInvitingEmail(false);
    }
  };

  const handleInviteToWorkspace = async (e) => {
    e.preventDefault();
    if (!workspaceId || !user) return;

    const email = workspaceInviteEmail.trim();
    if (!email) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    setInvitingToWorkspace(true);
    setError('');

    try {
      // 1. Check if user is already a member
      const { error: checkError } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id) // This checks if current user is member, not the invited one. Wait, we need to check if target email is already member?
        // Actually, RPC usually handles logic, but let's just try to insert invitation.
        // It's safer to just insert invitation and let DB constraint handle duplicates.
        .limit(1);

      if (checkError) throw checkError;

      // 2. Create Workspace Invitation
      const { error: inviteError } = await supabase
        .from('workspace_invitations')
        .insert({
          workspace_id: workspaceId,
          email: email,
          role: 'editor', // Default role for now, simpler
          invited_by: user.id
        });

      if (inviteError) throw inviteError;

      setWorkspaceInviteEmail('');
      setWorkspaceInviteEmail('');
      showNotification(`Invitación al workspace enviada a ${email}`, 'success');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al invitar al workspace');
    } finally {
      setInvitingToWorkspace(false);
    }
  };

  const loadPendingInvitations = useCallback(async () => {
    if (!selectedProjectId) {
      setPendingInvitations([]);
      return;
    }

    setLoadingInvitations(true);
    try {
      const { data, error: invError } = await supabase
        .from('project_invitations')
        .select('*')
        .eq('project_id', selectedProjectId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (invError) throw invError;
      setPendingInvitations(data ?? []);
    } catch (err) {
      console.error('Error cargando invitaciones del proyecto:', err);
    } finally {
      setLoadingInvitations(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (activeTab === 'invite') {
      loadPendingInvitations();
    }
  }, [activeTab, loadPendingInvitations]);

  const handleCancelInvitation = async (invitationId) => {
    try {
      const { error } = await supabase
        .from('project_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
      await loadPendingInvitations();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card data-testid="project-board" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Proyectos disponibles</h2>
              {loadingProjects ? <Spinner size="sm" /> : null}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Selecciona un proyecto para visualizar tus tareas.</p>
          </div>
          <Button onClick={handleRefresh} color="dark" disabled={loadingProjects}>
            Actualizar listado
          </Button>
        </header>

        {notificationBanner ? (
          <Alert
            color={notificationBanner.type}
            onDismiss={() => setNotificationBanner(null)}
            className="text-xs text-slate-100"
          >
            {notificationBanner.message}
          </Alert>
        ) : null}

        {!workspaceId ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-6 text-sm text-slate-600 dark:text-slate-400">
            Selecciona un workspace para administrar sus proyectos.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 p-2">
            <nav className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
              {[
                {
                  id: 'projects', label: 'Proyectos', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                  )
                },
                {
                  id: 'create', label: 'Crear proyecto', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )
                },
                {
                  id: 'invite', label: 'Invitar miembros', disabled: !selectedProjectId, icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3.75 15a2.25 2.25 0 0 1 2.25-2.25h6a2.25 2.25 0 0 1 2.25 2.25v1.5H3.75v-1.5Z" />
                    </svg>
                  )
                }
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const isDisabled = tab.disabled;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${isActive
                      ? 'border-cyan-500/30 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                      : 'border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="animate-in fade-in slide-in-from-left-1 duration-200">
              {activeTab === 'projects' && (
                <div className="min-h-[200px] space-y-4">
                  {loadingProjects ? (
                    <div className="flex items-center justify-center py-10">
                      <Spinner color="info" />
                    </div>
                  ) : hasProjects ? (
                    projects.map((project) => {
                      const isActive = project.id === selectedProjectId;
                      const ownerLabel =
                        project.owner_email || (user?.id === project.user_id ? user?.email : 'Dueño del Proyecto');
                      const createdAt = project.inserted_at ? new Date(project.inserted_at) : null;
                      const isNotifiable = notifiableProjects.includes(project.id);

                      return (
                        <Card
                          key={project.id}
                          as="article"
                          data-testid="project-card"
                          className={`transition hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/70 ${isActive ? 'ring-2 ring-primary/70' : 'border border-slate-200/60 dark:border-slate-800/60'
                            } bg-white/70 dark:bg-slate-950/40 backdrop-blur-sm`}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSelectProject(project.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleSelectProject(project.id);
                              }
                            }}
                            className="flex w-full flex-col gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                          >
                            <div className="flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white" title={project.name}>
                                  {project.name}
                                </h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge color={isActive ? 'info' : 'dark'} className="shrink-0">
                                  {isActive ? 'Activo' : 'Disponible'}
                                </Badge>
                                <Tooltip
                                  content={
                                    isNotifiable
                                      ? 'Notificaciones activadas para este proyecto.'
                                      : 'Notificaciones desactivadas para este proyecto.'
                                  }
                                  placement="bottom"
                                  className="text-slate-900 dark:text-white"
                                >
                                  <span className="shrink-0">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleProjectNotification(project.id);
                                      }}
                                      className={`rounded-full border px-2 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${isNotifiable
                                        ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-300/20 dark:text-amber-200'
                                        : 'border-slate-300 bg-white/50 text-slate-500 hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-amber-300 dark:hover:text-amber-200'
                                        }`}
                                      aria-pressed={isNotifiable}
                                      aria-label={
                                        isNotifiable
                                          ? 'Desactivar notificaciones por correo de este proyecto'
                                          : 'Activar notificaciones por correo de este proyecto'
                                      }
                                    >
                                      🔔
                                    </button>
                                  </span>
                                </Tooltip>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Propietario:{' '}
                              <span className="font-medium text-slate-700 dark:text-white break-words" title={ownerLabel ?? 'Desconocido'}>
                                {ownerLabel ?? 'Desconocido'}
                              </span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {createdAt ? `Creado ${createdAt.toLocaleDateString()}` : 'Sin fecha registrada'}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(membersByProject[project.id] ?? []).map((member) => {
                                const label = `${member.member_email} (${member.role})`;
                                const isOwner = member.role === 'owner';
                                return (
                                  <Tooltip key={member.member_id} content={label} placement="bottom">
                                    <Badge
                                      color={isOwner ? 'info' : 'dark'}
                                      className={`max-w-[16rem] truncate bg-white dark:bg-slate-900/70 ${isOwner ? 'text-cyan-800 dark:text-cyan-100' : 'text-slate-900 dark:text-slate-100'
                                        }`}
                                    >
                                      <span className="block truncate" aria-label={label}>
                                        {member.member_email}
                                      </span>
                                      <span className="ml-1 text-[0.65rem] uppercase tracking-wide">{member.role}</span>
                                    </Badge>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-6 text-sm text-slate-600 dark:text-slate-400">
                      Aún no tienes proyectos. Crea uno nuevo para comenzar.
                    </div>
                  )}

                  {selectedProjectId ? (
                    <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 shadow-none p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Miembros del proyecto</h3>
                          <p className="text-xs text-slate-500">
                            Cambia los roles o elimina miembros que ya no deban colaborar.
                          </p>
                        </div>
                        <Badge color="info">{selectedProjectMembers.length} miembros</Badge>
                      </div>

                      {selectedProjectMembers.length > 0 ? (
                        <div className="space-y-3">
                          {selectedProjectMembers.map((member) => {
                            const isOwner = member.role === 'owner';
                            const isUpdating = updatingMemberId === member.member_id;
                            const isRemoving = removingMemberId === member.member_id;
                            const isBusy = isUpdating || isRemoving;

                            return (
                              <div
                                key={`${member.project_id}-${member.member_id}`}
                                className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white">{member.member_email ?? 'Colaborador'}</p>
                                </div>
                                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                                  <Select
                                    sizing="sm"
                                    value={member.role}
                                    disabled={isOwner || isBusy}
                                    onChange={(event) =>
                                      handleMemberRoleUpdate(member.project_id, member.member_id, event.target.value)
                                    }
                                  >
                                    <option value="owner">Propietario</option>
                                    <option value="editor">Editor</option>
                                    <option value="viewer">Solo lectura</option>
                                  </Select>
                                  <Badge color={isOwner ? 'info' : 'gray'}>{member.role}</Badge>
                                  {!isOwner ? (
                                    <Button
                                      color="failure"
                                      size="xs"
                                      pill
                                      disabled={isBusy}
                                      onClick={() => handleMemberRemoval(member.project_id, member.member_id)}
                                    >
                                      {isRemoving ? 'Eliminando...' : 'Eliminar'}
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-4 text-xs text-slate-600 dark:text-slate-400">
                          No hay miembros registrados para este proyecto.
                        </p>
                      )}
                    </section>
                  ) : null}
                </div>
              )}

              {activeTab === 'create' && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Crear nuevo proyecto</p>
                  <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleCreateProject}>
                    <div className="flex-1 space-y-2">
                      <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="new-project">
                        Nuevo proyecto
                      </label>
                      <TextInput
                        id="new-project"
                        value={newProjectName}
                        onChange={(event) => {
                          setNewProjectName(event.target.value);
                          setError('');
                        }}
                        placeholder="Nombre del proyecto"
                        maxLength={120}
                        disabled={!workspaceId || creating || !user}
                      />
                    </div>
                    <Button
                      type="submit"
                      color="info"
                      disabled={creating || !user || !workspaceId}
                      className="whitespace-nowrap"
                    >
                      {creating ? 'Creando...' : 'Crear proyecto'}
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === 'invite' && (
                <div className="mt-4 space-y-3">
                  {selectedProjectId ? (
                    <>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Agregar miembro del workspace</p>
                      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleInviteMember}>
                        <div className="flex-1 space-y-2">
                          <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-member">
                            Miembro del workspace
                          </label>
                          <Select
                            id="invite-member"
                            value={inviteMemberId}
                            onChange={(event) => {
                              setInviteMemberId(event.target.value);
                              setError('');
                            }}
                            disabled={inviting || availableWorkspaceMembers.length === 0}
                          >
                            <option value="">Selecciona un miembro</option>
                            {availableWorkspaceMembers.map((member) => (
                              <option key={member.member_id} value={member.member_id}>
                                {member.member_email} ({member.role})
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="sm:w-48">
                          <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-role">
                            Rol asignado
                          </label>
                          <Select
                            id="invite-role"
                            value={inviteRole}
                            onChange={(event) => setInviteRole(event.target.value)}
                            disabled={inviting}
                          >
                            <option value="owner">Propietario</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Solo lectura</option>
                          </Select>
                        </div>
                        <Button
                          type="submit"
                          color="light"
                          disabled={inviting || availableWorkspaceMembers.length === 0}
                          className="sm:w-40"
                        >
                          {inviting ? 'Agregando...' : 'Agregar'}
                        </Button>
                      </form>
                      {availableWorkspaceMembers.length === 0 && (
                        <p className="mt-2 text-xs italic text-slate-400">
                          No hay otros miembros en el workspace para agregar.
                        </p>
                      )}

                      <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-3">Invitar por correo electrónico</p>
                        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleInviteByEmail}>
                          <div className="flex-1 space-y-2">
                            <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-email">
                              Correo electrónico
                            </label>
                            <TextInput
                              id="invite-email"
                              type="email"
                              placeholder="usuario@ejemplo.com"
                              value={inviteEmail}
                              onChange={(event) => {
                                setInviteEmail(event.target.value);
                                setError('');
                              }}
                              disabled={invitingEmail}
                            />
                          </div>
                          <div className="sm:w-32">
                            <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-email-role">
                              Rol
                            </label>
                            <Select
                              id="invite-email-role"
                              value={inviteEmailRole}
                              onChange={(event) => setInviteEmailRole(event.target.value)}
                              disabled={invitingEmail}
                            >
                              <option value="owner">Owner</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </Select>
                          </div>
                          <Button
                            type="submit"
                            color="info"
                            disabled={invitingEmail || !inviteEmail.trim()}
                            className="sm:w-auto"
                          >
                            {invitingEmail ? 'Enviando...' : 'Invitar'}
                          </Button>
                        </form>
                      </div>

                      {/* Lista de invitaciones pendientes */}
                      {loadingInvitations ? (
                        <div className="text-center py-4">
                          <p className="text-sm text-slate-500">Cargando invitaciones pendientes...</p>
                        </div>
                      ) : pendingInvitations.length > 0 ? (
                        <div className="mt-6 space-y-3">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                            Invitaciones Pendientes del Proyecto ({pendingInvitations.length})
                          </h3>
                          <div className="space-y-2">
                            {pendingInvitations.map((invitation) => {
                              const expiresAt = new Date(invitation.expires_at);
                              const isExpired = expiresAt < new Date();
                              const daysUntilExpiry = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));

                              return (
                                <div
                                  key={invitation.id}
                                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                                >
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                      {invitation.email}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge color={invitation.role === 'owner' ? 'purple' : invitation.role === 'editor' ? 'info' : 'gray'} size="xs">
                                        {invitation.role}
                                      </Badge>
                                      {isExpired ? (
                                        <span className="text-xs text-red-600 dark:text-red-400">Expirada</span>
                                      ) : (
                                        <span className="text-xs text-slate-500">
                                          Expira en {daysUntilExpiry} {daysUntilExpiry === 1 ? 'día' : 'días'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="xs"
                                      color="light"
                                      onClick={() => {
                                        const baseUrl = `${window.location.origin}${process.env.PUBLIC_URL || ''}`;
                                        const inviteUrl = `${baseUrl}/?token=${invitation.token}`;
                                        navigator.clipboard.writeText(inviteUrl);
                                        showNotification('Enlace copiado al portapapeles', 'success');
                                      }}
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </Button>
                                    <Button
                                      size="xs"
                                      color="failure"
                                      onClick={() => handleCancelInvitation(invitation.id)}
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-slate-500">
                            Nota: Cuando estos usuarios acepten la invitación, podrás agregarlos al proyecto desde el selector de arriba.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 mt-4">No hay invitaciones pendientes en este proyecto.</p>
                      )}

                      {/* NUEVA SECCIÓN: Invitar al Workspace */}
                      <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                          Invitar usuarios al Workspace
                        </h3>
                        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                          Si el usuario no aparece en la lista de "Agregar miembro del workspace", primero tienes que invitarlo al Workspace aquí.
                        </p>
                        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleInviteToWorkspace}>
                          <div className="flex-1 space-y-2">
                            <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="workspace-invite-email">
                              Correo electrónico
                            </label>
                            <TextInput
                              id="workspace-invite-email"
                              type="email"
                              placeholder="nuevo.usuario@ejemplo.com"
                              value={workspaceInviteEmail}
                              onChange={(e) => {
                                setWorkspaceInviteEmail(e.target.value);
                                setError('');
                              }}
                              disabled={invitingToWorkspace}
                            />
                          </div>
                          <Button
                            type="submit"
                            color="dark"
                            disabled={invitingToWorkspace || !workspaceInviteEmail.trim()}
                            className="sm:w-auto"
                          >
                            {invitingToWorkspace ? 'Enviando...' : 'Invitar al Workspace'}
                          </Button>
                        </form>
                      </div>

                    </>
                  ) : (
                    <p className="text-xs text-slate-500">Selecciona primero un proyecto para poder invitar miembros.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}


        {/* TOAST NOTIFICATIONS */}
        {notification && (
          <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <Toast>
              <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${notification.type === 'success'
                ? 'bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200'
                : 'bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200'
                }`}>
                {notification.type === 'success' ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 text-sm font-normal">{notification.message}</div>
              <Toast.Toggle onDismiss={() => setNotification(null)} />
            </Toast>
          </div>
        )}
      </div>
    </Card >
  );
}



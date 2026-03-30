import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Select, Spinner, TextInput } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useProjects, useProjectMembers, useWorkspaceMembers } from '../hooks/useSupabaseQueries';

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
  const { data: projectsData = [], isLoading: loadingProjects } = useProjects(workspaceId);
  const { data: membersData = [] } = useProjectMembers(selectedProjectId);
  const { data: workspaceMemberData = [] } = useWorkspaceMembers(workspaceId);

  const projects = useMemo(() => projectsData ?? [], [projectsData]);
  const members = useMemo(() => membersData ?? [], [membersData]);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [activeTab, setActiveTab] = useState('projects');
  const [inviting, setInviting] = useState(false);
  const [inviteMemberId, setInviteMemberId] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [updatingMemberId, setUpdatingMemberId] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteWorkspaceRole, setInviteWorkspaceRole] = useState('viewer');
  const [inviteEmailRole, setInviteEmailRole] = useState('editor');
  const [isMembersSectionCollapsed, setIsMembersSectionCollapsed] = useState(true);
  const [inviteTargetProjectId, setInviteTargetProjectId] = useState('');
  const [invitingEmail, setInvitingEmail] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [pendingWorkspaceInvitations, setPendingWorkspaceInvitations] = useState([]);
  const [loadingWorkspaceInvitations, setLoadingWorkspaceInvitations] = useState(false);
  const [notification, setNotification] = useState(null);
  const lastProjectsSignatureRef = useRef('');
  const lastMembersSignatureRef = useRef('');
  const invitationApiUrl = useMemo(() => {
    const configuredApiBaseUrl = (process.env.REACT_APP_API_BASE_URL || '').trim();
    if (configuredApiBaseUrl) {
      return `${configuredApiBaseUrl.replace(/\/$/, '')}/api/send-invitation.php`;
    }

    const configuredBaseUrl = (process.env.REACT_APP_BASE_URL || '').trim();
    if (configuredBaseUrl) {
      return `${configuredBaseUrl.replace(/\/$/, '')}/api/send-invitation.php`;
    }

    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/^\/(Taskboard)(?:\/|$)/i);
      const appBasePath = pathMatch ? `/${pathMatch[1]}` : '';
      return `${window.location.origin}${appBasePath}/api/send-invitation.php`;
    }

    return '/api/send-invitation.php';
  }, []);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 5000);
  }, []);

  const parseApiResponse = useCallback(async (response) => {
    const rawText = await response.text();

    try {
      return JSON.parse(rawText);
    } catch {
      throw new Error(rawText?.startsWith('<')
        ? 'El endpoint de invitaciones devolvió HTML en vez de JSON. Revisa el error PHP en /api/send-invitation.php.'
        : rawText || 'Respuesta inválida del servidor de invitaciones.');
    }
  }, []);

  const membersByProject = useMemo(() => {
    if (!selectedProjectId) return {};
    return { [selectedProjectId]: members };
  }, [selectedProjectId, members]);

  const workspaceMemberList = useMemo(
    () => (workspaceId ? workspaceMemberData ?? workspaceMembers[workspaceId] ?? [] : []),
    [workspaceId, workspaceMemberData, workspaceMembers]
  );

  const availableWorkspaceMembers = useMemo(() => {
    if (!selectedProjectId) return workspaceMemberList;
    const existingIds = new Set((membersByProject[selectedProjectId] ?? []).map((member) => member.member_id));
    return workspaceMemberList.filter((member) => !existingIds.has(member.member_id));
  }, [membersByProject, selectedProjectId, workspaceMemberList]);

  useEffect(() => {
    const signature = JSON.stringify((projects ?? []).map((project) => ({ id: project.id, name: project.name, workspace_id: project.workspace_id })));
    if (signature === lastProjectsSignatureRef.current) {
      return;
    }

    lastProjectsSignatureRef.current = signature;
    onProjectsChange?.(projects);
  }, [projects, onProjectsChange]);

  useEffect(() => {
    const signature = JSON.stringify(membersByProject);
    if (signature === lastMembersSignatureRef.current) {
      return;
    }

    lastMembersSignatureRef.current = signature;
    onProjectMembersChange?.(membersByProject);
  }, [membersByProject, onProjectMembersChange]);

  useEffect(() => {
    if (loadingProjects) return;
    if (projects.length === 0 && selectedProjectId !== null) {
      onSelect?.(null);
    }
  }, [loadingProjects, projects, selectedProjectId, onSelect]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries(['projects', workspaceId]);
    queryClient.invalidateQueries(['projectMembers', selectedProjectId]);
    queryClient.invalidateQueries(['workspaceMembers', workspaceId]);
  }, [queryClient, workspaceId, selectedProjectId]);

  const handleCreateProject = async (event) => {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name || !user || !workspaceId) {
      setError('Selecciona un workspace válido antes de crear un proyecto.');
      return;
    }

    setCreating(true);
    setError('');

    let insertResult = await supabase
      .from('projects')
      .insert([{ name, user_id: user.id, owner_email: user.email ?? null, workspace_id: workspaceId }])
      .select()
      .maybeSingle();

    if (insertResult.error && insertResult.error.code === '42703') {
      insertResult = await supabase
        .from('projects')
        .insert([{ name, user_id: user.id, workspace_id: workspaceId }])
        .select()
        .maybeSingle();
    }

    if (insertResult.error) {
      setError(insertResult.error.message);
      setCreating(false);
      return;
    }

    if (insertResult.data) {
      await supabase.from('project_members').upsert({
        project_id: insertResult.data.id,
        member_id: user.id,
        member_email: user.email ?? user.id,
        role: 'owner'
      });

      queryClient.invalidateQueries(['projects', workspaceId]);
      queryClient.invalidateQueries(['projectMembers', insertResult.data.id]);
      onSelect?.(insertResult.data.id);
      setNewProjectName('');
      showNotification('Proyecto creado correctamente.', 'success');
    }

    setCreating(false);
  };

  const handleInviteMember = async (event) => {
    event.preventDefault();
    if (!selectedProjectId || !inviteMemberId) {
      setError('Selecciona un miembro del workspace.');
      return;
    }

    const workspaceMember = workspaceMemberList.find((member) => member.member_id === inviteMemberId);
    if (!workspaceMember) {
      setError('No se encontró ese miembro en el workspace.');
      return;
    }

    setInviting(true);
    setError('');

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
        );

      if (upsertError) throw upsertError;

      setInviteMemberId('');
      setInviteRole('editor');
      queryClient.invalidateQueries(['projectMembers', selectedProjectId]);
      showNotification('Miembro añadido al tablero.', 'success');
    } catch (inviteError) {
      setError(inviteError.message);
    } finally {
      setInviting(false);
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
      setError(err.message);
    } finally {
      setLoadingInvitations(false);
    }
  }, [selectedProjectId]);

  const loadPendingWorkspaceInvitations = useCallback(async () => {
    if (!workspaceId) {
      setPendingWorkspaceInvitations([]);
      return;
    }

    setLoadingWorkspaceInvitations(true);
    try {
      const { data, error: invError } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (invError) throw invError;
      setPendingWorkspaceInvitations(data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingWorkspaceInvitations(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (activeTab === 'invite') {
      void loadPendingWorkspaceInvitations();
      void loadPendingInvitations();
    }
  }, [activeTab, loadPendingWorkspaceInvitations, loadPendingInvitations]);

  useEffect(() => {
    setIsMembersSectionCollapsed(true);
  }, [selectedProjectId]);

  const handleInviteByEmail = async (event) => {
    event.preventDefault();
    if (!workspaceId || !user) return;

    const email = inviteEmail.trim();
    if (!email) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    setInvitingEmail(true);
    setError('');

    try {
      if (inviteTargetProjectId) {
        const targetProject = projects.find((project) => project.id === inviteTargetProjectId) ?? null;
        const { data: existingProjectInvitation, error: existingProjectInvitationError } = await supabase
          .from('project_invitations')
          .select('id, token, accepted_at, expires_at')
          .eq('project_id', inviteTargetProjectId)
          .eq('email', email)
          .maybeSingle();

        if (existingProjectInvitationError) {
          if (existingProjectInvitationError.message?.toLowerCase().includes('row-level security')) {
            throw new Error('Tu usuario no tiene permisos para invitar a este tablero. Solo pueden invitar quienes sean owner o editor dentro del proyecto.');
          }
          throw existingProjectInvitationError;
        }

        let projectInvitation = existingProjectInvitation;
        const projectInvitationExpired = projectInvitation?.expires_at ? new Date(projectInvitation.expires_at) <= new Date() : false;

        if (projectInvitation && (projectInvitation.accepted_at || projectInvitationExpired)) {
          const { error: deleteProjectInvitationError } = await supabase
            .from('project_invitations')
            .delete()
            .eq('id', projectInvitation.id);

          if (deleteProjectInvitationError) {
            throw deleteProjectInvitationError;
          }

          projectInvitation = null;
        }

        if (!projectInvitation) {
          const { data: insertedProjectInvitation, error: projectInviteError } = await supabase
            .from('project_invitations')
            .insert({
              project_id: inviteTargetProjectId,
              email,
              role: inviteEmailRole,
              invited_by: user.id
            })
          .select()
          .maybeSingle();

          if (projectInviteError) {
            if (projectInviteError.message?.toLowerCase().includes('row-level security')) {
              throw new Error('Tu usuario no tiene permisos para invitar a este tablero. Solo pueden invitar quienes sean owner o editor dentro del proyecto.');
            }
            throw projectInviteError;
          }

          projectInvitation = insertedProjectInvitation;
        }

        const projectToken = projectInvitation?.token;
        if (!projectToken) {
          throw new Error('No se pudo recuperar el token de invitación del tablero.');
        }

        const projectMailResponse = await fetch(invitationApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            toEmail: email,
            inviterEmail: user.email ?? '',
            inviterName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? 'Taskboard',
            token: projectToken,
            role: inviteEmailRole,
            type: 'project',
            workspaceName: 'Taskboard',
            projectName: targetProject?.name ?? ''
          })
        });

        const projectMailResult = await parseApiResponse(projectMailResponse);
        if (!projectMailResponse.ok || !projectMailResult?.success) {
          throw new Error(projectMailResult?.error || 'No se pudo enviar el correo de invitación al tablero.');
        }

        setInviteEmail('');
        setInviteWorkspaceRole('viewer');
        setInviteEmailRole('editor');
        setInviteTargetProjectId('');
        await loadPendingInvitations();
        showNotification('Invitación al tablero enviada correctamente. El acceso al workspace se resolverá al aceptar la invitación.', 'success');
        return;
      }

      const { data: workspaceInvitation, error: workspaceInviteError } = await supabase
        .from('workspace_invitations')
        .upsert(
          {
            workspace_id: workspaceId,
            email,
            role: inviteWorkspaceRole,
            invited_by: user.id
          },
          { onConflict: 'workspace_id,email' }
        )
        .select()
        .maybeSingle();

      if (workspaceInviteError) {
        if (workspaceInviteError.message?.toLowerCase().includes('row-level security')) {
          throw new Error('Tu usuario no tiene permisos para invitar al workspace. Para añadir a alguien directamente, selecciona un proyecto en "Proyecto opcional" o usa una cuenta owner/editor del workspace.');
        }
        throw workspaceInviteError;
      }

      let refreshedWorkspaceInvitation = workspaceInvitation;
      const workspaceInvitationExpired = refreshedWorkspaceInvitation?.expires_at ? new Date(refreshedWorkspaceInvitation.expires_at) <= new Date() : false;

      if (refreshedWorkspaceInvitation && (refreshedWorkspaceInvitation.accepted_at || workspaceInvitationExpired)) {
        const { error: deleteWorkspaceInvitationError } = await supabase
          .from('workspace_invitations')
          .delete()
          .eq('id', refreshedWorkspaceInvitation.id);

        if (deleteWorkspaceInvitationError) {
          throw deleteWorkspaceInvitationError;
        }

        const { data: insertedWorkspaceInvitation, error: insertedWorkspaceInvitationError } = await supabase
          .from('workspace_invitations')
          .insert({
            workspace_id: workspaceId,
            email,
            role: inviteWorkspaceRole,
            invited_by: user.id
          })
          .select()
          .maybeSingle();

        if (insertedWorkspaceInvitationError) {
          throw insertedWorkspaceInvitationError;
        }

        refreshedWorkspaceInvitation = insertedWorkspaceInvitation;
      }

      const workspaceToken = refreshedWorkspaceInvitation?.token;
      if (!workspaceToken) {
        throw new Error('No se pudo recuperar el token de invitación del workspace.');
      }

      const workspaceMailResponse = await fetch(invitationApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toEmail: email,
          inviterEmail: user.email ?? '',
          inviterName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? 'Taskboard',
          token: workspaceToken,
          role: inviteWorkspaceRole,
          type: 'workspace',
          workspaceName: 'Taskboard'
        })
      });

      const workspaceMailResult = await parseApiResponse(workspaceMailResponse);
      if (!workspaceMailResponse.ok || !workspaceMailResult?.success) {
        throw new Error(workspaceMailResult?.error || 'No se pudo enviar el correo de invitación al workspace.');
      }

      setInviteEmail('');
      setInviteWorkspaceRole('viewer');
      setInviteEmailRole('editor');
      setInviteTargetProjectId('');
      await loadPendingWorkspaceInvitations();
      showNotification('Invitación al workspace enviada correctamente.', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setInvitingEmail(false);
    }
  };

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

  const handleCancelWorkspaceInvitation = async (invitationId) => {
    try {
      const { error } = await supabase
        .from('workspace_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
      await loadPendingWorkspaceInvitations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMemberRoleUpdate = async (projectId, memberId, nextRole) => {
    setUpdatingMemberId(memberId);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('project_members')
        .update({ role: nextRole })
        .eq('project_id', projectId)
        .eq('member_id', memberId);

      if (updateError) throw updateError;
      queryClient.invalidateQueries(['projectMembers', projectId]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleMemberRemoval = async (projectId, memberId) => {
    setRemovingMemberId(memberId);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('member_id', memberId);

      if (deleteError) throw deleteError;
      queryClient.invalidateQueries(['projectMembers', projectId]);
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const renderInvitationRow = (invitation, onCancel) => {
    const expiresAt = new Date(invitation.expires_at);
    const isExpired = expiresAt < new Date();
    const daysUntilExpiry = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));

    return (
      <div
        key={invitation.id}
        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
      >
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{invitation.email}</p>
          <div className="mt-1 flex items-center gap-2">
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
          <Button size="xs" color="failure" onClick={() => onCancel(invitation.id)}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card data-testid="project-board" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Tableros disponibles</h2>
              {loadingProjects ? <Spinner size="sm" /> : null}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Selecciona un tablero para visualizar tus tareas.</p>
          </div>
          <Button onClick={handleRefresh} color="dark" disabled={loadingProjects}>Actualizar listado</Button>
        </header>

        {error ? <Alert color="failure" onDismiss={() => setError('')}>{error}</Alert> : null}

        <div className="rounded-xl border border-slate-200 bg-white/50 p-2 dark:border-slate-800 dark:bg-slate-950/30">
          <nav className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
            {[
              { id: 'projects', label: 'Tableros' },
              { id: 'create', label: 'Crear' },
              { id: 'invite', label: 'Invitar' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${activeTab === tab.id ? 'border-cyan-500/30 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300' : 'border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Seleccionar tablero</label>
                  {selectedProjectId ? (
                    <button
                      type="button"
                      onClick={() => onSelect?.(null)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Limpiar selección
                    </button>
                  ) : null}
                </div>

                {projects.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project) => {
                      const isActive = selectedProjectId === project.id;
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => onSelect?.(project.id)}
                          className={`group rounded-2xl border p-4 text-left transition-all duration-200 ${isActive
                            ? 'border-cyan-500/40 bg-gradient-to-br from-cyan-50 to-blue-50 shadow-md shadow-cyan-500/10 dark:border-cyan-400/30 dark:from-cyan-900/20 dark:to-blue-900/20'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700 dark:hover:bg-slate-800/70'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`truncate text-sm font-semibold ${isActive ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-900 dark:text-white'}`}>
                                {project.name}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                {isActive ? 'Tablero activo' : 'Haz clic para abrirlo'}
                              </p>
                            </div>
                            <span className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${isActive ? 'bg-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.15)]' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400'}`}></span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                    No hay tableros disponibles todavía.
                  </div>
                )}
              </div>

              {selectedProjectId ? (
                <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Miembros del tablero</h3>
                      <p className="text-xs text-slate-500">Gestiona roles y accesos del tablero activo.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color="info">{members.length} miembros</Badge>
                      <button
                        type="button"
                        onClick={() => setIsMembersSectionCollapsed((current) => !current)}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {isMembersSectionCollapsed ? 'Mostrar' : 'Ocultar'}
                      </button>
                    </div>
                  </div>
                  {!isMembersSectionCollapsed && (members.length > 0 ? (
                    <div className="space-y-3">
                      {members.map((member) => {
                        const isOwner = member.role === 'owner';
                        return (
                          <div key={member.member_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{member.member_email ?? member.member_id}</p>
                              <p className="text-xs text-slate-500">{member.member_id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                sizing="sm"
                                value={member.role}
                                disabled={isOwner || updatingMemberId === member.member_id}
                                onChange={(event) => handleMemberRoleUpdate(selectedProjectId, member.member_id, event.target.value)}
                              >
                                <option value="owner">Owner</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </Select>
                              <Button size="xs" color="failure" disabled={isOwner || removingMemberId === member.member_id} onClick={() => handleMemberRemoval(selectedProjectId, member.member_id)}>
                                Quitar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No hay miembros cargados para este tablero.</p>
                  ))}
                </section>
              ) : null}
            </div>
          )}

          {activeTab === 'create' && (
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleCreateProject}>
              <div className="flex-1 space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="project-name">Nombre del tablero</label>
                <TextInput id="project-name" value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Solicitudes KH" disabled={creating} />
              </div>
              <Button type="submit" color="info" disabled={creating || !workspaceId}>{creating ? 'Creando...' : 'Crear tablero'}</Button>
            </form>
          )}

          {activeTab === 'invite' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Agregar miembro existente del workspace al tablero</p>
                <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleInviteMember}>
                  <div className="flex-1 space-y-2">
                    <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Miembro del workspace</label>
                    <Select value={inviteMemberId} onChange={(event) => setInviteMemberId(event.target.value)} disabled={!selectedProjectId || inviting || availableWorkspaceMembers.length === 0}>
                      <option value="">Selecciona un miembro</option>
                      {availableWorkspaceMembers.map((member) => (
                        <option key={member.member_id} value={member.member_id}>{member.member_email} ({member.role})</option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:w-40 space-y-2">
                    <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Rol tablero</label>
                    <Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} disabled={!selectedProjectId || inviting}>
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                  </div>
                  <Button type="submit" color="light" disabled={!selectedProjectId || inviting || !inviteMemberId}>{inviting ? 'Agregando...' : 'Agregar'}</Button>
                </form>
              </section>

              <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">Invitar por correo electrónico al workspace y proyecto</p>
                <form className="grid grid-cols-1 gap-3 lg:grid-cols-5" onSubmit={handleInviteByEmail}>
                  <div className="lg:col-span-2 space-y-2">
                    <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-email">Correo electrónico</label>
                    <TextInput id="invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="usuario@ejemplo.com" disabled={invitingEmail} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-workspace-role">Rol workspace</label>
                    <Select id="invite-workspace-role" value={inviteWorkspaceRole} onChange={(event) => setInviteWorkspaceRole(event.target.value)} disabled={invitingEmail}>
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-email-role">Rol proyecto</label>
                    <Select id="invite-email-role" value={inviteEmailRole} onChange={(event) => setInviteEmailRole(event.target.value)} disabled={invitingEmail}>
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-target-project">Proyecto opcional</label>
                    <Select id="invite-target-project" value={inviteTargetProjectId} onChange={(event) => setInviteTargetProjectId(event.target.value)} disabled={invitingEmail}>
                      <option value="">Solo workspace</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="lg:col-span-5">
                    <Button type="submit" color="info" disabled={invitingEmail || !inviteEmail.trim()}>{invitingEmail ? 'Enviando...' : 'Invitar'}</Button>
                  </div>
                </form>
              </section>

              <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Invitaciones pendientes del workspace</h3>
                {loadingWorkspaceInvitations ? (
                  <p className="text-sm text-slate-500">Cargando invitaciones del workspace...</p>
                ) : pendingWorkspaceInvitations.length > 0 ? (
                  <div className="space-y-2">
                    {pendingWorkspaceInvitations.map((invitation) => renderInvitationRow(invitation, handleCancelWorkspaceInvitation))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No hay invitaciones pendientes en el workspace.</p>
                )}
              </section>

              <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Invitaciones pendientes del tablero</h3>
                {selectedProjectId ? (
                  loadingInvitations ? (
                    <p className="text-sm text-slate-500">Cargando invitaciones del tablero...</p>
                  ) : pendingInvitations.length > 0 ? (
                    <div className="space-y-2">
                      {pendingInvitations.map((invitation) => renderInvitationRow(invitation, handleCancelInvitation))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No hay invitaciones pendientes en el tablero.</p>
                  )
                ) : (
                  <p className="text-xs text-slate-500">Selecciona un tablero si quieres ver invitaciones específicas del proyecto.</p>
                )}
              </section>
            </div>
          )}
        </div>

        {notification ? (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className={`rounded-xl border px-4 py-3 shadow-lg ${notification.type === 'success' ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{notification.message}</span>
                </div>
                <button
                  type="button"
                  className="text-current/80 hover:text-current"
                  onClick={() => setNotification(null)}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}



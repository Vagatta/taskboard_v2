import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Select, TextInput, Toast } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaces, useWorkspaceMembers } from '../hooks/useSupabaseQueries';
import Skeleton from './ui/Skeleton.jsx';


// Sector de workspaces: lista espacios, permite crear nuevos e invitar gente.
export default function WorkspaceSelector({
  user,
  selectedWorkspaceId,
  onSelect,
  onWorkspacesChange,
  onWorkspaceMembersChange,
  pendingAction,
  onClearPendingAction
}) {
  const queryClient = useQueryClient();
  const { data: workspaces = [], isLoading: loadingWorkspaces, error: workspacesError } = useWorkspaces(user);

  // Fetch members for ALL workspaces efficiently? 
  // The hook useWorkspaceMembers is single-workspace, but we can stick to loading active workspace members for now
  // OR keep the "batch load" pattern but moved to a hook?
  // Current UI displays members of *active* workspace.
  // The "Invite" tab (in Project) needed *all* workspace members? No, just members of the ACTIVE workspace.
  // Wait, the previous logic loaded members for ALL loaded workspaces to calculate `membershipRole`?
  // My hook `useWorkspaces` already includes `membershipRole`!
  // So I only need to fetch members for the *selected* workspace to display in the UI.

  const { data: members = [], isLoading: loadingMembers } = useWorkspaceMembers(selectedWorkspaceId);

  // Derive active workspace members map for compatibility or display
  const activeWorkspaceMembers = members;

  // Sync with App.js (Legacy compatibility)
  // Prevent infinite loops by comparing stringified data
  useEffect(() => {
    if (workspaces) {
      onWorkspacesChange?.(workspaces);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(workspaces), onWorkspacesChange]);


  const [error, setError] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('workspaces');

  // Auto-select logic
  useEffect(() => {
    if (loadingWorkspaces) return;

    if (workspaces?.length === 0) {
      if (selectedWorkspaceId !== null) onSelect?.(null);
      return;
    }

    const exists = workspaces?.some((w) => w.id === selectedWorkspaceId);
    if (!selectedWorkspaceId || !exists) {
      if (workspaces && workspaces[0]) {
        onSelect?.(workspaces[0].id);
      }
    }
  }, [loadingWorkspaces, workspaces, selectedWorkspaceId, onSelect]);

  useEffect(() => {
    if (pendingAction === 'create-workspace') {
      setActiveTab('create');
      onClearPendingAction?.();
    }
  }, [pendingAction, onClearPendingAction]);

  // Invitation logic removed



  const handleCreateWorkspace = async (event) => {
    event.preventDefault();
    if (!user?.id) return;

    const name = newWorkspaceName.trim();
    if (!name) return;

    setCreating(true);
    setError('');

    const { data, error: createError } = await supabase
      .from('workspaces')
      .insert([{ name, owner_id: user.id }])
      .select()
      .maybeSingle();

    if (createError) {
      setError(createError.message);
      setCreating(false);
      return;
    }

    const workspace = data ?? null;
    if (workspace) {
      const { error: memberError } = await supabase.from('workspace_members').upsert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner'
      });

      if (memberError) {
        setError(memberError.message);
        setCreating(false);
        return;
      }

      setNewWorkspaceName('');
      showNotification('¡Workspace creado con éxito!', 'success');
      queryClient.invalidateQueries(['workspaces']);
      onSelect?.(workspace.id);
      setActiveTab('workspaces'); // Volver a la lista para ver el nuevo workspace
    }

    setCreating(false);
  };

  // Invitation loading logic removed

  // Invitation handlers removed

  const activeWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Espacios de trabajo</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Organiza tus tableros principales.</p>
          </div>
          <Button color="dark" onClick={() => queryClient.invalidateQueries(['workspaces'])} disabled={loadingWorkspaces} className="w-full sm:w-auto">
            {loadingWorkspaces ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </header>

        {error ? (
          <Alert color="failure" onDismiss={() => setError('')}>
            {error}
          </Alert>
        ) : null}

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-950/30 p-2 overflow-hidden">
          <div className="relative border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
            <nav className="flex items-center gap-2 overflow-x-auto pr-8 scrollbar-hide no-scrollbar">
              {[
                {
                  id: 'workspaces', label: 'Workspaces', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                    </svg>
                  )
                },
                {
                  id: 'create', label: 'Crear', icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )
                },
                {
                  id: 'invite', label: 'Invitar', disabled: !selectedWorkspaceId, icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3.75 15a2.25 2.25 0 0 1 2.25-2.25h6a2.25 2.25 0 0 1 2.25 2.25v1.5H3.75v-1.5Z" />
                    </svg>
                  )
                }
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const isDisabled = tab.disabled;
                if (isDisabled && !isActive) return null;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors flex-shrink-0 ${isActive
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
            <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white dark:from-slate-900 pointer-events-none block sm:hidden" />
          </div>

          <div className="animate-in fade-in slide-in-from-left-1 duration-300">
            {activeTab === 'workspaces' && (
              <div className="mt-4 space-y-4">
                {workspacesError && (
                  <Alert color="failure">{workspacesError.message}</Alert>
                )}

                {loadingWorkspaces ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : workspaces?.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-6 text-sm text-slate-600 dark:text-slate-400">
                    Aún no tienes workspaces. Crea uno para comenzar.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Seleccionar Workspace</label>
                      <Select value={selectedWorkspaceId ?? ''} onChange={(event) => onSelect?.(event.target.value)}>
                        {workspaces?.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name} ({workspace.membershipRole})
                          </option>
                        ))}
                      </Select>
                    </div>

                    {activeWorkspace ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 shadow-none p-4 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{activeWorkspace.name}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}

            {activeTab === 'create' && (
              <div className="mt-4 space-y-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Crear nuevo workspace</p>
                <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleCreateWorkspace}>
                  <div className="flex-1 space-y-2">
                    <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="workspace-name">
                      Nombre del workspace
                    </label>
                    <TextInput
                      id="workspace-name"
                      value={newWorkspaceName}
                      onChange={(event) => setNewWorkspaceName(event.target.value)}
                      placeholder="Equipo de producto"
                      maxLength={120}
                      disabled={creating || !user}
                    />
                  </div>
                  <Button type="submit" color="info" disabled={creating || !user} className="whitespace-nowrap">
                    {creating ? 'Creando...' : 'Crear workspace'}
                  </Button>
                </form>
              </div>
            )}

            {activeTab === 'invite' && (
              <div className="mt-4 space-y-3">
                {selectedWorkspaceId ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Invitar miembros al workspace</p>
                    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleInvite}>
                      <div className="flex-1 space-y-2">
                        <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-email-ws">
                          Invitar miembro por email
                        </label>
                        <TextInput
                          id="invite-email-ws"
                          type="email"
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          placeholder="persona@empresa.com"
                          disabled={inviting}
                        />
                      </div>
                      <div className="sm:w-48 space-y-2">
                        <label className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400" htmlFor="invite-role-ws">
                          Rol asignado
                        </label>
                        <Select
                          id="invite-role-ws"
                          value={inviteRole}
                          onChange={(event) => setInviteRole(event.target.value)}
                          disabled={inviting}
                        >
                          <option value="owner">Propietario</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Lector</option>
                        </Select>
                      </div>
                      <Button type="submit" color="light" disabled={inviting} className="sm:w-40">
                        {inviting ? 'Invitando...' : 'Invitar'}
                      </Button>
                    </form>
                    <p className="text-xs text-slate-500">
                      Si el usuario ya está registrado, se agregará directamente. Si no, recibirá una invitación por email.
                    </p>

                    {/* Lista de invitaciones pendientes */}
                    {loadingInvitations ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-slate-500">Cargando invitaciones...</p>
                      </div>
                    ) : pendingInvitations.length > 0 ? (
                      <div className="mt-6 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          Invitaciones Pendientes ({pendingInvitations.length})
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
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mt-4">No hay invitaciones pendientes.</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Selecciona primero un workspace para poder invitar miembros.</p>
                )}
              </div>
            )}
          </div>
        </div>


        {/* TOAST NOTIFICATIONS removed if notification is not defined */}
      </div>
    </Card>
  );
}







import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Select, Tabs, TabItem, TextInput } from 'flowbite-react';
import { supabase } from '../supabaseClient';

// Selector de workspaces: lista espacios, permite crear nuevos e invitar gente.
export default function WorkspaceSelector({
  user,
  selectedWorkspaceId,
  onSelect,
  onWorkspacesChange,
  onWorkspaceMembersChange
}) {
  const [workspaces, setWorkspaces] = useState([]);
  const [membersByWorkspace, setMembersByWorkspace] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [activeTab, setActiveTab] = useState('workspaces');

  const activeWorkspaceMembers = useMemo(
    () => (selectedWorkspaceId ? membersByWorkspace[selectedWorkspaceId] ?? [] : []),
    [membersByWorkspace, selectedWorkspaceId]
  );

  const syncWorkspaces = useCallback(
    (list) => {
      setWorkspaces(list);
      onWorkspacesChange?.(list);
    },
    [onWorkspacesChange]
  );

  const syncMembers = useCallback(
    (map) => {
      setMembersByWorkspace(map);
      onWorkspaceMembersChange?.(map);
    },
    [onWorkspaceMembersChange]
  );

  // Carga los workspaces donde el usuario es miembro y sus miembros asociados.
  const loadWorkspaces = useCallback(async () => {
    if (!user?.id) {
      syncWorkspaces([]);
      syncMembers({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces(id,name,owner_id,created_at)')
      .eq('user_id', user.id)
      .order('workspaces(created_at)', { ascending: true });

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    const workspaceList = (data ?? [])
      .filter((entry) => entry.workspaces)
      .map((entry) => ({
        ...entry.workspaces,
        membershipRole: entry.role
      }));

    syncWorkspaces(workspaceList);

    const workspaceIds = workspaceList.map((workspace) => workspace.id);

    if (workspaceIds.length === 0) {
      syncMembers({});
      setLoading(false);
      return;
    }

    const { data: memberRows, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role, profiles(email)')
      .in('workspace_id', workspaceIds);

    if (memberError) {
      setError((prev) => prev || memberError.message);
      setLoading(false);
      return;
    }

    const memberMap = memberRows?.reduce((acc, row) => {
      if (!acc[row.workspace_id]) {
        acc[row.workspace_id] = [];
      }

      acc[row.workspace_id].push({
        workspace_id: row.workspace_id,
        member_id: row.user_id,
        role: row.role,
        member_email: row.profiles?.email ?? row.user_id
      });
      return acc;
    }, {}) ?? {};

    syncMembers(memberMap);
    setLoading(false);
  }, [syncMembers, syncWorkspaces, user?.id]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!workspaces.length) {
      onSelect?.(null);
      return;
    }

    const exists = workspaces.some((workspace) => workspace.id === selectedWorkspaceId);
    if (!selectedWorkspaceId || !exists) {
      onSelect?.(workspaces[0].id);
    }
  }, [onSelect, selectedWorkspaceId, workspaces]);

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
      await supabase.from('workspace_members').upsert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner'
      });

      setNewWorkspaceName('');
      await loadWorkspaces();
      onSelect?.(workspace.id);
    }

    setCreating(false);
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    if (!selectedWorkspaceId || !inviteEmail.trim() || !user?.id) {
      return;
    }

    setInviting(true);
    setError('');

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id,email')
        .eq('email', inviteEmail.trim())
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile) {
        setError('No se encontró un usuario con ese email.');
        return;
      }

      const { error: upsertError } = await supabase
        .from('workspace_members')
        .upsert(
          {
            workspace_id: selectedWorkspaceId,
            user_id: profile.id,
            role: inviteRole
          },
          { onConflict: 'workspace_id,user_id' }
        );

      if (upsertError) {
        throw upsertError;
      }

      setInviteEmail('');
      setInviteRole('editor');
      await loadWorkspaces();
    } catch (inviteError) {
      if (inviteError instanceof Error) {
        setError(inviteError.message);
      }
    } finally {
      setInviting(false);
    }
  };

  const activeWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-none">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Espacios de trabajo</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Organiza proyectos por workspace e invita a tu equipo.</p>
          </div>
          <Button color="dark" onClick={loadWorkspaces} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </header>

        {error ? (
          <Alert color="failure" onDismiss={() => setError('')}>
            {error}
          </Alert>
        ) : null}

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-950/30 p-2">
          <nav className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
            {[
              {
                id: 'workspaces', label: 'Workspaces', icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                )
              },
              {
                id: 'create', label: 'Crear workspace', icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                )
              },
              {
                id: 'invite', label: 'Invitar miembros', disabled: !selectedWorkspaceId, icon: (
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

          <div className="animate-in fade-in slide-in-from-left-1 duration-300">
            {activeTab === 'workspaces' && (
              <div className="mt-4 space-y-3">
                {workspaces.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-6 text-sm text-slate-600 dark:text-slate-400">
                    Aún no tienes workspaces. Crea uno para comenzar.
                  </div>
                ) : (
                  <>
                    <Select value={selectedWorkspaceId ?? ''} onChange={(event) => onSelect?.(event.target.value)}>
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name} ({workspace.membershipRole})
                        </option>
                      ))}
                    </Select>
                    {activeWorkspace ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 shadow-none p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{activeWorkspace.name}</p>
                            <p className="text-xs text-slate-500">Owner: {activeWorkspace.owner_id}</p>
                          </div>
                          <Badge color="info">{activeWorkspaceMembers.length} miembros</Badge>
                        </div>
                        {activeWorkspaceMembers.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {activeWorkspaceMembers.map((member) => (
                              <Badge
                                key={member.member_id}
                                color={
                                  member.role === 'owner'
                                    ? 'purple'
                                    : member.role === 'editor'
                                      ? 'info'
                                      : 'gray'
                                }
                              >
                                <span className="text-xs">
                                  {member.member_email}
                                  <span className="ml-1 uppercase">({member.role})</span>
                                </span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-slate-500">No hay miembros registrados en este workspace.</p>
                        )}
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
                      El usuario debe existir en `profiles`. Puedes enviar un enlace o email externo para que se registre primero.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Selecciona primero un workspace para poder invitar miembros.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}







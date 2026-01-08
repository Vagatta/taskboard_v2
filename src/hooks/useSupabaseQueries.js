import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

// --- WORKSPACES ---

export function useWorkspaces(user) {
    return useQuery({
        queryKey: ['workspaces', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];

            // 1. Get memberships
            const { data, error: membershipError } = await supabase
                .from('workspace_members')
                .select('workspace_id, role, workspaces(id,name,owner_id,created_at)')
                .eq('user_id', user.id)
                .order('workspaces(created_at)', { ascending: true });

            if (membershipError) throw membershipError;

            // 2. Flatten structure
            const workspaceList = (data ?? [])
                .filter((entry) => entry.workspaces)
                .map((entry) => ({
                    ...entry.workspaces,
                    membershipRole: entry.role
                }));

            return workspaceList;
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

// --- WORKSPACE MEMBERS ---

export function useWorkspaceMembers(workspaceId) {
    return useQuery({
        queryKey: ['workspaceMembers', workspaceId],
        queryFn: async () => {
            if (!workspaceId) return [];

            // Use the new secure RPC if available, or fallback to direct query if you prefer consistency
            // Using RPC as per recent fix
            const { data, error } = await supabase
                .rpc('get_workspace_members_and_profiles', { p_workspace_ids: [workspaceId] });

            if (error) throw error;

            // Map to consistent format
            return data.map(row => ({
                workspace_id: row.workspace_id,
                member_id: row.user_id,
                role: row.role,
                member_email: row.email ?? row.user_id
            }));
        },
        enabled: !!workspaceId,
        staleTime: 1000 * 60 * 5,
    });
}

// --- PROJECTS ---

export function useProjects(workspaceId) {
    return useQuery({
        queryKey: ['projects', workspaceId],
        queryFn: async () => {
            if (!workspaceId) return [];

            const { data, error } = await supabase
                .from('projects')
                .select('id,name,user_id,owner_email,inserted_at,workspace_id')
                .eq('workspace_id', workspaceId)
                .order('inserted_at', { ascending: true });

            if (error) {
                // Fallback for simple query if owner_email missing (legacy support)
                if (error.code === '42703') {
                    const { data: fallbackData, error: fallbackError } = await supabase
                        .from('projects')
                        .select('id,name,user_id,inserted_at,workspace_id')
                        .eq('workspace_id', workspaceId)
                        .order('inserted_at', { ascending: true });

                    if (fallbackError) throw fallbackError;
                    return fallbackData ?? [];
                }
                throw error;
            }

            return data ?? [];
        },
        enabled: !!workspaceId,
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
}

// --- PROJECT MEMBERS ---

export function useProjectMembers(projectId) {
    return useQuery({
        queryKey: ['projectMembers', projectId],
        queryFn: async () => {
            if (!projectId) return [];

            const { data, error } = await supabase
                .from('project_members')
                .select('id,project_id,member_id,member_email,role')
                .eq('project_id', projectId);

            if (error) {
                if (error.code === '42P01') return []; // Table doesn't exist yet?
                throw error;
            }

            return data ?? [];
        },
        enabled: !!projectId,
        staleTime: 1000 * 60 * 2,
    });
}

// --- GLOBAL STATS ---

export function useUserGlobalStats(user) {
    return useQuery({
        queryKey: ['globalStats', user?.id],
        queryFn: async () => {
            if (!user?.id) return { workspaces: 0, projects: 0, tasks: 0, completed: 0, collaborators: 0 };

            // 1. Conteo de workspaces
            const { count: wsCount } = await supabase
                .from('workspace_members')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            // 2. Conteo de proyectos
            const { count: prjCount } = await supabase
                .from('project_members')
                .select('*', { count: 'exact', head: true })
                .eq('member_id', user.id);

            // 3. Tareas asignadas
            const { count: taskCount } = await supabase
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', user.id);

            // 4. Tareas completadas
            const { count: completedCount } = await supabase
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', user.id)
                .eq('completed', true);

            // 5. Colaboradores únicos
            let collaboratorsCount = 0;
            const { data: myProjects } = await supabase
                .from('project_members')
                .select('project_id')
                .eq('member_id', user.id);

            const projectIds = myProjects?.map(p => p.project_id) ?? [];
            if (projectIds.length > 0) {
                const { data: collabData } = await supabase
                    .from('project_members')
                    .select('member_id')
                    .in('project_id', projectIds);
                const uniqueIds = new Set(collabData?.map(c => c.member_id));
                collaboratorsCount = Math.max(0, uniqueIds.size - 1); // Restamos al usuario mismo
            }

            return {
                workspaces: wsCount ?? 0,
                projects: prjCount ?? 0,
                tasks: taskCount ?? 0,
                completed: completedCount ?? 0,
                collaborators: collaboratorsCount
            };
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5, // 5 minutos
    });
}

import TaskList from '../TaskList';
import ProjectSelector from './ProjectSelector';

// Panel de tableros: lista tableros y, al seleccionar uno, muestra su detalle + tareas.
export default function ProjectsManagementPanel({
  user,
  selectedWorkspaceId,
  selectedProjectId,
  selectedProject,
  selectedProjectMembers,
  projects,
  onProjectSelect,
  onProjectsChange,
  onProjectMembersChange,
  workspaceMembers,
  taskListRef,
  onTaskSummaryChange,
  assigneePreset,
  initialTaskId
}) {
  const createdAt = selectedProject?.inserted_at ? new Date(selectedProject.inserted_at) : null;

  return (
    <div className="space-y-6">
      <ProjectSelector
        user={user}
        workspaceId={selectedWorkspaceId}
        selectedProjectId={selectedProjectId}
        onSelect={onProjectSelect}
        onProjectsChange={onProjectsChange}
        onProjectMembersChange={onProjectMembersChange}
        workspaceMembers={workspaceMembers}
      />

      {projects.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-8 text-center text-sm text-slate-600 dark:text-slate-400"
          aria-live="polite"
        >
          Crea tu primer tablero para gestionar tareas.
        </div>
      ) : selectedProjectId && selectedProject ? (
        <div className="space-y-4">
          {/* Cabecera del tablero */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 backdrop-blur-sm p-5 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Tablero activo</p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedProject.name}</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                {createdAt && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    Creado {createdAt.toLocaleDateString('es-ES')}
                  </span>
                )}
                {selectedProject.due_date && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-3 py-1 font-medium">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Finalización: {new Date(selectedProject.due_date).toLocaleDateString('es-ES')}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-slate-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  Gestionado por ti
                </span>
              </div>
            </div>
          </div>

          {/* TaskList */}
          <TaskList
            ref={taskListRef}
            user={user}
            workspaceId={selectedWorkspaceId}
            projectId={selectedProjectId}
            project={selectedProject}
            members={selectedProjectMembers}
            assigneePreset={assigneePreset}
            initialTaskId={initialTaskId}
            onTaskSummaryChange={onTaskSummaryChange}
            defaultViewMode="list"
          />
        </div>
      ) : null}
    </div>
  );
}







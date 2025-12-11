import ProjectSelector from './ProjectSelector';

// Panel de proyectos: se encarga de listar y seleccionar proyectos dentro del workspace activo.
export default function ProjectsManagementPanel({
  user,
  selectedWorkspaceId,
  selectedProjectId,
  projects,
  onProjectSelect,
  onProjectsChange,
  onProjectMembersChange
}) {
  return (
    <div className="space-y-6">
      {!selectedWorkspaceId ? (
        <div
          className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-8 text-center text-sm text-slate-600 dark:text-slate-400"
          aria-live="polite"
        >
          Selecciona un workspace para gestionar proyectos.
        </div>
      ) : (
        <>
          <ProjectSelector
            user={user}
            workspaceId={selectedWorkspaceId}
            selectedProjectId={selectedProjectId}
            onSelect={onProjectSelect}
            onProjectsChange={onProjectsChange}
            onProjectMembersChange={onProjectMembersChange}
          />
          {projects.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-8 text-center text-sm text-slate-600 dark:text-slate-400"
              aria-live="polite"
            >
              Crea tu primer proyecto para gestionar tareas.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}







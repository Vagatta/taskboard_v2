import TaskList from '../TaskList';

// Panel que conecta workspace/proyecto seleccionados con la vista principal de tareas.
export default function TasksManagementPanel({
  user,
  selectedWorkspaceId,
  selectedProjectId,
  selectedProject,
  selectedProjectMembers,
  projects,
  taskListRef,
  onViewModeChange,
  onTaskSummaryChange,
  assigneePreset = null
}) {
  return (
    <div className="space-y-6">
      {!selectedWorkspaceId ? (
        <div
          className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400"
          aria-live="polite"
        >
          Selecciona un workspace para ver tareas.
        </div>
      ) : projects.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400"
          aria-live="polite"
        >
          Crea un proyecto antes de gestionar tareas.
        </div>
      ) : selectedProjectId && selectedProject ? (
        <TaskList
          ref={taskListRef}
          user={user}
          workspaceId={selectedWorkspaceId}
          projectId={selectedProjectId}
          project={selectedProject}
          members={selectedProjectMembers}
          assigneePreset={assigneePreset}
          onViewModeChange={onViewModeChange}
          onTaskSummaryChange={onTaskSummaryChange}
        />
      ) : (
        <div
          className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400"
          aria-live="polite"
        >
          Selecciona un proyecto para ver sus tareas.
        </div>
      )}
    </div>
  );
}

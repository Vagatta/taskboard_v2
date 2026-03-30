import { useEffect, useMemo, useState } from 'react';
import TaskList from '../TaskList';
import ProjectSelector from './ProjectSelector';
import { supabase } from '../supabaseClient';

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
  const [timelineTasks, setTimelineTasks] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineStartIndex, setTimelineStartIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadTimelineTasks = async () => {
      if (!selectedProjectId) {
        if (isMounted) {
          setTimelineTasks([]);
          setTimelineLoading(false);
        }
        return;
      }

      setTimelineLoading(true);

      const { data, error } = await supabase
        .from('tasks')
        .select('id,title,completed,completed_at,inserted_at,due_date,priority,assigned_to,updated_at')
        .eq('project_id', selectedProjectId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('inserted_at', { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        setTimelineTasks([]);
      } else {
        setTimelineTasks(data ?? []);
      }

      setTimelineLoading(false);
    };

    void loadTimelineTasks();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  const timelineItems = useMemo(() => {
    const formatDate = (value) => {
      if (!value) return 'Sin fecha';
      return new Date(value).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    };

    return timelineTasks
      .filter((task) => !task.completed)
      .map((task) => {
        const referenceDate = task.due_date ?? task.inserted_at ?? task.updated_at ?? null;
        const referenceTimestamp = referenceDate ? new Date(referenceDate).getTime() : Number.POSITIVE_INFINITY;
        const assignedMember = selectedProjectMembers.find((member) => member.member_id === task.assigned_to);
        const isOverdue = Boolean(task.due_date && !task.completed && new Date(task.due_date).getTime() < Date.now());

        return {
          id: task.id,
          title: isOverdue ? 'Vencida' : task.due_date ? 'Próxima tarea' : 'Tarea creada',
          description: task.title,
          meta: [
            referenceDate ? formatDate(referenceDate) : null,
            task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baja' : 'Media',
            assignedMember?.member_email ?? (task.assigned_to ? 'Asignada' : 'Sin asignar')
          ].filter(Boolean).join(' · '),
          tone: isOverdue ? 'warning' : task.priority === 'high' ? 'active' : 'default',
          dateLabel: referenceDate ? formatDate(referenceDate) : 'Sin fecha',
          sortTimestamp: referenceTimestamp,
          isOverdue
        };
      })
      .sort((first, second) => {
        return first.sortTimestamp - second.sortTimestamp;
      })
      .slice(0, 24);
  }, [selectedProjectMembers, timelineTasks]);

  const visibleTimelineCount = 5;

  useEffect(() => {
    if (!timelineItems.length) {
      setTimelineStartIndex(0);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const firstCurrentOrFutureIndex = timelineItems.findIndex((item) => item.sortTimestamp >= todayTimestamp);
    const nextIndex = firstCurrentOrFutureIndex >= 0
      ? firstCurrentOrFutureIndex
      : Math.max(timelineItems.length - visibleTimelineCount, 0);

    setTimelineStartIndex(nextIndex);
  }, [selectedProjectId, timelineItems]);

  const visibleTimelineItems = useMemo(
    () => timelineItems.slice(timelineStartIndex, timelineStartIndex + visibleTimelineCount),
    [timelineItems, timelineStartIndex]
  );

  const canGoBackTimeline = timelineStartIndex > 0;
  const canGoForwardTimeline = timelineStartIndex + visibleTimelineCount < timelineItems.length;
  const overdueCount = timelineItems.filter((item) => item.isOverdue).length;
  const upcomingCount = timelineItems.filter((item) => !item.isOverdue).length;

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

      {selectedProjectId && selectedProject ? (
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
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-slate-400">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                Gestionado por ti
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/40 backdrop-blur-xl shadow-lg shadow-slate-200/20 dark:shadow-black/20 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Timeline</p>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Línea temporal de tareas</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Visualiza las tareas del tablero en una línea horizontal desplazable según su fecha.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{timelineLoading ? 'Cargando tareas...' : `${timelineItems.length} tareas visibles`}</span>
              <button
                type="button"
                onClick={() => setTimelineStartIndex((previous) => Math.max(previous - visibleTimelineCount, 0))}
                disabled={!canGoBackTimeline}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${canGoBackTimeline
                  ? 'border-slate-200 bg-white/50 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300'
                  : 'border-slate-200/60 bg-slate-100/60 text-slate-300 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-600 cursor-not-allowed'
                  }`}
              >
                {`← Vencidas (${overdueCount})`}
              </button>
              <button
                type="button"
                onClick={() => setTimelineStartIndex((previous) => Math.min(previous + visibleTimelineCount, Math.max(timelineItems.length - visibleTimelineCount, 0)))}
                disabled={!canGoForwardTimeline}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${canGoForwardTimeline
                  ? 'border-cyan-500/30 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                  : 'border-slate-200/60 bg-slate-100/60 text-slate-300 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-600 cursor-not-allowed'
                  }`}
              >
                {`Pendientes (${upcomingCount}) →`}
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex min-w-max items-stretch gap-3">
              {visibleTimelineItems.map((item) => {
                const isActive = item.tone === 'active';
                const isWarning = item.tone === 'warning';
                const isSuccess = item.tone === 'success';

                const cardClass = isActive
                  ? 'border-cyan-500/30 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                  : isWarning
                    ? 'border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                    : isSuccess
                      ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 bg-white/50 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300';

                const chipClass = isActive
                  ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                  : isWarning
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : isSuccess
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className={`flex min-h-[150px] w-[280px] flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${cardClass}`}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${chipClass}`}>
                            {item.title}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">{item.dateLabel}</span>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">{item.description}</h4>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{item.meta}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{isSuccess ? 'Hecha' : isWarning ? 'Vencida' : isActive ? 'Prioritaria' : 'Planificada'}</span>
                        <span>{item.dateLabel}</span>
                      </div>
                    </div>

                    <div className="flex h-full items-center">
                      <div className="h-px w-10 bg-slate-200 dark:bg-slate-800" />
                    </div>
                  </div>
                );
              })}

              {!timelineLoading && visibleTimelineItems.length === 0 ? (
                <div className="flex min-h-[150px] w-[280px] flex-col justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
                  No hay tareas suficientes con fechas o actividad para mostrar la timeline.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {projects.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-8 text-center text-sm text-slate-600 dark:text-slate-400"
          aria-live="polite"
        >
          Crea tu primer tablero para gestionar tareas.
        </div>
      ) : selectedProjectId && selectedProject ? (
        <div className="space-y-4">
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







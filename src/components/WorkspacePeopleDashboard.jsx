import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Select, Spinner } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import { formatRelativeTime } from '../utils/dateHelpers';

// Dashboard simple para ver tareas por persona dentro del workspace actual.
export default function WorkspacePeopleDashboard({ workspaceId, workspaceMembers = {}, onPersonClick }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');

  const workspaceMemberList = workspaceId ? workspaceMembers[workspaceId] ?? [] : [];

  useEffect(() => {
    const load = async () => {
      if (!workspaceId) {
        setTasks([]);
        return;
      }

      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('tasks')
        .select(
          'id,title,assigned_to,completed,due_date,priority,project_id,updated_at,projects!inner(id,name,workspace_id)'
        )
        .eq('projects.workspace_id', workspaceId);

      if (queryError) {
        setError(queryError.message);
        setTasks([]);
      } else {
        setTasks(data ?? []);
      }

      setLoading(false);
    };

    void load();
  }, [workspaceId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (projectFilter !== 'all') {
        const taskProjectId = task.project_id != null ? String(task.project_id) : '';
        if (taskProjectId !== String(projectFilter)) return false;
      }

      if (statusFilter === 'pending' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;

      return true;
    });
  }, [tasks, projectFilter, statusFilter]);

  const people = useMemo(() => {
    const byPerson = new Map();

    for (const task of filteredTasks) {
      const personId = task.assigned_to || '__unassigned__';
      if (!byPerson.has(personId)) {
        byPerson.set(personId, []);
      }
      byPerson.get(personId).push(task);
    }

    const projectById = tasks.reduce((acc, task) => {
      const project = task.projects;
      if (project && !acc[project.id]) {
        acc[project.id] = { id: project.id, name: project.name ?? project.id };
      }
      return acc;
    }, {});

    return Array.from(byPerson.entries()).map(([personId, list]) => {
      const member = personId === '__unassigned__'
        ? null
        : workspaceMemberList.find((m) => m.member_id === personId);
      const label = personId === '__unassigned__' ? 'Sin responsable' : (member?.member_email ?? personId);
      const pending = list.filter((task) => !task.completed).length;
      const completed = list.filter((task) => task.completed).length;

      const tasksForPerson = list
        .slice()
        .sort((a, b) => {
          const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
          const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
          return aDue - bDue;
        });

      return {
        personId,
        label,
        pending,
        completed,
        total: list.length,
        tasks: tasksForPerson,
        projectById
      };
    });
  }, [filteredTasks, tasks, workspaceMemberList]);

  const projectsForFilter = useMemo(() => {
    const byId = new Map();

    for (const task of tasks) {
      const project = task.projects;
      if (!project) continue;

      if (!byId.has(project.id)) {
        byId.set(project.id, { id: project.id, name: project.name ?? project.id });
      }
    }

    return Array.from(byId.values());
  }, [tasks]);

  if (!workspaceId) {
    return (
      <Card className="border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 shadow-none">
        <p className="text-sm text-slate-600 dark:text-slate-400">Selecciona un workspace para ver la carga de tareas por persona.</p>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 shadow-none">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Colaboradores</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">Tareas por persona en el workspace</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Estado</span>
              <Select
                sizing="sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-36"
              >
                <option value="pending">Pendientes</option>
                <option value="completed">Completadas</option>
                <option value="all">Todas</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span>Proyecto</span>
              <Select
                sizing="sm"
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="w-44"
              >
                <option value="all">Todos</option>
                {projectsForFilter.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {error ? (
          <Alert color="failure">{error}</Alert>
        ) : loading ? (
          <div className="flex items-center justify-center py-10 text-slate-600 dark:text-slate-400">
            <Spinner size="lg" />
            <span className="ml-3 text-sm">Cargando tareas del workspace…</span>
          </div>
        ) : people.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-6 text-sm text-slate-600 dark:text-slate-400">
            No hay tareas asignadas a personas en este workspace con los filtros actuales.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {people.map((person) => (
              <Card
                key={person.personId}
                className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 transition hover:border-cyan-500/60 hover:bg-slate-50 dark:hover:bg-slate-900/80 cursor-pointer"
                onClick={() => {
                  if (onPersonClick) {
                    onPersonClick(person.personId === '__unassigned__' ? null : person.personId);
                  }
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{person.label}</p>
                      <p className="text-xs text-slate-500">ID: {person.personId}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-700 dark:text-amber-200">
                        Pend: {person.pending}
                      </span>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-700 dark:text-emerald-200">
                        Comp: {person.completed}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300">
                    {person.tasks.slice(0, 5).map((task) => {
                      const project = person.projectById[task.project_id];
                      const projectLabel = project?.name ?? task.project_id ?? 'Sin proyecto';
                      const dueDate = task.due_date ? new Date(task.due_date) : null;
                      const dueLabel = dueDate
                        ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(dueDate)
                        : 'Sin fecha';

                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-2 py-1"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] text-slate-900 dark:text-white">{task.title}</p>
                            <p className="truncate text-[11px] text-slate-500">{projectLabel}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                            <span
                              className={
                                dueDate && !task.completed && dueDate.getTime() < Date.now()
                                  ? 'text-rose-200 font-semibold'
                                  : undefined
                              }
                            >
                              {dueLabel}
                            </span>
                            {task.updated_at ? (
                              <span>{formatRelativeTime(new Date(task.updated_at))}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {person.tasks.length > 5 ? (
                      <p className="text-[11px] text-slate-500">+{person.tasks.length - 5} tareas más</p>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}







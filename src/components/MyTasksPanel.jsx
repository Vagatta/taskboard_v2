import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Card, Select, Spinner, Tabs, TabItem } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import { formatRelativeTime } from '../utils/dateHelpers';

// Panel sencillo para ver todas las tareas asignadas al usuario en todos los proyectos.
export default function MyTasksPanel({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [projectFilter, setProjectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const userId = user?.id ?? null;

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setTasks([]);
        return;
      }

      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('tasks')
        .select(
          'id,title,project_id,assigned_to,completed,completed_at,inserted_at,due_date,priority,projects!inner(id,name,workspace_id)'
        )
        .eq('assigned_to', userId)
        .order('due_date', { ascending: true })
        .order('inserted_at', { ascending: false });

      if (queryError) {
        setError(queryError.message);
        setTasks([]);
      } else {
        setTasks(data ?? []);
      }

      setLoading(false);
    };

    void load();
  }, [userId]);

  const projects = useMemo(() => {
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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter === 'pending' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;

      if (projectFilter !== 'all') {
        const taskProjectId = task.project_id != null ? String(task.project_id) : '';
        if (taskProjectId !== String(projectFilter)) return false;
      }

      if (priorityFilter !== 'all') {
        const priority = task.priority ?? 'medium';
        if (priority !== priorityFilter) return false;
      }

      return true;
    });
  }, [tasks, statusFilter, projectFilter, priorityFilter]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((task) => task.completed).length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [filteredTasks]);

  return (
    <div className="space-y-4">
      <Card className="border border-slate-800 bg-slate-950/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Resumen personal</p>
            <p className="text-lg font-semibold text-white">Mis tareas abiertas</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Total</p>
              <p className="text-base font-semibold text-white">{stats.total}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Pendientes</p>
              <p className="text-base font-semibold text-amber-200">{stats.pending}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Completadas</p>
              <p className="text-base font-semibold text-emerald-300">{stats.completed}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-800 bg-slate-950/60">
        <Tabs aria-label="Filtros de mis tareas" variant="underline" className="w-full">
          <TabItem title="Lista" active>
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Estado</span>
                  <Select
                    sizing="sm"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="w-36"
                  >
                    <option value="all">Todas</option>
                    <option value="pending">Pendientes</option>
                    <option value="completed">Completadas</option>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span>Prioridad</span>
                  <Select
                    sizing="sm"
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                    className="w-36"
                  >
                    <option value="all">Todas</option>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
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
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {error ? (
                <Alert color="failure">{error}</Alert>
              ) : loading ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <Spinner size="lg" />
                  <span className="ml-3 text-sm">Cargando tus tareas…</span>
                </div>
              ) : filteredTasks.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                  No hay tareas que coincidan con los filtros actuales.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/40">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-slate-100">
                      <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3 text-left">Tarea</th>
                          <th className="px-4 py-3 text-left">Proyecto</th>
                          <th className="px-4 py-3 text-left">Prioridad</th>
                          <th className="px-4 py-3 text-left">Estado</th>
                          <th className="px-4 py-3 text-left">Vencimiento</th>
                          <th className="px-4 py-3 text-left">Última actualización</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.map((task) => {
                          const project = task.projects;
                          const projectLabel = project?.name ?? task.project_id ?? 'Sin proyecto';
                          const priority = task.priority ?? 'medium';
                          const dueDate = task.due_date ? new Date(task.due_date) : null;
                          const dueLabel = dueDate ? new Intl.DateTimeFormat('es-ES').format(dueDate) : 'Sin fecha';
                          const updatedLabel = task.updated_at
                            ? formatRelativeTime(new Date(task.updated_at))
                            : task.inserted_at
                              ? formatRelativeTime(new Date(task.inserted_at))
                              : 'Sin registro';

                          return (
                            <tr key={task.id} className="border-b border-slate-900/40 hover:bg-slate-900/60">
                              <td className="px-4 py-3">
                                <p className={`font-semibold ${task.completed ? 'text-slate-400 line-through' : 'text-white'}`}>
                                  {task.title}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-slate-300">{projectLabel}</td>
                              <td className="px-4 py-3">
                                <Badge
                                  color={
                                    priority === 'high'
                                      ? 'failure'
                                      : priority === 'low'
                                        ? 'success'
                                        : 'warning'
                                  }
                                >
                                  {priority === 'high' ? 'Alta' : priority === 'low' ? 'Baja' : 'Media'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Badge color={task.completed ? 'success' : 'warning'}>
                                  {task.completed ? 'Completada' : 'Pendiente'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <span className={
                                  dueDate && !task.completed && dueDate.getTime() < Date.now()
                                    ? 'text-rose-200 font-semibold'
                                    : 'text-slate-300'
                                }>
                                  {dueLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-400">{updatedLabel}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </TabItem>
        </Tabs>
      </Card>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Dropdown, Select } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import Skeleton from './ui/Skeleton';

export default function MyTasksPanel({
  user,
  projects = [],
  workspaces = [],
  setSelectedProjectId,
  setActiveManagementTab,
  setActivePrimaryView,
  pendingAction,
  onClearPendingAction
}) {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [statusFilter, setStatusFilter] = useState('pending');
  const [projectFilter, setProjectFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    if (pendingAction === 'create-task') {
      setIsAddingTask(true);
      if (onClearPendingAction) onClearPendingAction();
    }
  }, [pendingAction, onClearPendingAction]);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskEffort, setNewTaskEffort] = useState('m');

  const userId = user?.id ?? null;

  const [projectsList, setProjectsList] = useState(projects);

  useEffect(() => {
    setProjectsList(projects);
  }, [projects]);

  const loadAllUserProjects = useCallback(async () => {
    if (!userId) return;
    try {
      // 1. Obtener IDs de tableros donde el usuario es miembro
      const { data: memberships, error: memError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('member_id', userId);

      if (memError) throw memError;

      const pIds = memberships?.map(m => m.project_id) || [];
      if (pIds.length === 0) {
        setProjectsList([]);
        return;
      }

      // 2. Obtener detalles de esos tableros
      const { data, error: projError } = await supabase
        .from('projects')
        .select('id, name, workspace_id, workspaces(name)')
        .in('id', pIds);

      if (projError) throw projError;

      const uniqueProjs = data ? Array.from(new Map(data.map(p => [p.id, p])).values()) : [];
      setProjectsList(uniqueProjs);

    } catch (err) {
      console.error('Error fetching projects in MyTasksPanel:', err);
    }
  }, [userId]);

  useEffect(() => {
    if (projects.length === 0 && userId) {
      void loadAllUserProjects();
    }
  }, [projects.length, userId, loadAllUserProjects]);

  const loadTasks = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          project_id,
          assigned_to,
          completed,
          completed_at,
          inserted_at,
          updated_at,
          due_date,
          priority,
          projects(id, name, workspace_id)
        `)
        .eq('assigned_to', userId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('inserted_at', { ascending: false });

      if (queryError) throw queryError;
      setTasks(data ?? []);
    } catch (err) {
      setError(err.message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filtro de Estado
      if (statusFilter === 'pending' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;

      // Filtro de Tablero
      if (projectFilter !== 'all') {
        if (projectFilter === 'none') {
          if (task.project_id) return false;
        } else if (task.project_id !== projectFilter) {
          return false;
        }
      }

      // Filtro de Fecha
      if (dateFilter !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDate = task.due_date ? new Date(task.due_date) : null;

        if (dateFilter === 'today') {
          if (!taskDate || taskDate.getTime() !== today.getTime()) return false;
        } else if (dateFilter === 'overdue') {
          if (!taskDate || taskDate.getTime() >= today.getTime() || task.completed) return false;
        } else if (dateFilter === 'none') {
          if (taskDate) return false;
        }
      }

      return true;
    });
  }, [tasks, statusFilter, projectFilter, dateFilter]);

  const sections = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const groups = [
      { id: 'recent', title: 'Asignadas recientemente', tasks: [] },
      { id: 'today', title: 'Para hoy', tasks: [] },
      { id: 'upcoming', title: 'Próximamente', tasks: [] },
      { id: 'later', title: 'Más tarde', tasks: [] }
    ];

    const recentThreshold = new Date();
    recentThreshold.setHours(recentThreshold.getHours() - 48);

    filteredTasks.forEach(task => {
      const insertedAt = new Date(task.inserted_at);
      const dueDate = task.due_date ? new Date(task.due_date) : null;

      if (insertedAt > recentThreshold && !task.completed) {
        groups[0].tasks.push(task);
      } else if (dueDate && dueDate >= today && dueDate < tomorrow) {
        groups[1].tasks.push(task);
      } else if (dueDate && dueDate >= tomorrow) {
        groups[2].tasks.push(task);
      } else {
        groups[3].tasks.push(task);
      }
    });

    return groups.filter(g => g.tasks.length > 0 || g.id === 'later');
  }, [filteredTasks]);

  const handleAddTask = async (e) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim() || !userId) return;

    try {
      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert([{
          title: newTaskTitle.trim(),
          assigned_to: userId,
          created_by: userId,
          updated_by: userId,
          priority: newTaskPriority,
          effort: newTaskEffort,
          due_date: newTaskDueDate,
          inserted_at: new Date().toISOString()
        }])
        .select(`
          id, title, project_id, assigned_to, completed, completed_at, 
          inserted_at, updated_at, due_date, priority, 
          projects(id, name, workspace_id)
        `)
        .single();

      if (insertError) throw insertError;
      setTasks(prev => [data, ...prev]);
      setNewTaskTitle('');
      setNewTaskDueDate(new Date().toISOString().split('T')[0]);
      setNewTaskPriority('medium');
      setNewTaskEffort('m');
      setIsAddingTask(false);
      queryClient.invalidateQueries(['globalStats', userId]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          completed: !task.completed,
          completed_at: !task.completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (updateError) throw updateError;
      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : null
      } : t));
      queryClient.invalidateQueries(['globalStats', userId]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateTaskTitle = async (taskId, title) => {
    if (!title.trim()) return;
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ title: title.trim(), updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (updateError) throw updateError;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: title.trim() } : t));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateDueDate = async (taskId, dueDate) => {
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          due_date: dueDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (updateError) throw updateError;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: dueDate } : t));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAssignToProject = async (taskId, projectId) => {
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ project_id: projectId, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (updateError) throw updateError;

      queryClient.invalidateQueries(['globalStats', userId]);

      const projectObj = projectsList.find(p => p.id === projectId);
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        project_id: projectId,
        projects: projectObj ? { id: projectObj.id, name: projectObj.name } : null
      } : t));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateAndAssignProject = async (taskId, projectName) => {
    if (!projectName.trim() || !userId) return;
    try {
      const workspaceId = workspaces[0]?.id;
      if (!workspaceId) throw new Error('No se encontró un espacio de trabajo activo.');

      const { data: newProj, error: createError } = await supabase
        .from('projects')
        .insert({
          name: projectName,
          workspace_id: workspaceId,
          user_id: userId
        })
        .select()
        .single();

      if (createError) throw createError;
      queryClient.invalidateQueries(['projects', workspaceId]);
      queryClient.invalidateQueries(['globalStats', userId]);

      await supabase.from('project_members').insert({
        project_id: newProj.id,
        member_id: userId,
        role: 'owner'
      });

      await handleAssignToProject(taskId, newProj.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;
    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (deleteError) throw deleteError;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      queryClient.invalidateQueries(['globalStats', userId]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Mis tareas</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 border-0 transition-all hover:scale-105 active:scale-95"
            onClick={() => setIsAddingTask(true)}
          >
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                <path d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="font-semibold">Nueva Tarea</span>
            </div>
          </Button>
        </div>
      </div>

      {error && (
        <Alert color="failure" onDismiss={() => setError('')} className="mx-1">
          {error}
        </Alert>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</span>
          <Select
            sizing="sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-32"
          >
            <option value="pending">Pendientes</option>
            <option value="completed">Completadas</option>
            <option value="all">Todas</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tablero</span>
          <Select
            sizing="sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-40"
          >
            <option value="all">Todos los tableros</option>
            <option value="none">Sin tablero</option>
            {projectsList.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha</span>
          <Select
            sizing="sm"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-32"
          >
            <option value="all">Cualquier fecha</option>
            <option value="today">Para hoy</option>
            <option value="overdue">Atrasadas</option>
            <option value="none">Sin fecha</option>
          </Select>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {loading && tasks.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800 py-2 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <div className="col-span-1"></div>
              <div className="col-span-5">Nombre</div>
              <div className="col-span-2">Fecha de entrega</div>
              <div className="col-span-3">Tableros</div>
              <div className="col-span-1"></div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {sections.map(section => (
                <div key={section.id}>
                  <div className="flex items-center gap-2 py-2 px-4 bg-slate-50/50 dark:bg-slate-950/10 group cursor-pointer border-t border-slate-100 dark:border-slate-800/50 first:border-t-0">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{section.title}</span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {section.tasks.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        projects={projectsList}
                        onToggle={() => handleToggleTask(task)}
                        onUpdateTitle={(title) => handleUpdateTaskTitle(task.id, title)}
                        onAssignProject={(pid) => handleAssignToProject(task.id, pid)}
                        onCreateProject={(name) => handleCreateAndAssignProject(task.id, name)}
                        onUpdateDueDate={(date) => handleUpdateDueDate(task.id, date)}
                        onDelete={() => handleDeleteTask(task.id)}
                      />
                    ))}

                    <div className="grid grid-cols-12 py-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-800/20 group transition-all cursor-text" onClick={() => document.getElementById(`inline-add-${section.id}`)?.focus()}>
                      <div className="col-span-1 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                        <div className="h-5 w-5 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3">
                            <path d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </div>
                      </div>
                      <div className="col-span-11 pl-1">
                        <input
                          id={`inline-add-${section.id}`}
                          type="text"
                          placeholder="Escribe para agregar tarea..."
                          className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 group-hover:placeholder:text-slate-500 text-slate-700 dark:text-slate-200 transition-colors"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (e.target.value.trim()) {
                                setNewTaskTitle(e.target.value);
                                // Hack: wait for state to update (batched in React 18, but explicit variable helps)
                                // Better: call function with title
                                const title = e.target.value;
                                e.target.value = ''; // Clear immediately
                                const addTaskWithTitle = async () => {
                                  if (!title.trim() || !userId) return;
                                  try {
                                    const { data, error: insertError } = await supabase.from('tasks').insert([{
                                      title: title.trim(),
                                      assigned_to: userId,
                                      created_by: userId,
                                      updated_by: userId,
                                      priority: 'medium',
                                      inserted_at: new Date().toISOString()
                                    }]).select(`
                                       id, title, project_id, assigned_to, completed, completed_at, 
                                       inserted_at, updated_at, due_date, priority, 
                                       projects(id, name, workspace_id)
                                     `).single();
                                    if (insertError) throw insertError;
                                    setTasks(prev => [data, ...prev]);
                                    queryClient.invalidateQueries(['globalStats', userId]);
                                  } catch (err) { setError(err.message); }
                                };
                                addTaskWithTitle();
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isAddingTask && (
        <div className="fixed inset-0 z-50 flex items-start pt-32 justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl border-0 overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/10 scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="p-1.5 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 rounded-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
                    <path d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                Nueva tarea rápida
              </h2>
              <button
                onClick={() => setIsAddingTask(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-6">
              <div>
                <input
                  type="text"
                  placeholder="¿Qué hay que hacer?"
                  className="w-full text-lg font-medium border-0 border-b-2 border-slate-200 dark:border-slate-800 bg-transparent py-2 px-0 focus:ring-0 focus:border-cyan-500 placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Fecha de entrega</label>
                  <input
                    type="date"
                    className="w-full text-xs border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 transition-all"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Esfuerzo (Peso)</label>
                  <Select
                    value={newTaskEffort}
                    onChange={(e) => setNewTaskEffort(e.target.value)}
                    className="w-full text-xs"
                    sizing="sm"
                  >
                    <option value="s">S (Pequeño)</option>
                    <option value="m">M (Medio)</option>
                    <option value="l">L (Grande)</option>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Prioridad</label>
                  <Select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full text-xs"
                    sizing="sm"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                      <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    Asignada a mí
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button color="light" className="flex-1 sm:flex-none border-0 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setIsAddingTask(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 sm:flex-none bg-gradient-to-r from-cyan-600 to-blue-600 border-0 hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                    type="submit"
                  >
                    Crear tarea
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  projects,
  onToggle,
  onUpdateTitle,
  onAssignProject,
  onCreateProject,
  onUpdateDueDate,
  onDelete
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [projectSearch, setProjectSearch] = useState('');
  const [localDueDate, setLocalDueDate] = useState(task.due_date || '');

  useEffect(() => {
    setLocalDueDate(task.due_date || '');
  }, [task.due_date]);

  const handleSaveDate = useCallback(() => {
    if (localDueDate !== (task.due_date || '')) {
      onUpdateDueDate(localDueDate || null);
    }
  }, [localDueDate, task.due_date, onUpdateDueDate]);

  const handleKeyDownDate = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveDate();
    }
  };

  const filteredProjects = useMemo(() => {
    const query = projectSearch.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(query));
  }, [projects, projectSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdateTitle(editTitle);
    setIsEditing(false);
  };

  return (
    <div className="grid grid-cols-12 py-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 group transition-colors items-center">
      {/* Checkbox */}
      <div className="col-span-1 flex items-center justify-center">
        <button
          onClick={onToggle}
          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-700'}`}
        >
          {task.completed && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3">
              <path d="M20 6L9 17L4 12" />
            </svg>
          )}
        </button>
      </div>

      {/* Nombre */}
      <div className="col-span-5">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="w-full mr-4">
            <input
              autoFocus
              className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-1 px-2 text-sm focus:ring-2 focus:ring-cyan-500"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => setIsEditing(false)}
            />
          </form>
        ) : (
          <div
            className={`text-sm cursor-text truncate ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}
            onClick={() => setIsEditing(true)}
          >
            {task.title}
          </div>
        )}
      </div>

      {/* Fecha */}
      <div className="col-span-2 text-xs flex items-center">
        <Dropdown
          inline
          dismissOnClick={false}
          label={
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${task.due_date ? 'text-cyan-600 dark:text-cyan-400 font-medium' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span>{task.due_date ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(task.due_date)) : 'Fecha'}</span>
            </div>
          }
          arrowIcon={false}
        >
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Fecha de entrega</p>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDownDate}>
              <input
                type="date"
                className="flex-1 text-xs border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 transition-all font-sans"
                value={localDueDate}
                onChange={(e) => setLocalDueDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={handleSaveDate}
                className="p-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors shadow-sm"
                title="Guardar fecha"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
                  <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </button>
            </div>
            {task.due_date && (
              <button
                className="mt-2 w-full text-[10px] text-rose-500 hover:text-rose-600 font-bold uppercase tracking-wider py-1 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors"
                onClick={() => {
                  onUpdateDueDate(null);
                  setLocalDueDate('');
                }}
              >
                Quitar fecha
              </button>
            )}
          </div>
        </Dropdown>
      </div>

      {/* Tablero */}
      <div className="col-span-3 flex items-center">
        <Dropdown
          inline
          dismissOnClick={false}
          label={
            <div className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[11px] font-medium transition-all ${task.projects ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700' : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${task.projects ? 'bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.5)]' : 'bg-slate-300'}`}></span>
              <span className="truncate max-w-[100px]">{task.projects?.name || 'Tablero'}</span>
            </div>
          }
          arrowIcon={false}
        >
          <div className="p-3 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Asignar a tablero</p>
            <input
              placeholder="Buscar o crear..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs py-2 px-3 focus:ring-2 focus:ring-cyan-500 mb-3 text-slate-900 dark:text-white"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && projectSearch.trim()) {
                  onCreateProject(projectSearch);
                  setProjectSearch('');
                }
              }}
              onFocus={(e) => e.target.select()}
              autoFocus
            />
            <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
              {filteredProjects.length > 0 ? (
                filteredProjects.map(p => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-900/20 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2"
                    onClick={() => {
                      onAssignProject(p.id);
                      setProjectSearch('');
                    }}
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-cyan-500 transition-colors shrink-0"></div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium">{p.name}</span>
                      {p.workspaces?.name && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{p.workspaces.name}</span>
                      )}
                    </div>
                  </button>
                ))
              ) : !projectSearch.trim() && (
                <div className="py-8 text-center">
                  <p className="text-[10px] text-slate-400 italic">No hay tableros disponibles</p>
                </div>
              )}

              {projectSearch.trim() && !projects.some(p => p.name.toLowerCase() === projectSearch.toLowerCase()) && (
                <button
                  className="w-full text-left px-3 py-2.5 text-xs rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all flex items-center gap-2 border border-dashed border-cyan-200 dark:border-cyan-800"
                  onClick={() => {
                    onCreateProject(projectSearch);
                    setProjectSearch('');
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                    <path d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="font-semibold">Crear tablero: "{projectSearch}"</span>
                </button>
              )}
            </div>
          </div>
        </Dropdown>
      </div>

      {/* Opciones */}
      <div className="col-span-1 flex justify-end opacity-0 group-hover:opacity-100">
        <Dropdown
          inline
          label={
            <div className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-500">
                <path d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
            </div>
          }
          arrowIcon={false}
          placement="left"
        >
          {/* Usamos un div con onClick en lugar de Dropdown.Item si este falla */}
          <div
            className="px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
            onClick={onDelete}
          >
            Eliminar tarea
          </div>
        </Dropdown>
      </div>
    </div>
  );
}

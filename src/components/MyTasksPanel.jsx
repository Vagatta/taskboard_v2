import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Dropdown, Select } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import Skeleton from './ui/Skeleton';

const MY_TASKS_STORAGE_KEY = 'taskboard:my-tasks-preferences';
const PROJECT_COLOR_PALETTE = [
  {
    dot: 'bg-cyan-400 dark:bg-cyan-500',
    soft: 'bg-cyan-50/45 dark:bg-cyan-900/10',
    border: 'border-cyan-100 dark:border-cyan-900/40',
    badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/25 dark:text-cyan-200',
    hover: 'hover:bg-cyan-50/50 dark:hover:bg-cyan-900/10',
    calendarHover: 'hover:border-cyan-200 dark:hover:border-cyan-800/50'
  },
  {
    dot: 'bg-violet-400 dark:bg-violet-500',
    soft: 'bg-violet-50/45 dark:bg-violet-900/10',
    border: 'border-violet-100 dark:border-violet-900/40',
    badge: 'bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-200',
    hover: 'hover:bg-violet-50/50 dark:hover:bg-violet-900/10',
    calendarHover: 'hover:border-violet-200 dark:hover:border-violet-800/50'
  },
  {
    dot: 'bg-emerald-400 dark:bg-emerald-500',
    soft: 'bg-emerald-50/45 dark:bg-emerald-900/10',
    border: 'border-emerald-100 dark:border-emerald-900/40',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-200',
    hover: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
    calendarHover: 'hover:border-emerald-200 dark:hover:border-emerald-800/50'
  },
  {
    dot: 'bg-amber-400 dark:bg-amber-500',
    soft: 'bg-amber-50/45 dark:bg-amber-900/10',
    border: 'border-amber-100 dark:border-amber-900/40',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-200',
    hover: 'hover:bg-amber-50/50 dark:hover:bg-amber-900/10',
    calendarHover: 'hover:border-amber-200 dark:hover:border-amber-800/50'
  },
  {
    dot: 'bg-pink-400 dark:bg-pink-500',
    soft: 'bg-pink-50/45 dark:bg-pink-900/10',
    border: 'border-pink-100 dark:border-pink-900/40',
    badge: 'bg-pink-50 text-pink-700 dark:bg-pink-900/25 dark:text-pink-200',
    hover: 'hover:bg-pink-50/50 dark:hover:bg-pink-900/10',
    calendarHover: 'hover:border-pink-200 dark:hover:border-pink-800/50'
  },
  {
    dot: 'bg-indigo-400 dark:bg-indigo-500',
    soft: 'bg-indigo-50/45 dark:bg-indigo-900/10',
    border: 'border-indigo-100 dark:border-indigo-900/40',
    badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-200',
    hover: 'hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10',
    calendarHover: 'hover:border-indigo-200 dark:hover:border-indigo-800/50'
  },
  {
    dot: 'bg-teal-400 dark:bg-teal-500',
    soft: 'bg-teal-50/45 dark:bg-teal-900/10',
    border: 'border-teal-100 dark:border-teal-900/40',
    badge: 'bg-teal-50 text-teal-700 dark:bg-teal-900/25 dark:text-teal-200',
    hover: 'hover:bg-teal-50/50 dark:hover:bg-teal-900/10',
    calendarHover: 'hover:border-teal-200 dark:hover:border-teal-800/50'
  },
  {
    dot: 'bg-orange-400 dark:bg-orange-500',
    soft: 'bg-orange-50/45 dark:bg-orange-900/10',
    border: 'border-orange-100 dark:border-orange-900/40',
    badge: 'bg-orange-50 text-orange-700 dark:bg-orange-900/25 dark:text-orange-200',
    hover: 'hover:bg-orange-50/50 dark:hover:bg-orange-900/10',
    calendarHover: 'hover:border-orange-200 dark:hover:border-orange-800/50'
  }
];

const PROJECT_COLOR_DEFAULTS = {
  rowAccent: 'border-l-4 border-l-transparent',
  projectBadge: 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-800',
  projectDot: 'bg-slate-300',
  calendarCard: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40',
  calendarInteractive: 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
};

function getProjectColorIndex(projectId) {
  if (!projectId) {
    return null;
  }

  let hash = 0;
  for (let index = 0; index < projectId.length; index += 1) {
    hash = ((hash << 5) - hash) + projectId.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) % PROJECT_COLOR_PALETTE.length;
}

function getStoredProjectColors(preferences) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return {};
  }

  const colors = preferences.projectColors;
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) {
    return {};
  }

  return colors;
}

export default function MyTasksPanel({
  user,
  projects = [],
  workspaces = [],
  setSelectedProjectId,
  setActiveManagementTab,
  setActivePrimaryView,
  onTaskClick,
  pendingAction,
  onClearPendingAction
}) {
  const queryClient = useQueryClient();
  const [storedPreferences] = useState(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(MY_TASKS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projectColors, setProjectColors] = useState(() => getStoredProjectColors(storedPreferences));

  // Filtros
  const [statusFilter, setStatusFilter] = useState(storedPreferences?.statusFilter || 'pending');
  const [projectFilter, setProjectFilter] = useState(storedPreferences?.projectFilter || 'all');
  const [dateFilter, setDateFilter] = useState(storedPreferences?.dateFilter || 'all');
  const [viewMode, setViewMode] = useState(storedPreferences?.viewMode || 'table');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [celebratingTaskBursts, setCelebratingTaskBursts] = useState({});
  const [confettiMode, setConfettiMode] = useState(storedPreferences?.confettiMode || 'simple');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (pendingAction === 'create-task') {
      setIsAddingTask(true);
      if (onClearPendingAction) onClearPendingAction();
    }
  }, [pendingAction, onClearPendingAction]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(MY_TASKS_STORAGE_KEY, JSON.stringify({
      statusFilter,
      projectFilter,
      dateFilter,
      viewMode,
      confettiMode,
      projectColors
    }));
  }, [confettiMode, dateFilter, projectColors, projectFilter, statusFilter, viewMode]);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskEffort, setNewTaskEffort] = useState('m');
  const [newTaskProjectId, setNewTaskProjectId] = useState('');

  const userId = user?.id ?? null;

  const [projectsList, setProjectsList] = useState(projects);

  useEffect(() => {
    setProjectsList(projects);
  }, [projects]);

  useEffect(() => {
    setProjectColors((currentColors) => {
      const nextColors = { ...currentColors };
      let hasChanges = false;

      for (const project of projectsList) {
        if (!project?.id || nextColors[project.id] !== undefined) {
          continue;
        }

        nextColors[project.id] = getProjectColorIndex(project.id);
        hasChanges = true;
      }

      return hasChanges ? nextColors : currentColors;
    });
  }, [projectsList]);

  const getProjectColor = useCallback((projectId) => {
    if (!projectId) {
      return null;
    }

    const storedIndex = projectColors[projectId];
    const resolvedIndex = Number.isInteger(storedIndex)
      ? storedIndex % PROJECT_COLOR_PALETTE.length
      : getProjectColorIndex(projectId);

    return PROJECT_COLOR_PALETTE[resolvedIndex];
  }, [projectColors]);

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

  const selectedNewTaskProject = useMemo(
    () => projectsList.find((project) => project.id === newTaskProjectId) ?? null,
    [projectsList, newTaskProjectId]
  );

  const todayKey = useMemo(() => new Date().toISOString().split('T')[0], []);

  const calendarData = useMemo(() => {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const startWeekday = (monthStart.getDay() + 6) % 7;

    const cells = [];
    for (let index = 0; index < startWeekday; index += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    }

    const formatKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const tasksByDay = filteredTasks.reduce((accumulator, task) => {
      if (!task.due_date) return accumulator;
      const key = formatKey(new Date(task.due_date));
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(task);
      return accumulator;
    }, {});

    const monthLabel = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      year: 'numeric'
    }).format(calendarMonth);

    const weekdayFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
    const weekdayHeaders = Array.from({ length: 7 }, (_, index) => {
      const base = new Date(2024, 0, 1 + index);
      return weekdayFormatter.format(base);
    });

    return { cells, tasksByDay, monthLabel, weekdayHeaders, formatKey };
  }, [calendarMonth, filteredTasks]);

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

  const hasActiveFilters = statusFilter !== 'pending' || projectFilter !== 'all' || dateFilter !== 'all';

  const calendarMonthTaskCount = useMemo(
    () => Object.values(calendarData.tasksByDay).reduce((total, dayTasks) => total + dayTasks.length, 0),
    [calendarData.tasksByDay]
  );

  const emptyStateMessage = useMemo(() => {
    if (tasks.length === 0) {
      return 'No tienes tareas asignadas todavía.';
    }

    if (hasActiveFilters) {
      return 'No hay tareas con estos filtros.';
    }

    return 'No hay tareas para mostrar ahora mismo.';
  }, [hasActiveFilters, tasks.length]);

  const createTaskRecord = useCallback(async ({
    title,
    dueDate = newTaskDueDate,
    priority = newTaskPriority,
    effort = newTaskEffort,
    projectId = newTaskProjectId
  }) => {
    if (!title.trim() || !userId) return null;

    try {
      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert([{
          title: title.trim(),
          project_id: projectId || null,
          assigned_to: userId,
          created_by: userId,
          updated_by: userId,
          priority,
          effort,
          due_date: dueDate,
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
      queryClient.invalidateQueries(['globalStats', userId]);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [newTaskDueDate, newTaskEffort, newTaskPriority, newTaskProjectId, queryClient, userId]);

  const handleAddTask = async (e) => {
    if (e) e.preventDefault();
    const createdTask = await createTaskRecord({ title: newTaskTitle });
    if (!createdTask) return;

    setNewTaskTitle('');
    setNewTaskDueDate(new Date().toISOString().split('T')[0]);
    setNewTaskPriority('medium');
    setNewTaskEffort('m');
    setNewTaskProjectId('');
    setIsAddingTask(false);
  };

  const handleToggleTask = async (task) => {
    try {
      const nextCompleted = !task.completed;
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (updateError) throw updateError;
      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null
      } : t));

      if (nextCompleted && confettiMode !== 'off' && !prefersReducedMotion) {
        setCelebratingTaskBursts((current) => ({
          ...current,
          [task.id]: (current[task.id] ?? 0) + 1
        }));
        window.setTimeout(() => {
          setCelebratingTaskBursts((current) => {
            const next = { ...current };
            delete next[task.id];
            return next;
          });
        }, confettiMode === 'festive' ? 1200 : 900);
      }

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
    const taskToDelete = tasks.find((task) => task.id === taskId);
    if (taskToDelete?.completed) {
      setError('Las tareas completadas no se pueden eliminar.');
      return;
    }

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

  const goToPreviousMonth = useCallback(() => {
    setCalendarMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCalendarMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1));
  }, []);

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
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vista</span>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/60">
            {[
              { id: 'table', label: 'Tabla' },
              { id: 'calendar', label: 'Calendario' }
            ].map((view) => {
              const isActive = viewMode === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setViewMode(view.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${isActive
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                >
                  {view.label}
                </button>
              );
            })}
          </div>
        </div>

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

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Celebración</span>
          <Select
            sizing="sm"
            value={confettiMode}
            onChange={(e) => setConfettiMode(e.target.value)}
            className="w-36"
          >
            <option value="simple">Simple</option>
            <option value="festive">Festivo</option>
            <option value="off">Desactivado</option>
          </Select>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {loading && tasks.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900/30">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{emptyStateMessage}</p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              {hasActiveFilters ? 'Prueba a cambiar la vista o relajar los filtros de estado, tablero o fecha.' : 'En cuanto se te asignen tareas aparecerán aquí.'}
            </p>
          </div>
        ) : viewMode === 'calendar' ? (
          <div className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={goToPreviousMonth}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={goToNextMonth}
                >
                  Siguiente
                </button>
              </div>
              <div className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{calendarData.monthLabel}</div>
            </div>

            <div className="hidden sm:grid sm:grid-cols-7 gap-3 text-[11px] text-slate-400">
              {calendarData.weekdayHeaders.map((label) => (
                <div key={label} className="text-center font-bold uppercase tracking-widest text-slate-500">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
              {calendarData.cells.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="hidden sm:block min-h-[140px] rounded-2xl border border-transparent" />;
                }

                const key = calendarData.formatKey(date);
                const dayTasks = calendarData.tasksByDay[key] ?? [];
                const isToday = key === todayKey;
                const weekdayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);

                return (
                  <div
                    key={key}
                    className={`min-h-[140px] rounded-2xl border p-3 ${isToday
                      ? 'border-cyan-400 bg-cyan-50/60 dark:border-cyan-500 dark:bg-cyan-900/10'
                      : 'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/30'
                      }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-sm font-semibold ${isToday ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-900 dark:text-white'}`}>
                        <span className="mr-1 capitalize text-xs sm:hidden">{weekdayName}</span>
                        {date.getDate()}
                      </span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {dayTasks.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {dayTasks.length === 0 ? (
                        <p className="text-[11px] text-slate-400">Sin tareas</p>
                      ) : (
                        dayTasks.map((task) => (
                          <CalendarTaskCard
                            key={task.id}
                            task={task}
                            projectColor={getProjectColor(task.project_id)}
                            celebrationKey={celebratingTaskBursts[task.id] ?? 0}
                            isCelebrating={Boolean(celebratingTaskBursts[task.id])}
                            confettiMode={confettiMode}
                            onOpen={() => {
                              if (!task.project_id) return;
                              onTaskClick?.(task);
                            }}
                            onToggle={() => handleToggleTask(task)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {calendarMonthTaskCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-950/30">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {hasActiveFilters ? 'No hay tareas con estos filtros en este mes.' : 'No hay tareas este mes.'}
                </p>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  {hasActiveFilters ? 'Cambia los filtros para ver más resultados en el calendario.' : 'Prueba a navegar a otro mes o añade fechas a tus tareas.'}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-visible shadow-sm">
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
                        projectColor={getProjectColor(task.project_id)}
                        celebrationKey={celebratingTaskBursts[task.id] ?? 0}
                        isCelebrating={Boolean(celebratingTaskBursts[task.id])}
                        confettiMode={confettiMode}
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

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Tablero</label>
                <Select
                  value={newTaskProjectId}
                  onChange={(e) => setNewTaskProjectId(e.target.value)}
                  className="w-full text-xs"
                  sizing="sm"
                >
                  <option value="">Sin tablero (solo para mí)</option>
                  {projectsList.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                      <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    Asignada a mí
                  </span>
                  <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5M3.75 9.75h16.5M3.75 14.25h16.5M3.75 18.75h16.5" />
                    </svg>
                    {selectedNewTaskProject ? `Tablero: ${selectedNewTaskProject.name}` : 'Mi bandeja'}
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

function TaskConfettiBurst({ pieceCount = 6 }) {
  return (
    <div className="task-confetti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: pieceCount }, (_, index) => (
        <span key={index} className={`task-confetti-piece piece-${(index % 6) + 1}`}></span>
      ))}
    </div>
  );
}

function CalendarTaskCard({
  task,
  projectColor = null,
  isCelebrating = false,
  celebrationKey = 0,
  confettiMode = 'simple',
  onOpen,
  onToggle
}) {
  const projectAccentClass = projectColor
    ? `${projectColor.soft} ${projectColor.border} ${projectColor.calendarHover}`
    : PROJECT_COLOR_DEFAULTS.calendarCard;
  const cardClassName = task.completed
    ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-900/10'
    : projectAccentClass
      ? projectAccentClass
      : task.priority === 'high' || task.priority === 'urgent'
        ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-900/10'
        : task.priority === 'medium'
          ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-900/10'
          : PROJECT_COLOR_DEFAULTS.calendarCard;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!task.project_id) return;
        onOpen?.();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!task.project_id) return;
          onOpen?.();
        }
      }}
      title={!task.project_id ? 'Esta tarea no tiene tablero asociado' : undefined}
      className={`task-complete-surface relative overflow-visible rounded-xl border px-2.5 py-2 text-left transition-colors ${task.completed ? 'is-completed' : ''} ${task.project_id ? `${PROJECT_COLOR_DEFAULTS.calendarInteractive} cursor-pointer` : 'cursor-default'} ${cardClassName}`}
    >
      {isCelebrating ? <TaskConfettiBurst key={celebrationKey} pieceCount={confettiMode === 'festive' ? 12 : 6} /> : null}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
            {task.title}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className={`task-complete-toggle mt-0.5 h-4 w-4 shrink-0 rounded-full border ${task.completed ? 'is-completed' : ''} ${task.completed
            ? 'border-emerald-500 bg-emerald-500'
            : 'border-slate-300 dark:border-slate-600'
            }`}
          title={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
        >
          {task.completed ? <span className="block text-[10px] leading-none text-white">✓</span> : null}
        </button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  projectColor = null,
  isCelebrating = false,
  celebrationKey = 0,
  confettiMode = 'simple',
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

  const rowAccentClass = task.project_id && projectColor
    ? `${projectColor.hover} border-l-4 ${projectColor.border}`
    : PROJECT_COLOR_DEFAULTS.rowAccent;

  const projectBadgeClassName = task.projects && projectColor
    ? projectColor.badge
    : task.projects
      ? 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
      : PROJECT_COLOR_DEFAULTS.projectBadge;

  const projectDotClassName = task.projects && projectColor
    ? `${projectColor.dot} shadow-[0_0_5px_rgba(15,23,42,0.18)]`
    : task.projects
      ? 'bg-slate-400 dark:bg-slate-500'
      : PROJECT_COLOR_DEFAULTS.projectDot;

  return (
    <div className={`task-complete-surface relative overflow-visible grid grid-cols-12 py-2 px-4 group transition-colors items-center ${rowAccentClass} ${task.completed ? 'is-completed' : ''}`}>
      {isCelebrating ? <TaskConfettiBurst key={celebrationKey} pieceCount={confettiMode === 'festive' ? 12 : 6} /> : null}
      {/* Checkbox */}
      <div className="col-span-1 flex items-center justify-center">
        <button
          onClick={onToggle}
          className={`task-complete-toggle h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'is-completed bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-700'}`}
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
            <div className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[11px] font-medium transition-all ${projectBadgeClassName}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${projectDotClassName}`}></span>
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

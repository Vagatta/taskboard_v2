import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Select, Spinner, TabItem, Tabs, TextInput } from 'flowbite-react';
import ActivityLog from './components/ActivityLog';
import MentionDigest from './components/MentionDigest';
import TaskDetailPanel from './components/TaskDetailPanel';
import { supabase } from './supabaseClient';
import { formatRelativeTime, humanizeEventType, parseDateInput } from './utils/dateHelpers';

const TaskList = forwardRef(function TaskList({ user, projectId, project, members = [], onViewModeChange, onTaskSummaryChange }, ref) {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [addingTask, setAddingTask] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState(null);
  const [assigneeEditTaskId, setAssigneeEditTaskId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createdFromFilter, setCreatedFromFilter] = useState('');
  const [createdToFilter, setCreatedToFilter] = useState('');
  const [dueBeforeFilter, setDueBeforeFilter] = useState('');
  const [completedBeforeFilter, setCompletedBeforeFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  const newTaskInputRef = useRef(null);
  const [taskCommentMeta, setTaskCommentMeta] = useState({});
  const [taskActivityMeta, setTaskActivityMeta] = useState({});
  const [subtasksByTaskId, setSubtasksByTaskId] = useState({});
  const [subtasksLoadingMap, setSubtasksLoadingMap] = useState({});
  const [subtaskMeta, setSubtaskMeta] = useState({});
  const [subtaskError, setSubtaskError] = useState('');

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const isEmpty = useMemo(() => !loading && projectId && tasks.length === 0, [loading, projectId, tasks.length]);

  const projectOwnerLabel = useMemo(() => {
    if (!project) return 'Desconocido';
    if (project.owner_email) return project.owner_email;
    if (project.user_id === userId) return userEmail;
    return project.user_id;
  }, [project, userEmail, userId]);

  const membersById = useMemo(
    () =>
      members.reduce((accumulator, member) => {
        if (member?.member_id) {
          accumulator[member.member_id] = member;
        }
        return accumulator;
      }, {}),
    [members]
  );

  const updateTaskPriority = useCallback(
    async (task, nextPriority) => {
      if (!nextPriority || !projectId) {
        return;
      }

      setErrorMessage('');

      const { data, error } = await supabase
        .from('tasks')
        .update({ priority: nextPriority, updated_by: userId })
        .eq('id', task.id)
        .eq('project_id', projectId)
        .select()
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setTasks((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      }
    },
    [projectId, userId]
  );

  const createdFromDate = useMemo(() => parseDateInput(createdFromFilter), [createdFromFilter]);
  const createdToDate = useMemo(() => parseDateInput(createdToFilter, { endOfDay: true }), [createdToFilter]);
  const dueBeforeDate = useMemo(() => parseDateInput(dueBeforeFilter, { endOfDay: true }), [dueBeforeFilter]);
  const completedBeforeDate = useMemo(() => parseDateInput(completedBeforeFilter, { endOfDay: true }), [completedBeforeFilter]);

  const filterStorageKey = useMemo(() => {
    if (!userId || !projectId) {
      return null;
    }
    return `taskboard:filters:${userId}:${projectId}`;
  }, [projectId, userId]);

  const loadTaskCommentMeta = useCallback(async () => {
    if (!projectId) {
      setTaskCommentMeta({});
      return;
    }

    const { data, error } = await supabase
      .from('task_comments')
      .select('task_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('No se pudieron cargar los metadatos de comentarios:', error);
      return;
    }

    const meta = {};
    for (const item of data ?? []) {
      if (!meta[item.task_id]) {
        meta[item.task_id] = item.created_at;
      }
    }
    setTaskCommentMeta(meta);
  }, [projectId]);

  const loadTaskActivityMeta = useCallback(async () => {
    if (!projectId) {
      setTaskActivityMeta({});
      return;
    }

    const { data, error } = await supabase
      .from('activity_log')
      .select('task_id, event_type, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('No se pudieron cargar los metadatos de actividad:', error);
      return;
    }

    const meta = {};
    for (const item of data ?? []) {
      if (item.task_id && !meta[item.task_id]) {
        meta[item.task_id] = {
          eventType: item.event_type,
          createdAt: item.created_at
        };
      }
    }
    setTaskActivityMeta(meta);
  }, [projectId]);

  const madridDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Madrid'
      }),
    []
  );

  const totalTasks = tasks.length;
  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const pendingCount = totalTasks - completedCount;

  const highPriorityStats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    let overdue = 0;
    let dueToday = 0;

    for (const task of tasks) {
      const priority = task.priority ?? 'medium';
      if (priority !== 'high' || task.completed || !task.due_date) {
        continue;
      }
      const due = new Date(task.due_date);
      if (due < todayStart) {
        overdue += 1;
      } else if (due >= todayStart && due < todayEnd) {
        dueToday += 1;
      }
    }

    return { overdue, dueToday };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter === 'completed' && !task.completed) return false;
      if (statusFilter === 'pending' && task.completed) return false;

      if (assigneeFilter === 'unassigned' && task.assigned_to) return false;
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && task.assigned_to !== assigneeFilter) {
        return false;
      }

      if (priorityFilter !== 'all') {
        const priority = task.priority ?? 'medium';
        if (priority !== priorityFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const title = task.title?.toLowerCase() ?? '';
        const description = task.description?.toLowerCase() ?? '';
        if (!title.includes(query) && !description.includes(query)) {
          return false;
        }
      }

      if (createdFromDate) {
        const insertedAt = task.inserted_at ? new Date(task.inserted_at) : null;
        if (!insertedAt || insertedAt < createdFromDate) {
          return false;
        }
      }

      if (createdToDate) {
        const insertedAt = task.inserted_at ? new Date(task.inserted_at) : null;
        if (!insertedAt || insertedAt > createdToDate) {
          return false;
        }
      }

      if (dueBeforeDate && task.due_date) {
        const dueDateValue = new Date(task.due_date);
        if (dueDateValue > dueBeforeDate) {
          return false;
        }
      }

      if (dueBeforeDate && !task.due_date) {
        return false;
      }

      if (completedBeforeDate) {
        if (!task.completed) {
          return false;
        }
        const completedAt = task.completed_at ? new Date(task.completed_at) : null;
        if (!completedAt || completedAt > completedBeforeDate) {
          return false;
        }
      }
      return true;
    });
  }, [
    assigneeFilter,
    completedBeforeDate,
    createdFromDate,
    createdToDate,
    dueBeforeDate,
    priorityFilter,
    searchQuery,
    statusFilter,
    tasks
  ]);

  const isFilteredEmpty = useMemo(
    () => !loading && projectId && totalTasks > 0 && filteredTasks.length === 0,
    [filteredTasks.length, loading, projectId, totalTasks]
  );

  const timelineStartDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, [projectId, tasks.length]);

  const timelineDays = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(timelineStartDate);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [timelineStartDate]);

  const timelineEndDate = useMemo(() => {
    const lastDay = new Date(timelineDays[timelineDays.length - 1] ?? timelineStartDate);
    lastDay.setHours(23, 59, 59, 999);
    return lastDay;
  }, [timelineDays, timelineStartDate]);

  const timelineDayKeys = useMemo(() => timelineDays.map((day) => day.toISOString().split('T')[0]), [timelineDays]);

  const timelineWeeks = useMemo(() => {
    const weeks = [];
    for (let index = 0; index < timelineDays.length; index += 7) {
      weeks.push(timelineDays.slice(index, index + 7));
    }
    return weeks;
  }, [timelineDays]);

  const timelineBuckets = useMemo(() => {
    const dayMap = timelineDayKeys.reduce((accumulator, key) => {
      accumulator[key] = [];
      return accumulator;
    }, {});
    const overdue = [];
    const undated = [];
    const later = [];

    filteredTasks.forEach((task) => {
      if (!task.due_date) {
        undated.push(task);
        return;
      }

      const dueDate = new Date(task.due_date);
      const key = dueDate.toISOString().split('T')[0];

      if (dueDate < timelineStartDate) {
        overdue.push(task);
        return;
      }

      if (dueDate > timelineEndDate) {
        later.push(task);
        return;
      }

      if (!dayMap[key]) {
        dayMap[key] = [];
      }

      dayMap[key].push(task);
    });

    Object.values(dayMap).forEach((dayTasks) => {
      dayTasks.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    });

    return {
      dayMap,
      overdue,
      undated,
      later
    };
  }, [filteredTasks, timelineDayKeys, timelineEndDate, timelineStartDate]);

  const timelineDayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }),
    []
  );

  const timelineTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      }),
    []
  );

  const recalcSubtaskStats = useCallback((taskId, list) => {
    setSubtaskMeta((previous) => ({
      ...previous,
      [taskId]: {
        total: list.length,
        completed: list.filter((item) => item.completed).length
      }
    }));
  }, []);

  const loadSubtasksForTask = useCallback(
    async (taskId) => {
      if (!taskId) {
        return;
      }

      setSubtaskError('');
      setSubtasksLoadingMap((previous) => ({ ...previous, [taskId]: true }));

      const { data, error } = await supabase
        .from('task_subtasks')
        .select('id, task_id, title, completed, assigned_to, due_date, created_at, updated_at, updated_by')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) {
        setSubtaskError(error.message);
      } else {
        const payload = data ?? [];
        setSubtasksByTaskId((previous) => ({ ...previous, [taskId]: payload }));
        recalcSubtaskStats(taskId, payload);
      }

      setSubtasksLoadingMap((previous) => ({ ...previous, [taskId]: false }));
    },
    [recalcSubtaskStats]
  );

  const loadSubtaskMeta = useCallback(async () => {
    if (!projectId) {
      setSubtaskMeta({});
      return;
    }

    const { data, error } = await supabase
      .from('task_subtasks')
      .select('task_id, completed, tasks!inner(project_id)')
      .eq('tasks.project_id', projectId)
      .limit(2000);

    if (error) {
      console.warn('No se pudieron cargar las subtareas:', error);
      return;
    }

    const meta = {};
    for (const item of data ?? []) {
      if (!meta[item.task_id]) {
        meta[item.task_id] = { total: 0, completed: 0 };
      }
      meta[item.task_id].total += 1;
      if (item.completed) {
        meta[item.task_id].completed += 1;
      }
    }

    setSubtaskMeta(meta);
  }, [projectId]);

  const handleCreateSubtask = useCallback(
    async (taskId, title) => {
      const trimmed = title.trim();
      if (!taskId || !trimmed) {
        return;
      }

      setSubtaskError('');

      const { data, error } = await supabase
        .from('task_subtasks')
        .insert([{ task_id: taskId, title: trimmed, updated_by: userId }])
        .select()
        .maybeSingle();

      if (error) {
        setSubtaskError(error.message);
        throw error;
      }

      if (!data) {
        return;
      }

      setSubtasksByTaskId((previous) => {
        const current = previous[taskId] ?? [];
        const nextList = [...current, data];
        recalcSubtaskStats(taskId, nextList);
        return { ...previous, [taskId]: nextList };
      });
    },
    [recalcSubtaskStats, userId]
  );

  const handleToggleSubtask = useCallback(
    async (taskId, subtask) => {
      if (!taskId || !subtask) {
        return;
      }

      setSubtaskError('');
      const previousList = subtasksByTaskId[taskId] ?? [];
      const nextCompleted = !subtask.completed;

      const optimisticList = previousList.map((item) =>
        item.id === subtask.id ? { ...item, completed: nextCompleted, updated_at: new Date().toISOString() } : item
      );
      setSubtasksByTaskId((previous) => ({ ...previous, [taskId]: optimisticList }));
      recalcSubtaskStats(taskId, optimisticList);

      try {
        const { data, error } = await supabase
          .from('task_subtasks')
          .update({ completed: nextCompleted, updated_by: userId })
          .eq('id', subtask.id)
          .eq('task_id', taskId)
          .select()
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          setSubtasksByTaskId((previous) => {
            const current = previous[taskId] ?? [];
            const nextList = current.map((item) => (item.id === data.id ? data : item));
            recalcSubtaskStats(taskId, nextList);
            return { ...previous, [taskId]: nextList };
          });
        }
      } catch (error) {
        console.warn('No se pudo alternar la subtarea:', error);
        setSubtaskError(error.message ?? 'No se pudo actualizar la subtarea');
        setSubtasksByTaskId((previous) => ({ ...previous, [taskId]: previousList }));
        recalcSubtaskStats(taskId, previousList);
        throw error;
      }
    },
    [recalcSubtaskStats, subtasksByTaskId, userId]
  );

  const handleDeleteSubtask = useCallback(
    async (taskId, subtaskId) => {
      if (!taskId || !subtaskId) {
        return;
      }

      const confirmed = window.confirm('¿Seguro que deseas eliminar esta subtarea? Esta acción no se puede deshacer.');
      if (!confirmed) {
        return;
      }

      setSubtaskError('');

      const { error } = await supabase
        .from('task_subtasks')
        .delete()
        .eq('id', subtaskId)
        .eq('task_id', taskId);

      if (error) {
        setSubtaskError(error.message);
        throw error;
      }

      setSubtasksByTaskId((previous) => {
        const current = previous[taskId] ?? [];
        const nextList = current.filter((item) => item.id !== subtaskId);
        recalcSubtaskStats(taskId, nextList);
        return { ...previous, [taskId]: nextList };
      });
    },
    [recalcSubtaskStats]
  );

  const quickFilters = useMemo(() => {
    const presets = [
      { id: 'all', label: 'Ver todo', status: 'all', assignee: 'all', priority: 'all' },
      { id: 'pending', label: 'Solo pendientes', status: 'pending', assignee: 'all', priority: 'all' },
      {
        id: 'pending-unassigned',
        label: 'Pendientes sin responsable',
        status: 'pending',
        assignee: 'unassigned',
        priority: 'all'
      },
      { id: 'completed', label: 'Solo completadas', status: 'completed', assignee: 'all', priority: 'all' },
      { id: 'high-all', label: 'Solo prioridad alta', status: 'all', assignee: 'all', priority: 'high' },
      {
        id: 'high-pending',
        label: 'Pendientes · alta',
        status: 'pending',
        assignee: 'all',
        priority: 'high'
      }
    ];

    if (userId && membersById[userId]) {
      presets.push({
        id: 'assigned-to-me',
        label: 'Asignadas a mí',
        status: 'all',
        assignee: membersById[userId].member_id,
        priority: 'all'
      });
    }

    return presets;
  }, [membersById, userId]);

  const kanbanColumns = useMemo(
    () => ({
      pending: filteredTasks.filter((task) => !task.completed),
      completed: filteredTasks.filter((task) => task.completed)
    }),
    [filteredTasks]
  );

  const boardSections = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const nextWeekEnd = new Date(todayStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

    const recentThreshold = new Date();
    recentThreshold.setDate(recentThreshold.getDate() - 2);

    const sectionMatchers = [
      {
        id: 'recent',
        title: 'Asignadas recientemente',
        emptyLabel: 'Sin tareas recientes.',
        match: (task) => {
          const updatedAt = task.updated_at ? new Date(task.updated_at) : null;
          const insertedAt = task.inserted_at ? new Date(task.inserted_at) : null;
          const reference = updatedAt ?? insertedAt;
          return Boolean(reference && reference >= recentThreshold);
        }
      },
      {
        id: 'today',
        title: 'Para hacer hoy',
        emptyLabel: 'No hay tareas para hoy.',
        match: (task) => {
          if (!task.due_date) return false;
          const due = new Date(task.due_date);
          return due >= todayStart && due < todayEnd;
        }
      },
      {
        id: 'soon',
        title: 'Próximamente',
        emptyLabel: 'Nada programado en los próximos días.',
        match: (task) => {
          if (!task.due_date) return false;
          const due = new Date(task.due_date);
          return due >= todayEnd && due <= nextWeekEnd;
        }
      },
      {
        id: 'later',
        title: 'Para más tarde',
        emptyLabel: 'Todo al día.',
        match: () => true
      }
    ];

    const assignedIds = new Set();

    return sectionMatchers.map((section) => {
      const tasksForSection = filteredTasks.filter((task) => {
        if (assignedIds.has(task.id)) {
          return false;
        }
        if (!section.match(task)) {
          return false;
        }
        assignedIds.add(task.id);
        return true;
      });

      return {
        ...section,
        tasks: tasksForSection
      };
    });
  }, [filteredTasks]);

  const loadTasks = useCallback(async () => {
    if (!userId || !projectId) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const baseQuery = () =>
      supabase
        .from('tasks')
        .select(
          'id,title,project_id,created_by,assigned_to,owner_email,completed,completed_at,inserted_at,description,due_date,updated_by,updated_at,priority'
        )
        .eq('project_id', projectId)
        .order('inserted_at', { ascending: false });

    const fallbackQuery = () =>
      supabase
        .from('tasks')
        .select('id,title,project_id,created_by,assigned_to,owner_email,completed,completed_at,inserted_at,due_date,priority')
        .eq('project_id', projectId)
        .order('inserted_at', { ascending: false });

    try {
      let { data, error } = await baseQuery();

      if (error) {
        if (error.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await fallbackQuery();
          if (fallbackError) {
            setErrorMessage(fallbackError.message);
            return;
          }
          setTasks(fallbackData ?? []);
          return;
        }

        setErrorMessage(error.message);
        return;
      }

      setTasks(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId, userId]);

  const addTask = useCallback(
    async (event) => {
      event.preventDefault();
      const title = newTask.trim();
      if (!title || !projectId || !userId) return;

      setAddingTask(true);
      setErrorMessage('');

      const insertWithPayload = (payload) =>
        supabase
          .from('tasks')
          .insert([payload])
          .select()
          .maybeSingle();

      try {
        let insertResult = await insertWithPayload({
          title,
          project_id: projectId,
          owner_email: userEmail,
          created_by: userId,
          updated_by: userId,
          due_date: newTaskDueDate || null,
          priority: newTaskPriority
        });

        if (insertResult.error && insertResult.error.code === '42703') {
          insertResult = await insertWithPayload({
            title,
            project_id: projectId,
            created_by: userId,
            updated_by: userId,
            due_date: newTaskDueDate || null,
            priority: newTaskPriority
          });
        }

        if (insertResult.error) {
          setErrorMessage(insertResult.error.message);
          return;
        }

        if (insertResult.data) {
          setTasks((prev) => [insertResult.data, ...prev]);
          setNewTask('');
          setNewTaskDueDate('');
          setNewTaskPriority('medium');
        }
      } finally {
        setAddingTask(false);
      }
    },
    [newTask, newTaskDueDate, newTaskPriority, projectId, userEmail, userId]
  );

  const toggleTaskCompletion = useCallback(
    async (task) => {
      setPendingTaskId(task.id);
      const nextCompleted = !task.completed;
      const completionTimestamp = nextCompleted ? new Date().toISOString() : null;

      const { data, error } = await supabase
        .from('tasks')
        .update({ completed: nextCompleted, completed_at: completionTimestamp, updated_by: userId })
        .eq('id', task.id)
        .eq('project_id', projectId)
        .select()
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message);
        setPendingTaskId(null);
        return;
      }

      if (!data) {
        setErrorMessage('No se pudo actualizar la tarea. ¿Pertenece a este usuario?');
        setPendingTaskId(null);
        return;
      }

      setTasks((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setPendingTaskId(null);
    },
    [projectId, userId]
  );

  const updateTaskAssignee = useCallback(
    async (task, assigneeId) => {
      setAssigningTaskId(task.id);
      setErrorMessage('');

      const member = assigneeId ? membersById[assigneeId] : null;
      const payload = {
        assigned_to: member ? member.member_id : null,
        updated_by: userId
      };

      const { data, error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', task.id)
        .eq('project_id', projectId)
        .select()
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message);
        setAssigningTaskId(null);
        return;
      }

      if (data) {
        setTasks((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      }

      setAssigningTaskId(null);
    },
    [membersById, projectId, setAssigneeEditTaskId, userId]
  );

  const deleteTask = useCallback(
    async (taskId) => {
      setPendingTaskId(taskId);

      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('project_id', projectId)
        .select();

      if (error) {
        setErrorMessage(error.message);
        setPendingTaskId(null);
        return;
      }

      if (!data || data.length === 0) {
        setErrorMessage('No se eliminó ninguna tarea. Revisa las políticas de Supabase.');
        setPendingTaskId(null);
        return;
      }

      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      setPendingTaskId(null);
    },
    [projectId, user?.id]
  );

  const renderListView = useMemo(() => {
    if (!projectId) {
      return (
        <Card>
          <p className="text-sm text-slate-500">Selecciona un proyecto para ver sus tareas.</p>
        </Card>
      );
    }

    if (errorMessage) {
      return (
        <Alert color="failure" className="w-full">
          {errorMessage}
        </Alert>
      );
    }

    if (loading && tasks.length === 0) {
      return (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      );
    }

    if (isEmpty) {
      return (
        <Card>
          <p className="text-sm text-slate-500">
            Aún no hay tareas en este proyecto. Crea la primera usando el formulario superior.
          </p>
        </Card>
      );
    }

    if (isFilteredEmpty) {
      return (
        <Card>
          <p className="text-sm text-slate-500">
            Ninguna tarea coincide con los filtros seleccionados. Ajusta los filtros para ver más resultados.
          </p>
        </Card>
      );
    }

    const visibleTasks = filteredTasks.length;
    const completedVisible = filteredTasks.filter((task) => task.completed).length;
    const pendingVisible = visibleTasks - completedVisible;
    const now = Date.now();

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800/60 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
          <span className="text-sm font-semibold text-white">{visibleTasks} tareas visibles</span>
          <span className="text-emerald-300">Completadas: {completedVisible}</span>
          <span className="text-amber-200">Pendientes: {pendingVisible}</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/40 shadow-lg shadow-slate-950/40">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-100">
              <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 w-10">&nbsp;</th>
                  <th className="px-4 py-3 text-left">Tarea</th>
                  <th className="px-4 py-3 text-left">Responsable</th>
                  <th className="px-4 py-3 text-left">Prioridad</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Vencimiento</th>
                  <th className="px-4 py-3 text-left">Última actualización</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const assigneeMember = task.assigned_to ? membersById[task.assigned_to] : null;
                  const statusMeta = task.completed
                    ? { label: 'Completada', color: 'success' }
                    : { label: 'Pendiente', color: 'warning' };
                  const dueDate = task.due_date ? new Date(task.due_date) : null;
                  const dueLabel = dueDate ? new Intl.DateTimeFormat('es-ES').format(dueDate) : 'Sin fecha';
                  const updatedAt = task.updated_at ? new Date(task.updated_at) : task.updated_at;
                  const isOverdue = Boolean(dueDate && !task.completed && dueDate.getTime() < now);
                  const isSelected = selectedTaskDetail?.id === task.id;
                  const subtaskCount = subtaskMeta[task.id];
                  const subtaskTotal = subtaskCount?.total ?? 0;
                  const subtaskCompleted = subtaskCount?.completed ?? 0;
                  const subtaskProgress = subtaskTotal > 0 ? Math.round((subtaskCompleted / subtaskTotal) * 100) : 0;
                  const isHighPriority = task.priority === 'high';

                  const rowBaseClass = 'border-b border-slate-900/40 transition-colors';
                  const rowClass = isSelected
                    ? `${rowBaseClass} border-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20`
                    : isHighPriority
                      ? `${rowBaseClass} border-fuchsia-500/80 bg-fuchsia-500/5 hover:bg-fuchsia-500/10`
                      : `${rowBaseClass} hover:bg-slate-900/60`;

                  return (
                    <tr
                      key={task.id}
                      className={`${rowClass} cursor-pointer`}
                      onClick={() => setSelectedTaskDetail(task)}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTaskCompletion(task);
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-xs transition hover:border-emerald-300"
                        >
                          <span className="sr-only">
                            {task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                          </span>
                          <span className={task.completed ? 'text-emerald-300' : 'text-transparent'}>✓</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-semibold ${task.completed ? 'text-slate-400 line-through' : 'text-white'}`}>{task.title}</p>
                        {task.description ? (
                          <p className="text-xs text-slate-500" title={task.description}>
                            {task.description.length > 80 ? `${task.description.slice(0, 80)}…` : task.description}
                          </p>
                        ) : null}
                        {subtaskCount ? (
                          <p className="text-xs text-slate-400">{subtaskCount.completed}/{subtaskCount.total} subtareas</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{assigneeMember?.member_email ?? 'Sin asignar'}</td>
                      <td className="px-4 py-3">
                        {task.priority ? (
                          <Badge
                            color={
                              task.priority === 'high'
                                ? 'failure'
                                : task.priority === 'low'
                                  ? 'success'
                                  : 'warning'
                            }
                          >
                            {task.priority === 'high'
                              ? 'Alta'
                              : task.priority === 'low'
                                ? 'Baja'
                                : 'Media'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-500">Media</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={statusMeta.color}>{statusMeta.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={isOverdue ? 'text-rose-200 font-semibold' : 'text-slate-300'}>{dueLabel}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {updatedAt ? formatRelativeTime(new Date(updatedAt)) : 'Sin registro'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="xs"
                            color="dark"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedTaskDetail(task);
                            }}
                          >
                            Detalles
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }, [
    errorMessage,
    filteredTasks,
    isEmpty,
    isFilteredEmpty,
    loading,
    membersById,
    projectId,
    selectedTaskDetail?.id,
    subtaskMeta,
    tasks.length,
    toggleTaskCompletion
  ]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    void loadSubtaskMeta();
  }, [loadSubtaskMeta]);

  useEffect(() => {
    if (!selectedTaskDetail?.id) {
      return;
    }

    if (subtasksByTaskId[selectedTaskDetail.id]) {
      return;
    }

    void loadSubtasksForTask(selectedTaskDetail.id);
  }, [loadSubtasksForTask, selectedTaskDetail?.id, subtasksByTaskId]);

  useEffect(() => {
    void loadTaskCommentMeta();
    void loadTaskActivityMeta();
  }, [loadTaskActivityMeta, loadTaskCommentMeta]);

  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    const channel = supabase
      .channel(`task-comment-meta-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments'
        },
        (payload) => {
          const taskId = payload.new?.task_id;
          const createdAt = payload.new?.created_at;
          if (!taskId || !createdAt) {
            return;
          }

          setTaskCommentMeta((previous) => {
            const current = previous[taskId];
            if (current && new Date(current) >= new Date(createdAt)) {
              return previous;
            }
            return { ...previous, [taskId]: createdAt };
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    const channel = supabase
      .channel(`task-activity-meta-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          const taskId = payload.new?.task_id;
          if (!taskId) {
            return;
          }

          setTaskActivityMeta((previous) => {
            const current = previous[taskId];
            const nextDate = payload.new?.created_at;
            if (!nextDate) {
              return previous;
            }
            if (current && new Date(current.createdAt) >= new Date(nextDate)) {
              return previous;
            }
            return {
              ...previous,
              [taskId]: {
                eventType: payload.new?.event_type,
                createdAt: nextDate
              }
            };
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  useEffect(() => {
    if (!filterStorageKey) {
      setFiltersInitialized(false);
      setStatusFilter('all');
      setAssigneeFilter('all');
      setPriorityFilter('all');
      setViewMode('list');
      setCreatedFromFilter('');
      setCreatedToFilter('');
      setDueBeforeFilter('');
      setCompletedBeforeFilter('');
      setSearchQuery('');
      return;
    }

    if (typeof window === 'undefined') {
      setFiltersInitialized(true);
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(filterStorageKey);
      if (storedValue) {
        const parsed = JSON.parse(storedValue);
        if (parsed.statusFilter && ['all', 'pending', 'completed'].includes(parsed.statusFilter)) {
          setStatusFilter(parsed.statusFilter);
        }
        if (
          parsed.assigneeFilter &&
          (parsed.assigneeFilter === 'all' || parsed.assigneeFilter === 'unassigned' || typeof parsed.assigneeFilter === 'string')
        ) {
          setAssigneeFilter(parsed.assigneeFilter);
        }
        if (parsed.priorityFilter && ['all', 'high', 'medium', 'low'].includes(parsed.priorityFilter)) {
          setPriorityFilter(parsed.priorityFilter);
        }
        if (typeof parsed.searchQuery === 'string') {
          setSearchQuery(parsed.searchQuery);
        }
        if (parsed.viewMode && ['list', 'kanban', 'timeline', 'sections'].includes(parsed.viewMode)) {
          setViewMode(parsed.viewMode);
        }
        if (typeof parsed.createdFromFilter === 'string') {
          setCreatedFromFilter(parsed.createdFromFilter);
        }
        if (typeof parsed.createdToFilter === 'string') {
          setCreatedToFilter(parsed.createdToFilter);
        }
        if (typeof parsed.dueBeforeFilter === 'string') {
          setDueBeforeFilter(parsed.dueBeforeFilter);
        }
        if (typeof parsed.completedBeforeFilter === 'string') {
          setCompletedBeforeFilter(parsed.completedBeforeFilter);
        }
      }
    } catch (storageError) {
      console.warn('No se pudieron cargar filtros de tareas almacenados:', storageError);
    } finally {
      setFiltersInitialized(true);
    }
  }, [filterStorageKey]);

  useEffect(() => {
    if (!filterStorageKey || !filtersInitialized || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        filterStorageKey,
        JSON.stringify({
          statusFilter,
          assigneeFilter,
          priorityFilter,
          searchQuery,
          viewMode,
          createdFromFilter,
          createdToFilter,
          dueBeforeFilter,
          completedBeforeFilter
        })
      );
    } catch (storageError) {
      console.warn('No se pudieron guardar los filtros de tareas:', storageError);
    }
  }, [
    assigneeFilter,
    completedBeforeFilter,
    createdFromFilter,
    createdToFilter,
    dueBeforeFilter,
    filterStorageKey,
    filtersInitialized,
    priorityFilter,
    searchQuery,
    statusFilter,
    viewMode
  ]);

  useEffect(() => {
    if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned') {
      const stillExists = members.some((member) => member.member_id === assigneeFilter);
      if (!stillExists) {
        setAssigneeFilter('all');
      }
    }
  }, [assigneeFilter, members]);

  useEffect(() => {
    if (onViewModeChange) {
      onViewModeChange(viewMode);
    }
  }, [onViewModeChange, viewMode]);

  useImperativeHandle(
    ref,
    () => ({
      focusNewTaskInput: () => {
        if (newTaskInputRef.current) {
          newTaskInputRef.current.focus();
          if (typeof newTaskInputRef.current.select === 'function') {
            newTaskInputRef.current.select();
          }
        }
      },
      toggleViewMode: () => {
        const sequence = ['list', 'kanban', 'timeline', 'sections'];
        setViewMode((previous) => {
          const currentIndex = sequence.indexOf(previous);
          if (currentIndex === -1) {
            return sequence[0];
          }
          return sequence[(currentIndex + 1) % sequence.length];
        });
      }
    }),
    []
  );

  const renderTaskCard = useCallback(
    (task) => {
      const isProcessing = pendingTaskId === task.id;
      const isAssigning = assigningTaskId === task.id;
      const createdAt = task.inserted_at ? new Date(task.inserted_at) : null;
      const createdAtLabel = createdAt ? madridDateFormatter.format(createdAt) : null;
      const completedAt = task.completed_at ? new Date(task.completed_at) : null;
      const completedAtLabel = completedAt ? madridDateFormatter.format(completedAt) : null;
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      const dueDateLabel = dueDate ? madridDateFormatter.format(dueDate) : null;
      const now = Date.now();
      const isOverdue = Boolean(dueDate && !task.completed && dueDate.getTime() < now);
      const isDueSoon = Boolean(dueDate && !task.completed && !isOverdue && dueDate.getTime() - now <= 1000 * 60 * 60 * 24);
      const assigneeMember = task.assigned_to ? membersById[task.assigned_to] : null;
      const assigneeLabel = assigneeMember?.member_email ?? task.assigned_to ?? 'Sin asignar';
      const creatorMember = task.created_by ? membersById[task.created_by] : null;
      const creatorLabel = creatorMember?.member_email ?? task.owner_email ?? task.created_by ?? 'Desconocido';
      const updaterMember = task.updated_by ? membersById[task.updated_by] : null;
      const updaterLabel = updaterMember?.member_email ?? task.updated_by ?? 'Sin registro';
      const lastCommentAt = taskCommentMeta[task.id] ? new Date(taskCommentMeta[task.id]) : null;
      const activityMeta = taskActivityMeta[task.id] ?? null;
      const lastActivityLabel = activityMeta?.createdAt ? formatRelativeTime(new Date(activityMeta.createdAt)) : null;
      const lastCommentLabel = lastCommentAt ? formatRelativeTime(lastCommentAt) : null;
      const subtaskCount = subtaskMeta[task.id];
      const subtaskTotal = subtaskCount?.total ?? 0;
      const subtaskCompleted = subtaskCount?.completed ?? 0;
      const subtaskProgress = subtaskTotal > 0 ? Math.round((subtaskCompleted / subtaskTotal) * 100) : 0;
      const isAssigned = Boolean(task.assigned_to);
      const isEditingAssignee = assigneeEditTaskId === task.id;
      const priority = task.priority ?? 'medium';
      const priorityMeta =
        priority === 'high'
          ? { label: 'Alta', color: 'failure' }
          : priority === 'low'
            ? { label: 'Baja', color: 'success' }
            : { label: 'Media', color: 'warning' };

      return (
        <div
          key={task.id}
          className={`flex flex-col gap-4 rounded-2xl border bg-slate-950/70 p-4 transition ${
            priority === 'high'
              ? 'border-fuchsia-500/80 bg-fuchsia-500/5 shadow-lg shadow-fuchsia-500/20 hover:border-fuchsia-400 hover:bg-fuchsia-500/10'
              : 'border-slate-800 hover:border-primary/40'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className={`text-base font-semibold ${task.completed ? 'text-slate-400 line-through' : 'text-white'}`}>{task.title}</p>
              <Button size="xs" color="dark" onClick={() => setSelectedTaskDetail(task)}>
                Ver detalle
              </Button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <Badge color={task.completed ? 'success' : 'warning'}>{task.completed ? 'Completada' : 'Pendiente'}</Badge>
              <Badge color={priorityMeta.color}>{priorityMeta.label}</Badge>
              <span>{createdAtLabel ? `Creada ${createdAtLabel} (Madrid)` : 'Sin fecha registrada'}</span>
              {task.completed && completedAtLabel ? <span>Completada {completedAtLabel}</span> : null}
              {dueDateLabel ? (
                <span className={isOverdue ? 'text-red-300' : isDueSoon ? 'text-yellow-200' : undefined}>
                  {isOverdue
                    ? `Vencida ${dueDateLabel}`
                    : isDueSoon
                      ? `Vence pronto: ${dueDateLabel}`
                      : `Vence ${dueDateLabel}`}
                </span>
              ) : null}
              <span>Responsable: {assigneeLabel}</span>
              <span>Autor: {creatorLabel}</span>
              <span>Última actualización: {updaterLabel}</span>
              {lastActivityLabel && activityMeta?.eventType ? (
                <span>
                  Última actividad: {humanizeEventType(activityMeta.eventType)} · {lastActivityLabel}
                </span>
              ) : null}
              {lastCommentLabel ? <span>Último comentario: {lastCommentLabel}</span> : null}
              {subtaskTotal > 0 ? (
                <span>
                  Subtareas: {subtaskCompleted}/{subtaskTotal} ({subtaskProgress}%)
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-col gap-3">
            {subtaskTotal > 0 ? (
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
                <div
                  className="h-1 rounded-full bg-emerald-400"
                  style={{ width: `${subtaskProgress}%` }}
                />
              </div>
            ) : null}
            {members.length > 0 ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <Select
                  sizing="sm"
                  value={task.assigned_to ?? ''}
                  disabled={
                    isProcessing ||
                    isAssigning ||
                    (isAssigned && !isEditingAssignee)
                  }
                  className="w-full min-w-[12rem] sm:flex-1"
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    const value = event.target.value || null;
                    void updateTaskAssignee(task, value);
                    setAssigneeEditTaskId(null);
                  }}
                >
                  <option value="">Sin asignar</option>
                  {members.map((member) => (
                    <option key={member.member_id} value={member.member_id}>
                      {member.member_email ?? member.member_id} ({member.role})
                    </option>
                  ))}
                </Select>
                {isAssigned && !isEditingAssignee ? (
                  <Button
                    color="dark"
                    size="xs"
                    pill
                    className="w-full sm:w-auto"
                    disabled={isProcessing || isAssigning}
                    onClick={() => setAssigneeEditTaskId(task.id)}
                  >
                    Cambiar responsable
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Añade miembros al proyecto para asignar tareas.</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <Button
                color={task.completed ? 'warning' : 'success'}
                pill
                size="xs"
                disabled={isProcessing}
                className="w-full sm:w-auto"
                onClick={() => toggleTaskCompletion(task)}
              >
                {task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
              </Button>
              <Button
                color="failure"
                pill
                size="xs"
                disabled={isProcessing}
                className="w-full sm:w-auto"
                onClick={() => deleteTask(task.id)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      );
    },
    [
      assigningTaskId,
      assigneeEditTaskId,
      deleteTask,
      members,
      membersById,
      pendingTaskId,
      setAssigneeEditTaskId,
      setSelectedTaskDetail,
      subtaskMeta,
      taskActivityMeta,
      taskCommentMeta,
      toggleTaskCompletion,
      updateTaskAssignee
    ]
  );

  const renderModeContent = useCallback(
    (mode) => {
      if (!projectId) {
        return (
          <Card>
            <p className="text-sm text-slate-500">Selecciona un proyecto para ver sus tareas.</p>
          </Card>
        );
      }

      if (errorMessage) {
        return (
          <Alert color="failure" className="w-full">
            {errorMessage}
          </Alert>
        );
      }

      if (loading && tasks.length === 0) {
        return (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        );
      }

      if (isEmpty) {
        return (
          <Card>
            <p className="text-sm text-slate-500">
              Aún no hay tareas en este proyecto. Crea la primera usando el formulario superior.
            </p>
          </Card>
        );
      }

      if (isFilteredEmpty) {
        return (
          <Card>
            <p className="text-sm text-slate-500">
              Ninguna tarea coincide con los filtros seleccionados. Ajusta los filtros para ver más resultados.
            </p>
          </Card>
        );
      }

      if (mode === 'timeline') {
        const bucketConfigs = [
          { title: 'Atrasadas', tasks: timelineBuckets.overdue, empty: 'Sin tareas atrasadas.' },
          { title: 'Sin fecha límite', tasks: timelineBuckets.undated, empty: 'Todas las tareas tienen fecha.' },
          { title: 'Más adelante', tasks: timelineBuckets.later, empty: 'Nada planificado más allá de dos semanas.' }
        ];

        const renderTaskChip = (task) => {
          const assigneeMember = task.assigned_to ? membersById[task.assigned_to] : null;
          const dueDate = task.due_date ? new Date(task.due_date) : null;
          const isSelected = selectedTaskDetail?.id === task.id;
          const priority = task.priority ?? 'medium';
          const priorityLabel = priority === 'high' ? 'Alta' : priority === 'low' ? 'Baja' : 'Media';
          const isHighPriority = priority === 'high';
          const subMeta = subtaskMeta[task.id];
          const subTotal = subMeta?.total ?? 0;
          const subCompleted = subMeta?.completed ?? 0;
          const subProgress = subTotal > 0 ? Math.round((subCompleted / subTotal) * 100) : 0;

          return (
            <div
              key={task.id}
              className={`mr-1 w-full overflow-hidden rounded-xl border p-3 text-left transition ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-500/10 hover:border-cyan-400 hover:bg-cyan-500/20'
                  : isHighPriority
                    ? 'border-fuchsia-500/80 bg-fuchsia-500/5 hover:border-fuchsia-400 hover:bg-fuchsia-500/10'
                    : 'border-slate-800 bg-slate-900/60 hover:border-cyan-400 hover:bg-cyan-500/5'
              }`}
              onClick={() => setSelectedTaskDetail(task)}
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className={`max-w-[10rem] text-sm font-semibold leading-snug ${
                    task.completed ? 'text-slate-400 line-through' : 'text-white'
                  }`}
                >
                  {task.title}
                </p>
                <button
                  type="button"
                  className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-400 transition hover:border-emerald-300"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleTaskCompletion(task);
                  }}
                >
                  <span className="sr-only">
                    {task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                  </span>
                  <span className={task.completed ? 'text-emerald-300' : 'text-transparent'}>✓</span>
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {dueDate ? timelineTimeFormatter.format(dueDate) : 'Todo el día'} · {assigneeMember?.member_email ?? 'Sin asignar'}
                {` · Prioridad: ${priorityLabel}`}
                {subtaskMeta[task.id]
                  ? ` · ${subtaskMeta[task.id].completed}/${subtaskMeta[task.id].total} subtareas`
                  : ''}
              </p>
              {subtaskMeta[task.id] ? (
                <div className="mt-1 h-1 w-full rounded-full bg-slate-800">
                  <div
                    className="h-1 rounded-full bg-emerald-400"
                    style={{ width: `${(subtaskMeta[task.id].completed / subtaskMeta[task.id].total) * 100}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        };

        return (
          <div className="space-y-6">
            <div className="space-y-4">
              {timelineWeeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                  {week.map((day, dayIndex) => {
                    const absoluteIndex = weekIndex * 7 + dayIndex;
                    const key = timelineDayKeys[absoluteIndex];
                    const dayTasks = timelineBuckets.dayMap[key] ?? [];
                    const isToday = key === timelineDayKeys[0];
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const tasksToShow = dayTasks.slice(0, 3);
                    const remainingTasks = dayTasks.length - tasksToShow.length;

                    return (
                      <div
                        key={key}
                        className={`rounded-2xl border px-3 py-3 overflow-hidden ${
                          isToday ? 'border-cyan-500/70 bg-cyan-500/5' : 'border-slate-800 bg-slate-950/40'
                        } ${isWeekend ? 'opacity-80' : ''}`}
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold text-white">{timelineDayFormatter.format(day)}</span>
                          <Badge color={dayTasks.length ? 'info' : 'gray'}>{dayTasks.length}</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {dayTasks.length === 0 ? (
                            <p className="text-xs text-slate-500">Sin tareas.</p>
                          ) : (
                            <>
                              {tasksToShow.map((task) => renderTaskChip(task))}
                              {remainingTasks > 0 ? (
                                <button
                                  type="button"
                                  className="w-full rounded-lg border border-dashed border-slate-700 py-1 text-xs text-slate-400 hover:border-cyan-400"
                                  onClick={() => {
                                    const targetTask = dayTasks[0];
                                    if (targetTask) {
                                      setSelectedTaskDetail(targetTask);
                                    }
                                  }}
                                >
                                  + {remainingTasks} tarea{remainingTasks > 1 ? 's' : ''} más
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {bucketConfigs.map((bucket) => (
                <div key={bucket.title} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-white">{bucket.title}</span>
                    <Badge color={bucket.tasks.length ? 'warning' : 'gray'}>{bucket.tasks.length}</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {bucket.tasks.length === 0 ? (
                      <p className="text-xs text-slate-500">{bucket.empty}</p>
                    ) : (
                      bucket.tasks.map((task) => renderTaskChip(task))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (mode === 'sections') {
        return (
          <div className="grid gap-4 lg:grid-cols-4">
            {boardSections.map((section) => (
              <div key={section.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-white">{section.title}</span>
                  <Badge color={section.tasks.length ? 'info' : 'gray'}>{section.tasks.length}</Badge>
                </div>
                <div className="mt-3 space-y-3">
                  {section.tasks.length === 0 ? (
                    <p className="text-xs text-slate-500">{section.emptyLabel}</p>
                  ) : (
                    section.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/40 p-3 transition hover:border-cyan-400 hover:bg-cyan-500/5"
                        onClick={() => setSelectedTaskDetail(task)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-sm font-semibold ${
                                task.completed ? 'text-slate-400 line-through' : 'text-white'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.description ? (
                              <p className="text-xs text-slate-500">
                                {task.description.slice(0, 80)}
                                {task.description.length > 80 ? '…' : ''}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 text-[10px] text-slate-400"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleTaskCompletion(task);
                            }}
                          >
                            <span className="sr-only">
                              {task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                            </span>
                            <span className={task.completed ? 'text-emerald-300' : 'text-transparent'}>✓</span>
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="max-w-full break-words">
                            {task.assigned_to
                              ? membersById[task.assigned_to]?.member_email ?? 'Responsable'
                              : 'Sin asignar'}
                          </span>
                          {task.due_date ? (
                            <span>{new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(task.due_date))}</span>
                          ) : (
                            <span>Sin fecha</span>
                          )}
                          <span>
                            {task.updated_at
                              ? `Actualizada ${formatRelativeTime(new Date(task.updated_at))}`
                              : 'Sin actividad reciente'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  <Button size="xs" color="gray" className="w-full" onClick={() => newTaskInputRef.current?.focus()}>
                    + Agregar tarea
                  </Button>
                </div>
              </div>
            ))}
          </div>
        );
      }

      if (mode === 'kanban') {
        const kanbanMeta = {
          pending: { label: 'Pendientes', badgeColor: 'warning' },
          completed: { label: 'Completadas', badgeColor: 'success' }
        };

        return (
          <div className="max-h-[640px] overflow-y-auto pr-2">
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(kanbanColumns).map(([columnKey, columnTasks]) => (
                <Card key={columnKey} className="bg-slate-950/40">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-white">{kanbanMeta[columnKey].label}</span>
                    <Badge color={kanbanMeta[columnKey].badgeColor}>{columnTasks.length}</Badge>
                  </div>
                  <div className="mt-4 space-y-4">
                    {columnTasks.length === 0 ? (
                      <p className="text-xs text-slate-500">Sin tareas en esta columna.</p>
                    ) : (
                      columnTasks.map((task) => <div key={task.id}>{renderTaskCard(task)}</div>)
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      }

      // Vista lista por defecto
      return <div className="space-y-4">{filteredTasks.map((task) => renderTaskCard(task))}</div>;
    },
    [
      errorMessage,
      filteredTasks,
      isEmpty,
      isFilteredEmpty,
      kanbanColumns,
      loading,
      membersById,
      projectId,
      renderTaskCard,
      selectedTaskDetail?.id,
      subtaskMeta,
      timelineBuckets,
      timelineDayFormatter,
      timelineDayKeys,
      timelineDays,
      timelineWeeks,
      timelineTimeFormatter,
      toggleTaskCompletion,
      tasks.length
    ]
  );

  useEffect(() => {
    if (typeof onTaskSummaryChange === 'function') {
      onTaskSummaryChange({
        total: totalTasks,
        pending: pendingCount,
        completed: completedCount
      });
    }
  }, [completedCount, onTaskSummaryChange, pendingCount, totalTasks]);

  useEffect(() => {
    if (!selectedTaskDetail) {
      return;
    }
    const latest = tasks.find((task) => task.id === selectedTaskDetail.id);
    if (latest) {
      setSelectedTaskDetail(latest);
    } else {
      setSelectedTaskDetail(null);
    }
  }, [selectedTaskDetail, tasks]);

  const listContent = renderListView;
  const kanbanContent = renderModeContent('kanban');
  const timelineContent = renderModeContent('timeline');
  const sectionsContent = renderModeContent('sections');

  return (
    <div className="space-y-6">
      <Card className="bg-slate-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Proyecto activo</p>
            <h2 className="text-lg font-semibold text-white">{project?.name ?? 'Sin proyecto seleccionado'}</h2>
            <p className="text-xs text-slate-500">Propietario: {projectOwnerLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Total</p>
              <p className="text-base font-semibold text-white">{totalTasks}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Pendientes</p>
              <p className="text-base font-semibold text-white">{pendingCount}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Completadas</p>
              <p className="text-base font-semibold text-white">{completedCount}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Altas atrasadas</p>
              <p className="text-base font-semibold text-rose-300">{highPriorityStats.overdue}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Altas hoy</p>
              <p className="text-base font-semibold text-amber-200">{highPriorityStats.dueToday}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-slate-950/40">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Nueva tarea</h3>
          </div>
          <form onSubmit={addTask} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <span className="mb-1 block text-xs text-slate-500">Título</span>
              <TextInput
                ref={newTaskInputRef}
                type="text"
                value={newTask}
                disabled={!projectId || addingTask}
                placeholder="Escribe una nueva tarea"
                onChange={(event) => setNewTask(event.target.value)}
                className="w-full"
                maxLength={120}
              />
            </div>
            <div className="flex w-full flex-col gap-1 text-xs text-slate-500 sm:w-auto">
              <span>Fecha de vencimiento</span>
              <input
                type="date"
                value={newTaskDueDate}
                disabled={!projectId || addingTask}
                onChange={(event) => setNewTaskDueDate(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-info focus:ring-info"
              />
            </div>
            <div className="flex w-full flex-col gap-1 text-xs text-slate-500 sm:w-auto">
              <span>Prioridad</span>
              <Select
                value={newTaskPriority}
                onChange={(event) => setNewTaskPriority(event.target.value)}
                disabled={!projectId || addingTask}
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </Select>
            </div>
            <Button type="submit" color="info" className="sm:self-end" disabled={!projectId || addingTask || !newTask.trim()}>
              {addingTask ? 'Creando...' : 'Agregar tarea'}
            </Button>
          </form>
        </div>
      </Card>

      <Card className="bg-slate-950/40">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Filtros rápidos</h3>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Buscar</span>
            <TextInput
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por título o descripción"
              disabled={!projectId}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-900/30 p-2">
            {quickFilters.map((preset) => {
              const isActive =
                statusFilter === preset.status &&
                assigneeFilter === preset.assignee &&
                priorityFilter === (preset.priority ?? 'all');
              return (
                <Button
                  key={preset.id}
                  size="xs"
                  color={isActive ? 'info' : 'gray'}
                  className="whitespace-nowrap"
                  onClick={() => {
                    setStatusFilter(preset.status);
                    setAssigneeFilter(preset.assignee);
                    setPriorityFilter(preset.priority ?? 'all');
                  }}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Estado</span>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todas</option>
                <option value="pending">Solo pendientes</option>
                <option value="completed">Solo completadas</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Responsable</span>
              <Select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="unassigned">Sin asignar</option>
                {members.map((member) => (
                  <option key={member.member_id} value={member.member_id}>
                    {member.member_email ?? member.member_id}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Prioridad</span>
              <Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40">
        <Tabs aria-label="Vistas de tareas" variant="underline" className="w-full">
          <TabItem title="Vista lista" active={viewMode === 'list'} onClick={() => setViewMode('list')}>
            <div className="mt-4">{listContent}</div>
          </TabItem>
          <TabItem title="Vista Kanban" active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')}>
            <div className="mt-4">{kanbanContent}</div>
          </TabItem>
          <TabItem title="Vista Timeline" active={viewMode === 'timeline'} onClick={() => setViewMode('timeline')}>
            <div className="mt-4">{timelineContent}</div>
          </TabItem>
          <TabItem title="Vista tablón" active={viewMode === 'sections'} onClick={() => setViewMode('sections')}>
            <div className="mt-4">{sectionsContent}</div>
          </TabItem>
        </Tabs>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40">
        <TaskDetailPanel
          task={selectedTaskDetail}
          membersById={membersById}
          members={members}
          onClose={() => setSelectedTaskDetail(null)}
          activityMeta={selectedTaskDetail ? taskActivityMeta[selectedTaskDetail.id] : null}
          lastCommentAt={selectedTaskDetail ? taskCommentMeta[selectedTaskDetail.id] : null}
          subtasks={selectedTaskDetail ? subtasksByTaskId[selectedTaskDetail.id] ?? [] : []}
          subtasksLoading={selectedTaskDetail ? Boolean(subtasksLoadingMap[selectedTaskDetail.id]) : false}
          subtaskError={subtaskError}
          onCreateSubtask={handleCreateSubtask}
          onToggleSubtask={handleToggleSubtask}
          onDeleteSubtask={handleDeleteSubtask}
          onRefreshSubtasks={selectedTaskDetail ? () => loadSubtasksForTask(selectedTaskDetail.id) : undefined}
          onUpdateAssignee={updateTaskAssignee}
          onUpdatePriority={updateTaskPriority}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MentionDigest projectId={projectId} members={members} />
        <ActivityLog projectId={projectId} members={members} />
      </div>
    </div>
  );
});

export default TaskList;

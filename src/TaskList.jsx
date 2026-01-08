import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, Select, Spinner } from 'flowbite-react';
import DailyFlash from './components/DailyFlash';
import ActivityLog from './components/ActivityLog';
import MentionDigest from './components/MentionDigest';
import TaskDetailPanel from './components/TaskDetailPanel';
import TaskSectionsBoard from './components/TaskSectionsBoard';
import TaskKanbanBoard from './components/TaskKanbanBoard';
import TaskCreatePanel from './components/TaskCreatePanel';
import TaskFiltersPanel from './components/TaskFiltersPanel';
import { supabase } from './supabaseClient';
import { playSuccessSound } from './utils/audioHelpers';
import { calculateStreak, formatRelativeTime, humanizeEventType, parseDateInput } from './utils/dateHelpers';
import confetti from 'canvas-confetti';

// Vista principal del tablero: lista, kanban, filtros, detalles y todo lo que pasa alrededor de las tareas.
const TaskList = forwardRef(function TaskList(
  { user, projectId, project, members = [], workspaceId = null, assigneePreset = null, onViewModeChange, onTaskSummaryChange, initialTaskId = null },
  ref
) {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');


  const [showDailyFlash, setShowDailyFlash] = useState(false);
  const lastProjectRef = useRef(null);

  useEffect(() => {
    if (projectId && projectId !== lastProjectRef.current) {
      setShowDailyFlash(true);
      lastProjectRef.current = projectId;
    }
  }, [projectId]);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskEffort, setNewTaskEffort] = useState('m');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [addingTask, setAddingTask] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState(null);
  const [assigneeEditTaskId, setAssigneeEditTaskId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [effortFilter, setEffortFilter] = useState('all');
  const [sortMode, setSortMode] = useState('default');
  const [tagFilter, setTagFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createdFromFilter, setCreatedFromFilter] = useState('');
  const [createdToFilter, setCreatedToFilter] = useState('');
  const [dueBeforeFilter, setDueBeforeFilter] = useState('');
  const [completedBeforeFilter, setCompletedBeforeFilter] = useState('');
  const [onlyMentionedFilter, setOnlyMentionedFilter] = useState(false);
  const [taskToolsTab, setTaskToolsTab] = useState('search');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [sectionsGrouping, setSectionsGrouping] = useState('dates');
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [activeTasksSection, setActiveTasksSection] = useState('tasks');
  const newTaskInputRef = useRef(null);
  const [taskCommentMeta, setTaskCommentMeta] = useState({});
  const [taskActivityMeta, setTaskActivityMeta] = useState({});
  const [subtasksByTaskId, setSubtasksByTaskId] = useState({});
  const [subtasksLoadingMap, setSubtasksLoadingMap] = useState({});
  const [subtaskMeta, setSubtaskMeta] = useState({});
  const [subtaskError, setSubtaskError] = useState('');
  const [mentionedTaskIds, setMentionedTaskIds] = useState(new Set());
  const [isCalendarFullscreen, setIsCalendarFullscreen] = useState(false);
  const [projectViewers, setProjectViewers] = useState([]);

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

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
          'id,title,project_id,created_by,assigned_to,owner_email,completed,completed_at,inserted_at,description,due_date,updated_by,updated_at,priority,effort,tags,epic'
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

  const productivityStreak = useMemo(() => {
    const dates = tasks
      .filter((t) => t.completed && t.completed_at && t.assigned_to === userId)
      .map((t) => t.completed_at);
    return calculateStreak(dates);
  }, [tasks, userId]);

  const isEmpty = useMemo(() => !loading && projectId && tasks.length === 0, [loading, projectId, tasks.length]);

  // Si nos llega un responsable preseleccionado desde fuera (por ejemplo, desde el dashboard de colaboradores),
  // ajustamos el filtro de responsable y mostramos los filtros de búsqueda.
  useEffect(() => {
    if (!assigneePreset) {
      return;
    }
    if (assigneePreset === 'all') {
      setAssigneeFilter('all');
      return;
    }
    setAssigneeFilter(assigneePreset === null ? 'unassigned' : assigneePreset);
    setTaskToolsTab('search');
    setShowFilters(true);
  }, [assigneePreset]);

  // Si se proporciona un ID de tarea inicial (navegación desde el dashboard), la abrimos automáticamente.
  useEffect(() => {
    if (initialTaskId && tasks.length > 0) {
      const task = tasks.find((t) => t.id === initialTaskId);
      if (task) {
        setSelectedTaskDetail(task);
      }
    }
  }, [initialTaskId, tasks]);

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

  // Nota: la actualización de esfuerzo de la tarea se realiza desde TaskDetailPanel mediante callbacks específicos.

  const updateTaskEpic = useCallback(
    async (task, nextEpicRaw) => {
      if (!projectId) {
        return;
      }

      const nextEpic = typeof nextEpicRaw === 'string' ? nextEpicRaw.trim() : '';

      setErrorMessage('');

      const { data, error } = await supabase
        .from('tasks')
        .update({ epic: nextEpic.length > 0 ? nextEpic : null, updated_by: userId })
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

  const updateTaskTags = useCallback(
    async (task, nextTags) => {
      if (!projectId) {
        return;
      }

      const safeTags = Array.isArray(nextTags)
        ? nextTags
          .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
          .filter((tag, index, array) => tag && array.indexOf(tag) === index)
        : [];

      setErrorMessage('');

      const { data, error } = await supabase
        .from('tasks')
        .update({ tags: safeTags, updated_by: userId })
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

  // Presencia en tiempo real en el proyecto.
  useEffect(() => {
    if (!userId || !projectId) {
      return undefined;
    }

    const channelId = `project_presence_${projectId} `;
    const channel = supabase.channel(channelId, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const others = [];

        Object.entries(state).forEach(([key, sessions]) => {
          if (!Array.isArray(sessions) || sessions.length === 0) {
            return;
          }
          const session = sessions[0];
          others.push({
            userId: key,
            ...session
          });
        });

        setProjectViewers(others);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      setProjectViewers([]);
    };
  }, [userId, projectId]);

  const filterStorageKey = useMemo(() => {
    if (!userId || !projectId) {
      return null;
    }
    return `taskboard: filters:${userId}:${projectId} `;
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

  const completionStats = useMemo(() => {
    let completedOnTime = 0;
    let completedLate = 0;

    for (const task of tasks) {
      if (!task.completed || !task.due_date || !task.completed_at) {
        continue;
      }

      const due = new Date(task.due_date).getTime();
      const completed = new Date(task.completed_at).getTime();

      if (completed <= due) {
        completedOnTime += 1;
      } else {
        completedLate += 1;
      }
    }

    return { completedOnTime, completedLate };
  }, [tasks]);

  useEffect(() => {
    const loadMentionedTasks = async () => {
      if (!userId || !projectId) {
        setMentionedTaskIds(new Set());
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id,user_id,payload')
        .eq('user_id', userId)
        .contains('payload', { project_id: projectId, type: 'comment_mention' })
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.warn('No se pudieron cargar las menciones del usuario:', error);
        setMentionedTaskIds(new Set());
        return;
      }

      const next = new Set();
      for (const row of data ?? []) {
        const taskId = row?.payload?.task_id;
        if (taskId) {
          next.add(taskId);
        }
      }
      setMentionedTaskIds(next);
    };

    void loadMentionedTasks();
  }, [projectId, userId]);

  useEffect(() => {
    if (!userId || !projectId) {
      return undefined;
    }

    const channel = supabase
      .channel(`mentions - filter - ${projectId} -${userId} `)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id = eq.${userId} `
        },
        (payload) => {
          const newNotif = payload.new;
          if (newNotif?.payload?.type !== 'comment_mention' || newNotif.payload?.project_id !== projectId) {
            return;
          }
          const taskId = newNotif.payload?.task_id;
          if (!taskId) {
            return;
          }
          setMentionedTaskIds((previous) => {
            const next = new Set(previous);
            next.add(taskId);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, userId]);

  const availableTags = useMemo(() => {
    const tagSet = new Set();
    for (const task of tasks) {
      if (Array.isArray(task.tags)) {
        for (const tag of task.tags) {
          const trimmed = typeof tag === 'string' ? tag.trim().toLowerCase() : '';
          if (trimmed) {
            tagSet.add(trimmed);
          }
        }
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedTagFilter = tagFilter.trim().toLowerCase();
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

      if (effortFilter !== 'all') {
        const effort = task.effort ?? 'm';
        if (effort !== effortFilter) {
          return false;
        }
      }

      if (effortFilter !== 'all') {
        const effort = task.effort ?? 'm';
        if (effort !== effortFilter) {
          return false;
        }
      }

      if (normalizedTagFilter) {
        const taskTags = Array.isArray(task.tags) ? task.tags : [];
        const hasTag = taskTags.some(
          (tag) => typeof tag === 'string' && tag.trim().toLowerCase() === normalizedTagFilter
        );
        if (!hasTag) {
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

      if (onlyMentionedFilter && !mentionedTaskIds.has(task.id)) {
        return false;
      }
      return true;
    });
  }, [
    assigneeFilter,
    completedBeforeDate,
    createdFromDate,
    createdToDate,
    dueBeforeDate,
    onlyMentionedFilter,
    mentionedTaskIds,
    effortFilter,
    priorityFilter,
    searchQuery,
    statusFilter,
    tagFilter,
    tasks
  ]);

  const sortedTasks = useMemo(() => {
    if (!filteredTasks.length) {
      return filteredTasks;
    }

    const copy = [...filteredTasks];

    if (sortMode === 'priority') {
      const rank = { high: 0, medium: 1, low: 2 };
      copy.sort((first, second) => {
        const aPriority = rank[first.priority ?? 'medium'] ?? 1;
        const bPriority = rank[second.priority ?? 'medium'] ?? 1;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        const aDue = first.due_date ? new Date(first.due_date).getTime() : Number.POSITIVE_INFINITY;
        const bDue = second.due_date ? new Date(second.due_date).getTime() : Number.POSITIVE_INFINITY;
        if (aDue !== bDue) {
          return aDue - bDue;
        }

        const aInserted = first.inserted_at ? new Date(first.inserted_at).getTime() : 0;
        const bInserted = second.inserted_at ? new Date(second.inserted_at).getTime() : 0;
        return bInserted - aInserted;
      });
    } else if (sortMode === 'due_date') {
      copy.sort((first, second) => {
        const aDue = first.due_date ? new Date(first.due_date).getTime() : Number.POSITIVE_INFINITY;
        const bDue = second.due_date ? new Date(second.due_date).getTime() : Number.POSITIVE_INFINITY;
        if (aDue !== bDue) {
          return aDue - bDue;
        }

        const aInserted = first.inserted_at ? new Date(first.inserted_at).getTime() : 0;
        const bInserted = second.inserted_at ? new Date(second.inserted_at).getTime() : 0;
        return bInserted - aInserted;
      });
    } else if (sortMode === 'last_activity') {
      const getLastActivityTimestamp = (task) => {
        const taskId = task.id;
        const activity = taskActivityMeta[taskId];
        const activityTime = activity?.createdAt ? new Date(activity.createdAt).getTime() : 0;
        const commentTime = taskCommentMeta[taskId] ? new Date(taskCommentMeta[taskId]).getTime() : 0;
        const updatedTime = task.updated_at ? new Date(task.updated_at).getTime() : 0;
        return Math.max(activityTime, commentTime, updatedTime);
      };

      copy.sort((first, second) => getLastActivityTimestamp(second) - getLastActivityTimestamp(first));
    }

    return copy;
  }, [filteredTasks, sortMode, taskActivityMeta, taskCommentMeta]);

  const isFilteredEmpty = useMemo(
    () => !loading && projectId && totalTasks > 0 && filteredTasks.length === 0,
    [filteredTasks.length, loading, projectId, totalTasks]
  );

  const timelineStartDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

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

  const handleGenerateSubtasks = useCallback(
    async (task) => {
      if (!task || !task.id) return;

      const taskId = task.id;
      setSubtasksLoadingMap((prev) => ({ ...prev, [taskId]: true }));
      setSubtaskError('');

      try {
        const title = task.title || 'Tarea';
        const description = task.description || '';

        // --- GOOGLE GEMINI API CALL ---
        // --- GOOGLE GEMINI API CALL (Updated) ---
        const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

        if (!API_KEY) {
          throw new Error('Configuración incompleta: Falta la API Key de Gemini en el archivo .env');
        }

        // Using gemini-flash-latest (likely standard 1.5-flash alias) for better free tier support
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

        const prompt = `
          Act as a project manager. Generate 3 to 5 concise, actionable subtasks for the following task:
          Title: "${title}"
          Description: "${description}"
          
          Return ONLY a raw JSON array of strings. Do not use Markdown code blocks. Do not add explanations.
          Example: ["Analyze requirements", "Draft design", "Implement core logic"]
        `;

        let response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || 'Error communicating with Gemini AI');
        }

        const data = await response.json();

        if (!data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
          throw new Error('Invalid response format from Gemini');
        }

        const rawText = data.candidates[0].content.parts[0].text;

        // Clean up markdown code blocks if Gemini adds them despite instructions
        const cleanedText = rawText.replace(/```json|```/g, '').trim();

        let suggestions = [];
        try {
          suggestions = JSON.parse(cleanedText);
        } catch (e) {
          console.warn("Failed to parse JSON from AI, fallback to line splitting", rawText);
          // Fallback: Split by newlines and remove list markers
          suggestions = cleanedText
            .split('\n')
            .map(line => line.replace(/^[-*•\d.]+\s+/, '').trim())
            .filter(line => line.length > 0)
            .slice(0, 5);
        }

        if (!Array.isArray(suggestions) || suggestions.length === 0) {
          throw new Error('No valid subtasks generated');
        }

        // --- INSERT INTO SUPABASE ---
        const newSubtasks = suggestions.map((suggestion) => ({
          task_id: taskId,
          title: suggestion,
          updated_by: userId
        }));

        const { data: insertedData, error: insertError } = await supabase
          .from('task_subtasks')
          .insert(newSubtasks)
          .select();

        if (insertError) throw insertError;

        // --- UPDATE LOCAL STATE ---
        setSubtasksByTaskId((previous) => {
          const current = previous[taskId] ?? [];
          const nextList = [...current, ...(insertedData ?? [])];
          recalcSubtaskStats(taskId, nextList);
          return { ...previous, [taskId]: nextList };
        });

      } catch (err) {
        console.error("Error generating subtasks:", err);
        setSubtaskError(err.message || 'Error al generar subtareas con IA.');
      } finally {
        setSubtasksLoadingMap((prev) => ({ ...prev, [taskId]: false }));
      }
    },
    [userId, recalcSubtaskStats]
  );

  const handleAutoPrioritize = useCallback(async () => {
    const pendingTasks = tasks.filter(t => !t.completed);
    if (!projectId || !userId || pendingTasks.length === 0) {
      setErrorMessage('No hay tareas pendientes para organizar.');
      return;
    }

    const confirmed = window.confirm('Esto pedirá a la IA que reorganice las prioridades de tus tareas pendientes. ¿Deseas continuar?');
    if (!confirmed) return;

    setAddingTask(true);
    setErrorMessage('');

    try {
      const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
      if (!API_KEY) throw new Error('Falta la API Key de Gemini en el archivo .env');

      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

      const tasksSummary = pendingTasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        due_date: t.due_date,
        effort: t.effort
      }));

      const prompt = `
        Actúa como un experto gestor de proyectos. Analiza las siguientes tareas pendientes y asígnales una prioridad ("high", "medium" o "low") optimizada para maximizar la productividad, considerando sus títulos y fechas de entrega (si las tienen).
        Tareas: ${JSON.stringify(tasksSummary)}

        Devuelve ÚNICAMENTE un array JSON de objetos con este formato: [{"id": "uuid-de-la-tarea", "priority": "high|medium|low"}].
        No añadas texto antes ni después del JSON.
      `;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'Error comunicando con Gemini AI');
      }

      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text;
      const cleanedText = rawText.replace(/```json|```/g, '').trim();
      const newPriorities = JSON.parse(cleanedText);

      if (!Array.isArray(newPriorities)) throw new Error('La IA devolvió un formato inválido.');

      // Actualizar una por una para asegurar cumplimiento de RLS y triggers
      const updates = newPriorities.map(item =>
        supabase
          .from('tasks')
          .update({ priority: item.priority, updated_by: userId })
          .eq('id', item.id)
          .eq('project_id', projectId)
      );

      await Promise.all(updates);
      await loadTasks();

    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Error al intentar priorizar tareas con IA.');
    } finally {
      setAddingTask(false);
    }
  }, [projectId, userId, tasks, loadTasks]);

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
      { id: 'all', label: 'Ver todo', status: 'all', assignee: 'all', priority: 'all', tag: '' },
      { id: 'pending', label: 'Solo pendientes', status: 'pending', assignee: 'all', priority: 'all', tag: '' },
      {
        id: 'pending-unassigned',
        label: 'Pendientes sin responsable',
        status: 'pending',
        assignee: 'unassigned',
        priority: 'all',
        tag: ''
      },
      {
        id: 'completed',
        label: 'Solo completadas',
        status: 'completed',
        assignee: 'all',
        priority: 'all',
        tag: ''
      },
      { id: 'high-all', label: 'Solo prioridad alta', status: 'all', assignee: 'all', priority: 'high', tag: '' },
      {
        id: 'high-pending',
        label: 'Pendientes · alta',
        status: 'pending',
        assignee: 'all',
        priority: 'high',
        tag: ''
      }
    ];

    if (userId && membersById[userId]) {
      presets.push({
        id: 'assigned-to-me',
        label: 'Asignadas a mí',
        status: 'all',
        assignee: membersById[userId].member_id,
        priority: 'all',
        tag: ''
      });
    }

    if (availableTags.includes('bug')) {
      presets.push({
        id: 'tag-bug',
        label: 'Solo bugs',
        status: 'all',
        assignee: 'all',
        priority: 'all',
        tag: 'bug'
      });
    }

    if (availableTags.includes('frontend')) {
      presets.push({
        id: 'tag-frontend',
        label: 'Solo frontend',
        status: 'all',
        assignee: 'all',
        priority: 'all',
        tag: 'frontend'
      });
    }

    return presets;
  }, [availableTags, membersById, userId]);

  const kanbanColumns = useMemo(
    () => ({
      pending: sortedTasks.filter((task) => !task.completed),
      completed: sortedTasks.filter((task) => task.completed)
    }),
    [sortedTasks]
  );

  const boardSections = useMemo(() => {
    if (sectionsGrouping === 'epic') {
      const groups = new Map();

      for (const task of filteredTasks) {
        const rawEpic = typeof task.epic === 'string' ? task.epic.trim() : '';
        const label = rawEpic.length > 0 ? rawEpic : 'Sin epic / grupo';
        if (!groups.has(label)) {
          groups.set(label, []);
        }
        groups.get(label).push(task);
      }

      const entries = Array.from(groups.entries()).sort(([firstLabel], [secondLabel]) =>
        firstLabel.localeCompare(secondLabel, 'es', { sensitivity: 'base' })
      );

      return entries.map(([label, tasksForSection]) => {
        const slug = label
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/gi, '') || 'sin-epic';

        return {
          id: `epic-${slug}`,
          title: label,
          emptyLabel: 'Sin tareas en este grupo.',
          tasks: tasksForSection
        };
      });
    }

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
  }, [filteredTasks, sectionsGrouping]);


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
          priority: newTaskPriority,
          effort: newTaskEffort
        });

        if (insertResult.error && insertResult.error.code === '42703') {
          insertResult = await insertWithPayload({
            title,
            project_id: projectId,
            created_by: userId,
            updated_by: userId,
            due_date: newTaskDueDate || null,
            priority: newTaskPriority,
            effort: newTaskEffort
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
          setNewTaskEffort('m');
        }
      } finally {
        setAddingTask(false);
      }
    },
    [newTask, newTaskDueDate, newTaskEffort, newTaskPriority, projectId, userEmail, userId]
  );

  const toggleTaskCompletion = useCallback(
    async (task) => {
      setPendingTaskId(task.id);
      const nextCompleted = !task.completed;
      const completionTimestamp = nextCompleted ? new Date().toISOString() : null;

      if (nextCompleted) {
        playSuccessSound();
      }

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
      if (nextCompleted) {
        // Disparar confetti
        if (task.priority === 'high') {
          // Confetti más persistente para tareas de alta prioridad
          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

          const randomInRange = (min, max) => Math.random() * (max - min) + min;

          const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 25 * (timeLeft / duration);
            // since particles fall down, start a bit higher than random
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
              gravity: 0.8,
              scalar: 0.8,
              drift: randomInRange(-0.5, 0.5)
            });
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
              gravity: 0.8,
              scalar: 0.8,
              drift: randomInRange(-0.5, 0.5)
            });
          }, 450);
        } else {
          // Confetti básico para otras - Ajustado para ser más suave
          void confetti({
            particleCount: 60,
            spread: 60,
            origin: { y: 0.7 },
            gravity: 1.0,
            scalar: 0.7,
            ticks: 150
          });
        }
      }
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
    [membersById, projectId, userId]
  );

  const handleBulkUpdateCompletion = useCallback(
    async (nextCompleted) => {
      if (!projectId || !userId || selectedTaskIds.length === 0) {
        return;
      }

      setErrorMessage('');
      const completionTimestamp = nextCompleted ? new Date().toISOString() : null;

      if (nextCompleted) {
        playSuccessSound();
      }

      const { data, error } = await supabase
        .from('tasks')
        .update({ completed: nextCompleted, completed_at: completionTimestamp, updated_by: userId })
        .eq('project_id', projectId)
        .in('id', selectedTaskIds)
        .select();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data && data.length > 0) {
        setTasks((previous) => {
          const updatedMap = new Map(data.map((item) => [item.id, item]));
          return previous.map((item) => updatedMap.get(item.id) ?? item);
        });
        setSelectedTaskIds([]);
      }
    },
    [projectId, selectedTaskIds, userId]
  );

  const handleBulkUpdatePriority = useCallback(
    async (nextPriority) => {
      if (!projectId || !userId || selectedTaskIds.length === 0 || !nextPriority) {
        return;
      }

      setErrorMessage('');

      const { data, error } = await supabase
        .from('tasks')
        .update({ priority: nextPriority, updated_by: userId })
        .eq('project_id', projectId)
        .in('id', selectedTaskIds)
        .select();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data && data.length > 0) {
        setTasks((previous) => {
          const updatedMap = new Map(data.map((item) => [item.id, item]));
          return previous.map((item) => updatedMap.get(item.id) ?? item);
        });
        setSelectedTaskIds([]);
      }
    },
    [projectId, selectedTaskIds, userId]
  );

  const handleBulkUpdateAssignee = useCallback(
    async (assigneeId) => {
      if (!projectId || !userId || selectedTaskIds.length === 0) {
        return;
      }

      setErrorMessage('');
      const shouldUnassign = assigneeId === '__unassign__';
      const member = shouldUnassign || !assigneeId ? null : membersById[assigneeId];
      const assignedTo = member ? member.member_id : null;

      const { data, error } = await supabase
        .from('tasks')
        .update({ assigned_to: assignedTo, updated_by: userId })
        .eq('project_id', projectId)
        .in('id', selectedTaskIds)
        .select();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data && data.length > 0) {
        setTasks((previous) => {
          const updatedMap = new Map(data.map((item) => [item.id, item]));
          return previous.map((item) => updatedMap.get(item.id) ?? item);
        });
        setSelectedTaskIds([]);
      }
    },
    [membersById, projectId, selectedTaskIds, userId]
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
    [projectId]
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
    const hasSelection = selectedTaskIds.length > 0;
    const allVisibleSelected = hasSelection && selectedTaskIds.length === visibleTasks;

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/60 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{visibleTasks} tareas visibles</span>
          <span className="text-emerald-700 dark:text-emerald-300">Completadas: {completedVisible}</span>
          <span className="text-amber-700 dark:text-amber-200">Pendientes: {pendingVisible}</span>
        </div>
        {hasSelection ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 px-4 py-2 text-xs text-cyan-900 dark:text-cyan-100">
            <span className="text-sm font-semibold text-cyan-800 dark:text-cyan-200">
              {selectedTaskIds.length} tarea
              {selectedTaskIds.length === 1 ? '' : 's'} seleccionada
              {selectedTaskIds.length === 1 ? '' : 's'}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="xs" color="success" onClick={() => void handleBulkUpdateCompletion(true)}>
                Completar
              </Button>
              <Button size="xs" color="warning" onClick={() => void handleBulkUpdateCompletion(false)}>
                Pendiente
              </Button>
              <Button size="xs" color="gray" onClick={() => setSelectedTaskIds([])}>
                Limpiar
              </Button>
            </div>
            <Select
              sizing="sm"
              className="w-full sm:w-40"
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value;
                if (value) {
                  void handleBulkUpdatePriority(value);
                  event.target.value = '';
                }
              }}
            >
              <option value="">Cambiar prioridad…</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </Select>
          </div>
        ) : null}

        {/* Mobile List View */}
        <div className="block sm:hidden space-y-3">
          {sortedTasks.map((task) => {
            const assigneeMember = task.assigned_to ? membersById[task.assigned_to] : null;
            const assigneeLabel = assigneeMember?.member_email ?? (task.assigned_to ? 'Asignado' : 'Sin asignar');
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const dueLabel = dueDate ? new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' }).format(dueDate) : null;
            const isOverdue = Boolean(dueDate && !task.completed && dueDate.getTime() < now);

            return (
              <div
                key={task.id}
                onClick={() => {
                  setSelectedTaskDetail(task);
                  setViewMode('detail');
                  setActiveTasksSection('tasks');
                }}
                className={`flex flex-col gap-2 rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-950/40 cursor-pointer ${task.completed ? 'border-slate-200 dark:border-slate-800 opacity-75' :
                  task.priority === 'high' ? 'border-rose-200 dark:border-rose-900/50' : 'border-slate-200 dark:border-slate-800'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold line-clamp-2 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                    {task.title}
                  </p>
                  <Checkbox
                    className="shrink-0"
                    checked={selectedTaskIds.includes(task.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedTaskIds((previous) => {
                        if (checked) {
                          if (previous.includes(task.id)) return previous;
                          return [...previous, task.id];
                        }
                        return previous.filter((id) => id !== task.id);
                      });
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Badge color={task.priority === 'high' ? 'failure' : task.priority === 'low' ? 'success' : 'warning'} size="xs">
                    {task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baja' : 'Media'}
                  </Badge>
                  {dueLabel && (
                    <span className={isOverdue ? 'text-rose-600 font-medium' : ''}>
                      {isOverdue ? '!' : ''} {dueLabel}
                    </span>
                  )}
                  <span className="truncate max-w-[100px]">{assigneeLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/40 shadow-lg shadow-slate-200/40 dark:shadow-slate-950/40">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-100">
              <thead className="bg-slate-50 dark:bg-slate-950/70 text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      className="text-cyan-600 focus:ring-cyan-600 border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:focus:ring-cyan-600"
                      checked={allVisibleSelected}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        if (checked) {
                          setSelectedTaskIds(sortedTasks.map((task) => task.id));
                        } else {
                          setSelectedTaskIds([]);
                        }
                      }}
                    />
                  </th>
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
                {sortedTasks.map((task) => {
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
                  const isHighPriority = task.priority === 'high';
                  const tags = Array.isArray(task.tags) ? task.tags : [];

                  const rowBaseClass = 'border-b border-slate-900/40 transition-colors';
                  const rowClass = isSelected
                    ? `${rowBaseClass} border-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20`
                    : isHighPriority
                      ? `${rowBaseClass} border-fuchsia-500/80 bg-fuchsia-500/5 hover:bg-fuchsia-500/10`
                      : `${rowBaseClass} hover:bg-slate-100 dark:hover:bg-slate-900/60`;

                  return (
                    <tr
                      key={task.id}
                      className={`${rowClass} cursor-pointer`}
                      onClick={() => {
                        setSelectedTaskDetail(task);
                        setViewMode('detail');
                        setActiveTasksSection('tasks');
                      }}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          className="text-cyan-600 focus:ring-cyan-600 border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:focus:ring-cyan-600"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={(event) => {
                            event.stopPropagation();
                            const checked = event.target.checked;
                            setSelectedTaskIds((previous) => {
                              if (checked) {
                                if (previous.includes(task.id)) {
                                  return previous;
                                }
                                return [...previous, task.id];
                              }
                              return previous.filter((id) => id !== task.id);
                            });
                          }}
                        />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                        <p className={`font-semibold ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{task.title}</p>
                        {task.description ? (
                          <p className="text-xs text-slate-500" title={task.description}>
                            {task.description.length > 80 ? `${task.description.slice(0, 80)}…` : task.description}
                          </p>
                        ) : null}
                        {subtaskCount ? (
                          <p className="text-xs text-slate-400">{subtaskCount.completed}/{subtaskCount.total} subtareas</p>
                        ) : null}
                        {tags.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {tags.slice(0, 4).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-slate-200 dark:bg-slate-900 px-2 py-0.5 text-[10px] text-slate-700 dark:text-slate-200"
                              >
                                #{tag}
                              </span>
                            ))}
                            {tags.length > 4 ? (
                              <span className="text-[10px] text-slate-500">+{tags.length - 4} más</span>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{assigneeMember?.member_email ?? 'Sin asignar'}</td>
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
                        <span className={isOverdue ? 'text-rose-600 dark:text-rose-200 font-semibold' : 'text-slate-700 dark:text-slate-300'}>{dueLabel}</span>
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
                              setViewMode('detail');
                              setActiveTasksSection('tasks');
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
    handleBulkUpdateCompletion,
    handleBulkUpdatePriority,
    loading,
    membersById,
    projectId,
    selectedTaskDetail?.id,
    sortedTasks,
    selectedTaskIds,
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
      setSortMode('default');
      setViewMode('list');
      setCreatedFromFilter('');
      setCreatedToFilter('');
      setDueBeforeFilter('');
      setCompletedBeforeFilter('');
      setSearchQuery('');
      setTagFilter('');
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
        if (typeof parsed.tagFilter === 'string') {
          setTagFilter(parsed.tagFilter);
        }
        if (
          typeof parsed.sortMode === 'string' &&
          ['default', 'priority', 'due_date', 'last_activity'].includes(parsed.sortMode)
        ) {
          setSortMode(parsed.sortMode);
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
          tagFilter,
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
    sortMode,
    tagFilter,
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
        const sequence = ['list', 'kanban', 'timeline', 'calendar', 'sections'];
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
      const assigneeLabel = assigneeMember?.member_email ?? (task.assigned_to ? 'Colaborador' : 'Sin asignar');
      const creatorMember = task.created_by ? membersById[task.created_by] : null;
      const creatorLabel = creatorMember?.member_email ?? task.owner_email ?? 'Dueño del Proyecto';
      const updaterMember = task.updated_by ? membersById[task.updated_by] : null;
      const updaterLabel = updaterMember?.member_email ?? (task.updated_by ? 'Colaborador' : 'Sin registro');
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
      const effort = task.effort ?? 'm';
      const effortMeta =
        effort === 's'
          ? { label: 'S (pequeño)', color: 'success' }
          : effort === 'l'
            ? { label: 'L (grande)', color: 'failure' }
            : { label: 'M (medio)', color: 'indigo' };
      const tags = Array.isArray(task.tags) ? task.tags : [];

      const isAuthUserAssignee = task.assigned_to === userId;

      return (
        <div
          key={task.id}
          className={`flex flex-col gap-4 rounded-2xl border transition p-4 ${priority === 'high'
            ? 'border-fuchsia-500/80 bg-fuchsia-500/5 shadow-lg shadow-fuchsia-500/20 hover:border-fuchsia-400 hover:bg-fuchsia-500/10'
            : isAuthUserAssignee
              ? 'border-cyan-500/50 bg-cyan-500/5 shadow-md shadow-cyan-500/10 dark:shadow-cyan-900/20 hover:border-cyan-400 hover:bg-cyan-500/10'
              : 'bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 hover:border-primary/40'
            }`}
          onClick={() => {
            setSelectedTaskDetail(task);
            setViewMode('detail');
            setActiveTasksSection('tasks');
          }}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className={`text-base font-semibold ${task.completed ? 'text-slate-400 line-through' : 'text-white'}`}>{task.title}</p>
              <Button
                size="xs"
                color="dark"
                onClick={() => {
                  setSelectedTaskDetail(task);
                  setViewMode('detail');
                  setActiveTasksSection('tasks');
                }}
              >
                Ver detalle
              </Button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <Badge color={task.completed ? 'success' : 'warning'}>{task.completed ? 'Completada' : 'Pendiente'}</Badge>
              <Badge color={priorityMeta.color}>{priorityMeta.label}</Badge>
              <Badge color={effortMeta.color}>{effortMeta.label}</Badge>
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
              {tags.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200"
                    >
                      #{tag}
                    </span>
                  ))}
                  {tags.length > 4 ? (
                    <span className="text-[10px] text-slate-500">+{tags.length - 4} más</span>
                  ) : null}
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
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTaskCompletion(task);
                }}
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
      updateTaskAssignee,
      madridDateFormatter,
      userId
    ]
  );

  useEffect(() => {
    if (!onTaskSummaryChange) {
      return;
    }

    onTaskSummaryChange({
      total: totalTasks,
      pending: pendingCount,
      completed: completedCount,
      completedOnTime: completionStats.completedOnTime,
      completedLate: completionStats.completedLate
    });
  }, [completedCount, completionStats.completedLate, completionStats.completedOnTime, onTaskSummaryChange, pendingCount, totalTasks]);

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

  useEffect(() => {
    if (selectedTaskDetail) {
      setViewMode('detail');
      setActiveTasksSection('tasks');

      // Hack: forzar a Flowbite Tabs a activar visualmente la pestaña "Vista detalle"
      setTimeout(() => {
        try {
          const tabs = document.querySelectorAll('button[role="tab"]');
          for (const tab of tabs) {
            const label = tab.textContent?.trim() ?? '';
            if (label.includes('Vista detalle')) {
              tab.click();
              break;
            }
          }
        } catch (error) {
          // Ignorar errores de acceso al DOM
        }
      }, 0);
    }
  }, [selectedTaskDetail]);

  const renderModeContent = (mode) => {
    if (!projectId) {
      return null;
    }

    if (mode === 'kanban') {
      const handleMoveTaskInKanban = (taskId, targetColumnKey) => {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;

        const isCompleted = Boolean(task.completed);
        if (targetColumnKey === 'completed' && !isCompleted) {
          void toggleTaskCompletion(task);
        } else if (targetColumnKey === 'pending' && isCompleted) {
          void toggleTaskCompletion(task);
        }
      };

      return (
        <TaskKanbanBoard
          columns={kanbanColumns}
          renderTaskCard={renderTaskCard}
          onMoveTask={handleMoveTaskInKanban}
        />
      );
    }

    if (mode === 'timeline') {
      const { dayMap, overdue, undated, later } = timelineBuckets;

      const renderTaskChip = (task) => {
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const timeLabel = dueDate ? timelineTimeFormatter.format(dueDate) : null;
        const isAuthUserAssignee = task.assigned_to === userId;

        return (
          <button
            key={task.id}
            type="button"
            className={`w-full rounded-xl border p-2 text-left text-xs transition-colors ${isAuthUserAssignee
              ? 'border-cyan-500/40 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-100 hover:bg-cyan-200 dark:hover:bg-cyan-900/50'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/40'
              }`}
            onClick={() => {
              setSelectedTaskDetail(task);
              setViewMode('detail');
              setActiveTasksSection('tasks');
            }}
          >
            {timeLabel ? <span className="mr-1 text-[10px] text-slate-400">{timeLabel}</span> : null}
            <span className={task.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}>{task.title}</span>
          </button>
        );
      };

      return (
        <div className="space-y-4">
          {overdue.length > 0 ? (
            <Card className="bg-white dark:bg-slate-950/40">
              <div className="mb-2 text-xs font-semibold text-rose-700 dark:text-rose-200">Vencidas</div>
              <div className="space-y-2">
                {overdue.map((task) => renderTaskChip(task))}
              </div>
            </Card>
          ) : null}

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-3">
              {timelineDays.map((day) => {
                const key = day.toISOString().split('T')[0];
                const dayTasks = dayMap[key] ?? [];
                return (
                  <Card key={key} className="min-w-[180px] bg-white dark:bg-slate-950/40">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-900 dark:text-white">{timelineDayFormatter.format(day)}</span>
                      <Badge color={dayTasks.length ? 'info' : 'gray'}>{dayTasks.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {dayTasks.length === 0 ? (
                        <p className="text-[11px] text-slate-500">Sin tareas para este día.</p>
                      ) : (
                        dayTasks.map((task) => renderTaskChip(task))
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {(later.length > 0 || undated.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {later.length > 0 ? (
                <Card className="bg-white dark:bg-slate-950/40">
                  <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Más adelante</div>
                  <div className="space-y-2">
                    {later.map((task) => renderTaskChip(task))}
                  </div>
                </Card>
              ) : null}
              {undated.length > 0 ? (
                <Card className="bg-white dark:bg-slate-950/40">
                  <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Sin fecha</div>
                  <div className="space-y-2">
                    {undated.map((task) => renderTaskChip(task))}
                  </div>
                </Card>
              ) : null}
            </div>
          )}
        </div>
      );
    }

    if (mode === 'calendar') {
      const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
      const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);

      const startWeekday = (monthStart.getDay() + 6) % 7; // Lunes = 0
      const daysInMonth = monthEnd.getDate();

      const cells = [];
      for (let index = 0; index < startWeekday; index += 1) {
        cells.push(null);
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
      }

      const formatKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const tasksByDay = tasks.reduce((accumulator, task) => {
        if (!task.due_date) {
          return accumulator;
        }
        const date = new Date(task.due_date);
        const key = formatKey(date);
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

      const goToPreviousMonth = () => {
        setCalendarMonth((previous) => {
          const next = new Date(previous);
          next.setMonth(next.getMonth() - 1);
          next.setDate(1);
          return next;
        });
      };

      const goToNextMonth = () => {
        setCalendarMonth((previous) => {
          const next = new Date(previous);
          next.setMonth(next.getMonth() + 1);
          next.setDate(1);
          return next;
        });
      };

      const todayKey = new Date().toISOString().split('T')[0];

      const wrapperClassName = isCalendarFullscreen
        ? 'fixed inset-0 z-40 flex flex-col gap-4 bg-slate-950/95 px-4 py-4 sm:px-8'
        : 'mt-4 space-y-4 px-2 pb-2 sm:px-4 sm:pb-4';

      return (
        <div className={wrapperClassName}>
          <div className="flex items-center justify-between text-sm text-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-cyan-400"
                onClick={goToPreviousMonth}
              >
                Anterior
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-cyan-400"
                onClick={goToNextMonth}
              >
                Siguiente
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">{monthLabel}</div>
              <Button
                size="xs"
                color="dark"
                onClick={() => setIsCalendarFullscreen((previous) => !previous)}
              >
                {isCalendarFullscreen ? 'Cerrar calendario' : 'Pantalla completa'}
              </Button>
            </div>
          </div>

          <div className="hidden sm:grid sm:grid-cols-7 gap-3 text-[11px] text-slate-400">
            {weekdayHeaders.map((label) => (
              <div key={label} className="text-center font-bold uppercase tracking-widest text-slate-500">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
            {cells.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="hidden sm:block h-24 rounded-2xl border border-transparent" />;
              }

              const key = formatKey(date);
              const dayTasks = tasksByDay[key] ?? [];
              const isToday = key === todayKey;
              const weekdayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);

              return (
                <Card
                  key={key}
                  className={`flex min-h-[96px] flex-col rounded-2xl border bg-white dark:bg-slate-950/60 p-2 ${isToday ? 'border-cyan-400/80 shadow-cyan-500/30' : 'border-slate-200 dark:border-slate-800'
                    }`}
                >
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span className={isToday ? 'font-semibold text-cyan-600 dark:text-cyan-200' : 'font-semibold text-slate-900 dark:text-slate-200'}>
                      <span className="capitalize sm:hidden mr-1">{weekdayName}</span>
                      {date.getDate()}
                    </span>
                    <Badge color={dayTasks.length ? 'info' : 'gray'}>{dayTasks.length}</Badge>
                  </div>
                  <div className="flex-1 space-y-1 overflow-y-auto pr-1">
                    {dayTasks.length === 0 ? (
                      <p className="text-[10px] text-slate-500">Sin tareas.</p>
                    ) : (
                      dayTasks.slice(0, 3).map((task) => {
                        const assigneeMember = task.assigned_to ? membersById[task.assigned_to] : null;
                        const assigneeLabel = assigneeMember?.member_email ?? task.assigned_to ?? 'Sin asignar';
                        const isAuthUserAssignee = task.assigned_to === userId;

                        const priorityColorClass = task.priority === 'high'
                          ? 'border-rose-500/50 bg-rose-100 dark:bg-rose-900/30 text-rose-900 dark:text-rose-100'
                          : task.priority === 'medium'
                            ? 'border-amber-500/50 bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'
                            : 'border-emerald-500/50 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100';

                        return (
                          <button
                            key={task.id}
                            type="button"
                            className={`w-full rounded-lg border px-1 py-0.5 text-left text-[11px] transition-colors ${isAuthUserAssignee
                              ? 'ring-1 ring-cyan-500/50'
                              : ''
                              } ${priorityColorClass} hover:opacity-80`}
                            onClick={() => {
                              setSelectedTaskDetail(task);
                              setViewMode('detail');
                              setActiveTasksSection('tasks');
                            }}
                            title={task.title}
                          >
                            <div className="whitespace-normal break-words leading-tight">{task.title}</div>
                            <div className="truncate text-[10px] text-slate-400" title={`Resp: ${assigneeLabel}`}>Resp: {assigneeLabel}</div>
                          </button>
                        );
                      })
                    )}
                    {dayTasks.length > 3 ? (
                      <p className="text-[10px] text-slate-500">+{dayTasks.length - 3} más</p>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-800/50">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <div className="h-2 w-2 rounded-full bg-rose-500"></div>
              <span>Alta</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <div className="h-2 w-2 rounded-full bg-amber-500"></div>
              <span>Media</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              <span>Baja</span>
            </div>
          </div>
        </div>
      );
    }

    if (mode === 'sections') {
      const handleMoveTaskInSections = (taskId, targetSectionId) => {
        if (sectionsGrouping !== 'epic') {
          return;
        }

        const task = tasks.find((item) => item.id === taskId);
        if (!task) {
          return;
        }

        const targetSection = boardSections.find((section) => section.id === targetSectionId);
        if (!targetSection) {
          return;
        }

        // En agrupación por epic, el título de la sección es el valor del epic (o "Sin epic / grupo").
        const rawLabel = targetSection.title || '';
        const nextEpic = rawLabel.startsWith('Sin epic') ? '' : rawLabel;

        void updateTaskEpic(task, nextEpic);
      };

      return (
        <TaskSectionsBoard
          sections={boardSections}
          sectionsGrouping={sectionsGrouping}
          onChangeSectionsGrouping={setSectionsGrouping}
          membersById={membersById}
          onToggleTaskCompletion={toggleTaskCompletion}
          onSelectTask={(task) => {
            setSelectedTaskDetail(task);
            setViewMode('detail');
            setActiveTasksSection('tasks');
          }}
          onFocusNewTaskInput={() => {
            setShowCreatePanel(true);
            requestAnimationFrame(() => {
              newTaskInputRef.current?.focus?.();
            });
          }}
          onMoveTask={handleMoveTaskInSections}
        />
      );
    }

    return null;
  };

  const listContent = renderListView;
  const kanbanContent = renderModeContent('kanban');
  const timelineContent = renderModeContent('timeline');
  const calendarContent = renderModeContent('calendar');
  const sectionsContent = renderModeContent('sections');

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/40 backdrop-blur-xl shadow-lg shadow-slate-200/20 dark:shadow-black/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Proyecto activo</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{project?.name ?? 'Sin proyecto seleccionado'}</h2>
              <p className="text-xs text-slate-500">Propietario: {projectOwnerLabel}</p>
            </div>

            {/* Burbujas de Presencia */}
            {projectViewers.length > 0 && (
              <div className="flex flex-col items-end gap-1 px-4">
                <div className="flex -space-x-2">
                  {projectViewers.slice(0, 5).map((viewer, idx) => {
                    const member = membersById[viewer.userId];
                    const initials = member?.member_email?.[0].toUpperCase() || '?';
                    return (
                      <div
                        key={viewer.userId}
                        title={member?.member_email || 'Cargando...'}
                        className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-slate-100 dark:border-slate-900 dark:bg-slate-800"
                        style={{ zIndex: 10 - idx }}
                      >
                        {member?.avatar_url ? (
                          <img src={member.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {initials}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900" />
                      </div>
                    );
                  })}
                  {projectViewers.length > 5 && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-bold text-slate-600 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-300">
                      +{projectViewers.length - 5}
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  {projectViewers.length} {projectViewers.length === 1 ? 'activo' : 'activos'}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Total</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">{totalTasks}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Pendientes</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">{pendingCount}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Completadas</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">{completedCount}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Altas atrasadas</p>
              <p className="text-base font-semibold text-rose-600 dark:text-rose-300">{highPriorityStats.overdue}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-slate-500">Altas hoy</p>
              <p className="text-base font-semibold text-amber-600 dark:text-amber-200">{highPriorityStats.dueToday}</p>
            </div>
            {productivityStreak > 0 && (
              <div className="flex flex-col items-center text-center px-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <p className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400">Racha 🔥</p>
                <p className="text-base font-black text-orange-600 dark:text-orange-400">
                  {productivityStreak} {productivityStreak === 1 ? 'Día' : 'Días'}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {showDailyFlash && projectId && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <DailyFlash projectId={projectId} onClose={() => setShowDailyFlash(false)} />
        </div>
      )}

      <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/40 backdrop-blur-xl shadow-lg shadow-slate-200/20 dark:shadow-black/20">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
            {[
              {
                id: 'tasks', label: 'Tareas', icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                  </svg>
                )
              },
              {
                id: 'insights', label: 'Menciones y actividad', icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                )
              }
            ].map((tab) => {
              const isActive = activeTasksSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTasksSection(tab.id)}
                  className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors ${isActive
                    ? 'border-cyan-500 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-300'
                    }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="min-h-[300px]">
            {activeTasksSection === 'tasks' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    {
                      id: 'search', label: 'Buscar', icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                      )
                    },
                    {
                      id: 'create', label: 'Crear tarea', icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      )
                    },
                    {
                      id: 'ai-prioritize', label: 'Priorizar con IA', icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                      ),
                      onClick: handleAutoPrioritize
                    }
                  ].map((tool) => {
                    if (tool.id === 'ai-prioritize') {
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          disabled={addingTask}
                          onClick={tool.onClick}
                          className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/5 px-3 py-2 text-xs font-medium text-purple-600 transition-all hover:bg-purple-500/10 dark:text-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        >
                          {tool.icon}
                          <span>{tool.label}</span>
                        </button>
                      );
                    }
                    const isActive = taskToolsTab === tool.id;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => setTaskToolsTab(tool.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${isActive
                          ? 'border-cyan-500/30 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                          : 'border-slate-200 bg-white/50 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300'
                          }`}
                      >
                        {tool.icon}
                        <span>{tool.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  {taskToolsTab === 'search' && (
                    <div className="space-y-4">

                      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                        <span>Filtros de búsqueda</span>
                        <button
                          type="button"
                          className="rounded-full border border-sky-200 dark:border-sky-400/40 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-700 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-500/20 hover:text-sky-800 dark:hover:text-sky-100"
                          onClick={() => setShowFilters((prev) => !prev)}
                        >
                          {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                        </button>
                      </div>

                      {showFilters ? (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                          <TaskFiltersPanel
                            projectId={projectId}
                            searchQuery={searchQuery}
                            onSearchQueryChange={setSearchQuery}
                            quickFilters={quickFilters}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            assigneeFilter={assigneeFilter}
                            setAssigneeFilter={setAssigneeFilter}
                            priorityFilter={priorityFilter}
                            setPriorityFilter={setPriorityFilter}
                            effortFilter={effortFilter}
                            setEffortFilter={setEffortFilter}
                            tagFilter={tagFilter}
                            setTagFilter={setTagFilter}
                            sortMode={sortMode}
                            setSortMode={setSortMode}
                            onlyMentionedFilter={onlyMentionedFilter}
                            setOnlyMentionedFilter={setOnlyMentionedFilter}
                            hasMentionedTasks={mentionedTaskIds.size > 0}
                            members={members}
                            availableTags={availableTags}
                          />
                        </div>
                      ) : null}
                    </div>
                  )}

                  {taskToolsTab === 'create' && (
                    <div className="mt-2">
                      <TaskCreatePanel
                        projectId={projectId}
                        newTask={newTask}
                        newTaskDueDate={newTaskDueDate}
                        newTaskPriority={newTaskPriority}
                        newTaskEffort={newTaskEffort}
                        addingTask={addingTask}
                        inputRef={newTaskInputRef}
                        onSubmit={addTask}
                        onChangeTitle={setNewTask}
                        onChangeDueDate={setNewTaskDueDate}
                        onChangePriority={setNewTaskPriority}
                        onChangeEffort={setNewTaskEffort}
                        showTitle
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-950/30 backdrop-blur-lg p-3">
                  <nav className="flex flex-wrap gap-2 mb-4" aria-label="Vistas de tareas">
                    {[
                      {
                        id: 'list', label: 'Lista', icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.008v.008H3.75V6.75Zm0 5.25h.008v.008H3.75V12Zm0 5.25h.008v.008H3.75v-.008Z" />
                          </svg>
                        )
                      },
                      {
                        id: 'kanban', label: 'Kanban', icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" />
                          </svg>
                        )
                      },
                      {
                        id: 'timeline', label: 'Timeline', icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                          </svg>
                        )
                      },
                      {
                        id: 'calendar', label: 'Calendario', icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                          </svg>
                        )
                      },
                      {
                        id: 'sections', label: 'Tablón', icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                          </svg>
                        )
                      },
                      {
                        id: 'detail', label: 'Detalle', disabled: !selectedTaskDetail, icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                        )
                      }
                    ].map((tab) => {
                      const isActive = viewMode === tab.id;
                      const isDisabled = tab.disabled;
                      if (isDisabled && !isActive) return null;

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => !isDisabled && setViewMode(tab.id)}
                          disabled={isDisabled}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${isActive
                            ? 'border-cyan-500/30 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                            : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {tab.icon}
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </nav>

                  <div>
                    {viewMode === 'list' && <div className="mt-4">{listContent}</div>}
                    {viewMode === 'kanban' && <div className="mt-4">{kanbanContent}</div>}
                    {viewMode === 'timeline' && <div className="mt-4">{timelineContent}</div>}
                    {viewMode === 'calendar' && <div className="mt-4">{calendarContent}</div>}
                    {viewMode === 'sections' && <div className="mt-4">{sectionsContent}</div>}
                    {viewMode === 'detail' && selectedTaskDetail && (
                      <div className="mt-4 border-t border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/40 pt-4 overflow-hidden min-w-0">
                        <TaskDetailPanel
                          task={selectedTaskDetail}
                          membersById={membersById}
                          members={members}
                          workspaceId={workspaceId}
                          projectId={projectId}
                          currentUserId={userId}
                          isOwner={project?.user_id === userId}
                          ownerLabel={projectOwnerLabel}
                          projectName={project?.name}
                          onClose={() => {
                            setSelectedTaskDetail(null);
                            setViewMode('list');
                          }}
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
                          onUpdateTags={updateTaskTags}
                          onUpdateEpic={updateTaskEpic}
                          onUpdateEffort={updateTaskEpic ? undefined : undefined}
                          onToggleCompletion={toggleTaskCompletion}
                          onGenerateSubtasks={handleGenerateSubtasks}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTasksSection === 'insights' && (
              <div className="mt-4 space-y-4">
                <MentionDigest projectId={projectId} members={members} />
                <ActivityLog projectId={projectId} members={members} />
              </div>
            )}
          </div>
        </div>
      </Card>

      {showCreatePanel ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Nueva tarea</h3>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={() => setShowCreatePanel(false)}
              >
                ×
              </button>
            </div>
            <TaskCreatePanel
              projectId={projectId}
              newTask={newTask}
              newTaskDueDate={newTaskDueDate}
              newTaskPriority={newTaskPriority}
              newTaskEffort={newTaskEffort}
              addingTask={addingTask}
              inputRef={newTaskInputRef}
              onSubmit={addTask}
              onChangeTitle={setNewTask}
              onChangeDueDate={setNewTaskDueDate}
              onChangePriority={setNewTaskPriority}
              onChangeEffort={setNewTaskEffort}
              showTitle={false}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default TaskList;





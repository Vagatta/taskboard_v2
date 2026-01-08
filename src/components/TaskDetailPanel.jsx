import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, Select, TextInput } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import TaskComments from './TaskComments';
import Skeleton from './ui/Skeleton';
import { formatRelativeTime, humanizeEventType } from '../utils/dateHelpers';

// Panel de detalle lateral: aquí es donde se ve y toca casi todo lo importante de una tarea concreta.
export default function TaskDetailPanel({
  task,
  membersById,
  members = [],
  workspaceId = null,
  projectId = null,
  currentUserId = null,
  isOwner = false,
  ownerLabel = 'Dueño del Proyecto',
  onClose,
  activityMeta,
  lastCommentAt,
  subtasks = [],
  subtasksLoading = false,
  subtaskError = '',
  onCreateSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onRefreshSubtasks,
  onUpdateAssignee,
  onUpdatePriority,
  onUpdateTags,
  onUpdateEpic,
  onUpdateEffort,
  onToggleCompletion,
  onGenerateSubtasks,
  projectName = null
}) {
  const [newSubtask, setNewSubtask] = useState('');
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [refreshingSubtasks, setRefreshingSubtasks] = useState(false);
  const [assigneeEditing, setAssigneeEditing] = useState(false);
  const [assigneeSaving, setAssigneeSaving] = useState(false);
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [tagsSaving, setTagsSaving] = useState(false);
  const [epicValue, setEpicValue] = useState(task?.epic ?? '');
  const [epicSaving, setEpicSaving] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [activeLeftTab, setActiveLeftTab] = useState('summary');
  const [activeRightTab, setActiveRightTab] = useState('activity');
  const [mobileActiveTab, setMobileActiveTab] = useState('summary');
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    if (!task) {
      setEpicValue('');
      return;
    }
    setEpicValue(task.epic ?? '');
  }, [task]);

  useEffect(() => {
    if (!task?.id || !currentUserId) {
      setViewers([]);
      return;
    }

    // Canal de presencia para saber qué otros usuarios tienen esta tarea abierta ahora mismo.
    const channel = supabase.channel(`task-viewers-${task.id}`, {
      config: {
        presence: {
          key: currentUserId
        }
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const others = [];

      Object.entries(state).forEach(([userId, sessions]) => {
        if (String(userId) === String(currentUserId)) {
          return;
        }
        if (!Array.isArray(sessions) || sessions.length === 0) {
          return;
        }
        const session = sessions[0];
        others.push({
          userId,
          ...session
        });
      });

      setViewers(others);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({
          user_id: currentUserId,
          task_id: task.id,
          started_at: new Date().toISOString()
        });
      }
    });

    return () => {
      try {
        channel.untrack();
      } catch (error) {
        console.warn('No se pudo detener la presencia de la tarea:', error);
      }
      void supabase.removeChannel(channel);
      setViewers([]);
    };
  }, [currentUserId, task?.id]);

  if (!task) {
    return (
      <Card className="border border-slate-200 dark:border-slate-800/60 bg-slate-100 dark:bg-slate-950/10 text-sm text-slate-500">
        <p>Selecciona una tarea para ver sus detalles.</p>
      </Card>
    );
  }

  const assignee = task.assigned_to ? membersById[task.assigned_to] : null;
  const creator = task.created_by ? membersById[task.created_by] : null;
  const updater = task.updated_by ? membersById[task.updated_by] : null;
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const createdAt = task.inserted_at ? new Date(task.inserted_at) : null;
  const completedAt = task.completed_at ? new Date(task.completed_at) : null;
  const lastActivityLabel = activityMeta?.createdAt ? formatRelativeTime(new Date(activityMeta.createdAt)) : null;
  const lastActivityType = activityMeta?.eventType ? humanizeEventType(activityMeta.eventType) : null;
  const lastCommentLabel = lastCommentAt ? formatRelativeTime(new Date(lastCommentAt)) : null;
  const statusMeta = task.completed
    ? { label: 'Completada', color: 'success' }
    : { label: 'Pendiente', color: 'warning' };
  const completedSubtasks = subtasks.filter((item) => item.completed).length;
  const isAssigned = Boolean(task.assigned_to);
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const activeViewers = viewers
    .map((viewer) => membersById[viewer.userId] ?? membersById[viewer.user_id])
    .filter(Boolean);
  const viewerNames = activeViewers.map((member) => member.member_email ?? member.member_id);

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

  const handleCreateSubtask = async (event) => {
    event.preventDefault();
    if (!newSubtask.trim() || !onCreateSubtask) {
      return;
    }

    try {
      setCreatingSubtask(true);
      await onCreateSubtask(task.id, newSubtask);
      setNewSubtask('');
    } catch (error) {
      console.warn('No se pudo crear la subtarea:', error);
    } finally {
      setCreatingSubtask(false);
    }
  };

  const handleEffortChange = async (event) => {
    if (!onUpdateEffort) {
      return;
    }

    const nextEffort = event.target.value;
    if (!nextEffort || nextEffort === (task.effort ?? 'm')) {
      return;
    }

    try {
      await onUpdateEffort(task, nextEffort);
    } catch (error) {
      console.warn('No se pudo actualizar el esfuerzo de la tarea:', error);
    }
  };

  const handleEpicSave = async () => {
    if (!onUpdateEpic) {
      return;
    }

    const nextEpic = epicValue.trim();
    const currentEpic = task.epic ?? '';

    if (nextEpic === (currentEpic ?? '')) {
      return;
    }

    try {
      setEpicSaving(true);
      await onUpdateEpic(task, nextEpic);
    } catch (error) {
      console.warn('No se pudo actualizar la epic/grupo de la tarea:', error);
    } finally {
      setEpicSaving(false);
    }
  };

  const handleAddTag = async (event) => {
    event.preventDefault();
    if (!onUpdateTags) {
      return;
    }

    const value = newTag.trim().toLowerCase();
    if (!value) {
      return;
    }

    const currentTags = Array.isArray(task.tags) ? task.tags : [];
    const exists = currentTags.some((tag) => (tag ?? '').toLowerCase() === value);
    if (exists) {
      setNewTag('');
      return;
    }

    const nextTags = [...currentTags, value];

    try {
      setTagsSaving(true);
      await onUpdateTags(task, nextTags);
      setNewTag('');
    } catch (error) {
      console.warn('No se pudieron actualizar las etiquetas de la tarea:', error);
    } finally {
      setTagsSaving(false);
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    if (!onUpdateTags) {
      return;
    }

    const currentTags = Array.isArray(task.tags) ? task.tags : [];
    const nextTags = currentTags.filter((tag) => tag !== tagToRemove);

    try {
      setTagsSaving(true);
      await onUpdateTags(task, nextTags);
    } catch (error) {
      console.warn('No se pudieron actualizar las etiquetas de la tarea:', error);
    } finally {
      setTagsSaving(false);
    }
  };

  const handlePriorityChange = async (event) => {
    if (!onUpdatePriority) {
      return;
    }

    const nextPriority = event.target.value;
    if (!nextPriority || nextPriority === task.priority) {
      return;
    }

    try {
      setPrioritySaving(true);
      await onUpdatePriority(task, nextPriority);
    } catch (error) {
      console.warn('No se pudo actualizar la prioridad de la tarea:', error);
    } finally {
      setPrioritySaving(false);
    }
  };

  const handleAssigneeChange = async (event) => {
    if (!onUpdateAssignee) {
      return;
    }

    const nextAssigneeId = event.target.value || null;

    try {
      setAssigneeSaving(true);
      await onUpdateAssignee(task, nextAssigneeId);
      setAssigneeEditing(false);
    } catch (error) {
      console.warn('No se pudo actualizar el responsable de la tarea:', error);
    } finally {
      setAssigneeSaving(false);
    }
  };

  const handleToggleSubtask = async (subtask) => {
    if (!onToggleSubtask) {
      return;
    }
    try {
      await onToggleSubtask(task.id, subtask);
    } catch (error) {
      console.warn('No se pudo alternar la subtarea:', error);
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    if (!onDeleteSubtask) {
      return;
    }
    try {
      await onDeleteSubtask(task.id, subtaskId);
    } catch (error) {
      console.warn('No se pudo eliminar la subtarea:', error);
    }
  };

  const handleRefreshSubtasks = async () => {
    if (!onRefreshSubtasks) {
      return;
    }
    try {
      setRefreshingSubtasks(true);
      await onRefreshSubtasks();
    } catch (error) {
      console.warn('No se pudieron refrescar las subtareas:', error);
    } finally {
      setRefreshingSubtasks(false);
    }
  };

  return (
    <div className={isFocusMode ? 'fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md animate-in fade-in duration-300' : 'contents'}>
      <Card className={`flex h-full flex-col gap-4 border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 transition-all duration-300 ${isFocusMode ? 'w-full max-w-6xl shadow-2xl shadow-cyan-500/10' : ''}`}>
        <TaskHeader
          task={task}
          statusMeta={statusMeta}
          priorityMeta={priorityMeta}
          dueDate={dueDate}
          viewerNames={viewerNames}
          onClose={onClose}
          isFocusMode={isFocusMode}
          onToggleFocus={() => setIsFocusMode(!isFocusMode)}
        />

        {onToggleCompletion ? (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-slate-100 dark:bg-slate-950/10 shadow-none px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
            <span>
              Estado actual:
              {' '}
              <span className={task.completed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-200'}>
                {task.completed ? 'Completada' : 'Pendiente'}
              </span>
            </span>
            <Button
              size="xs"
              color={task.completed ? 'warning' : 'success'}
              onClick={() => onToggleCompletion(task)}
            >
              {task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
            </Button>
          </div>
        ) : null}

        {/* Navegación UNIFICADA para móvil */}
        <div className="lg:hidden border-b border-slate-200 dark:border-slate-800 mb-4 overflow-x-auto relative">
          <nav className="flex whitespace-nowrap px-4 pb-1 gap-4">
            {[
              { id: 'summary', label: 'Resumen' },
              { id: 'assignee', label: 'Responsable' },
              { id: 'properties', label: 'Propiedades' },
              { id: 'activity', label: 'Actividad' },
              { id: 'subtasks', label: 'Subtareas' },
              { id: 'comments', label: 'Comentarios' }
            ].map((tab) => {
              const isActive = mobileActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMobileActiveTab(tab.id)}
                  className={`flex-shrink-0 py-2 text-xs font-semibold transition-colors border-b-2 ${isActive
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
          {/* Indicador visual de que hay más contenido a la derecha */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 pointer-events-none opacity-50 lg:hidden" />
        </div>

        {/* Vista MÓVIL (unificada) */}
        <div className="lg:hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          {mobileActiveTab === 'summary' && (
            <div className="space-y-4">
              <TaskSummarySection creator={creator} updater={updater} task={task} ownerLabel={ownerLabel} />
              <TaskTimelineSection createdAt={createdAt} dueDate={dueDate} completedAt={completedAt} />
            </div>
          )}
          {mobileActiveTab === 'assignee' && (
            <TaskAssigneeSection
              members={members}
              task={task}
              assignee={assignee}
              isAssigned={isAssigned}
              assigneeEditing={assigneeEditing}
              assigneeSaving={assigneeSaving}
              onAssigneeChange={handleAssigneeChange}
              onStartEditing={() => setAssigneeEditing(true)}
            />
          )}
          {mobileActiveTab === 'properties' && (
            <div className="space-y-4">
              <TaskPrioritySection priority={priority} priorityMeta={priorityMeta} prioritySaving={prioritySaving} onPriorityChange={handlePriorityChange} />
              <TaskEffortSection effort={effort} effortMeta={effortMeta} onEffortChange={handleEffortChange} />
              <TaskEpicSection epicValue={epicValue} epicSaving={epicSaving} onEpicChange={setEpicValue} onEpicSave={handleEpicSave} />
              <TaskTagsSection tags={tags} newTag={newTag} tagsSaving={tagsSaving} onNewTagChange={setNewTag} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} />
            </div>
          )}
          {mobileActiveTab === 'activity' && (
            <TaskActivitySection lastActivityLabel={lastActivityLabel} lastActivityType={lastActivityType} lastCommentLabel={lastCommentLabel} />
          )}
          {mobileActiveTab === 'subtasks' && (
            <TaskSubtasksSection
              subtasks={subtasks}
              completedSubtasks={completedSubtasks}
              subtasksLoading={subtasksLoading}
              subtaskError={subtaskError}
              canRefreshSubtasks={Boolean(onRefreshSubtasks)}
              onRefreshClick={handleRefreshSubtasks}
              refreshingSubtasks={refreshingSubtasks}
              onToggleSubtask={handleToggleSubtask}
              onDeleteSubtask={handleDeleteSubtask}
              creatingSubtask={creatingSubtask}
              newSubtask={newSubtask}
              onNewSubtaskChange={setNewSubtask}
              onCreateSubtask={handleCreateSubtask}
              membersById={membersById}
              onGenerateSubtasks={() => onGenerateSubtasks && onGenerateSubtasks(task)}
            />
          )}
          {mobileActiveTab === 'comments' && (
            <TaskComments
              taskId={task.id}
              taskTitle={task.title}
              currentUserId={currentUserId}
              members={members}
              workspaceId={workspaceId}
              projectId={projectId}
              projectName={projectName}
              isOwner={isOwner}
              ownerLabel={ownerLabel}
            />
          )}
        </div>

        <div className="hidden lg:grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/30 p-2 overflow-hidden">
              <nav className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                {[
                  {
                    id: 'summary', label: 'Resumen', icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    )
                  },
                  {
                    id: 'assignee', label: 'Responsable', icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    )
                  },
                  {
                    id: 'properties', label: 'Propiedades', icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                      </svg>
                    )
                  }
                ].map((tab) => {
                  const isActive = activeLeftTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveLeftTab(tab.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${isActive
                        ? 'border-cyan-500/30 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                        : 'border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="animate-in fade-in slide-in-from-left-1 duration-200">
                {activeLeftTab === 'summary' && (
                  <div className="space-y-4">
                    <TaskSummarySection creator={creator} updater={updater} task={task} ownerLabel={ownerLabel} />
                    <TaskTimelineSection createdAt={createdAt} dueDate={dueDate} completedAt={completedAt} />
                  </div>
                )}
                {activeLeftTab === 'assignee' && (
                  <div className="space-y-4">
                    <TaskAssigneeSection
                      members={members}
                      task={task}
                      assignee={assignee}
                      isAssigned={isAssigned}
                      assigneeEditing={assigneeEditing}
                      assigneeSaving={assigneeSaving}
                      onAssigneeChange={handleAssigneeChange}
                      onStartEditing={() => setAssigneeEditing(true)}
                    />
                  </div>
                )}
                {activeLeftTab === 'properties' && (
                  <div className="space-y-4">
                    <TaskPrioritySection
                      priority={priority}
                      priorityMeta={priorityMeta}
                      prioritySaving={prioritySaving}
                      onPriorityChange={handlePriorityChange}
                    />
                    <TaskEffortSection
                      effort={effort}
                      effortMeta={effortMeta}
                      onEffortChange={handleEffortChange}
                    />
                    <TaskEpicSection
                      epicValue={epicValue}
                      epicSaving={epicSaving}
                      onEpicChange={setEpicValue}
                      onEpicSave={handleEpicSave}
                    />
                    <TaskTagsSection
                      tags={tags}
                      newTag={newTag}
                      tagsSaving={tagsSaving}
                      onNewTagChange={setNewTag}
                      onAddTag={handleAddTag}
                      onRemoveTag={handleRemoveTag}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/30 p-2 overflow-hidden">
              <nav className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                {[
                  {
                    id: 'activity', label: 'Actividad', icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                      </svg>
                    )
                  },
                  {
                    id: 'subtasks', label: 'Subtareas', icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.008v.008H3.75V6.75Zm0 5.25h.008v.008H3.75V12Zm0 5.25h.008v.008H3.75v-.008Z" />
                      </svg>
                    )
                  },
                  {
                    id: 'comments', label: 'Comentarios', icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                      </svg>
                    )
                  }
                ].map((tab) => {
                  const isActive = activeRightTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveRightTab(tab.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${isActive
                        ? 'border-cyan-500/30 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                        : 'border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="animate-in fade-in slide-in-from-left-1 duration-200">
                {activeRightTab === 'activity' && (
                  <div className="space-y-4">
                    <TaskActivitySection
                      lastActivityLabel={lastActivityLabel}
                      lastActivityType={lastActivityType}
                      lastCommentLabel={lastCommentLabel}
                    />
                  </div>
                )}
                {activeRightTab === 'subtasks' && (
                  <div className="space-y-4">
                    <TaskSubtasksSection
                      subtasks={subtasks}
                      completedSubtasks={completedSubtasks}
                      subtasksLoading={subtasksLoading}
                      subtaskError={subtaskError}
                      canRefreshSubtasks={Boolean(onRefreshSubtasks)}
                      onRefreshClick={handleRefreshSubtasks}
                      refreshingSubtasks={refreshingSubtasks}
                      onToggleSubtask={handleToggleSubtask}
                      onDeleteSubtask={handleDeleteSubtask}
                      creatingSubtask={creatingSubtask}
                      newSubtask={newSubtask}
                      onNewSubtaskChange={setNewSubtask}
                      onCreateSubtask={handleCreateSubtask}
                      membersById={membersById}
                      onGenerateSubtasks={() => onGenerateSubtasks && onGenerateSubtasks(task)}
                    />
                  </div>
                )}
                {activeRightTab === 'comments' && (
                  <div className="space-y-4">
                    {/* Comentarios y conversación alrededor de la tarea */}
                    <TaskComments
                      taskId={task.id}
                      taskTitle={task.title}
                      currentUserId={currentUserId}
                      members={members}
                      workspaceId={workspaceId}
                      projectId={projectId}
                      projectName={projectName}
                      isOwner={isOwner}
                      ownerLabel={ownerLabel}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TaskHeader({ task, statusMeta, priorityMeta, dueDate, viewerNames, onClose, isFocusMode, onToggleFocus }) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800/60 pb-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Detalles</p>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{task.title}</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Badge color={statusMeta.color}>{statusMeta.label}</Badge>
          <Badge color={priorityMeta.color}>{priorityMeta.label}</Badge>
          {dueDate ? (
            <span>Vence {new Intl.DateTimeFormat('es-ES').format(dueDate)}</span>
          ) : (
            <span>Sin fecha límite</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-2">
        {viewerNames.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-emerald-700 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>
              {viewerNames.length === 1
                ? `${viewerNames[0]} está viendo esta tarea`
                : viewerNames.length === 2
                  ? `${viewerNames[0]} y ${viewerNames[1]} están viendo esta tarea`
                  : `${viewerNames[0]}, ${viewerNames[1]} y ${viewerNames.length - 2} más están viendo esta tarea`}
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            color="info"
            onClick={onToggleFocus}
            title={isFocusMode ? 'Salir de modo Focus' : 'Entrar en modo Focus'}
          >
            {isFocusMode ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M15 9V4.5M15 9H19.5M9 15V19.5M9 15H4.5M15 15V19.5M15 15H19.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </Button>
          <Button size="xs" color="light" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </header>
  );
}

function TaskSummarySection({ creator, updater, task, ownerLabel }) {
  const items = [
    { label: 'Autor', value: creator?.member_email ?? task.owner_email ?? ownerLabel },
    { label: 'Última edición', value: updater?.member_email ?? (task.updated_by ? (task.updated_by === task.created_by ? ownerLabel : 'Colaborador') : 'Sin registro') }
  ];

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 shadow-none p-4 text-sm text-slate-700 dark:text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Resumen</p>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 min-w-0">
            <span className="text-xs uppercase tracking-wide text-slate-500 sm:w-32">{item.label}</span>
            <div className="min-w-0 flex-1 overflow-hidden text-left sm:text-right">
              <span className="block text-sm text-slate-900 dark:text-white break-all whitespace-normal sm:truncate">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskAssigneeSection({
  members,
  task,
  assignee,
  isAssigned,
  assigneeEditing,
  assigneeSaving,
  onAssigneeChange,
  onStartEditing
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 shadow-none p-4 text-sm text-slate-700 dark:text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Responsable</p>
      {members.length === 0 ? (
        <p className="text-xs text-slate-500">Añade miembros al proyecto para poder asignar esta tarea.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Select
            sizing="sm"
            value={task.assigned_to ?? ''}
            disabled={(isAssigned && !assigneeEditing) || assigneeSaving}
            className="w-full min-w-[12rem] sm:flex-1"
            onChange={onAssigneeChange}
          >
            <option value="">Sin asignar</option>
            {members.map((member) => (
              <option key={member.member_id} value={member.member_id}>
                {member.member_email ?? member.member_id} ({member.role})
              </option>
            ))}
          </Select>
          {isAssigned && !assigneeEditing ? (
            <Button
              size="xs"
              color="dark"
              pill
              className="w-full sm:w-auto"
              disabled={assigneeSaving}
              onClick={onStartEditing}
            >
              Cambiar responsable
            </Button>
          ) : null}
        </div>
      )}
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Actual: {assignee?.member_email ?? 'Sin asignar'}
      </p>
    </section>
  );
}

function TaskPrioritySection({ priority, priorityMeta, prioritySaving, onPriorityChange }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 shadow-none p-4 text-sm text-slate-700 dark:text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Prioridad</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select
          sizing="sm"
          value={priority}
          onChange={onPriorityChange}
          disabled={prioritySaving}
          className="w-full min-w-[10rem] sm:flex-1"
        >
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </Select>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span>Impacto visual:</span>
          <Badge color={priorityMeta.color}>{priorityMeta.label}</Badge>
        </div>
      </div>
    </section>
  );
}

function TaskEffortSection({ effort, effortMeta, onEffortChange }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 shadow-none p-4 text-sm text-slate-700 dark:text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Esfuerzo</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select
          sizing="sm"
          value={effort}
          onChange={onEffortChange}
          className="w-full min-w-[10rem] sm:flex-1"
        >
          <option value="s">S (pequeño)</option>
          <option value="m">M (medio)</option>
          <option value="l">L (grande)</option>
        </Select>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span>Estimación de tamaño:</span>
          <Badge color={effortMeta.color}>{effortMeta.label}</Badge>
        </div>
      </div>
    </section>
  );
}

function TaskEpicSection({ epicValue, epicSaving, onEpicChange, onEpicSave }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 shadow-none p-4 text-sm text-slate-700 dark:text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Epic / Grupo</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TextInput
          type="text"
          value={epicValue}
          onChange={(event) => onEpicChange(event.target.value)}
          onBlur={onEpicSave}
          placeholder="Ej. Onboarding, Infra, Marketing..."
          maxLength={80}
          disabled={epicSaving}
          className="w-full min-w-[10rem] sm:flex-1"
        />
        <Button
          size="xs"
          color="light"
          disabled={epicSaving}
          onClick={onEpicSave}
          className="w-full sm:w-auto"
        >
          {epicSaving ? 'Guardando…' : 'Guardar epic'}
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Usa este campo para agrupar tareas relacionadas por iniciativa o área.
      </p>
    </section>
  );
}

function TaskTagsSection({ tags, newTag, tagsSaving, onNewTagChange, onAddTag, onRemoveTag }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 shadow-none p-4 text-sm text-slate-700 dark:text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Etiquetas</p>
      {tags.length ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="flex items-center gap-1 rounded-full border border-slate-700 bg-white dark:bg-slate-900/10 px-2 py-0.5 text-[11px] text-slate-900 dark:text-slate-100 hover:border-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-100"
              onClick={() => onRemoveTag(tag)}
              disabled={tagsSaving}
            >
              <span>#{tag}</span>
              <span className="text-slate-500">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Aún no hay etiquetas. Añade algunas para clasificar esta tarea.</p>
      )}
      <form
        className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center"
        onSubmit={onAddTag}
      >
        <TextInput
          type="text"
          placeholder="Añadir etiqueta (bug, frontend, infra...)"
          value={newTag}
          onChange={(event) => onNewTagChange(event.target.value)}
          maxLength={32}
          disabled={tagsSaving}
        />
        <Button
          type="submit"
          size="xs"
          color="info"
          disabled={tagsSaving || !newTag.trim()}
        >
          {tagsSaving ? 'Guardando…' : 'Añadir etiqueta'}
        </Button>
      </form>
    </section>
  );
}

function TaskTimelineSection({ createdAt, dueDate, completedAt }) {
  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 shadow-none p-4 text-sm text-slate-700 dark:text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Cronología</p>
      <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
        {createdAt ? <li>Creada {formatRelativeTime(createdAt)}</li> : null}
        {dueDate ? <li>Fecha límite {formatRelativeTime(dueDate)}</li> : null}
        {completedAt ? <li>Completada {formatRelativeTime(completedAt)}</li> : null}
      </ul>
    </section>
  );
}

function TaskActivitySection({ lastActivityLabel, lastActivityType, lastCommentLabel }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 shadow-none p-4 text-sm text-slate-700 dark:text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Actividad</p>
      <div className="space-y-2 text-slate-300">
        <div>
          <p className="text-xs text-slate-500">Última actividad</p>
          <p className="text-sm text-slate-900 dark:text-white">
            {lastActivityLabel && lastActivityType
              ? `${lastActivityType} · ${lastActivityLabel}`
              : 'Sin actividad reciente registrada.'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Último comentario</p>
          <p className="text-sm text-slate-900 dark:text-white">{lastCommentLabel ?? 'Sin comentarios recientes.'}</p>
        </div>
      </div>
    </section>
  );
}

function TaskSubtasksSection({
  subtasks,
  completedSubtasks,
  subtasksLoading,
  subtaskError,
  canRefreshSubtasks,
  onRefreshClick,
  refreshingSubtasks,
  onToggleSubtask,
  onDeleteSubtask,
  creatingSubtask,
  newSubtask,
  onNewSubtaskChange,
  onCreateSubtask,
  membersById,
  onGenerateSubtasks
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/10 shadow-none p-4 text-sm text-slate-700 dark:text-slate-200">
      <SubtasksHeader
        subtasks={subtasks}
        completedSubtasks={completedSubtasks}
        subtasksLoading={subtasksLoading}
        canRefreshSubtasks={canRefreshSubtasks}
        onRefreshClick={onRefreshClick}
        refreshingSubtasks={refreshingSubtasks}
        onGenerateSubtasks={onGenerateSubtasks}
      />

      {/* Subtareas sencillas pero útiles para romper trabajo grande en piezas manejables */}
      <SubtasksList
        subtasks={subtasks}
        subtasksLoading={subtasksLoading}
        subtaskError={subtaskError}
        membersById={membersById}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
      />

      <SubtaskCreateForm
        creatingSubtask={creatingSubtask}
        newSubtask={newSubtask}
        onNewSubtaskChange={onNewSubtaskChange}
        onCreateSubtask={onCreateSubtask}
      />
    </section>
  );
}

function SubtasksHeader({
  subtasks,
  completedSubtasks,
  subtasksLoading,
  canRefreshSubtasks,
  onRefreshClick,
  refreshingSubtasks,
  onGenerateSubtasks
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Subtareas</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {subtasks.length
            ? `${completedSubtasks}/${subtasks.length} completadas`
            : 'Sin subtareas registradas.'}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <Button
          size="xs"
          color="purple"
          onClick={onGenerateSubtasks}
          disabled={subtasksLoading || refreshingSubtasks}
          title="Generar subtareas automáticamente con IA"
          className="mr-1"
        >
          Generar con IA
        </Button>
        <Button
          size="xs"
          color="light"
          onClick={canRefreshSubtasks ? onRefreshClick : undefined}
          disabled={!canRefreshSubtasks || refreshingSubtasks || subtasksLoading}
        >
          {subtasksLoading || refreshingSubtasks ? 'Actualizando…' : 'Refrescar'}
        </Button>
      </div>
    </div>
  );
}

function SubtasksList({
  subtasks,
  subtasksLoading,
  subtaskError,
  membersById,
  onToggleSubtask,
  onDeleteSubtask
}) {
  return (
    <>
      {subtaskError ? <Alert color="failure">{subtaskError}</Alert> : null}
      {subtasksLoading && !subtasks.length ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
        {subtasks.length === 0 && !subtasksLoading ? (
          <p className="text-xs text-slate-500">Añade la primera subtarea para esta tarea.</p>
        ) : (
          subtasks.map((subtask) => (
            <SubtaskItem
              key={subtask.id}
              subtask={subtask}
              membersById={membersById}
              onToggleSubtask={onToggleSubtask}
              onDeleteSubtask={onDeleteSubtask}
            />
          ))
        )}
      </div>
    </>
  );
}

function SubtaskItem({ subtask, membersById, onToggleSubtask, onDeleteSubtask }) {
  const assigneeLabel = subtask.assigned_to
    ? membersById[subtask.assigned_to]?.member_email ?? subtask.assigned_to
    : null;
  const dueLabel = subtask.due_date
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(
      new Date(subtask.due_date)
    )
    : null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/10 p-3">
      <Checkbox
        checked={subtask.completed}
        onChange={() => onToggleSubtask(subtask)}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${subtask.completed ? 'text-slate-500 line-through' : 'text-white'
            }`}
        >
          {subtask.title}
        </p>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
          {assigneeLabel ? <span className="break-all">Responsable: {assigneeLabel}</span> : null}
          {dueLabel ? <span>Vence {dueLabel}</span> : null}
          {subtask.updated_at ? (
            <span>Actualizada {formatRelativeTime(new Date(subtask.updated_at))}</span>
          ) : null}
        </div>
      </div>
      <Button size="xs" color="failure" pill onClick={() => onDeleteSubtask(subtask.id)}>
        Eliminar
      </Button>
    </div>
  );
}

function SubtaskCreateForm({ creatingSubtask, newSubtask, onNewSubtaskChange, onCreateSubtask }) {
  return (
    <form className="space-y-2" onSubmit={onCreateSubtask}>
      <TextInput
        type="text"
        placeholder="Describe la subtarea"
        value={newSubtask}
        onChange={(event) => onNewSubtaskChange(event.target.value)}
        maxLength={120}
        disabled={creatingSubtask}
      />
      <Button type="submit" size="sm" color="info" disabled={creatingSubtask || !newSubtask.trim()}>
        {creatingSubtask ? 'Agregando…' : 'Agregar subtarea'}
      </Button>
    </form>
  );
}







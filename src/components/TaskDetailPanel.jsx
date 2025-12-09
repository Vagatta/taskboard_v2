import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, Select, Spinner, TabItem, Tabs, TextInput, Tooltip } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import TaskComments from './TaskComments';
import { formatRelativeTime, humanizeEventType } from '../utils/dateHelpers';

// Panel de detalle lateral: aquí es donde se ve y toca casi todo lo importante de una tarea concreta.
export default function TaskDetailPanel({
  task,
  membersById,
  members = [],
  workspaceId = null,
  projectId = null,
  currentUserId = null,
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
  onToggleCompletion
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
      <Card className="border border-slate-800/60 bg-slate-950/40 text-sm text-slate-500">
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
    <Card className="flex h-full flex-col gap-4 border border-slate-800/60 bg-slate-950/70">
      <TaskHeader
        task={task}
        statusMeta={statusMeta}
        priorityMeta={priorityMeta}
        dueDate={dueDate}
        viewerNames={viewerNames}
        onClose={onClose}
      />

      {onToggleCompletion ? (
        <div className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-950/60 px-4 py-2 text-xs text-slate-300">
          <span>
            Estado actual:
            {' '}
            <span className={task.completed ? 'text-emerald-300' : 'text-amber-200'}>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Tabs aria-label="Resumen y propiedades de la tarea" variant="underline">
            <TabItem title="Resumen" active>
              <div className="mt-2 space-y-4">
                <TaskSummarySection creator={creator} updater={updater} task={task} />
                <TaskTimelineSection createdAt={createdAt} dueDate={dueDate} completedAt={completedAt} />
              </div>
            </TabItem>
            <TabItem title="Responsable">
              <div className="mt-2 space-y-4">
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
            </TabItem>
            <TabItem title="Propiedades">
              <div className="mt-2 space-y-4">
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
            </TabItem>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Tabs aria-label="Detalles avanzados de la tarea" variant="underline">
            <TabItem title="Actividad" active>
              <div className="mt-2 space-y-4">
                <TaskActivitySection
                  lastActivityLabel={lastActivityLabel}
                  lastActivityType={lastActivityType}
                  lastCommentLabel={lastCommentLabel}
                />
              </div>
            </TabItem>
            <TabItem title="Subtareas">
              <div className="mt-2 space-y-4">
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
                />
              </div>
            </TabItem>
            <TabItem title="Comentarios">
              <div className="mt-2 space-y-4">
                {/* Comentarios y conversación alrededor de la tarea */}
                <TaskComments
                  taskId={task.id}
                  taskTitle={task.title}
                  currentUserId={currentUserId}
                  members={members}
                  workspaceId={workspaceId}
                  projectId={projectId}
                />
              </div>
            </TabItem>
          </Tabs>
        </div>
      </div>
    </Card>
  );
}

function TaskHeader({ task, statusMeta, priorityMeta, dueDate, viewerNames, onClose }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-800/60 pb-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Detalles</p>
        <h3 className="text-lg font-semibold text-white">{task.title}</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Badge color={statusMeta.color}>{statusMeta.label}</Badge>
          <Badge color={priorityMeta.color}>{priorityMeta.label}</Badge>
          {dueDate ? (
            <span>Vence {new Intl.DateTimeFormat('es-ES').format(dueDate)}</span>
          ) : (
            <span>Sin fecha límite</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {viewerNames.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-emerald-300">
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
        <Button size="xs" color="light" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </header>
  );
}

function TaskSummarySection({ creator, updater, task }) {
  const items = [
    { label: 'Autor', value: creator?.member_email ?? task.owner_email ?? 'Desconocido' },
    { label: 'Última edición', value: updater?.member_email ?? task.updated_by ?? 'Sin registro' }
  ];

  return (
    <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Resumen</p>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-4 min-w-0">
            <span className="w-32 text-xs uppercase tracking-wide text-slate-500">{item.label}</span>
            <div className="min-w-0 flex-1 overflow-hidden text-right">
              <Tooltip content={item.value} placement="left" style={{}} className="max-w-xs break-words">
                <span className="block truncate text-sm text-white">{item.value}</span>
              </Tooltip>
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
    <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
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
      <p className="text-xs text-slate-400">
        Actual: {assignee?.member_email ?? 'Sin asignar'}
      </p>
    </section>
  );
}

function TaskPrioritySection({ priority, priorityMeta, prioritySaving, onPriorityChange }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
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
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Impacto visual:</span>
          <Badge color={priorityMeta.color}>{priorityMeta.label}</Badge>
        </div>
      </div>
    </section>
  );
}

function TaskEffortSection({ effort, effortMeta, onEffortChange }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
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
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Estimación de tamaño:</span>
          <Badge color={effortMeta.color}>{effortMeta.label}</Badge>
        </div>
      </div>
    </section>
  );
}

function TaskEpicSection({ epicValue, epicSaving, onEpicChange, onEpicSave }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
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
    <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Etiquetas</p>
      {tags.length ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-100 hover:border-cyan-400 hover:text-cyan-100"
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
    <section className="space-y-2 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Cronología</p>
      <ul className="space-y-2 text-xs text-slate-400">
        {createdAt ? <li>Creada {formatRelativeTime(createdAt)}</li> : null}
        {dueDate ? <li>Fecha límite {formatRelativeTime(dueDate)}</li> : null}
        {completedAt ? <li>Completada {formatRelativeTime(completedAt)}</li> : null}
      </ul>
    </section>
  );
}

function TaskActivitySection({ lastActivityLabel, lastActivityType, lastCommentLabel }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">Actividad</p>
      <div className="space-y-2 text-slate-300">
        <div>
          <p className="text-xs text-slate-500">Última actividad</p>
          <p className="text-sm text-white">
            {lastActivityLabel && lastActivityType
              ? `${lastActivityType} · ${lastActivityLabel}`
              : 'Sin actividad reciente registrada.'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Último comentario</p>
          <p className="text-sm text-white">{lastCommentLabel ?? 'Sin comentarios recientes.'}</p>
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
  membersById
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
      <SubtasksHeader
        subtasks={subtasks}
        completedSubtasks={completedSubtasks}
        subtasksLoading={subtasksLoading}
        canRefreshSubtasks={canRefreshSubtasks}
        onRefreshClick={onRefreshClick}
        refreshingSubtasks={refreshingSubtasks}
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
  refreshingSubtasks
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Subtareas</p>
        <p className="text-xs text-slate-400">
          {subtasks.length
            ? `${completedSubtasks}/${subtasks.length} completadas`
            : 'Sin subtareas registradas.'}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs">
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
        <div className="flex items-center gap-2 text-slate-400">
          <Spinner size="sm" />
          <span>Cargando subtareas…</span>
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
    <div className="flex items-start gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
      <Checkbox
        checked={subtask.completed}
        onChange={() => onToggleSubtask(subtask)}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            subtask.completed ? 'text-slate-500 line-through' : 'text-white'
          }`}
        >
          {subtask.title}
        </p>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
          {assigneeLabel ? <span>Responsable: {assigneeLabel}</span> : null}
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

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, Select, Spinner, TextInput, Tooltip } from 'flowbite-react';
import { formatRelativeTime, humanizeEventType } from '../utils/dateHelpers';

export default function TaskDetailPanel({
  task,
  membersById,
  members = [],
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
  onUpdateEpic
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
  
  useEffect(() => {
    if (!task) {
      setEpicValue('');
      return;
    }
    setEpicValue(task.epic ?? '');
  }, [task]);

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

  const priority = task.priority ?? 'medium';
  const priorityMeta =
    priority === 'high'
      ? { label: 'Alta', color: 'failure' }
      : priority === 'low'
        ? { label: 'Baja', color: 'success' }
        : { label: 'Media', color: 'warning' };

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
      <header className="flex items-start justify-between gap-4 border-b border-slate-800/60 pb-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Detalles</p>
          <h3 className="text-lg font-semibold text-white">{task.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Badge color={statusMeta.color}>{statusMeta.label}</Badge>
            <Badge color={priorityMeta.color}>{priorityMeta.label}</Badge>
            {dueDate ? <span>Vence {new Intl.DateTimeFormat('es-ES').format(dueDate)}</span> : <span>Sin fecha límite</span>}
          </div>
        </div>
        <Button size="xs" color="light" onClick={onClose}>
          Cerrar
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Resumen</p>
            <div className="space-y-3">
              {[{ label: 'Autor', value: creator?.member_email ?? task.owner_email ?? 'Desconocido' },
                { label: 'Última edición', value: updater?.member_email ?? task.updated_by ?? 'Sin registro' }].map((item) => (
                  <div key={item.label} className="flex items-center gap-4 min-w-0">
                    <span className="w-32 text-xs uppercase tracking-wide text-slate-500">{item.label}</span>
                    <div className="min-w-0 flex-1 overflow-hidden text-right">
                      <Tooltip content={item.value} placement="left" style="light" className="max-w-xs break-words">
                        <span className="block truncate text-sm text-white">{item.value}</span>
                      </Tooltip>
                    </div>
                  </div>
              ))}
            </div>
          </section>

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
                  onChange={handleAssigneeChange}
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
                    onClick={() => setAssigneeEditing(true)}
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

          <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Prioridad</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Select
                sizing="sm"
                value={priority}
                onChange={handlePriorityChange}
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

          <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Epic / Grupo</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <TextInput
                type="text"
                value={epicValue}
                onChange={(event) => setEpicValue(event.target.value)}
                onBlur={handleEpicSave}
                placeholder="Ej. Onboarding, Infra, Marketing..."
                maxLength={80}
                disabled={epicSaving}
                className="w-full min-w-[10rem] sm:flex-1"
              />
              <Button
                size="xs"
                color="light"
                disabled={epicSaving}
                onClick={handleEpicSave}
                className="w-full sm:w-auto"
              >
                {epicSaving ? 'Guardando…' : 'Guardar epic'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Usa este campo para agrupar tareas relacionadas por iniciativa o área.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Etiquetas</p>
            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-100 hover:border-cyan-400 hover:text-cyan-100"
                    onClick={() => handleRemoveTag(tag)}
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
              onSubmit={handleAddTag}
            >
              <TextInput
                type="text"
                placeholder="Añadir etiqueta (bug, frontend, infra...)"
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
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

          <section className="space-y-2 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cronología</p>
            <ul className="space-y-2 text-xs text-slate-400">
              {createdAt ? <li>Creada {formatRelativeTime(createdAt)}</li> : null}
              {dueDate ? <li>Fecha límite {formatRelativeTime(dueDate)}</li> : null}
              {completedAt ? <li>Completada {formatRelativeTime(completedAt)}</li> : null}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Actividad</p>
            <div className="space-y-2 text-slate-300">
              <div>
                <p className="text-xs text-slate-500">Última actividad</p>
                <p className="text-sm text-white">
                  {lastActivityLabel && lastActivityType ? `${lastActivityType} · ${lastActivityLabel}` : 'Sin actividad reciente registrada.'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Último comentario</p>
                <p className="text-sm text-white">{lastCommentLabel ?? 'Sin comentarios recientes.'}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Subtareas</p>
                <p className="text-xs text-slate-400">
                  {subtasks.length ? `${completedSubtasks}/${subtasks.length} completadas` : 'Sin subtareas registradas.'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Button
                  size="xs"
                  color="light"
                  onClick={handleRefreshSubtasks}
                  disabled={!onRefreshSubtasks || refreshingSubtasks || subtasksLoading}
                >
                  {subtasksLoading || refreshingSubtasks ? 'Actualizando…' : 'Refrescar'}
                </Button>
              </div>
            </div>

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
                subtasks.map((subtask) => {
                  const assigneeLabel = subtask.assigned_to
                    ? membersById[subtask.assigned_to]?.member_email ?? subtask.assigned_to
                    : null;
                  const dueLabel = subtask.due_date
                    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(
                        new Date(subtask.due_date)
                      )
                    : null;

                  return (
                    <div
                      key={subtask.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-3"
                    >
                      <Checkbox
                        checked={subtask.completed}
                        onChange={() => handleToggleSubtask(subtask)}
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
                      <Button size="xs" color="failure" pill onClick={() => handleDeleteSubtask(subtask.id)}>
                        Eliminar
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <form className="space-y-2" onSubmit={handleCreateSubtask}>
              <TextInput
                type="text"
                placeholder="Describe la subtarea"
                value={newSubtask}
                onChange={(event) => setNewSubtask(event.target.value)}
                maxLength={120}
                disabled={creatingSubtask}
              />
              <Button type="submit" size="sm" color="info" disabled={creatingSubtask || !newSubtask.trim()}>
                {creatingSubtask ? 'Agregando…' : 'Agregar subtarea'}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </Card>
  );
}

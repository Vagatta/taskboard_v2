import { Badge, Button } from 'flowbite-react';
import { formatRelativeTime } from '../utils/dateHelpers';

export default function TaskSectionsBoard({
  sections,
  sectionsGrouping,
  onChangeSectionsGrouping,
  membersById,
  onToggleTaskCompletion,
  onSelectTask,
  onFocusNewTaskInput,
  onMoveTask
}) {
  return (
    <div className="space-y-4 px-2 pb-2 sm:px-4 sm:pb-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold text-white">Vista tablón</span>
        <div className="flex gap-2">
          <Button
            size="xs"
            color={sectionsGrouping === 'dates' ? 'info' : 'gray'}
            onClick={() => onChangeSectionsGrouping('dates')}
          >
            Por fechas
          </Button>
          <Button
            size="xs"
            color={sectionsGrouping === 'epic' ? 'info' : 'gray'}
            onClick={() => onChangeSectionsGrouping('epic')}
          >
            Por epic / grupo
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        {sections.map((section) => (
          <div
            key={section.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
            onDragOver={(event) => {
              if (!onMoveTask) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (!onMoveTask) return;
              event.preventDefault();
              const taskId = event.dataTransfer.getData('application/task-id');
              if (taskId) {
                onMoveTask(taskId, section.id);
              }
            }}
          >
            <div className="flex items-center justify_between text-xs text-slate-400">
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
                    className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/40 p-3 transition hover:border-cyan-400 hover:bg-cyan-500/5 cursor-move"
                    draggable={Boolean(onMoveTask)}
                    onDragStart={(event) => {
                      if (!onMoveTask) return;
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('application/task-id', task.id);
                    }}
                    onClick={() => onSelectTask(task)}
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
                          onToggleTaskCompletion(task);
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
                        <span>
                          {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(
                            new Date(task.due_date)
                          )}
                        </span>
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
              <Button size="xs" color="gray" className="w-full" onClick={onFocusNewTaskInput}>
                + Agregar tarea
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

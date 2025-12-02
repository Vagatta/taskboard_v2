import { Card, Button, Select, TextInput } from 'flowbite-react';

export default function TaskCreatePanel({
  projectId,
  newTask,
  newTaskDueDate,
  newTaskPriority,
  newTaskEffort,
  addingTask,
  inputRef,
  onSubmit,
  onChangeTitle,
  onChangeDueDate,
  onChangePriority,
  onChangeEffort,
  showTitle = true
}) {
  const canCreate = Boolean(projectId);

  return (
    <Card className="bg-slate-950/40">
      <div className="space-y-3">
        {showTitle ? (
          <div>
            <h3 className="text-sm font-semibold text-white">Nueva tarea</h3>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <span className="mb-1 block text-xs text-slate-500">Título</span>
            <TextInput
              ref={inputRef}
              type="text"
              value={newTask}
              disabled={!canCreate || addingTask}
              placeholder="Escribe una nueva tarea"
              onChange={(event) => onChangeTitle(event.target.value)}
              className="w-full"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-end">
            <div className="flex w-full flex-col gap-1 sm:w-auto">
              <span>Fecha de vencimiento</span>
              <input
                type="date"
                value={newTaskDueDate}
                disabled={!canCreate || addingTask}
                onChange={(event) => onChangeDueDate(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-info focus:ring-info"
              />
            </div>
            <div className="flex w-full flex-col gap-1 sm:w-auto">
              <span>Esfuerzo</span>
              <Select
                value={newTaskEffort}
                onChange={(event) => onChangeEffort(event.target.value)}
                disabled={!canCreate || addingTask}
              >
                <option value="s">S (pequeño)</option>
                <option value="m">M (medio)</option>
                <option value="l">L (grande)</option>
              </Select>
            </div>
            <div className="flex w-full flex-col gap-1 sm:w-auto">
              <span>Prioridad</span>
              <Select
                value={newTaskPriority}
                onChange={(event) => onChangePriority(event.target.value)}
                disabled={!canCreate || addingTask}
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </Select>
            </div>
            <Button
              type="submit"
              color="info"
              className="sm:self-end"
              disabled={!canCreate || addingTask || !newTask.trim()}
            >
              {addingTask ? 'Creando...' : 'Agregar tarea'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

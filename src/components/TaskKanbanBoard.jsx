import { Badge, Card } from 'flowbite-react';

export default function TaskKanbanBoard({ columns, renderTaskCard, onMoveTask }) {
  const kanbanMeta = {
    pending: { label: 'Pendientes', badgeColor: 'warning' },
    completed: { label: 'Completadas', badgeColor: 'success' }
  };

  return (
    <div className="max-h-[640px] overflow-y-auto px-2 pb-2 sm:px-4 sm:pb-4">
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(columns).map(([columnKey, columnTasks]) => (
          <Card
            key={columnKey}
            className="bg-slate-100 dark:bg-slate-950/60"
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData('application/task-id');
              if (taskId && onMoveTask) {
                onMoveTask(taskId, columnKey);
              }
            }}
          >
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">{kanbanMeta[columnKey].label}</span>
              <Badge color={kanbanMeta[columnKey].badgeColor}>{columnTasks.length}</Badge>
            </div>
            <div className="mt-4 space-y-4">
              {columnTasks.length === 0 ? (
                <p className="text-xs text-slate-500">Sin tareas en esta columna.</p>
              ) : (
                columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('application/task-id', task.id);
                    }}
                  >
                    {renderTaskCard(task)}
                  </div>
                ))
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}





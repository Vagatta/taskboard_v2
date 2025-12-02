import { Badge, Card } from 'flowbite-react';

export default function TaskKanbanBoard({ columns, renderTaskCard }) {
  const kanbanMeta = {
    pending: { label: 'Pendientes', badgeColor: 'warning' },
    completed: { label: 'Completadas', badgeColor: 'success' }
  };

  return (
    <div className="max-h-[640px] overflow-y-auto pr-2">
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(columns).map(([columnKey, columnTasks]) => (
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

import { Card, Button, Select, TextInput } from 'flowbite-react';

export default function TaskFiltersPanel({
  projectId,
  searchQuery,
  onSearchQueryChange,
  quickFilters,
  statusFilter,
  setStatusFilter,
  assigneeFilter,
  setAssigneeFilter,
  priorityFilter,
  setPriorityFilter,
  effortFilter,
  setEffortFilter,
  tagFilter,
  setTagFilter,
  sortMode,
  setSortMode,
  onlyMentionedFilter,
  setOnlyMentionedFilter,
  hasMentionedTasks,
  members,
  availableTags
}) {
  const canFilter = Boolean(projectId);

  return (
    <Card className="bg-slate-950/40">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Filtros rápidos</h3>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Buscar</span>
          <TextInput
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Buscar por título o descripción"
            disabled={!canFilter}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-900/30 p-2">
          {quickFilters.map((preset) => {
            const isActive =
              statusFilter === preset.status &&
              assigneeFilter === preset.assignee &&
              priorityFilter === (preset.priority ?? 'all') &&
              tagFilter === (preset.tag ?? '');

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
                  setTagFilter(preset.tag ?? '');
                }}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="xs"
            color={onlyMentionedFilter ? 'info' : 'gray'}
            disabled={!canFilter || !hasMentionedTasks}
            onClick={() => setOnlyMentionedFilter((previous) => !previous)}
          >
            Tareas donde me mencionan
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Esfuerzo</span>
            <Select value={effortFilter} onChange={(event) => setEffortFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="s">S (pequeño)</option>
              <option value="m">M (medio)</option>
              <option value="l">L (grande)</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Etiqueta</span>
            <Select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              disabled={availableTags.length === 0}
            >
              <option value="">Todas</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Ordenar por</span>
          <Select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="default">Por defecto (creación reciente)</option>
            <option value="priority">Prioridad (alta primero)</option>
            <option value="due_date">Fecha de vencimiento</option>
            <option value="last_activity">Última actividad</option>
          </Select>
        </div>
      </div>
    </Card>
  );
}

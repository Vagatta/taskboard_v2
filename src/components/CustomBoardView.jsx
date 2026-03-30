import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Spinner, TextInput } from 'flowbite-react';
import { supabase } from '../supabaseClient';

const COLUMN_COLORS = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'
];

export default function CustomBoardView({
  projectId,
  userId,
  tasks = [],
  membersById = {},
  onSelectTask,
  onToggleTaskCompletion,
  onFocusNewTaskInput
}) {
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [boardTasks, setBoardTasks] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingBoard, setSavingBoard] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [dragOverColumnId, setDragOverColumnId] = useState(null);
  const [dragOverTaskPosition, setDragOverTaskPosition] = useState(null);
  const [editingBoardName, setEditingBoardName] = useState(false);
  const [boardNameDraft, setBoardNameDraft] = useState('');
  const boardNameInputRef = useRef(null);
  const columnNameInputRef = useRef(null);
  const newColumnInputRef = useRef(null);

  const activeBoard = useMemo(
    () => boards.find((b) => b.id === activeBoardId) ?? null,
    [boards, activeBoardId]
  );

  const tasksById = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      map[t.id] = t;
    }
    return map;
  }, [tasks]);

  // Tareas asignadas a alguna columna del tablón activo
  const assignedTaskIds = useMemo(() => {
    const set = new Set();
    for (const list of Object.values(boardTasks)) {
      for (const bt of list) {
        set.add(bt.task_id);
      }
    }
    return set;
  }, [boardTasks]);

  // Tareas no asignadas a ninguna columna
  const unassignedTasks = useMemo(
    () => tasks.filter((t) => !assignedTaskIds.has(t.id)),
    [tasks, assignedTaskIds]
  );

  // ── Load boards ──
  const loadBoards = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('project_boards')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setBoards(data);
      if (data.length > 0 && !activeBoardId) {
        setActiveBoardId(data[0].id);
      }
    }
    setLoading(false);
  }, [projectId, activeBoardId]);

  // ── Load columns + task assignments for active board ──
  const loadBoardData = useCallback(async () => {
    if (!activeBoardId) {
      setColumns([]);
      setBoardTasks({});
      return;
    }

    const { data: cols } = await supabase
      .from('project_board_columns')
      .select('*')
      .eq('board_id', activeBoardId)
      .order('position', { ascending: true });

    if (cols) {
      setColumns(cols);

      const colIds = cols.map((c) => c.id);
      if (colIds.length > 0) {
        const { data: bt } = await supabase
          .from('project_board_tasks')
          .select('*')
          .in('column_id', colIds)
          .order('position', { ascending: true });

        if (bt) {
          const grouped = {};
          for (const colId of colIds) {
            grouped[colId] = [];
          }
          for (const item of bt) {
            if (grouped[item.column_id]) {
              grouped[item.column_id].push(item);
            }
          }
          setBoardTasks(grouped);
        }
      } else {
        setBoardTasks({});
      }
    }
  }, [activeBoardId]);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData]);

  // ── Create board ──
  const handleCreateBoard = async () => {
    const name = newBoardName.trim() || 'Nuevo tablón';
    setSavingBoard(true);

    const { data, error } = await supabase
      .from('project_boards')
      .insert({ project_id: projectId, name, created_by: userId })
      .select()
      .single();

    if (!error && data) {
      // Create 3 default columns
      const defaultCols = ['Por hacer', 'En progreso', 'Hecho'];
      const colInserts = defaultCols.map((colName, idx) => ({
        board_id: data.id,
        name: colName,
        position: idx,
        color: COLUMN_COLORS[idx] ?? null
      }));

      await supabase.from('project_board_columns').insert(colInserts);

      setBoards((prev) => [...prev, data]);
      setActiveBoardId(data.id);
      setNewBoardName('');
      setCreatingBoard(false);
    }

    setSavingBoard(false);
  };

  // ── Delete board ──
  const handleDeleteBoard = async (boardId) => {
    if (!window.confirm('¿Eliminar este tablón? Se perderán las columnas y asignaciones.')) return;

    await supabase.from('project_boards').delete().eq('id', boardId);

    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    if (activeBoardId === boardId) {
      setActiveBoardId(boards.find((b) => b.id !== boardId)?.id ?? null);
    }
  };

  // ── Rename board ──
  const handleRenameBoard = async () => {
    const name = boardNameDraft.trim();
    if (!name || !activeBoardId) {
      setEditingBoardName(false);
      return;
    }

    await supabase.from('project_boards').update({ name, updated_at: new Date().toISOString() }).eq('id', activeBoardId);

    setBoards((prev) => prev.map((b) => (b.id === activeBoardId ? { ...b, name } : b)));
    setEditingBoardName(false);
  };

  // ── Add column ──
  const handleAddColumn = async () => {
    const name = newColumnName.trim();
    if (!name || !activeBoardId) return;
    setAddingColumn(false);

    const nextPosition = columns.length;
    const color = COLUMN_COLORS[nextPosition % COLUMN_COLORS.length];

    const { data, error } = await supabase
      .from('project_board_columns')
      .insert({ board_id: activeBoardId, name, position: nextPosition, color })
      .select()
      .single();

    if (!error && data) {
      setColumns((prev) => [...prev, data]);
      setBoardTasks((prev) => ({ ...prev, [data.id]: [] }));
      setNewColumnName('');
    }
  };

  // ── Rename column ──
  const handleRenameColumn = async (colId) => {
    const name = editingColumnName.trim();
    if (!name) {
      setEditingColumnId(null);
      return;
    }

    await supabase.from('project_board_columns').update({ name }).eq('id', colId);
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name } : c)));
    setEditingColumnId(null);
  };

  // ── Delete column ──
  const handleDeleteColumn = async (colId) => {
    if (!window.confirm('¿Eliminar esta columna y desasignar sus tareas?')) return;

    await supabase.from('project_board_columns').delete().eq('id', colId);
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    setBoardTasks((prev) => {
      const next = { ...prev };
      delete next[colId];
      return next;
    });
  };

  // ── Drag & Drop ──
  const handleDragStartTask = (event, taskId, sourceColumnId) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/board-task-id', taskId);
    event.dataTransfer.setData('application/board-source-col', sourceColumnId || '');
  };

  const handleDragOverColumn = (event, colId) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverColumnId(colId);
  };

  const handleDragLeaveColumn = () => {
    setDragOverColumnId(null);
    setDragOverTaskPosition(null);
  };

  const handleDropOnColumn = async (event, targetColId) => {
    event.preventDefault();
    setDragOverColumnId(null);
    setDragOverTaskPosition(null);

    const taskId = event.dataTransfer.getData('application/board-task-id');
    const sourceColId = event.dataTransfer.getData('application/board-source-col');

    if (!taskId) return;

    // Calculate new position (append to end)
    const targetList = boardTasks[targetColId] ?? [];
    const newPosition = targetList.length;

    if (sourceColId && sourceColId !== '') {
      // Moving from one column to another (or reorder within same)
      if (sourceColId === targetColId) return; // same column, skip for now

      // Remove from source
      await supabase.from('project_board_tasks').delete().eq('task_id', taskId).eq('column_id', sourceColId);

      // Insert into target
      await supabase.from('project_board_tasks').upsert(
        { column_id: targetColId, task_id: taskId, position: newPosition },
        { onConflict: 'column_id,task_id' }
      );

      // Update local state
      setBoardTasks((prev) => {
        const next = { ...prev };
        next[sourceColId] = (next[sourceColId] ?? []).filter((bt) => bt.task_id !== taskId);
        next[targetColId] = [...(next[targetColId] ?? []), { column_id: targetColId, task_id: taskId, position: newPosition }];
        return next;
      });
    } else {
      // Dragging from unassigned pool
      await supabase.from('project_board_tasks').upsert(
        { column_id: targetColId, task_id: taskId, position: newPosition },
        { onConflict: 'column_id,task_id' }
      );

      setBoardTasks((prev) => {
        const next = { ...prev };
        next[targetColId] = [...(next[targetColId] ?? []), { column_id: targetColId, task_id: taskId, position: newPosition }];
        return next;
      });
    }
  };

  // ── Remove task from column (back to unassigned) ──
  const handleRemoveFromColumn = async (taskId, colId) => {
    await supabase.from('project_board_tasks').delete().eq('task_id', taskId).eq('column_id', colId);

    setBoardTasks((prev) => {
      const next = { ...prev };
      next[colId] = (next[colId] ?? []).filter((bt) => bt.task_id !== taskId);
      return next;
    });
  };

  // ── Reorder within column via drag ──
  const handleDragOverTask = (event, colId, position) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverColumnId(colId);
    setDragOverTaskPosition(position);
  };

  const handleDropOnTask = async (event, targetColId, targetPosition) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverColumnId(null);
    setDragOverTaskPosition(null);

    const taskId = event.dataTransfer.getData('application/board-task-id');
    const sourceColId = event.dataTransfer.getData('application/board-source-col');
    if (!taskId) return;

    const isFromUnassigned = !sourceColId || sourceColId === '';

    // Remove from source first
    if (!isFromUnassigned && sourceColId) {
      await supabase.from('project_board_tasks').delete().eq('task_id', taskId).eq('column_id', sourceColId);
    }

    // Get current column tasks, remove the task if it exists there
    const currentColTasks = (boardTasks[targetColId] ?? []).filter((bt) => bt.task_id !== taskId);

    // Insert at the target position
    const reordered = [...currentColTasks];
    reordered.splice(targetPosition, 0, { column_id: targetColId, task_id: taskId, position: targetPosition });

    // Update all positions
    const updates = reordered.map((bt, idx) => ({
      column_id: targetColId,
      task_id: bt.task_id,
      position: idx
    }));

    // Delete all for this column, re-insert
    await supabase.from('project_board_tasks').delete().eq('column_id', targetColId);
    if (updates.length > 0) {
      await supabase.from('project_board_tasks').insert(updates);
    }

    setBoardTasks((prev) => {
      const next = { ...prev };
      if (!isFromUnassigned && sourceColId && sourceColId !== targetColId) {
        next[sourceColId] = (next[sourceColId] ?? []).filter((bt) => bt.task_id !== taskId);
      }
      next[targetColId] = updates;
      return next;
    });
  };

  // Focus refs
  useEffect(() => {
    if (editingBoardName && boardNameInputRef.current) {
      boardNameInputRef.current.focus();
      boardNameInputRef.current.select();
    }
  }, [editingBoardName]);

  useEffect(() => {
    if (editingColumnId && columnNameInputRef.current) {
      columnNameInputRef.current.focus();
      columnNameInputRef.current.select();
    }
  }, [editingColumnId]);

  useEffect(() => {
    if (addingColumn && newColumnInputRef.current) {
      newColumnInputRef.current.focus();
    }
  }, [addingColumn]);

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Board selector bar
  const renderBoardSelector = () => (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {boards.map((board) => (
        <div key={board.id} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveBoardId(board.id)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
              activeBoardId === board.id
                ? 'border-cyan-500/40 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            {board.name}
          </button>
          {activeBoardId === board.id && (
            <button
              type="button"
              onClick={() => handleDeleteBoard(board.id)}
              className="rounded-full p-1 text-[10px] text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
              title="Eliminar tablón"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {creatingBoard ? (
        <div className="flex items-center gap-2">
          <TextInput
            sizing="sm"
            placeholder="Nombre del tablón..."
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateBoard();
              if (e.key === 'Escape') setCreatingBoard(false);
            }}
            autoFocus
          />
          <Button size="xs" color="info" onClick={handleCreateBoard} disabled={savingBoard}>
            {savingBoard ? <Spinner size="xs" /> : 'Crear'}
          </Button>
          <Button size="xs" color="gray" onClick={() => setCreatingBoard(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreatingBoard(true)}
          className="flex items-center gap-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:border-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo tablón
        </button>
      )}
    </div>
  );

  const renderTaskCard = (task, colId) => {
    if (!task) return null;

    return (
      <div
        key={task.id}
        className="group cursor-pointer rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3 transition hover:border-cyan-400 hover:bg-cyan-500/5 cursor-move"
        draggable
        onDragStart={(e) => handleDragStartTask(e, task.id, colId)}
        onClick={() => onSelectTask?.(task)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-semibold ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
              {task.title}
            </p>
            {task.description ? (
              <p className="text-xs text-slate-500 truncate">{task.description.slice(0, 60)}{task.description.length > 60 ? '…' : ''}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTaskCompletion?.(task);
              }}
              title={task.completed ? 'Marcar pendiente' : 'Completar'}
            >
              <span className={task.completed ? 'text-emerald-500' : 'text-transparent hover:text-emerald-300'}>✓</span>
            </button>
            {colId && (
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFromColumn(task.id, colId);
                }}
                title="Quitar de columna"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {task.priority && (
            <span className={`rounded-md px-1.5 py-0.5 font-medium ${
              task.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
              task.priority === 'low' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
              'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>
              {task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baja' : 'Media'}
            </span>
          )}
          <span className="truncate max-w-[100px]">
            {task.assigned_to ? (membersById[task.assigned_to]?.member_email ?? 'Asignado') : ''}
          </span>
          {task.due_date && (
            <span>{new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(task.due_date))}</span>
          )}
        </div>
      </div>
    );
  };

  if (!activeBoardId || !activeBoard) {
    return (
      <div className="space-y-4">
        {renderBoardSelector()}
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No hay tablones creados. Crea uno para organizar las tareas en columnas personalizadas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderBoardSelector()}

      {/* Board header */}
      <div className="flex items-center justify-between">
        {editingBoardName ? (
          <div className="flex items-center gap-2">
            <input
              ref={boardNameInputRef}
              type="text"
              value={boardNameDraft}
              onChange={(e) => setBoardNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameBoard();
                if (e.key === 'Escape') setEditingBoardName(false);
              }}
              onBlur={handleRenameBoard}
              className="rounded-lg border border-cyan-400 bg-transparent px-2 py-1 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setBoardNameDraft(activeBoard.name);
              setEditingBoardName(true);
            }}
            className="text-sm font-semibold text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            title="Clic para renombrar"
          >
            {activeBoard.name}
          </button>
        )}
        <Badge color="gray" className="text-[10px]">
          {columns.length} {columns.length === 1 ? 'columna' : 'columnas'}
        </Badge>
      </div>

      {/* Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 300 }}>
        {columns.map((col) => {
          const colTasks = (boardTasks[col.id] ?? [])
            .sort((a, b) => a.position - b.position)
            .map((bt) => tasksById[bt.task_id])
            .filter(Boolean);

          const isDragOver = dragOverColumnId === col.id;

          return (
            <div
              key={col.id}
              className={`flex-shrink-0 w-72 rounded-2xl border p-3 transition-colors ${
                isDragOver
                  ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-900/10'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'
              }`}
              onDragOver={(e) => handleDragOverColumn(e, col.id)}
              onDragLeave={handleDragLeaveColumn}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {col.color && (
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  )}
                  {editingColumnId === col.id ? (
                    <input
                      ref={columnNameInputRef}
                      type="text"
                      value={editingColumnName}
                      onChange={(e) => setEditingColumnName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameColumn(col.id);
                        if (e.key === 'Escape') setEditingColumnId(null);
                      }}
                      onBlur={() => handleRenameColumn(col.id)}
                      className="rounded border border-cyan-400 bg-transparent px-1 py-0.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingColumnId(col.id);
                        setEditingColumnName(col.name);
                      }}
                      className="text-xs font-semibold text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400"
                      title="Clic para renombrar"
                    >
                      {col.name}
                    </button>
                  )}
                  <Badge color="gray" className="text-[10px]">{colTasks.length}</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteColumn(col.id)}
                  className="rounded-full p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                  title="Eliminar columna"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Column tasks */}
              <div className="space-y-2 min-h-[40px]">
                {colTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    onDragOver={(e) => handleDragOverTask(e, col.id, idx)}
                    onDrop={(e) => handleDropOnTask(e, col.id, idx)}
                  >
                    {dragOverColumnId === col.id && dragOverTaskPosition === idx && (
                      <div className="h-1 rounded-full bg-cyan-400 mb-1" />
                    )}
                    {renderTaskCard(task, col.id)}
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <p className="py-4 text-center text-[11px] text-slate-400">
                    Arrastra tareas aquí
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Add column button */}
        {addingColumn ? (
          <div className="flex-shrink-0 w-72 rounded-2xl border border-dashed border-cyan-400 p-3 bg-cyan-50/30 dark:bg-cyan-900/10">
            <input
              ref={newColumnInputRef}
              type="text"
              placeholder="Nombre de la columna..."
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddColumn();
                if (e.key === 'Escape') setAddingColumn(false);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <div className="mt-2 flex gap-2">
              <Button size="xs" color="info" onClick={handleAddColumn}>Añadir</Button>
              <Button size="xs" color="gray" onClick={() => setAddingColumn(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingColumn(true)}
            className="flex-shrink-0 flex w-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-xs text-slate-400 hover:border-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2 h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Añadir columna
          </button>
        )}
      </div>

      {/* Unassigned tasks pool */}
      {unassignedTasks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tareas sin asignar al tablón</span>
            <Badge color="gray">{unassignedTasks.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
            {unassignedTasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStartTask(e, task.id, '')}
                className="cursor-move rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:border-cyan-400 transition-colors max-w-xs truncate"
                title={task.title}
              >
                <span className={task.completed ? 'line-through text-slate-400' : ''}>{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

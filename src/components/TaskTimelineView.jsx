import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import TaskComments from './TaskComments';

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function getTaskHour(task) {
  const ts = task.inserted_at ? new Date(task.inserted_at) : null;
  if (!ts) return null;
  return ts.getHours();
}

function getTaskDateKey(task) {
  if (task.due_date) return task.due_date;
  if (task.inserted_at) return formatDateKey(new Date(task.inserted_at));
  return null;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function TaskTimelineView({
  tasks,
  membersById,
  members = [],
  projectId,
  userId,
  onTaskUpdated
}) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [weekStart, setWeekStart] = useState(() => {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.getFullYear(), today.getMonth(), diff);
  });

  const weekDates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      arr.push(addDays(weekStart, i));
    }
    return arr;
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const s = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(start);
    const e = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(end);
    return `${s} – ${e}`;
  }, [weekDates]);

  const tasksByDayHour = useMemo(() => {
    const map = {};
    weekDates.forEach((d) => {
      map[formatDateKey(d)] = {};
      HOURS.forEach((h) => { map[formatDateKey(d)][h] = []; });
    });

    tasks.forEach((task) => {
      const dayKey = getTaskDateKey(task);
      if (!dayKey || !map[dayKey]) return;
      const hour = getTaskHour(task);
      if (hour === null) {
        if (!map[dayKey].allDay) map[dayKey].allDay = [];
        map[dayKey].allDay.push(task);
      } else {
        map[dayKey][hour].push(task);
      }
    });
    return map;
  }, [tasks, weekDates]);

  const [panelTask, setPanelTask] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [showAllHours, setShowAllHours] = useState(false);

  // Horario por defecto: 08:00 - 22:00. Modo 24h opcional.
  const activeHours = useMemo(() => {
    const arr = [];
    for (let h = 8; h <= 22; h++) arr.push(h);
    return arr;
  }, []);

  const displayHours = showAllHours ? HOURS : activeHours;

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') setPanelOpen(false); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const goPrev = () => setWeekStart((prev) => addDays(prev, -7));
  const goNext = () => setWeekStart((prev) => addDays(prev, 7));
  const goToday = () => {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setWeekStart(new Date(today.getFullYear(), today.getMonth(), diff));
  };

  const openPanel = (task) => { setPanelTask(task); setPanelError(''); setPanelOpen(true); };
  const closePanel = () => { setPanelOpen(false); setTimeout(() => setPanelTask(null), 300); };

  const updateTaskField = useCallback(async (field, value) => {
    if (!panelTask || !projectId || !userId) return;
    setSaving(true); setPanelError('');
    const payload = { [field]: value, updated_by: userId, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('tasks').update(payload).eq('id', panelTask.id).eq('project_id', projectId).select().maybeSingle();
    if (error) setPanelError(error.message);
    else if (data) { setPanelTask(data); onTaskUpdated?.(data); }
    setSaving(false);
  }, [panelTask, projectId, userId, onTaskUpdated]);

  const toggleTaskCompleted = useCallback(async () => {
    if (!panelTask || !projectId || !userId) return;
    setSaving(true); setPanelError('');
    const next = !panelTask.completed;
    const { data, error } = await supabase.from('tasks').update({ completed: next, completed_at: next ? new Date().toISOString() : null, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', panelTask.id).eq('project_id', projectId).select().maybeSingle();
    if (error) setPanelError(error.message);
    else if (data) { setPanelTask(data); onTaskUpdated?.(data); }
    setSaving(false);
  }, [panelTask, projectId, userId, onTaskUpdated]);

  const weekdayShort = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
  const formatHour = (h) => `${String(h).padStart(2, '0')}:00`;
  const priorityDot = (priority) => {
    if (priority === 'high') return 'bg-rose-500';
    if (priority === 'low') return 'bg-emerald-500';
    return 'bg-amber-500';
  };

  return (
    <div className="mt-4 space-y-4 px-2 pb-2 sm:px-4 sm:pb-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-cyan-400"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-cyan-400"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-cyan-400"
          >
            Siguiente
          </button>
          <button
            type="button"
            onClick={() => setShowAllHours((v) => !v)}
            className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:border-cyan-400"
            title={showAllHours ? 'Mostrar 08:00 - 22:00' : 'Mostrar 24 horas'}
          >
            {showAllHours ? '08:00-22:00' : '24h'}
          </button>
        </div>
        <div className="text-xs uppercase tracking-wide text-slate-400">{weekLabel}</div>
      </div>

      {/* Weekly schedule grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40">
        <div style={{ minWidth: 700 }}>
          {/* Header: days */}
          <div className="grid sticky top-0 z-20" style={{ gridTemplateColumns: `64px repeat(7, 1fr)` }}>
            <div className="border-b border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-2 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Hora
            </div>
            {weekDates.map((date) => {
              const key = formatDateKey(date);
              const isToday = key === formatDateKey(today);
              return (
                <div
                  key={key}
                  className={`border-b border-r border-slate-200 dark:border-slate-800 px-1 py-2 text-center text-[11px] font-medium ${
                    isToday
                      ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="uppercase">{weekdayShort.format(date)}</div>
                  <div>{date.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* All-day row */}
          <div className="grid" style={{ gridTemplateColumns: `64px repeat(7, 1fr)` }}>
            <div className="border-b border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-2 py-2 text-[10px] font-medium text-slate-500 flex items-center">
              Todo el día
            </div>
            {weekDates.map((date) => {
              const key = formatDateKey(date);
              const dayTasks = tasksByDayHour[key]?.allDay || [];
              const isToday = key === formatDateKey(today);
              return (
                <div
                  key={key}
                  className={`border-b border-r border-slate-200 dark:border-slate-800 px-1 py-1 h-[40px] overflow-hidden ${
                    isToday ? 'bg-cyan-500/5' : ''
                  }`}
                >
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {dayTasks.map((task) => {
                      const isUrgent = Boolean(task.title && task.title.toLowerCase().includes('urgente'));
                      const buttonClass = task.completed
                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 line-through opacity-60'
                        : isUrgent
                          ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 hover:border-red-400 shadow-sm shadow-red-500/5'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-400';

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => openPanel(task)}
                          className={`group flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border w-full overflow-hidden ${buttonClass}`}
                          title={task.title}
                        >
                          <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${priorityDot(task.priority)}`} />
                          <span className="truncate whitespace-nowrap">{task.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
 
          {/* Hour rows */}
          {displayHours.map((hour) => (
            <div key={hour} className="grid" style={{ gridTemplateColumns: `64px repeat(7, 1fr)` }}>
              <div className="border-b border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 px-2 py-1 text-[10px] text-slate-400 flex items-center">
                {formatHour(hour)}
              </div>
              {weekDates.map((date) => {
                const key = formatDateKey(date);
                const hourTasks = tasksByDayHour[key]?.[hour] || [];
                const isToday = key === formatDateKey(today);
                return (
                  <div
                    key={`${key}-${hour}`}
                    className={`border-b border-r border-slate-200 dark:border-slate-800 px-1 py-1 h-[36px] overflow-hidden ${
                      isToday ? 'bg-cyan-500/5' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-1 overflow-hidden">
                      {hourTasks.map((task) => {
                        const isUrgent = Boolean(task.title && task.title.toLowerCase().includes('urgente'));
                        const buttonClass = task.completed
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 line-through opacity-60'
                          : isUrgent
                            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 hover:border-red-400 shadow-sm shadow-red-500/5'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-400';

                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => openPanel(task)}
                            className={`group flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border w-full overflow-hidden ${buttonClass}`}
                            title={task.title}
                          >
                            <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${priorityDot(task.priority)}`} />
                            <span className="truncate whitespace-nowrap">{task.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
          <span>Alta</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
          <span>Media</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          <span>Baja</span>
        </div>
      </div>

      {/* Overlay */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity" onClick={closePanel} />
      )}

      {/* Side panel (Asana-style) */}
      {panelOpen && panelTask && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg transform transition-transform duration-300 ease-in-out translate-x-0">
          <div className="h-full overflow-y-auto border-l border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-2xl">
            <div className="flex flex-col">
              {/* Top header bar */}
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-5 py-3">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Detalle de tarea</span>
                <button type="button" onClick={closePanel} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex flex-col gap-5 p-5">
                {panelError && <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{panelError}</div>}
                {saving && <div className="text-[10px] text-slate-400">Guardando...</div>}

                {/* Title */}
                <div className="space-y-2">
                  <input
                    value={panelTask.title}
                    onChange={(e) => updateTaskField('title', e.target.value)}
                    className="w-full bg-transparent text-lg font-bold text-slate-900 dark:text-white border-b border-transparent hover:border-slate-300 focus:border-cyan-400 focus:outline-none pb-1 leading-tight"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                      <input type="checkbox" checked={panelTask.completed} onChange={toggleTaskCompleted} className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
                      <span className={panelTask.completed ? 'line-through text-slate-400' : ''}>{panelTask.completed ? 'Completada' : 'Marcar como completada'}</span>
                    </label>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      panelTask.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                      panelTask.priority === 'low' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${priorityDot(panelTask.priority)}`} />
                      {panelTask.priority === 'high' ? 'Alta' : panelTask.priority === 'low' ? 'Baja' : 'Media'}
                    </span>
                  </div>
                </div>

                {/* Properties grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
                  {/* Assignee */}
                  <div className="space-y-1.5">
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                      Asignado
                    </span>
                    <select
                      value={panelTask.assigned_to || ''}
                      onChange={(e) => updateTaskField('assigned_to', e.target.value || null)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="">Sin asignar</option>
                      {members.map((m) => (
                        <option key={m.member_id} value={m.member_id}>{m.member_email}</option>
                      ))}
                    </select>
                  </div>

                  {/* Effort */}
                  <div className="space-y-1.5">
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      Esfuerzo
                    </span>
                    <select
                      value={panelTask.effort || 'm'}
                      onChange={(e) => updateTaskField('effort', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="s">S — Pequeño</option>
                      <option value="m">M — Medio</option>
                      <option value="l">L — Grande</option>
                    </select>
                  </div>

                  {/* Start date */}
                  <div className="space-y-1.5">
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                      Inicio
                    </span>
                    <input
                      type="date"
                      value={panelTask.start_date || ''}
                      onChange={(e) => updateTaskField('start_date', e.target.value || null)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  {/* Due date */}
                  <div className="space-y-1.5">
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      Vencimiento
                    </span>
                    <input
                      type="date"
                      value={panelTask.due_date || ''}
                      onChange={(e) => updateTaskField('due_date', e.target.value || null)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                    Descripción
                  </span>
                  <textarea
                    value={panelTask.description || ''}
                    onChange={(e) => updateTaskField('description', e.target.value)}
                    rows={5}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-cyan-400 focus:outline-none resize-y"
                    placeholder="Añade una descripción..."
                  />
                </div>

                {/* Comments */}
                <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337L5.25 21l1.183-3.6A8.962 8.962 0 013.75 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                    Comentarios
                  </span>
                  <TaskComments
                    taskId={panelTask.id}
                    taskTitle={panelTask.title}
                    currentUserId={userId}
                    members={members}
                    projectId={projectId}
                    isOwner={false}
                  />
                </div>

                {/* Tags */}
                {Array.isArray(panelTask.tags) && panelTask.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {panelTask.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

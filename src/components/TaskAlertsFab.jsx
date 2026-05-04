import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Floating Action Button that shows task alerts per project.
 * - Personal: tasks due today / overdue for the current user
 * - Unassigned: tasks due today / overdue with no assignee (per project)
 */
export default function TaskAlertsFab({ user, projects }) {
  const [isOpen, setIsOpen] = useState(false);
  const [alertData, setAlertData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasBeenRead, setHasBeenRead] = useState(() => {
    try {
      const raw = localStorage.getItem(`taskAlertsDismissed_${user?.id ?? ''}`);
      if (!raw) return false;
      const stored = JSON.parse(raw);
      return stored?.date === new Date().toLocaleDateString('en-CA');
    } catch { return false; }
  });
  const prevCountRef = useRef(0);
  const panelRef = useRef(null);
  const fabRef = useRef(null);

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  // Restore read state from localStorage
  const storageKey = `taskAlertsDismissed_${user?.id ?? ''}`;
  const getStoredDismiss = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [storageKey]);

  const fetchAlerts = useCallback(async () => {
    if (!user?.id) {
      setAlertData([]);
      return;
    }

    setLoading(true);
    try {
      const projectIds = projects?.map(p => p.id) ?? [];

      // Fetch all relevant tasks in parallel
      const queries = [
        // My tasks (all, including those without project)
        supabase
          .from('tasks')
          .select('id, project_id, due_date')
          .eq('assigned_to', user.id)
          .or('completed.is.null,completed.eq.false')
          .not('due_date', 'is', null)
          .lte('due_date', todayStr)
      ];

      // Unassigned tasks only if we have projects
      if (projectIds.length > 0) {
        queries.push(
          supabase
            .from('tasks')
            .select('id, project_id, due_date')
            .is('assigned_to', null)
            .in('project_id', projectIds)
            .or('completed.is.null,completed.eq.false')
            .not('due_date', 'is', null)
            .lte('due_date', todayStr)
        );
      }

      const results = await Promise.all(queries);
      const [myTasksRes] = results;
      const unassignedRes = results[1];

      const myTasks = myTasksRes.data ?? [];
      const unassigned = unassignedRes?.data ?? [];

      // Group by project
      const grouped = {};
      // Add a virtual group for tasks without project
      grouped['__no_project__'] = { myToday: 0, myOverdue: 0, unassignedToday: 0, unassignedOverdue: 0 };
      projectIds.forEach(pid => {
        grouped[pid] = { myToday: 0, myOverdue: 0, unassignedToday: 0, unassignedOverdue: 0 };
      });

      myTasks.forEach(t => {
        const pid = t.project_id ?? '__no_project__';
        if (!grouped[pid]) return;
        if (t.due_date === todayStr) grouped[pid].myToday++;
        else if (t.due_date < todayStr) grouped[pid].myOverdue++;
      });

      unassigned.forEach(t => {
        if (!grouped[t.project_id]) return;
        if (t.due_date === todayStr) grouped[t.project_id].unassignedToday++;
        else if (t.due_date < todayStr) grouped[t.project_id].unassignedOverdue++;
      });

      // Build messages per project
      const buildMessages = (g) => {
        const msgs = [];
        if (g.myOverdue > 0) {
          msgs.push({ type: 'overdue', text: `Tienes ${g.myOverdue} tarea${g.myOverdue > 1 ? 's' : ''} vencida${g.myOverdue > 1 ? 's' : ''}` });
        }
        if (g.myToday > 0) {
          msgs.push({ type: 'today', text: `Tienes ${g.myToday} tarea${g.myToday > 1 ? 's' : ''} para hoy` });
        }
        if (g.unassignedOverdue > 0) {
          msgs.push({ type: 'unassigned-overdue', text: `${g.unassignedOverdue} tarea${g.unassignedOverdue > 1 ? 's' : ''} vencida${g.unassignedOverdue > 1 ? 's' : ''} sin asignar` });
        }
        if (g.unassignedToday > 0) {
          msgs.push({ type: 'unassigned-today', text: `${g.unassignedToday} tarea${g.unassignedToday > 1 ? 's' : ''} para hoy sin asignar` });
        }
        return msgs;
      };

      const messages = [];

      // Tasks without project first
      const noProjectGroup = grouped['__no_project__'];
      const noProjectMsgs = buildMessages(noProjectGroup);
      if (noProjectMsgs.length > 0) {
        messages.push({ project: { id: '__no_project__', name: 'Mis tareas' }, messages: noProjectMsgs });
      }

      // Then per project
      (projects ?? []).forEach(p => {
        const g = grouped[p.id];
        if (!g) return;
        const projectMsgs = buildMessages(g);
        if (projectMsgs.length > 0) {
          messages.push({ project: p, messages: projectMsgs });
        }
      });

      const newTotal = messages.reduce((sum, g) => sum + g.messages.length, 0);
      setAlertData(messages);

      // Check if user already dismissed this exact set today
      const stored = getStoredDismiss();
      if (stored && stored.date === todayStr && stored.count === newTotal) {
        setHasBeenRead(true);
      } else if (newTotal > prevCountRef.current && prevCountRef.current > 0) {
        // New alerts appeared since last check
        setHasBeenRead(false);
      }
      prevCountRef.current = newTotal;
    } catch (err) {
      console.error('TaskAlertsFab: error fetching alerts', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, projects, todayStr]);

  // Fetch on mount and when projects change
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        fabRef.current &&
        !fabRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const totalCount = useMemo(
    () => alertData.reduce((sum, g) => sum + g.messages.length, 0),
    [alertData]
  );

  // Don't render if no user
  if (!user) return null;

  const iconForType = (type) => {
    switch (type) {
      case 'overdue':
        return (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
        );
      case 'today':
        return (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
        );
      case 'unassigned-overdue':
        return (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
            </svg>
          </div>
        );
      case 'unassigned-today':
        return (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const textColorForType = (type) => {
    switch (type) {
      case 'overdue': return 'text-rose-700 dark:text-rose-300';
      case 'today': return 'text-amber-700 dark:text-amber-300';
      case 'unassigned-overdue': return 'text-purple-700 dark:text-purple-300';
      case 'unassigned-today': return 'text-cyan-700 dark:text-cyan-300';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };

  return (
    <>
      {/* FAB Button */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => {
          if (!isOpen) { fetchAlerts(); }
          setIsOpen(!isOpen);
          setHasBeenRead(true);
          // Persist dismiss state
          const total = alertData.reduce((sum, g) => sum + g.messages.length, 0);
          try { localStorage.setItem(storageKey, JSON.stringify({ date: todayStr, count: total })); } catch {}
        }}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-2xl shadow-cyan-500/40 transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/60 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
        aria-label="Alertas de tareas"
      >
        {/* Bell icon */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-6 w-6 transition-transform duration-300 ${isOpen ? 'rotate-12' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>

        {/* Badge */}
        {totalCount > 0 && !hasBeenRead && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-black text-white shadow-lg shadow-rose-500/50 ring-2 ring-white dark:ring-slate-900 animate-bounce">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-36 right-4 lg:bottom-24 lg:right-6 z-[60] w-[340px] max-h-[70vh] overflow-hidden rounded-3xl border border-slate-200/60 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-black/20 transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in"
          style={{ animation: 'fadeSlideUp 0.3s ease-out' }}
        >
          {/* Panel Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Alertas</h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {totalCount > 0 ? `${totalCount} alerta${totalCount !== 1 ? 's' : ''} activa${totalCount !== 1 ? 's' : ''}` : 'Sin alertas'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Panel Content */}
          <div className="overflow-y-auto max-h-[calc(70vh-80px)] custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              </div>
            ) : alertData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">¡Todo al día!</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No hay tareas críticas pendientes.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {alertData.map((group) => (
                  <div key={group.project.id} className="px-5 py-4">
                    {/* Project name header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                        </svg>
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                        {group.project.name}
                      </span>
                    </div>

                    {/* Messages */}
                    <div className="space-y-2">
                      {group.messages.map((msg, idx) => (
                        <div key={idx} className="flex items-center gap-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 px-3 py-2.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60">
                          {iconForType(msg.type)}
                          <span className={`text-xs font-medium leading-tight ${textColorForType(msg.type)}`}>
                            {msg.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

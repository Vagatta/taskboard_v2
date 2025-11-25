import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Badge, Button, Card, Checkbox, Select, Spinner } from 'flowbite-react';
import { supabase } from '../supabaseClient';

const RANGE_PRESETS = [
  { value: 7, label: 'Últimos 7 días' },
  { value: 14, label: 'Últimos 14 días' },
  { value: 30, label: 'Últimos 30 días' }
];

const ACTION_META = {
  task_created: { label: 'Tarea creada', color: 'success' },
  task_completed: { label: 'Tarea completada', color: 'info' },
  task_reopened: { label: 'Tarea reabierta', color: 'warning' },
  task_assigned: { label: 'Asignación actualizada', color: 'purple' },
  comment_added: { label: 'Comentario', color: 'gray' },
  default: { label: 'Actividad', color: 'indigo' }
};

const ACTION_OPTIONS = Object.keys(ACTION_META).filter((key) => key !== 'default');

const formatDateInput = (date) => date.toISOString().slice(0, 10);

const formatLocaleDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
};

export default function ActivityLog({ projectId, members = [] }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [rangeDays, setRangeDays] = useState(7);
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return formatDateInput(start);
  });
  const [dateTo, setDateTo] = useState(() => formatDateInput(new Date()));
  const [selectedActions, setSelectedActions] = useState(ACTION_OPTIONS);

  const membersById = useMemo(
    () =>
      members.reduce((acc, member) => {
        if (member.member_id) {
          acc[member.member_id] = member;
        }
        return acc;
      }, {}),
    [members]
  );

  const handlePresetChange = (days) => {
    setRangeDays(days);
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    setDateTo(formatDateInput(now));
    setDateFrom(formatDateInput(start));
  };

  const fromBoundary = useMemo(() => {
    if (!dateFrom) return null;
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    return from;
  }, [dateFrom]);

  const toBoundary = useMemo(() => {
    if (!dateTo) return null;
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    return to;
  }, [dateTo]);

  const shouldIncludeLog = useCallback(
    (log) => {
      if (!projectId || log.project_id !== projectId) return false;
      if (selectedActions.length === 0 || !selectedActions.includes(log.event_type)) return false;
      if (selectedUser !== 'all' && log.actor_id !== selectedUser) return false;

      if (fromBoundary) {
        const created = new Date(log.created_at);
        if (created < fromBoundary) return false;
      }

      if (toBoundary) {
        const created = new Date(log.created_at);
        if (created > toBoundary) return false;
      }

      return true;
    },
    [fromBoundary, projectId, selectedActions, selectedUser, toBoundary]
  );

  const loadLog = useCallback(async () => {
    if (!projectId || selectedActions.length === 0) {
      setLogs([]);
      return;
    }

    setLoading(true);
    setError('');

    let query = supabase
      .from('activity_log')
      .select('id,project_id,task_id,actor_id,event_type,payload,created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (selectedUser !== 'all') {
      query = query.eq('actor_id', selectedUser);
    }

    if (selectedActions.length !== ACTION_OPTIONS.length) {
      query = query.in('event_type', selectedActions);
    }

    if (fromBoundary) {
      query = query.gte('created_at', fromBoundary.toISOString());
    }

    if (toBoundary) {
      query = query.lte('created_at', toBoundary.toISOString());
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setLogs([]);
    } else {
      setLogs(data ?? []);
    }

    setLoading(false);
  }, [fromBoundary, projectId, selectedActions, selectedUser, toBoundary]);

  useEffect(() => {
     loadLog();
  }, [loadLog]);

  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    const channel = supabase
      .channel(`activity-log-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && shouldIncludeLog(payload.new)) {
            setLogs((previous) => {
              const next = [payload.new, ...previous];
              return next.slice(0, 100);
            });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, shouldIncludeLog]);

  const toggleAction = (action) => {
    setSelectedActions((previous) => {
      if (previous.includes(action)) {
        return previous.filter((item) => item !== action);
      }
      return [...previous, action];
    });
  };

  const areAllActionsSelected = selectedActions.length === ACTION_OPTIONS.length;

  const renderDetails = (log) => {
    if (!log.details) {
      return 'Sin detalles adicionales.';
    }

    if (typeof log.details === 'string') {
      return log.details;
    }

    if (typeof log.details === 'object') {
      return log.details.summary ?? JSON.stringify(log.details);
    }

    return String(log.details);
  };

  const currentPreset = RANGE_PRESETS.find((preset) => preset.value === rangeDays)?.value ?? 'custom';

  let content;

  if (loading) {
    content = (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  } else if (logs.length === 0) {
    content = (
      <p className="text-sm text-slate-500">
        Sin actividad registrada para los filtros seleccionados.
      </p>
    );
  } else {
    content = (
      <div className="space-y-3">
        {logs.map((log) => {
          const member = membersById[log.actor_id];
          const meta = ACTION_META[log.event_type] ?? ACTION_META.default;
          return (
            <div key={log.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <Badge color={meta.color}>{meta.label}</Badge>
                <span className="font-semibold text-white">
                  {member?.member_email ?? log.actor_id ?? 'Sistema'}
                </span>
                <span>{formatLocaleDate(log.created_at)}</span>
                {log.task_id ? <span>Tarea #{log.task_id.slice(0, 8)}…</span> : null}
              </div>
              <p className="mt-2 text-sm text-slate-100">{renderDetails(log)}</p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="bg-slate-950/40">
      <div className="flex max-h-[480px] flex-col gap-4 overflow-y-auto pr-2">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Historial de actividad</p>
            <p className="text-xs text-slate-500">Registra tareas, comentarios y asignaciones recientes.</p>
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-500 sm:text-right">
            <span>Rango rápido</span>
            <Select
              value={typeof rangeDays === 'number' ? String(rangeDays) : 'custom'}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'custom') {
                  setRangeDays('custom');
                  return;
                }
                const days = Number(value);
                if (!Number.isNaN(days)) {
                  handlePresetChange(days);
                }
              }}
            >
              {RANGE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Personalizado (usar fechas)</option>
            </Select>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Usuario</span>
            <Select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              <option value="all">Todos</option>
              {members.map((member) => (
                <option key={member.member_id} value={member.member_id}>
                  {member.member_email ?? member.member_id}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Desde</span>
            <input
              type="date"
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-sm text-white"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setRangeDays('custom');
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Hasta</span>
            <input
              type="date"
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-sm text-white"
              value={dateTo}
              min={dateFrom}
              onChange={(event) => {
                setDateTo(event.target.value);
                setRangeDays('custom');
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Filtrar por tipo de acción</span>
            <Button
              size="xs"
              color="light"
              onClick={() => setSelectedActions(areAllActionsSelected ? [] : ACTION_OPTIONS)}
            >
              {areAllActionsSelected ? 'Limpiar' : 'Seleccionar todo'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4">
            {ACTION_OPTIONS.map((action) => (
              <label key={action} className="flex items-center gap-2 text-xs text-slate-400">
                <Checkbox
                  checked={selectedActions.includes(action)}
                  onChange={() => toggleAction(action)}
                />
                <span>{ACTION_META[action].label}</span>
              </label>
            ))}
          </div>
        </div>

        {error ? (
          <Alert color="failure" onDismiss={() => setError('')}>
            {error}
          </Alert>
        ) : null}

        {content}
      </div>
    </Card>
  );
}

ActivityLog.propTypes = {
  projectId: PropTypes.string,
  members: PropTypes.arrayOf(
    PropTypes.shape({
      member_id: PropTypes.string,
      member_email: PropTypes.string
    })
  )
};

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner, Toast } from 'flowbite-react';
import { supabase } from '../supabaseClient';

const NOTIFICATION_META = {
  comment_mention: {
    label: 'Mención',
    color: 'purple',
    message: (payload) => `Te mencionaron en "${payload?.task_title ?? 'una tarea'}"`
  },
  task_assigned: {
    label: 'Nueva asignación',
    color: 'info',
    message: (payload) => `Te asignaron "${payload?.task_title ?? 'una tarea'}"`
  },
  task_unassigned: {
    label: 'Asignación removida',
    color: 'warning',
    message: (payload) => `Ya no eres responsable de "${payload?.task_title ?? 'una tarea'}"`
  },
  default: {
    label: 'Notificación',
    color: 'gray',
    message: () => 'Tienes una nueva actividad'
  }
};

const formatDateTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
};

export default function NotificationPanel({ userId, workspaceId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastQueue, setToastQueue] = useState([]);

  const groupedNotifications = useMemo(() => {
    return notifications.reduce(
      (accumulator, notification) => {
        if (notification.read) {
          accumulator.read.push(notification);
        } else {
          accumulator.unread.push(notification);
        }
        return accumulator;
      },
      { unread: [], read: [] }
    );
  }, [notifications]);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('id,user_id,workspace_id,payload,read,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (fetchError) {
      setError(fetchError.message);
      setNotifications([]);
    } else {
      setNotifications(data ?? []);
    }

    setLoading(false);
  }, [userId]);

  const markNotification = useCallback(
    async (notificationId) => {
      const target = notifications.find((item) => item.id === notificationId);
      if (!target || target.read) return;

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (!updateError) {
        setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
      }
    },
    [notifications]
  );

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    if (unreadIds.length === 0) return;

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);

    if (!updateError) {
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    }
  }, [notifications]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev].slice(0, 30));
          setToastQueue((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (toastQueue.length === 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setToastQueue((prev) => prev.slice(1));
    }, 4000);

    return () => clearTimeout(timer);
  }, [toastQueue]);

  if (!userId) {
    return (
      <Card className="bg-slate-950/40">
        <p className="text-sm text-slate-500">Inicia sesión para recibir notificaciones.</p>
      </Card>
    );
  }

  const unreadCount = groupedNotifications.unread.length;

  const resolveMeta = (notification) => {
    const typeFromPayload = notification.payload?.type;
    return NOTIFICATION_META[typeFromPayload] ?? NOTIFICATION_META.default;
  };

  return (
    <div className="space-y-4">
      {toastQueue.length > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center">
          <div className="space-y-2">
            {toastQueue.map((notification) => {
              const meta = resolveMeta(notification);
              return (
                <Toast key={`toast-${notification.id}`}>
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-500 dark:bg-primary-900 dark:text-primary-300">
                    <span className="text-lg">🔔</span>
                  </div>
                  <div className="ml-3 text-sm font-normal">
                    <p className="font-semibold">{meta.label}</p>
                    <p>{meta.message(notification.payload)}</p>
                  </div>
                  <Toast.Toggle onDismiss={() => setToastQueue((prev) => prev.filter((item) => item.id !== notification.id))} />
                </Toast>
              );
            })}
          </div>
        </div>
      ) : null}

      <Card className="bg-slate-950/40">
        <div className="flex flex-col gap-4">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Notificaciones</p>
              <p className="text-xs text-slate-500">Menciones y asignaciones en este workspace.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <Badge color={unreadCount > 0 ? 'info' : 'gray'}>Pendientes: {unreadCount}</Badge>
              <Button size="xs" color="light" onClick={markAllAsRead} disabled={unreadCount === 0}>
                Marcar todo como leído
              </Button>
            </div>
          </header>

          {error ? (
            <Alert color="failure" onDismiss={() => setError('')}>
              {error}
            </Alert>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-slate-500">Sin notificaciones para mostrar.</p>
          ) : (
            <div className="space-y-6">
              {[
                {
                  id: 'unread',
                  title: 'Pendientes',
                  description: 'Mensajes sin leer',
                  items: groupedNotifications.unread,
                  empty: 'No tienes notificaciones pendientes.'
                },
                {
                  id: 'history',
                  title: 'Histórico',
                  description: 'Últimas notificaciones leídas',
                  items: groupedNotifications.read,
                  empty: 'Aún no tienes historial reciente.'
                }
              ].map((section) => (
                <section key={section.id} className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{section.title}</p>
                      <p className="text-xs text-slate-500">{section.description}</p>
                    </div>
                    <Badge color={section.items.length > 0 ? 'info' : 'gray'}>{section.items.length} items</Badge>
                  </div>
                  {section.items.length === 0 ? (
                    <p className="text-xs text-slate-500">{section.empty}</p>
                  ) : (
                    <div className="space-y-3">
                      {section.items.map((notification) => {
                        const meta = resolveMeta(notification);
                        return (
                          <div
                            key={notification.id}
                            className={`rounded-2xl border p-3 text-sm transition ${
                              notification.read ? 'border-slate-800 bg-slate-950/50' : 'border-primary/40 bg-slate-900/60'
                            }`}
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2">
                                <Badge color={meta.color}>{meta.label}</Badge>
                                <span>{meta.message(notification.payload)}</span>
                              </div>
                              <span className="text-xs text-slate-500">{formatDateTime(notification.created_at)}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                              {notification.payload?.task_id ? <span>ID tarea: {notification.payload.task_id.slice(0, 8)}…</span> : null}
                              {notification.payload?.project_id ? <span>Proyecto: {notification.payload.project_id.slice(0, 8)}…</span> : null}
                            </div>
                            {!notification.read ? (
                              <Button
                                size="xs"
                                color="success"
                                className="mt-3"
                                onClick={() => markNotification(notification.id)}
                              >
                                Marcar como leída
                              </Button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

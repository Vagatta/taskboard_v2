import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Card, Spinner } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import { formatRelativeTime } from '../utils/dateHelpers';

export default function MentionDigest({ projectId, members = [], limit = 25 }) {
  const [mentions, setMentions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const loadMentions = useCallback(async () => {
    if (!projectId) {
      setMentions([]);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('id,user_id,payload,created_at')
      .contains('payload', { project_id: projectId, type: 'comment_mention' })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchError) {
      setError(fetchError.message);
      setMentions([]);
    } else {
      setMentions(data ?? []);
    }

    setLoading(false);
  }, [limit, projectId]);

  useEffect(() => {
    void loadMentions();
  }, [loadMentions]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const channel = supabase
      .channel(`mentions-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          const newNotif = payload.new;
          if (newNotif?.payload?.type !== 'comment_mention' || newNotif.payload?.project_id !== projectId) {
            return;
          }
          setMentions((previous) => [newNotif, ...previous].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [limit, projectId]);

  const groupedMentions = useMemo(() => {
    const grouped = mentions.reduce((acc, mention) => {
      const userMentions = acc.get(mention.user_id) ?? [];
      userMentions.push(mention);
      acc.set(mention.user_id, userMentions);
      return acc;
    }, new Map());

    return Array.from(grouped.entries()).map(([userId, items]) => ({
      userId,
      items: items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }));
  }, [mentions]);

  return (
    <Card className="bg-slate-950/40">
      <div className="space-y-3">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Resumen de menciones</p>
            <p className="text-xs text-slate-500">Últimas referencias directas a miembros del proyecto.</p>
          </div>
          {loading ? <Spinner size="sm" /> : null}
        </header>

        {error ? (
          <Alert color="failure" onDismiss={() => setError('')}>
            {error}
          </Alert>
        ) : null}

        {!projectId ? (
          <p className="text-sm text-slate-500">Selecciona un proyecto para ver las menciones.</p>
        ) : mentions.length === 0 ? (
          <p className="text-sm text-slate-500">Sin menciones recientes.</p>
        ) : (
          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-2">
            {groupedMentions.map(({ userId, items }) => {
              const member = membersById[userId];
              const latest = items[0];
              const payload = latest.payload ?? {};
              const taskTitle = payload.task_title ?? payload.task_id ?? 'Tarea';
              const mentionedBy = membersById[payload.mentioned_by]?.member_email ?? payload.mentioned_by;
              return (
                <div key={userId} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-100">{member?.member_email ?? userId}</span>
                    <Badge color="info" size="xs">
                      {items.length} menc.
                    </Badge>
                    <span>{formatRelativeTime(new Date(latest.created_at))}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-100">
                    {mentionedBy ? `${mentionedBy} te mencionó` : 'Nueva mención'} en "{taskTitle}"
                  </p>
                  {payload.comment_excerpt ? (
                    <p className="mt-1 text-xs text-slate-400">“{payload.comment_excerpt}”</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

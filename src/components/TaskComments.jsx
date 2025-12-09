import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner, Textarea } from 'flowbite-react';
import { supabase } from '../supabaseClient';

// Comentarios de una tarea: lista, creación rápida, menciones y algo de control de permisos.
export default function TaskComments({ taskId, taskTitle, currentUserId, members = [], workspaceId = null, projectId = null }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionAnchor, setMentionAnchor] = useState(null);
  const [caretIndex, setCaretIndex] = useState(0);
  const textareaRef = useRef(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingBody, setEditingBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

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

  const currentMember = currentUserId ? membersById[currentUserId] : null;
  const allowedRoles = ['owner', 'editor'];
  const canComment = Boolean(currentMember && allowedRoles.includes(currentMember.role));
  const permissionMessage = currentUserId
    ? currentMember
      ? `Tu rol (${currentMember.role}) no permite publicar comentarios.`
      : 'No perteneces a este proyecto, por lo que no puedes comentar.'
    : 'Inicia sesión para poder comentar.';

  const mentionableMembers = useMemo(
    () => members.filter((member) => member.member_id && member.member_id !== currentUserId),
    [members, currentUserId]
  );

  const mentionSuggestions = useMemo(() => {
    if (!showMentionDropdown) {
      return [];
    }
    const query = mentionQuery.trim().toLowerCase();
    if (!query) {
      return mentionableMembers.slice(0, 5);
    }
    return mentionableMembers
      .filter((member) => {
        const label = member.member_email ?? member.member_id;
        return label?.toLowerCase().includes(query);
      })
      .slice(0, 5);
  }, [mentionQuery, mentionableMembers, showMentionDropdown]);

  // Pequeño detector de @menciones mientras se escribe en el textarea.
  const handleMentionDetection = useCallback((value, cursorPosition) => {
    setCaretIndex(cursorPosition);
    const slice = value.slice(0, cursorPosition);
    const mentionMatch = slice.match(/@([^\s@]*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionAnchor(cursorPosition - mentionMatch[1].length - 1);
      setShowMentionDropdown(true);
    } else {
      setMentionQuery('');
      setMentionAnchor(null);
      setShowMentionDropdown(false);
    }
  }, []);

  const insertMentionAtCursor = useCallback(
    (member) => {
      if (mentionAnchor === null) {
        return;
      }
      const label = member.member_email ?? member.member_id;
      const before = newComment.slice(0, mentionAnchor);
      const after = newComment.slice(caretIndex);
      const insertion = `@${label} `;
      const nextValue = `${before}${insertion}${after}`;
      setNewComment(nextValue);
      setMentionedUsers((prev) => (prev.includes(member.member_id) ? prev : [...prev, member.member_id]));
      setMentionQuery('');
      setMentionAnchor(null);
      setShowMentionDropdown(false);
      const nextCaret = before.length + insertion.length;
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(nextCaret, nextCaret);
        }
      });
    },
    [caretIndex, mentionAnchor, newComment]
  );

  const removeMention = useCallback((memberId) => {
    setMentionedUsers((prev) => prev.filter((id) => id !== memberId));
  }, []);

  const sendMentionNotifications = useCallback(
    async (body, mentionIds) => {
      if (!workspaceId || !projectId || !mentionIds?.length) {
        return;
      }

      // Enviamos una notificación interna por cada usuario mencionado.
      const payload = mentionIds.map((userId) => ({
        user_id: userId,
        workspace_id: workspaceId,
        payload: {
          type: 'comment_mention',
          project_id: projectId,
          task_id: taskId,
          task_title: taskTitle,
          mentioned_by: currentUserId,
          comment_excerpt: body.slice(0, 140)
        }
      }));

      await supabase.from('notifications').insert(payload);
    },
    [currentUserId, projectId, taskId, taskTitle, workspaceId]
  );

  const startEditComment = (comment) => {
    if (!currentUserId || comment.author_id !== currentUserId) {
      return;
    }
    setEditingCommentId(comment.id);
    setEditingBody(comment.body ?? '');
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingBody('');
    setSavingEdit(false);
  };

  const handleSaveCommentEdit = async () => {
    const body = editingBody.trim();
    if (!editingCommentId || !body || !currentUserId) {
      return;
    }

    setSavingEdit(true);
    setError('');

    const { error: updateError } = await supabase
      .from('task_comments')
      .update({ body })
      .eq('id', editingCommentId)
      .eq('author_id', currentUserId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setComments((prev) => prev.map((comment) => (comment.id === editingCommentId ? { ...comment, body } : comment)));
      setEditingCommentId(null);
      setEditingBody('');
    }

    setSavingEdit(false);
  };

  const handleDeleteComment = async (commentId) => {
    if (!commentId || !currentUserId) {
      return;
    }

    setDeletingCommentId(commentId);
    setError('');

    const { error: deleteError } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', currentUserId);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingBody('');
      }
    }

    setDeletingCommentId(null);
  };

  const loadComments = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('task_comments')
      .select('id,task_id,author_id,body,mentions,created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setComments([]);
    } else {
      setComments(data ?? []);
    }

    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    // Suscripción en tiempo real a los cambios de comentarios de esta tarea.
    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setComments((prev) => {
              const exists = prev.some((comment) => comment.id === payload.new.id);
              return exists ? prev : [...prev, payload.new];
            });
          } else if (payload.eventType === 'DELETE') {
            setComments((prev) => prev.filter((comment) => comment.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setComments((prev) => prev.map((comment) => (comment.id === payload.new.id ? payload.new : comment)));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [taskId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const body = newComment.trim();
    if (!body || !taskId || !currentUserId) {
      return;
    }

    setSubmitting(true);
    setError('');

    const uniqueMentions = [...new Set(mentionedUsers)];

    const { data: insertedComments, error: insertError } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: currentUserId,
        body,
        mentions: uniqueMentions
      })
      .select('id,task_id,author_id,body,mentions,created_at');

    if (insertError) {
      if (insertError.message?.toLowerCase().includes('row-level security')) {
        setError('No tienes permisos para comentar en esta tarea.');
      } else {
        setError(insertError.message);
      }
    } else {
      const inserted = Array.isArray(insertedComments)
        ? insertedComments
        : insertedComments
        ? [insertedComments]
        : [];

      if (inserted.length > 0) {
        setComments((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const toAdd = inserted.filter((c) => !existingIds.has(c.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      if (uniqueMentions.length > 0) {
        try {
          await sendMentionNotifications(body, uniqueMentions);
        } catch (notifyError) {
          console.warn('No se pudieron enviar notificaciones de mención:', notifyError);
        }
      }
      setNewComment('');
      setMentionedUsers([]);
    }

    setSubmitting(false);
  };

  return (
    <Card className="bg-slate-950/50">
      <div className="space-y-3">
        <header className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">Comentarios</h4>
            <p className="text-xs text-slate-500">Participa en la conversación de "{taskTitle}".</p>
          </div>
          {loading ? <Spinner size="sm" /> : null}
        </header>

        {error ? (
          <Alert color="failure" onDismiss={() => setError('')}>
            {error}
          </Alert>
        ) : null}

        {comments.length === 0 ? (
          <p className="text-xs text-slate-500">Aún no hay comentarios.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-sm">
            {comments.map((comment) => {
              const author = membersById[comment.author_id];
              const createdAt = comment.created_at ? new Date(comment.created_at) : null;
              const mentionList = Array.isArray(comment.mentions) ? comment.mentions : [];
              const isAuthor = currentUserId && comment.author_id === currentUserId;

              return (
                <div key={comment.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-100">{author?.member_email ?? comment.author_id}</span>
                    {createdAt ? <span>{createdAt.toLocaleString()}</span> : null}
                    {isAuthor ? (
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          className="text-[11px] text-slate-500 hover:text-slate-200 hover:underline underline-offset-2"
                          onClick={() => startEditComment(comment)}
                          disabled={savingEdit || deletingCommentId === comment.id}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-[11px] text-rose-400 hover:text-rose-200 hover:underline underline-offset-2"
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={savingEdit || deletingCommentId === comment.id}
                        >
                          Borrar
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editingBody}
                        onChange={(event) => setEditingBody(event.target.value)}
                        rows={3}
                        maxLength={500}
                        disabled={savingEdit}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Button
                          size="xs"
                          color="info"
                          onClick={handleSaveCommentEdit}
                          disabled={savingEdit || !editingBody.trim()}
                        >
                          {savingEdit ? 'Guardando…' : 'Guardar'}
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          onClick={cancelEditComment}
                          disabled={savingEdit}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap break-words text-slate-100">{comment.body}</p>
                  )}
                  {mentionList.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {mentionList.map((mentionId) => {
                        const mentionUser = membersById[mentionId];
                        return (
                          <Badge key={`${comment.id}-${mentionId}`} color="info" size="xs">
                            @{mentionUser?.member_email ?? mentionId}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {!canComment ? (
          <Alert color="warning">{permissionMessage}</Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={newComment}
            onChange={(event) => {
              setNewComment(event.target.value);
              handleMentionDetection(event.target.value, event.target.selectionStart ?? 0);
            }}
            onSelect={(event) => handleMentionDetection(event.target.value, event.target.selectionStart ?? 0)}
            onKeyUp={(event) => handleMentionDetection(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)}
            placeholder="Escribe un comentario..."
            rows={3}
            disabled={submitting || !canComment}
            maxLength={500}
          />
          {showMentionDropdown && mentionSuggestions.length > 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-sm">
              <p className="mb-1 text-xs text-slate-500">Menciona a:</p>
              <div className="flex flex-col gap-1">
                {mentionSuggestions.map((member) => (
                  <button
                    key={member.member_id}
                    type="button"
                    className="rounded-lg px-2 py-1 text-left text-white hover:bg-slate-800"
                    onClick={() => insertMentionAtCursor(member)}
                  >
                    @{member.member_email ?? member.member_id}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {mentionedUsers.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {mentionedUsers.map((mentionedId) => {
                const user = membersById[mentionedId];
                return (
                  <Badge
                    key={mentionedId}
                    color="info"
                    size="sm"
                    onClick={() => removeMention(mentionedId)}
                    className="cursor-pointer"
                  >
                    @{user?.member_email ?? mentionedId} ×
                  </Badge>
                );
              })}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" color="info" disabled={submitting || !currentUserId || !taskId || !canComment}>
              {submitting ? 'Publicando...' : 'Publicar'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

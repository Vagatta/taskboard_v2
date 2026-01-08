import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner, Textarea } from 'flowbite-react';
import { supabase } from '../supabaseClient';
import VoiceRecorder from './VoiceRecorder';

// Comentarios de una tarea: lista, creación rápida, menciones y algo de control de permisos.
export default function TaskComments({ taskId, taskTitle, currentUserId, members = [], workspaceId = null, projectId = null, isOwner = false, ownerLabel = 'Dueño del Proyecto', projectName = null }) {
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
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);

  const [file, setFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [transcribingAudio, setTranscribingAudio] = useState(false);
  const fileInputRef = useRef(null);

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
  const canComment = Boolean(isOwner || (currentMember && allowedRoles.includes(currentMember.role)));
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
          project_name: projectName,
          task_id: taskId,
          task_title: taskTitle,
          mentioned_by: currentUserId,
          comment_excerpt: body.slice(0, 140)
        }
      }));

      await supabase.from('notifications').insert(payload);
    },
    [currentUserId, projectId, projectName, taskId, taskTitle, workspaceId]
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
      .select('id,task_id,author_id,body,mentions,created_at,file_url,file_type,file_name')
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

  useEffect(() => {
    if (!taskId || !currentUserId) {
      return undefined;
    }

    const channel = supabase.channel(`task-typing-${taskId}`, {
      config: { presence: { key: currentUserId } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing = [];
        Object.entries(state).forEach(([uId, sessions]) => {
          if (uId === currentUserId) return;
          const session = sessions[0];
          if (session?.is_typing) {
            typing.push(uId);
          }
        });
        setTypingUsers(typing);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [taskId, currentUserId]);

  const setPresenceTyping = useCallback(
    async (isTyping) => {
      const channel = supabase.getChannels().find((c) => c.topic === `task-typing-${taskId}`);
      if (channel) {
        await channel.track({
          user_id: currentUserId,
          is_typing: isTyping,
          updated_at: new Date().toISOString()
        });
      }
    },
    [currentUserId, taskId]
  );

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyzeImage = async () => {
    if (!file || !file.type.startsWith('image/')) return;

    setAnalyzingImage(true);
    setError('');

    try {
      const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
      if (!API_KEY) throw new Error('Falta la API Key de Gemini');

      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
      const base64Content = await fileToBase64(file);

      const prompt = `Analiza esta imagen adjunta a una tarea de gestión de proyectos. 
      Título de la tarea: "${taskTitle}"
      Si la imagen muestra un error técnico o de diseño, identifícalo y sugiere una solución paso a paso. 
      Si es una referencia visual, descríbela para el equipo. 
      Responde de forma profesional, en español y con formato Markdown (negritas, listas, etc.).`;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: file.type,
                    data: base64Content.split(',')[1]
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) throw new Error('Error al conectar con la IA de visión.');

      const data = await response.json();
      const analysis = data.candidates[0].content.parts[0].text;

      // Insertamos el análisis en el comentario
      setNewComment((prev) => (prev ? `${prev}\n\n--- ANÁLISIS IA ---\n${analysis}` : `--- ANÁLISIS IA ---\n${analysis}`));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al analizar la imagen.');
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleVoiceNote = async (audioFile) => {
    setFile(audioFile);
    setTranscribingAudio(true);
    setError('');

    try {
      const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
      if (!API_KEY) throw new Error('Falta la API Key de Gemini');

      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
      const base64Content = await fileToBase64(audioFile);

      const prompt = "Actúa como un transcriptor experto. Transcribe el siguiente audio de voz de forma literal y precisa. No añadas introducciones, solo devuelve el texto del audio.";

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'audio/webm',
                    data: base64Content.split(',')[1]
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) throw new Error('Error al transcribir el audio.');

      const data = await response.json();
      const transcription = data.candidates[0].content.parts[0].text;

      setNewComment((prev) => (prev ? `${prev}\n\n(Voz): ${transcription}` : `(Voz): ${transcription}`));
    } catch (err) {
      console.error(err);
      // No bloqueamos el envío del audio si falla la transcripción, pero avisamos.
      console.warn('Fallo en la transcripción automática.');
    } finally {
      setTranscribingAudio(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const body = newComment.trim();
    if ((!body && !file) || !taskId || !currentUserId) {
      return;
    }

    setSubmitting(true);
    setError('');

    let fileUrl = null;
    let fileType = null;
    let fileName = null;

    if (file) {
      setUploadingFile(true);
      try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${taskId}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        fileUrl = publicUrlData.publicUrl;
        fileType = file.type;
        fileName = file.name;
      } catch (err) {
        setError(`Error al subir archivo: ${err.message}`);
        setSubmitting(false);
        setUploadingFile(false);
        return;
      } finally {
        setUploadingFile(false);
      }
    }

    const uniqueMentions = [...new Set(mentionedUsers)];

    const { data: insertedComments, error: insertError } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: currentUserId,
        body,
        mentions: uniqueMentions,
        file_url: fileUrl,
        file_type: fileType,
        file_name: fileName
      })
      .select('id,task_id,author_id,body,mentions,created_at,file_url,file_type,file_name');

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
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    setSubmitting(false);
  };

  return (
    <Card className="bg-white dark:bg-slate-950/50 shadow-none">
      <div className="space-y-3">
        <header className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Comentarios</h4>
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
                <div key={comment.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 p-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 min-w-0">
                    <span className="font-semibold text-slate-100 break-all sm:truncate max-w-full">
                      {author?.member_email ?? (comment.author_id === currentUserId ? ownerLabel : 'Colaborador')}
                    </span>
                    {createdAt ? <span className="flex-shrink-0">{createdAt.toLocaleString()}</span> : null}
                    {isAuthor ? (
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:underline underline-offset-2"
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
                  {comment.file_url && (
                    <div className="mt-3">
                      {comment.file_type?.startsWith('image/') ? (
                        <a href={comment.file_url} target="_blank" rel="noopener noreferrer" className="inline-block group relative">
                          <img
                            src={comment.file_url}
                            alt={comment.file_name}
                            className="max-h-48 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-transform group-hover:scale-[1.02]"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                            <span className="text-white text-[10px] font-bold">Ver original</span>
                          </div>
                        </a>
                      ) : (comment.file_type?.startsWith('audio/') || comment.file_name?.endsWith('.webm') || comment.file_name?.endsWith('.mp3') || comment.file_name?.endsWith('.wav')) ? (
                        <div className="mt-2 flex flex-col gap-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                              <span>Nota de voz</span>
                            </div>
                            <a href={comment.file_url} download={comment.file_name} className="text-[10px] text-cyan-600 hover:underline">Descargar</a>
                          </div>
                          <audio controls src={comment.file_url} className="w-full h-10 brightness-90 dark:invert" />
                        </div>
                      ) : (
                        <a
                          href={comment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                        >
                          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                            {comment.file_name || 'Archivo adjunto'}
                          </span>
                        </a>
                      )}
                    </div>
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

              setPresenceTyping(true);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => {
                setPresenceTyping(false);
              }, 3000);
            }}
            onSelect={(event) => handleMentionDetection(event.target.value, event.target.selectionStart ?? 0)}
            onKeyUp={(event) => handleMentionDetection(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)}
            placeholder="Escribe un comentario..."
            rows={3}
            disabled={submitting || !canComment}
            maxLength={500}
          />
          {showMentionDropdown && mentionSuggestions.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900/80 p-2 text-sm">
              <p className="mb-1 text-xs text-slate-500">Menciona a:</p>
              <div className="flex flex-col gap-1">
                {mentionSuggestions.map((member) => (
                  <button
                    key={member.member_id}
                    type="button"
                    className="rounded-lg px-2 py-1 text-left text-slate-900 dark:text-white hover:bg-slate-800"
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
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0])}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting || !canComment}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span>{file ? 'Cambiar archivo' : 'Adjuntar'}</span>
              </button>
              <VoiceRecorder
                onRecordingComplete={handleVoiceNote}
                disabled={submitting || analyzingImage || transcribingAudio || !canComment}
              />
              {(analyzingImage || transcribingAudio) && (
                <div className="flex items-center gap-2 overflow-hidden">
                  <Spinner size="xs" color="purple" />
                  <span className="text-[10px] font-medium text-purple-600 animate-pulse truncate">
                    {analyzingImage ? 'Analizando imagen...' : 'Transcribiendo audio...'}
                  </span>
                </div>
              )}
              {file && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-100 dark:bg-cyan-900/30 text-[10px] text-cyan-700 dark:text-cyan-300 max-w-[150px]">
                    <span className="truncate">{file.name}</span>
                    <button type="button" onClick={() => setFile(null)} className="hover:text-cyan-900 dark:hover:text-cyan-100">
                      ×
                    </button>
                  </div>
                  {file.type.startsWith('image/') && (
                    <button
                      type="button"
                      onClick={handleAnalyzeImage}
                      disabled={analyzingImage || submitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/40 text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all shadow-sm hover:shadow-purple-500/20"
                    >
                      {analyzingImage ? (
                        <Spinner size="xs" color="purple" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                      <span>{analyzingImage ? 'Analizando...' : 'Analizar con IA'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <Button type="submit" color="info" disabled={submitting || !currentUserId || !taskId || !canComment}>
              {submitting ? (uploadingFile ? 'Subiendo...' : 'Publicando...') : 'Publicar'}
            </Button>
          </div>
        </form>

        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-emerald-500 animate-pulse">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>
              {typingUsers.length === 1
                ? `${membersById[typingUsers[0]]?.member_email ?? 'Alguien'} está escribiendo...`
                : `${typingUsers.length} personas están escribiendo...`}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}







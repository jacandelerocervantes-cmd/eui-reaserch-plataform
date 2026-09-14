'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Send, Eye, EyeOff, Loader2, Lock, ShieldCheck, X } from 'lucide-react';

export interface CommentItem {
  id: string;
  announcement_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  created_at: string;
  hidden_at: string | null;
  hidden_by: string | null;
}

interface AnnouncementCommentsProps {
  announcementId: string;
  isTeacher: boolean;
  allowComments: boolean;
  courseId?: string;
}

export default function AnnouncementComments({
  announcementId,
  isTeacher,
  allowComments,
}: AnnouncementCommentsProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await supabase.functions.invoke('sync-tablon', {
        body: {
          action: 'listComments',
          payload: { announcement_id: announcementId },
        },
      });

      if (error || !data?.success) {
        console.warn('[COMMENTS_FETCH_WARN]', error || data?.error);
        return;
      }

      setComments(data.data ?? []);
    } catch (err) {
      console.warn('[COMMENTS_FETCH_ERROR]', err);
    } finally {
      setLoading(false);
    }
  }, [announcementId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newContent.trim();
    if (!content || submitting || !allowComments) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const { data, error } = await supabase.functions.invoke('sync-tablon', {
        body: {
          action: 'postComment',
          payload: { announcement_id: announcementId, content },
        },
      });

      if (error || !data?.success) {
        setErrorMsg(data?.error || error?.message || 'No se pudo publicar el comentario.');
        return;
      }

      if (data.data) {
        setComments((prev) => [...prev, data.data]);
        setNewContent('');
        if (!isOpen) setIsOpen(true);
      }
    } catch {
      setErrorMsg('Error al enviar el comentario.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleHide = async (comment: CommentItem) => {
    if (!isTeacher || togglingId) return;

    const isCurrentlyHidden = Boolean(comment.hidden_at);
    const targetAction = isCurrentlyHidden ? 'unhideComment' : 'hideComment';

    try {
      setTogglingId(comment.id);
      const { data, error } = await supabase.functions.invoke('sync-tablon', {
        body: {
          action: targetAction,
          payload: { comment_id: comment.id },
        },
      });

      if (error || !data?.success) {
        setFeedback({
          type: 'error',
          message: data?.error || error?.message || 'No se pudo actualizar el comentario.',
        });
        return;
      }

      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? {
                ...c,
                hidden_at: isCurrentlyHidden ? null : new Date().toISOString(),
              }
            : c
        )
      );

      setFeedback({
        type: 'success',
        message: isCurrentlyHidden
          ? 'Comentario restaurado: visible para alumnos.'
          : 'Comentario ocultado para alumnos.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Error de conexión al moderar comentario.',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const visibleCommentsCount = isTeacher
    ? comments.length
    : comments.filter((c) => !c.hidden_at).length;

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
      {/* Toast banner flotante de feedback */}
      {feedback && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 1000, maxWidth: "420px",
          backgroundColor: feedback.type === "success" ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          color: feedback.type === "success" ? "#166534" : "#991b1b",
          padding: "14px 18px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
        }}>
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", lineHeight: 0, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Barra de cabecera / Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: visibleCommentsCount > 0 ? '#1B396A' : '#64748b',
          }}
        >
          <MessageSquare size={15} />
          <span>
            {visibleCommentsCount === 0
              ? 'Comentarios'
              : `${visibleCommentsCount} ${visibleCommentsCount === 1 ? 'comentario' : 'comentarios'}`}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '4px' }}>
            {isOpen ? '▲ Ocultar' : '▼ Ver'}
          </span>
        </button>

        {!allowComments && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#94a3b8',
              backgroundColor: '#f8fafc',
              padding: '2px 8px',
              borderRadius: '6px',
            }}
          >
            <Lock size={12} /> Comentarios cerrados
          </span>
        )}
      </div>

      {/* Contenido expandible */}
      {isOpen && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', color: '#64748b', fontSize: '0.8rem' }}>
              <Loader2 size={16} className="animate-spin" /> Cargando comentarios...
            </div>
          ) : comments.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
              No hay comentarios en este aviso todavía.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {comments.map((comment) => {
                const isHidden = Boolean(comment.hidden_at);
                const isAuthorTeacher = comment.author_role === 'docente' || comment.author_role === 'admin';

                // Si por alguna razón un alumno recibe un comentario oculto, no lo renderiza
                if (!isTeacher && isHidden) return null;

                return (
                  <div
                    key={comment.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: isHidden ? '#f8fafc' : '#f1f5f9',
                      border: isHidden ? '1px dashed #cbd5e1' : '1px solid transparent',
                      opacity: isHidden ? 0.75 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>
                          {comment.author_name}
                        </span>

                        {isAuthorTeacher && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <ShieldCheck size={11} /> Docente
                          </span>
                        )}

                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          {new Date(comment.created_at).toLocaleDateString('es-MX', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {isHidden && isTeacher && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            Oculto para alumnos
                          </span>
                        )}
                      </div>

                      {/* Botón de moderación solo para docente */}
                      {isTeacher && (
                        <button
                          type="button"
                          onClick={() => handleToggleHide(comment)}
                          disabled={togglingId === comment.id}
                          title={isHidden ? 'Hacer visible a los alumnos' : 'Ocultar comentario'}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: togglingId === comment.id ? 'not-allowed' : 'pointer',
                            color: isHidden ? '#2563eb' : '#64748b',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {togglingId === comment.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isHidden ? (
                            <>
                              <Eye size={13} /> Mostrar
                            </>
                          ) : (
                            <>
                              <EyeOff size={13} /> Ocultar
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                      {comment.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulario para comentar */}
          {allowComments ? (
            <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Escribe un comentario..."
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                }}
              />
              <button
                type="submit"
                disabled={submitting || !newContent.trim()}
                style={{
                  backgroundColor: '#1B396A',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0 14px',
                  cursor: submitting || !newContent.trim() ? 'not-allowed' : 'pointer',
                  opacity: submitting || !newContent.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  transition: 'background-color 0.2s',
                }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Enviar
              </button>
            </form>
          ) : (
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
              El docente deshabilitó los comentarios para este anuncio.
            </p>
          )}

          {errorMsg && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
              {errorMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Megaphone, Clock, Loader2, Send, FileText, GraduationCap, ArrowRight, RotateCcw, X } from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";
import AnnouncementComments from "@/components/tablon/AnnouncementComments";
import styles from './tablon.module.css';
import { useTablon } from './_hooks/useTablon';

const EXAM_STATUS_LABEL: Record<string, string> = { draft: 'Borrador', published: 'Publicado', closed: 'Cerrado' };

function TablonContent({ courseId, reloadKey, onReload }: { courseId: string; reloadKey: number; onReload: () => void }) {
  const router = useRouter();
  const t = useTablon({ courseId, reloadKey, onReload });

  if (t.loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className="animate-spin" size={64} color="#1B396A" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {t.feedback && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 1000, maxWidth: "420px",
          backgroundColor: t.feedback.type === "success" ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${t.feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          color: t.feedback.type === "success" ? "#166534" : "#991b1b",
          padding: "14px 18px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
        }}>
          <span>{t.feedback.message}</span>
          <button
            type="button"
            onClick={() => t.setFeedback(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", lineHeight: 0, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className={styles.heroBanner}>
        <div className={styles.bannerContent}>
          <h1>{t.materia?.title || "Cargando..."}</h1>
          <p>ID: {courseId?.toString().substring(0, 8)}</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.widget}>
            <h3>Estado de la Materia</h3>
            <ul className={styles.taskList}>
              <li><Clock size={16} color="#64748b" /> <span>{t.anuncios.length} Avisos publicados</span></li>
            </ul>
          </div>
        </aside>

        <main className={styles.feed}>
          <div className={`${styles.composeBox} ${t.showCompose ? styles.composeBoxExpanded : ''}`}>
            {!t.showCompose ? (
              <div className={styles.composeHeader}>
                <div className={styles.avatar}>{t.userInitial}</div>
                <button className={styles.composeBtn} onClick={() => t.setShowCompose(true)}>
                  Anunciar algo a la clase...
                </button>
              </div>
            ) : (
              <form onSubmit={t.handlePublish}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    className={`${styles.composeBtn} ${styles.composeInput}`}
                    placeholder="Título del aviso..."
                    value={t.newPost.titulo}
                    onChange={(e) => t.setNewPost({...t.newPost, titulo: e.target.value})}
                    required
                  />
                  <textarea
                    className={`${styles.composeBtn} ${styles.composeTextarea}`}
                    placeholder="Contenido..."
                    value={t.newPost.contenido}
                    onChange={(e) => t.setNewPost({...t.newPost, contenido: e.target.value})}
                    required
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', flexWrap: 'wrap', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155', cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={t.newPost.allow_comments}
                      onChange={(e) => t.setNewPost({ ...t.newPost, allow_comments: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#1B396A', cursor: 'pointer' }}
                    />
                    Permitir comentarios en este anuncio
                  </label>

                  <div className={styles.composeActions} style={{ margin: 0 }}>
                    <button type="button" onClick={() => t.setShowCompose(false)} className={styles.cancelBtn}>Cancelar</button>
                    <button type="submit" disabled={t.isPublishing} className={styles.submitBtn}>
                      {t.isPublishing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Publicar
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {t.feedError ? (
            <div className={styles.emptyState} style={{ color: "#ef4444" }}>
              <p style={{ fontWeight: 700 }}>{t.feedError}</p>
              <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} variant="secondary" size={40} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
            </div>
          ) : t.feedItems.length === 0 ? (
            <div className={styles.emptyState}>
              <Megaphone size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto' }} />
              <p style={{ fontWeight: 600 }}>Aún no hay actividad en esta materia.</p>
            </div>
          ) : (
            t.feedItems.map((item) => {
              const meta = item.tipo === 'actividad'
                ? { icon: <FileText size={16} />, label: 'Nueva Actividad', color: '#2563eb', bg: '#eff6ff' }
                : item.tipo === 'examen'
                  ? { icon: <GraduationCap size={16} />, label: 'Nuevo Examen', color: '#7c3aed', bg: '#f5f3ff' }
                  : null;
              const href = item.tipo === 'actividad'
                ? `/panel/materias/${courseId}/actividades/${item.id}`
                : item.tipo === 'examen'
                  ? `/panel/materias/${courseId}/evaluaciones/${item.id}`
                  : null;

              return (
                <article
                  key={`${item.tipo}-${item.id}`}
                  className={styles.postCard}
                  style={href ? { cursor: 'pointer' } : undefined}
                  onClick={href ? () => router.push(href) : undefined}
                >
                  <div className={styles.postHeader}>
                    <div className={styles.postMeta}>
                      <div className={styles.avatarSmall} style={meta ? { backgroundColor: meta.color } : undefined}>
                        {meta ? meta.icon : t.userInitial}
                      </div>
                      <div className={styles.authorMeta}>
                        <span className={styles.author}>{meta ? meta.label : t.userNameDisplay}</span>
                        <span className={styles.date}>{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {item.tipo === 'examen' && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', backgroundColor: '#f5f3ff', color: '#7c3aed', textTransform: 'uppercase' }}>
                        {EXAM_STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    )}
                  </div>
                  <div className={styles.postBody}>
                    <h4 className={styles.postTitle}>{item.title}</h4>
                    {item.tipo === 'aviso' && (
                      <div>
                        <p style={{ color: '#334155', lineHeight: 1.5, margin: 0 }}>{item.content}</p>
                        <AnnouncementComments
                          announcementId={item.id}
                          isTeacher={true}
                          allowComments={item.allow_comments ?? true}
                          courseId={courseId}
                        />
                      </div>
                    )}
                    {item.tipo === 'actividad' && (
                      <p style={{ color: '#64748b' }}>
                        {item.deadline ? `Fecha límite: ${new Date(item.deadline).toLocaleDateString('es-MX', { dateStyle: 'long' })}` : 'Sin fecha límite definida.'}
                      </p>
                    )}
                  </div>
                  {href && (
                    <div className={styles.postFooter}>
                      <span className={styles.actionBtn} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Ver detalle <ArrowRight size={14} />
                      </span>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}

export default function TablonPage() {
  const { id: courseId } = useParams() as { id: string };
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <TablonContent courseId={courseId} reloadKey={reloadKey} onReload={() => setReloadKey((k) => k + 1)} />
  );
}

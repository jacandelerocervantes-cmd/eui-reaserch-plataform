"use client";

import { useState, useMemo, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Megaphone, Clock, Loader2, Send, FileText, GraduationCap, ArrowRight, RotateCcw } from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";
import styles from './tablon.module.css';
import { fetchTablon, type FetchResult } from './_services/fetchTablon';
import { useTablon } from './_hooks/useTablon';

const EXAM_STATUS_LABEL: Record<string, string> = { draft: 'Borrador', published: 'Publicado', closed: 'Cerrado' };

function TablonContent({ resource, courseId, onReload }: { resource: Promise<FetchResult>; courseId: string; onReload: () => void }) {
  const router = useRouter();
  const t = useTablon({ resource, courseId, onReload });

  return (
    <div className={styles.container}>
      <div className={styles.heroBanner} style={{ backgroundColor: '#1B396A', position: 'relative' }}>
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

                <div className={styles.composeActions}>
                  <button type="button" onClick={() => t.setShowCompose(false)} className={styles.cancelBtn}>Cancelar</button>
                  <button type="submit" disabled={t.isPublishing} className={styles.submitBtn}>
                    {t.isPublishing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Publicar
                  </button>
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
                    {item.tipo === 'aviso' && <p>{item.content}</p>}
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
  const resource = useMemo(() => fetchTablon(courseId, reloadKey), [courseId, reloadKey]);

  return (
    <Suspense fallback={
      <div className={styles.loadingContainer}>
        <Loader2 className="animate-spin" size={64} color="#1B396A" />
      </div>
    }>
      <TablonContent resource={resource} courseId={courseId} onReload={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}

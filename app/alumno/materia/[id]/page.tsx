'use client';

import { use, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Megaphone, Clock, Loader2, FileText, GraduationCap, ArrowRight, RotateCcw } from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";
import styles from './tablon.module.css';
import { useMateriaAlumno, type FetchResult } from './_hooks/useMateriaAlumno';

const EXAM_STATUS_LABEL: Record<string, string> = { published: 'Disponible', closed: 'Cerrado' };

function TablonContent({ resource, courseId, onRetry }: { resource: Promise<FetchResult>; courseId: string; onRetry: () => void }) {
  const result = use(resource);
  const router = useRouter();

  if (result.kind === "redirect") return (
    <div className={styles.loadingContainer}>
      <Loader2 className="animate-spin" size={64} color="#1B396A" />
    </div>
  );

  if (result.kind === "error") return (
    <div className={styles.loadingContainer} style={{ flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: '#ef4444', fontWeight: 700 }}>{result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { courseName, avisos, feedItems, allowStudentComments } = result;

  return (
    <div className={styles.container}>
      <div className={styles.heroBanner}>
        <div className={styles.bannerContent}>
          <h1>{courseName}</h1>
          <p>Tablón de avisos y novedades</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.widget}>
            <h3>Estado de la Materia</h3>
            <ul className={styles.taskList}>
              <li><Clock size={16} color="#64748b" /> <span>{avisos.length} Avisos publicados</span></li>
            </ul>
          </div>

          <div className={styles.widget}>
            <h3>Interacción</h3>
            <span style={{ fontSize: '0.78rem', color: allowStudentComments ? '#10b981' : '#64748b', fontWeight: 700, display: 'block', marginTop: '4px' }}>
              {allowStudentComments ? '● Comentarios de clase habilitados' : '○ Comentarios deshabilitados'}
            </span>
          </div>
        </aside>

        <main className={styles.feed}>
          {feedItems.length === 0 ? (
            <div className={styles.emptyState}>
              <Megaphone size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto' }} />
              <p style={{ fontWeight: 600 }}>Aún no hay actividad en esta materia.</p>
            </div>
          ) : (
            feedItems.map((item) => {
              const meta = item.tipo === 'actividad'
                ? { icon: <FileText size={16} />, label: 'Nueva Actividad', color: '#2563eb' }
                : item.tipo === 'examen'
                  ? { icon: <GraduationCap size={16} />, label: 'Nuevo Examen', color: '#7c3aed' }
                  : null;
              const href = item.tipo === 'actividad'
                ? `/alumno/materia/${courseId}/actividades`
                : item.tipo === 'examen'
                  ? `/alumno/materia/${courseId}/evaluaciones`
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
                        {meta ? meta.icon : 'D'}
                      </div>
                      <div className={styles.authorMeta}>
                        <span className={styles.author}>{meta ? meta.label : 'Docente'}</span>
                        <span className={styles.date}>{new Date(item.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
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
                        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: allowStudentComments ? '#2563eb' : '#94a3b8' }}>
                            {allowStudentComments ? '💬 Comentarios de clase activos' : '🔒 Comentarios deshabilitados'}
                          </span>
                        </div>
                      </div>
                    )}
                    {item.tipo === 'actividad' && (
                      <p style={{ color: '#64748b', margin: 0 }}>
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

export default function TablonAlumno() {
  const { id: courseId } = useParams<{ id: string }>();
  const { resource, retry } = useMateriaAlumno(courseId);

  return (
    <Suspense fallback={
      <div className={styles.loadingContainer}>
        <Loader2 className="animate-spin" size={64} color="#1B396A" />
      </div>
    }>
      <TablonContent resource={resource} courseId={courseId} onRetry={retry} />
    </Suspense>
  );
}

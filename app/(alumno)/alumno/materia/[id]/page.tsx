'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Megaphone, Clock, Loader2, FileText, GraduationCap, ArrowRight, RotateCcw } from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";
import AnnouncementComments from "@/components/tablon/AnnouncementComments";
import styles from './tablon.module.css';
import { useMateriaAlumno } from './_hooks/useMateriaAlumno';
import AiTutorChat from '@/components/ia/AiTutorChat';

const EXAM_STATUS_LABEL: Record<string, string> = { published: 'Disponible', closed: 'Cerrado' };

function TablonContent({ courseId, reloadKey, onReload }: { courseId: string; reloadKey: number; onReload: () => void }) {
  const router = useRouter();
  const { loading, result } = useMateriaAlumno({ courseId, reloadKey, onReload });

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className="animate-spin" size={64} color="#1B396A" />
      </div>
    );
  }

  if (result.kind === "redirect") {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className="animate-spin" size={64} color="#1B396A" />
      </div>
    );
  }

  if (result.kind === "error") {
    return (
      <div className={styles.loadingContainer} style={{ flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: '#ef4444', fontWeight: 700 }}>{result.message}</p>
        <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
      </div>
    );
  }

  const { courseName, avisos, feedItems } = result;

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

          {/* Piloto ai-tutor-sandbox, modo "general": dudas de la materia
              no atadas a una entrega/examen puntual. */}
          <div className={styles.widget}>
            <h3>Tutor de IA</h3>
            <div style={{ marginTop: '8px' }}>
              <AiTutorChat courseId={courseId} contextType="general" title="Dudas de la materia" />
            </div>
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
                        <AnnouncementComments
                          announcementId={item.id}
                          isTeacher={false}
                          allowComments={item.allow_comments ?? true}
                          courseId={courseId}
                        />
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
  const [reloadKey, setReloadKey] = useState(0);

  // Revalidación al volver a la pestaña para ver avisos nuevos sin recargar a mano
  useEffect(() => {
    let lastReload = Date.now();
    const handleRevalidation = () => {
      if (document.visibilityState === "visible" && Date.now() - lastReload > 3000) {
        lastReload = Date.now();
        setReloadKey((k) => k + 1);
      }
    };

    window.addEventListener("focus", handleRevalidation);
    document.addEventListener("visibilitychange", handleRevalidation);
    return () => {
      window.removeEventListener("focus", handleRevalidation);
      document.removeEventListener("visibilitychange", handleRevalidation);
    };
  }, []);

  return (
    <TablonContent courseId={courseId} reloadKey={reloadKey} onReload={() => setReloadKey((k) => k + 1)} />
  );
}

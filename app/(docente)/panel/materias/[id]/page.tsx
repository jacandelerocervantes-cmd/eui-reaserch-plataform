"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Megaphone, Clock, Loader2, Send } from 'lucide-react';
import styles from './tablon.module.css';
import { supabase } from "@/lib/supabase";

interface Aviso {
  id: string;
  titulo: string;
  content: string;
  created_at: string;
  author_id: string;
}

export default function TablonPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [materia, setMateria] = useState<any>(null);
  const [anuncios, setAnuncios] = useState<Aviso[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [newPost, setNewPost] = useState({ titulo: '', contenido: '' });
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => {
    if (id) fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setUserProfile(session.user);

    await Promise.all([fetchMateriaData(), fetchAnuncios()]);
    setLoading(false);
  };

  const fetchMateriaData = async () => {
    const { data, error } = await supabase
      .from("courses") // TABLA REAL
      .select("*")
      .eq("id", id)
      .single();

    if (!error) setMateria(data);
  };

  const fetchAnuncios = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-tablon', {
        method: 'POST',
        body: { action: 'fetchPosts', payload: { course_id: id } } // ENVIAMOS course_id
      });
      
      if (!error && data?.success) {
        setAnuncios(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.titulo || !newPost.contenido || !userProfile) return;

    try {
      setIsPublishing(true);
      
      const { data, error } = await supabase.functions.invoke('sync-tablon', {
        method: 'POST',
        body: { 
          action: 'publishPost', 
          payload: { 
            course_id: id, 
            titulo: newPost.titulo, 
            contenido: newPost.contenido,
            autor_id: userProfile.id 
          } 
        }
      });

      if (error || !data?.success) {
        alert("Error al publicar: " + (error?.message || data?.error));
        return;
      }

      setAnuncios([data.data, ...anuncios]);
      setNewPost({ titulo: '', contenido: '' });
      setShowCompose(false);
    } catch (err) {
      alert("Error crítico al publicar.");
    } finally {
      setIsPublishing(false);
    }
  };

  const userNameDisplay = userProfile?.user_metadata?.full_name || userProfile?.email?.split('@')[0] || 'Docente';
  const userInitial = userNameDisplay.charAt(0).toUpperCase();

  if (loading) return (
    <div className={styles.loadingContainer}>
      <Loader2 className="animate-spin" size={64} color="#1B396A" />
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.heroBanner} style={{ backgroundColor: '#1B396A', position: 'relative' }}>
        <div className={styles.bannerContent}>
          <h1>{materia?.title || "Cargando..."}</h1>
          <p>ID: {id?.toString().substring(0, 8)}</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.widget}>
            <h3>Estado de la Materia</h3>
            <ul className={styles.taskList}>
              <li><Clock size={16} color="#64748b" /> <span>{anuncios.length} Avisos publicados</span></li>
            </ul>
          </div>
        </aside>

        <main className={styles.feed}>
          <div className={`${styles.composeBox} ${showCompose ? styles.composeBoxExpanded : ''}`}>
            {!showCompose ? (
              <div className={styles.composeHeader}>
                <div className={styles.avatar}>{userInitial}</div>
                <button className={styles.composeBtn} onClick={() => setShowCompose(true)}>
                  Anunciar algo a la clase...
                </button>
              </div>
            ) : (
              <form onSubmit={handlePublish}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input 
                    className={`${styles.composeBtn} ${styles.composeInput}`} 
                    placeholder="Título del aviso..."
                    value={newPost.titulo}
                    onChange={(e) => setNewPost({...newPost, titulo: e.target.value})}
                    required
                  />
                  <textarea 
                    className={`${styles.composeBtn} ${styles.composeTextarea}`} 
                    placeholder="Contenido..."
                    value={newPost.contenido}
                    onChange={(e) => setNewPost({...newPost, contenido: e.target.value})}
                    required
                  />
                </div>
                
                <div className={styles.composeActions}>
                  <button type="button" onClick={() => setShowCompose(false)} className={styles.cancelBtn}>Cancelar</button>
                  <button type="submit" disabled={isPublishing} className={styles.submitBtn}>
                    {isPublishing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Publicar
                  </button>
                </div>
              </form>
            )}
          </div>

          {anuncios.length === 0 ? (
            <div className={styles.emptyState}>
              <Megaphone size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto' }} />
              <p style={{ fontWeight: 600 }}>Aún no hay anuncios.</p>
            </div>
          ) : (
            anuncios.map((anuncio) => (
              <article key={anuncio.id} className={styles.postCard}>
                <div className={styles.postHeader}>
                  <div className={styles.postMeta}>
                    <div className={styles.avatarSmall}>{userInitial}</div>
                    <div className={styles.authorMeta}>
                      <span className={styles.author}>{userNameDisplay}</span>
                      <span className={styles.date}>{new Date(anuncio.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.postBody}>
                  <h4 className={styles.postTitle}>{anuncio.titulo}</h4>
                  <p>{anuncio.content}</p>
                </div>
              </article>
            ))
          )}
        </main>
      </div>
    </div>
  );
}
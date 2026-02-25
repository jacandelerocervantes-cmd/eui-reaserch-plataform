"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Megaphone, MoreVertical, Clock, MessageSquare, Loader2, Send } from 'lucide-react';
import styles from './tablon.module.css';
import { supabase } from "@/lib/supabase";

// Interfaz para tipar los avisos
interface Aviso {
  id: string;
  titulo: string;
  contenido: string;
  creado_en: string;
  autor_id: string;
}

export default function TablonPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [materia, setMateria] = useState<any>(null);
  const [anuncios, setAnuncios] = useState<Aviso[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Estado para el nuevo aviso
  const [newPost, setNewPost] = useState({ titulo: '', contenido: '' });
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => {
    if (id) {
      fetchMateriaData();
      fetchAnuncios();
    }
  }, [id]);

  // 1. Obtener información básica de la materia
  const fetchMateriaData = async () => {
    const { data, error } = await supabase
      .from("materias")
      .select("*")
      .eq("id", id)
      .single();

    if (!error) setMateria(data);
  };

  // 2. Obtener anuncios mediante la Edge Function
  const fetchAnuncios = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-tablon', {
        body: { action: 'fetchPosts', payload: { materia_id: id } }
      });
      if (data?.success) setAnuncios(data.data);
    } catch (err) {
      console.error("Error cargando anuncios:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Publicar nuevo aviso
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.titulo || !newPost.contenido) return;

    try {
      setIsPublishing(true);
      const { data, error } = await supabase.functions.invoke('sync-tablon', {
        body: { 
          action: 'publishPost', 
          payload: { 
            materia_id: id, 
            titulo: newPost.titulo, 
            contenido: newPost.contenido 
          } 
        }
      });

      if (data?.success) {
        setAnuncios([data.data, ...anuncios]);
        setNewPost({ titulo: '', contenido: '' });
        setShowCompose(false);
        alert("Aviso publicado y notificado por correo.");
      }
    } catch (err) {
      alert("Error al publicar aviso.");
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}>
      <Loader2 className="animate-spin" size={48} color="#1B396A" />
    </div>
  );

  return (
    <div className={styles.container}>
      {/* Banner Dinámico */}
      <div className={styles.heroBanner} style={{ backgroundColor: materia?.color_hex || '#1B396A' }}>
        <div className={styles.bannerContent}>
          <h1>{materia?.nombre || "Cargando materia..."}</h1>
          <p>Semestre: {materia?.semestre || "N/A"} | ID: {id?.toString().substring(0, 8)}</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.widget}>
            <h3>Estado de la Materia</h3>
            <ul className={styles.taskList}>
              <li><Clock size={14} /> <span>{anuncios.length} Avisos publicados</span></li>
              {materia?.google_sheet_id && <li><div style={{width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981'}}/> <span>Sincronizado con Drive</span></li>}
            </ul>
          </div>
        </aside>

        <main className={styles.feed}>
          {/* Caja de Composición */}
          <div className={styles.composeBox} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {!showCompose ? (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className={styles.avatar}>J</div>
                <button className={styles.composeBtn} onClick={() => setShowCompose(true)}>
                  Anunciar algo a la clase...
                </button>
              </div>
            ) : (
              <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input 
                  className={styles.composeBtn} 
                  style={{ cursor: 'text', fontWeight: 'bold' }}
                  placeholder="Título del aviso..."
                  value={newPost.titulo}
                  onChange={(e) => setNewPost({...newPost, titulo: e.target.value})}
                  required
                />
                <textarea 
                  className={styles.composeBtn} 
                  style={{ cursor: 'text', minHeight: '100px', borderRadius: '12px' }}
                  placeholder="Escribe el contenido del mensaje aquí..."
                  value={newPost.contenido}
                  onChange={(e) => setNewPost({...newPost, contenido: e.target.value})}
                  required
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
                  <button 
                    type="submit" 
                    disabled={isPublishing}
                    style={{ backgroundColor: '#1B396A', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Publicar Aviso
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Listado de Anuncios Reales */}
          {anuncios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Aún no hay anuncios en esta materia.</div>
          ) : (
            anuncios.map((anuncio) => (
              <article key={anuncio.id} className={styles.postCard}>
                <div className={styles.postHeader}>
                  <div className={styles.postMeta}>
                    <div className={styles.avatarSmall}>J</div>
                    <div>
                      <span className={styles.author}>Prof. Juan Antonio</span>
                      <span className={styles.date}>{new Date(anuncio.creado_en).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button className={styles.menuBtn}><MoreVertical size={18} /></button>
                </div>
                <div className={styles.postBody}>
                  <h4>{anuncio.titulo}</h4>
                  <p>{anuncio.contenido}</p>
                </div>
                <div className={styles.postFooter}>
                  <button className={styles.actionBtn}>
                    <MessageSquare size={16} /> Comentarios de clase
                  </button>
                </div>
              </article>
            ))
          )}
        </main>
      </div>
    </div>
  );
}
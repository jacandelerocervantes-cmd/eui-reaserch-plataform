import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchTablon, type FetchResult } from "../_services/fetchTablon";

type UseTablonArgs = {
  courseId: string;
  reloadKey: number;
  onReload: () => void;
};

const EMPTY_RESULT: FetchResult = { materia: null, anuncios: [], feedItems: [], feedError: null, userProfile: null };

export function useTablon({ courseId, reloadKey, onReload }: UseTablonArgs) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FetchResult>(EMPTY_RESULT);

  const [isPublishing, setIsPublishing] = useState(false);
  const [newPost, setNewPost] = useState({ titulo: '', contenido: '', allow_comments: true });
  const [showCompose, setShowCompose] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { materia, anuncios, feedItems, feedError, userProfile } = result;

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchTablon(courseId, reloadKey).then((r) => {
      if (!isMounted) return;
      setResult(r);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [courseId, reloadKey]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.titulo.trim() || !newPost.contenido.trim() || !userProfile) return;

    try {
      setIsPublishing(true);

      const { data, error } = await supabase.functions.invoke('sync-tablon', {
        method: 'POST',
        body: {
          action: 'publishPost',
          payload: {
            course_id: courseId,
            titulo: newPost.titulo.trim(),
            contenido: newPost.contenido.trim(),
            allow_comments: newPost.allow_comments,
          }
        }
      });

      if (error || !data?.success) {
        setFeedback({
          type: 'error',
          message: 'Error al publicar: ' + (error?.message || data?.error || 'No se pudo guardar el aviso.'),
        });
        return;
      }

      setNewPost({ titulo: '', contenido: '', allow_comments: true });
      setShowCompose(false);
      setFeedback({
        type: 'success',
        message: 'Aviso publicado correctamente.',
      });
      onReload();
    } catch {
      setFeedback({
        type: 'error',
        message: 'Error crítico al publicar el aviso.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const userNameDisplay = userProfile?.user_metadata?.full_name || userProfile?.email?.split('@')[0] || 'Docente';
  const userInitial = userNameDisplay.charAt(0).toUpperCase();

  return {
    loading,
    materia, anuncios, feedItems, feedError,
    isPublishing, newPost, setNewPost,
    showCompose, setShowCompose,
    handlePublish,
    userNameDisplay, userInitial,
    feedback, setFeedback,
  };
}

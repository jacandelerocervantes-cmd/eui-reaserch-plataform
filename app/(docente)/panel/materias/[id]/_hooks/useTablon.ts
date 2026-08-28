import { use, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FetchResult } from "../_services/fetchTablon";

type UseTablonArgs = {
  resource: Promise<FetchResult>;
  courseId: string;
  onReload: () => void;
};

export function useTablon({ resource, courseId, onReload }: UseTablonArgs) {
  const result = use(resource);

  const [isPublishing, setIsPublishing] = useState(false);
  const [newPost, setNewPost] = useState({ titulo: '', contenido: '' });
  const [showCompose, setShowCompose] = useState(false);

  const { materia, anuncios, feedItems, feedError, userProfile } = result;

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
            course_id: courseId,
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

      setNewPost({ titulo: '', contenido: '' });
      setShowCompose(false);
      onReload();
    } catch {
      alert("Error crítico al publicar.");
    } finally {
      setIsPublishing(false);
    }
  };

  const userNameDisplay = userProfile?.user_metadata?.full_name || userProfile?.email?.split('@')[0] || 'Docente';
  const userInitial = userNameDisplay.charAt(0).toUpperCase();

  return {
    materia, anuncios, feedItems, feedError,
    isPublishing, newPost, setNewPost,
    showCompose, setShowCompose,
    handlePublish,
    userNameDisplay, userInitial,
  };
}

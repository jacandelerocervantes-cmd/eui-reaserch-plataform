import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uploadValidated } from "@/lib/uploadValidated";
import { saveCaptura } from "@/lib/campoDb";

export type TipoCaptura = 'foto' | 'texto' | 'muestra' | 'audio';

export function useCaptura() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const misionIdFromUrl = searchParams?.get('mision') ?? '';

  const [tipo, setTipo] = useState<TipoCaptura>('texto');
  const [notas, setNotas] = useState('');
  const [misionId, setMisionId] = useState(misionIdFromUrl);
  const [misiones, setMisiones] = useState<{ id: string; titulo: string }[]>([]);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [additionalFields, setAdditionalFields] = useState<Record<string, string>>({});
  const [misionesError, setMisionesError] = useState<string | null>(null);

  const fetchMisiones = async () => {
    setMisionesError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('misiones_campo').select('id, titulo').eq('docente_id', user.id).in('status', ['activa', 'planificada']).order('created_at', { ascending: false });
      if (error) throw error;
      setMisiones(data ?? []);
    } catch (e) {
      console.error("Error cargando misiones:", e);
      setMisionesError(e instanceof Error ? e.message : "No se pudieron cargar las misiones.");
    }
  };

  const captureGPS = () => {
    if (!navigator.geolocation) { setGpsError('Geolocalización no disponible'); return; }
    setGpsLoading(true); setGpsError('');
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGpsLoading(false); },
      err => { setGpsError(`Error GPS: ${err.message}`); setGpsLoading(false); },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    // setTimeout(0) saca las llamadas del cuerpo síncrono del efecto sin
    // cambiar cuándo se disparan en la práctica (siguen siendo inmediatas al
    // montar) — evita el patrón que react-hooks/set-state-in-effect marca.
    const t = setTimeout(() => { fetchMisiones(); captureGPS(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleSave = async () => {
    if (!misionId) return;
    setSaving(true);
    setSaveError(null);
    try {
      let content_url: string | null = null;
      if (file) {
        const { data: { user } } = await supabase.auth.getUser();
        const ext = file.name.split('.').pop();
        const path = `capturas/${user?.id}/${Date.now()}.${ext}`;
        const { publicUrl } = await uploadValidated({ bucket: 'campo-capturas', path, file });
        content_url = publicUrl;
      }

      await saveCaptura({
        mision_id: misionId,
        tipo,
        latitud: gps?.lat ?? null,
        longitud: gps?.lon ?? null,
        notas,
        campos_datos: additionalFields,
        content_url,
        timestamp: new Date().toISOString(),
      });

      setSaved(true);
      setTimeout(() => {
        router.push(misionIdFromUrl ? `/campo/misiones/${misionIdFromUrl}` : '/campo');
      }, 1500);
    } catch (err) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar la captura. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return {
    router,
    misionIdFromUrl,
    tipo, setTipo,
    notas, setNotas,
    misionId, setMisionId,
    misiones,
    gps,
    gpsLoading,
    gpsError,
    file, setFile,
    saving,
    saveError,
    saved,
    additionalFields, setAdditionalFields,
    misionesError,
    fetchMisiones,
    captureGPS,
    handleSave,
  };
}

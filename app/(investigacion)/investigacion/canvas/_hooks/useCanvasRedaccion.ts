import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type Cita = { id: string; titulo: string; autores: string | null; año: number | null; journal: string | null };

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useCanvasRedaccion() {
  const mounted = useRef(false);
  const docId = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<'copiloto' | 'citas' | 'revision'>('copiloto');

  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'guardando' | 'guardado' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [revisionScore, setRevisionScore] = useState<number | null>(null);
  const [critica, setCritica] = useState<string | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);

  useEffect(() => {
    const loadDoc = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('canvas_documentos')
          .select('id, titulo_manuscrito, contenido_crudo')
          .eq('autor_id', user.id)
          .order('ultima_sincronizacion', { ascending: false })
          .limit(1)
          .single();
        if (data) {
          docId.current = data.id;
          setTitulo(data.titulo_manuscrito ?? '');
          setContenido(data.contenido_crudo ?? '');
        }
        const { data: litData } = await supabase
          .from('literatura_referencias')
          .select('id, titulo, autores, año, journal')
          .eq('usuario_id', user.id)
          .order('creado_en', { ascending: false })
          .limit(20);
        if (litData) setCitas(litData);
      } catch (e) {
        // No único error bloqueante: si falla la carga previa, el docente
        // simplemente empieza con el editor en blanco — se lo indicamos,
        // pero no le impedimos escribir uno nuevo.
        console.error("Error cargando manuscrito previo:", e);
        setLoadError("No se pudo recuperar tu último manuscrito guardado. Puedes seguir escribiendo, se creará uno nuevo al guardar.");
      } finally {
        mounted.current = true;
      }
    };
    loadDoc();
  }, []);

  const debouncedTitulo = useDebounce(titulo, 1500);
  const debouncedContenido = useDebounce(contenido, 1500);

  const autoSave = useCallback(async (t: string, c: string) => {
    if (!t && !c) return;
    setSaveStatus('guardando');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveStatus('error'); return; }
    const payload = {
      autor_id: user.id,
      titulo_manuscrito: t,
      contenido_crudo: c,
      ultima_sincronizacion: new Date().toISOString(),
    };
    const { data, error } = docId.current
      ? await supabase.from('canvas_documentos').update(payload).eq('id', docId.current).select('id').single()
      : await supabase.from('canvas_documentos').insert(payload).select('id').single();
    if (error) { setSaveStatus('error'); return; }
    if (!docId.current && data) docId.current = (data as { id: string }).id;
    setSaveStatus('guardado');
    setTimeout(() => setSaveStatus('idle'), 2500);
  }, []);

  useEffect(() => {
    if (!mounted.current) return;
    autoSave(debouncedTitulo, debouncedContenido);
  }, [debouncedTitulo, debouncedContenido, autoSave]);

  const callCopilot = async (modo: 'sugerencia' | 'revision') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Tu sesión expiró, recarga la página.");
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/canvas-copilot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ titulo, contenido, modo }),
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? `El copiloto respondió con error ${res.status}.`);
    return data;
  };

  const generarParrafo = async () => {
    setIsGenerating(true);
    setCopilotError(null);
    try {
      const data = await callCopilot('sugerencia');
      if (data?.parrafo) setContenido(prev => prev + '\n\n' + data.parrafo);
      else throw new Error("El copiloto no devolvió ningún párrafo.");
    } catch (e) {
      console.error("Error generando párrafo:", e);
      setCopilotError(e instanceof Error ? e.message : "No se pudo generar la continuación.");
    } finally { setIsGenerating(false); }
  };

  const iniciarAuditoria = async () => {
    setIsGenerating(true);
    setRevisionScore(null);
    setCritica(null);
    setCopilotError(null);
    try {
      const data = await callCopilot('revision');
      if (data?.score !== undefined) { setRevisionScore(data.score); setCritica(data.critica ?? ''); }
      else throw new Error("El copiloto no devolvió una evaluación válida.");
    } catch (e) {
      console.error("Error en auditoría del manuscrito:", e);
      setCopilotError(e instanceof Error ? e.message : "No se pudo completar la auditoría.");
    } finally { setIsGenerating(false); }
  };

  const saveLabel = saveStatus === 'guardando' ? 'Guardando...' : saveStatus === 'guardado' ? 'Guardado' : saveStatus === 'error' ? 'Error' : '';

  return {
    activeTab, setActiveTab,
    titulo, setTitulo,
    contenido, setContenido,
    saveStatus, saveLabel,
    loadError,
    isGenerating, copilotError,
    revisionScore, setRevisionScore,
    critica, setCritica,
    citas,
    autoSave,
    generarParrafo,
    iniciarAuditoria,
  };
}

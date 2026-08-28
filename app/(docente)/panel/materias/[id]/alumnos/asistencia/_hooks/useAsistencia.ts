import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useJsApiLoader } from '@react-google-maps/api';

// --- Tipos de TypeScript ---
export type Student = {
  id: string;
  matricula: string;
  nombre_completo: string;
  apellido_paterno: string;
};

export type Geocerca = { lat: number; lng: number; radius: number };
export type CurrentUnit = { id: string; unit_number: number; title: string; total_sessions: number };
export type MapCenter = { lat: number; lng: number };

export const defaultCenter: MapCenter = { lat: 21.1428, lng: -88.1474 };

export function useAsistencia(courseId: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [geocerca, setGeocerca] = useState<Geocerca | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionNumber, setSessionNumber] = useState<number>(1);
  const [sessionAlreadySaved, setSessionAlreadySaved] = useState(false);
  const [currentUnit, setCurrentUnit] = useState<CurrentUnit | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [qrHash, setQrHash] = useState<string | null>(null);
  const [qrSig, setQrSig] = useState<string | null>(null);
  const [asistencia, setAsistencia] = useState<Record<string, number>>({});
  // IDs marcados en vivo por autoescaneo QR (canal realtime) — distingue
  // 'qr_scan' de 'manual' al sellar, sin depender de leer la columna
  // `source` de vuelta desde la BD.
  const [autoMarcados, setAutoMarcados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  const [showMapModal, setShowMapModal] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [tempRadius, setTempRadius] = useState(50);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
    setSessionAlreadySaved(false);
    try {
      const { data: unitData } = await supabase
        .from("course_units")
        .select("id, unit_number, title, total_sessions")
        .eq("course_id", courseId)
        .eq("is_closed", false)
        .order("unit_number")
        .limit(1)
        .maybeSingle();
      setCurrentUnit(unitData ?? null);

      const { data: geo } = await supabase.from("course_geofences").select("latitude, longitude, radius_meters").eq("course_id", courseId).limit(1).maybeSingle();
      if (geo) setGeocerca({ lat: geo.latitude, lng: geo.longitude, radius: geo.radius_meters });

      const { data: dbStudentsRaw } = await supabase.from("students").select("*").eq("course_id", courseId);
      const dbStudents = dbStudentsRaw as { id: string; matricula: string; apellido_paterno: string; apellido_materno: string | null; nombres: string }[] | null;
      let sorted: Student[] = [];
      if (dbStudents) {
        sorted = dbStudents.sort((a, b) => a.apellido_paterno.localeCompare(b.apellido_paterno)).map((s) => ({
          id: s.id, matricula: s.matricula, apellido_paterno: s.apellido_paterno,
          nombre_completo: `${s.apellido_paterno} ${s.apellido_materno || ''} ${s.nombres}`.trim()
        }));
        setStudents(sorted);
      }

      const now = new Date().toISOString();
      const { data: activeSes } = await supabase.from("insitu_sessions")
        .select("id, qr_hash, session_number, expires_at")
        .eq("course_id", courseId).eq("is_active", true).gt("expires_at", now).maybeSingle();

      const initMap: Record<string, number> = {};
      sorted.forEach(s => initMap[s.id] = 0);

      if (activeSes) {
        setSesionId(activeSes.id);
        setSessionNumber(activeSes.session_number);
        const remaining = Math.floor((new Date(activeSes.expires_at).getTime() - new Date().getTime()) / 1000);
        setTimeLeft(remaining > 0 ? remaining : 0);
        setIsActive(true);

        // El hash guardado en BD no tiene firma HMAC asociada en memoria
        // (la firma no se persiste) — al recuperar una sesión activa tras
        // recargar la página, rotamos una vez para obtener hash+firma frescos.
        const rotRes = await fetch("/api/attendance/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeSes.id, courseId }),
        });
        if (rotRes.ok) {
          const rot = await rotRes.json();
          setQrHash(rot.hash);
          setQrSig(rot.sig);
        }

        const { data: validated } = await supabase.from("validated_attendances").select("student_id, source").eq("session_id", activeSes.id);
        const preloadedAuto = new Set<string>();
        validated?.forEach((v: { student_id: string; source: string }) => {
          if (initMap[v.student_id] !== undefined) initMap[v.student_id] = 1;
          if (v.source === 'qr_scan') preloadedAuto.add(v.student_id);
        });
        setAutoMarcados(preloadedAuto);
      } else {
        const today = new Date().toISOString().split('T')[0];
        const { data: done } = await supabase.from("validated_attendances").select("session_number").eq("course_id", courseId).eq("session_date", today);
        const unique = Array.from(new Set(done?.map((a: { session_number: number }) => Number(a.session_number)) || []));
        const nextSession = [1, 2, 3].find(n => !unique.includes(n));
        if (nextSession !== undefined) {
          setSessionNumber(nextSession);
          setSessionAlreadySaved(false);
        } else {
          // Todas las sesiones del día ya fueron selladas
          setSessionNumber(3);
          setSessionAlreadySaved(true);
        }
      }
      setAsistencia(initMap);
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : "No se pudo cargar la información de asistencia.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!courseId) return;
    // Mismo motivo que los demás setTimeout(0) de este archivo: saca la
    // llamada del cuerpo síncrono del efecto sin cambiar cuándo se dispara
    // en la práctica (sigue siendo inmediato al montar o cambiar courseId).
    const t = setTimeout(() => { fetchData(); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const buscarUbicacion = async () => {
    setIsLocating(true);
    setGeoError(null);
    try {
      const pos: GeolocationPosition = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
      );
      setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e) {
      const err = e as GeolocationPositionError | undefined;
      const msg = err?.code === 1
        ? "Permiso denegado. Habilita la ubicación en tu navegador."
        : err?.code === 3
        ? "Tiempo agotado. Verifica tu conexión o GPS."
        : "No se pudo obtener la ubicación.";
      setGeoError(msg);
      if (geocerca) setMapCenter({ lat: geocerca.lat, lng: geocerca.lng });
    } finally {
      setIsLocating(false);
    }
  };

  const abrirConfiguracionGeocerca = async () => {
    if (isActive) return;
    setGeoError(null);
    setShowMapModal(true);
    if (geocerca) { setMapCenter({ lat: geocerca.lat, lng: geocerca.lng }); setTempRadius(geocerca.radius); }
    await buscarUbicacion();
  };

  const guardarGeocercaModal = async () => {
    setIsSaving(true);
    try {
      const { data: ex } = await supabase.from("course_geofences").select("id").eq("course_id", courseId).maybeSingle();
      const payload = { course_id: courseId, latitude: mapCenter.lat, longitude: mapCenter.lng, radius_meters: tempRadius };
      const { error } = ex ? await supabase.from("course_geofences").update(payload).eq("course_id", courseId) : await supabase.from("course_geofences").insert(payload);
      if (error) throw error;
      setGeocerca({ lat: mapCenter.lat, lng: mapCenter.lng, radius: tempRadius });
      setShowMapModal(false);
    } catch { alert("Error al guardar GPS."); } finally { setIsSaving(false); }
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    if (isActive && sesionId) {
      channel = supabase.channel(`radar-${sesionId}`).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'validated_attendances', filter: `session_id=eq.${sesionId}` },
      (payload: { new: { student_id: string } }) => {
        setAsistencia((prev: Record<string, number>) => (prev[payload.new.student_id] === 0.5) ? prev : { ...prev, [payload.new.student_id]: 1 });
        setAutoMarcados((prev) => new Set(prev).add(payload.new.student_id));
      }).subscribe();
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [isActive, sesionId]);

  useEffect(() => {
    let refresh: NodeJS.Timeout;
    if (isActive && sesionId) {
      refresh = setInterval(async () => {
        const res = await fetch("/api/attendance/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sesionId, courseId }),
        });
        if (res.ok) {
          const { hash, sig } = await res.json();
          setQrHash(hash);
          setQrSig(sig);
        }
      }, 40000);
    }
    return () => clearInterval(refresh);
  }, [isActive, sesionId, courseId]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
      return () => clearInterval(timer);
    }
    if (timeLeft === 0) {
      // Defiere la llamada fuera del cuerpo síncrono del efecto — mismo
      // motivo que en la validación de asistencia y el auto-bloqueo del
      // examen: no cambia el comportamiento, solo el momento exacto del tick.
      const t = setTimeout(() => setIsActive(false), 0);
      return () => clearTimeout(t);
    }
  }, [isActive, timeLeft]);

  const startRadar = async () => {
    if (!geocerca) return alert("Configura el GPS primero.");
    setIsSaving(true);
    try {
      const res = await fetch("/api/attendance/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId, sessionNumber, unitNumber: currentUnit?.unit_number ?? 1,
        }),
      });
      if (!res.ok) throw new Error("start_failed");
      const { sessionId, hash, sig } = await res.json();
      setSesionId(sessionId); setQrHash(hash); setQrSig(sig); setTimeLeft(300); setIsActive(true);
    } catch { alert("Error al iniciar radar."); } finally { setIsSaving(false); }
  };

  const guardarFinal = async () => {
    setIsSaving(true);
    try {
      const sessionDate = new Date().toISOString().split('T')[0];
      // source: 'qr_scan' solo para alumnos que el canal realtime marcó por
      // autoescaneo (autoMarcados); cualquier otro registro al sellar —
      // ausencia, justificante, o presente tildado a mano— es 'manual'.
      const records = Object.entries(asistencia).map(([sId, val]) => ({
        course_id: courseId, student_id: sId, session_date: sessionDate,
        session_number: sessionNumber, status: val,
        unit_number: currentUnit?.unit_number ?? 1,
        source: autoMarcados.has(sId) ? 'qr_scan' : 'manual',
      }));
      await supabase.from("validated_attendances").upsert(records, { onConflict: 'course_id, student_id, session_date, session_number' });
      const syncRecords = Object.entries(asistencia).map(([studentId, status]) => ({
        studentId, status: status as 0 | 0.5 | 1
      }));
      await supabase.functions.invoke('sync-attendance', {
        body: { courseId, records: syncRecords, sessionDate, sessionNumber }
      });
      if (sesionId) await supabase.from("insitu_sessions").update({ is_active: false }).eq("id", sesionId);
      alert("Asistencia Guardada");
      setIsActive(false); setSesionId(null); fetchData();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); } finally { setIsSaving(false); }
  };

  return {
    students,
    geocerca,
    isActive, setIsActive,
    isSaving,
    sessionNumber,
    sessionAlreadySaved,
    currentUnit,
    timeLeft,
    sesionId, setSesionId,
    qrHash, qrSig,
    asistencia, setAsistencia,
    autoMarcados, setAutoMarcados,
    loading,
    loadError,
    isLoaded,
    showMapModal, setShowMapModal,
    mapCenter, setMapCenter,
    tempRadius, setTempRadius,
    isLocating,
    geoError,
    fetchData,
    buscarUbicacion,
    abrirConfiguracionGeocerca,
    guardarGeocercaModal,
    startRadar,
    guardarFinal,
  };
}

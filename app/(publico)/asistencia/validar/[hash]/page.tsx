"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, MapPin } from "lucide-react";

import { supabase } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import styles from "./validar.module.css";

// ── Catálogo de códigos de error de esta pantalla ───────────────────────────
// Referencia de debugging: cada código apunta al punto exacto del flujo que
// falló. titulo/msg son el texto que ve el alumno; origen es solo para quien
// audite logs (se loguea en consola vía logError(), nunca se muestra).
//
// `accion` decide cómo se recupera el alumno de cada error — el criterio es
// si la asistencia quedó registrada en la base o no:
//   - 'rescan'    → NO se registró y el QR/hash ya no sirve (lo genera y
//                   rota el docente, no esta pantalla): pantalla bloqueante,
//                   sin botón, el alumno debe escanear un QR nuevo.
//   - 'retry_qr'  → falló antes de intentar registrar nada (error de red al
//                   leer el QR): botón que reintenta solo esa verificación,
//                   mismo hash, sin recargar la página.
//   - 'retry_gps' → el alumno no dio permiso de ubicación o hubo timeout:
//                   botón que vuelve a pedir GPS únicamente, sin re-leer QR.
//   - 'none'      → dispositivo incompatible con GPS: no hay nada que
//                   reintentar.
//   - 'stay_form' → la asistencia no se registró pero el problema es un dato
//                   que el alumno puede corregir sin QR nuevo (matrícula mal
//                   escrita): se queda en el formulario con la matrícula que
//                   ya escribió, error inline arriba del botón.
const ERROR_CATALOG = {
  QR_INVALID_OR_EXPIRED: {
    titulo: "Acceso Expirado",
    msg: "El código QR ya no es válido o expiró. Pide a tu docente que genere uno nuevo y vuelve a escanearlo.",
    origen: "Verificación de insitu_sessions al cargar la página (verificarQR)",
    accion: 'rescan',
  },
  QR_CHECK_CONNECTION_ERROR: {
    titulo: "Error",
    msg: "Fallo de conexión institucional.",
    origen: "Excepción de red/Supabase durante verificarQR",
    accion: 'retry_qr',
  },
  GPS_UNSUPPORTED: {
    titulo: "Incompatible",
    msg: "Tu dispositivo no soporta GPS.",
    origen: "navigator.geolocation no disponible en el dispositivo",
    accion: 'none',
  },
  GPS_DENIED_OR_TIMEOUT: {
    titulo: "GPS Obligatorio",
    msg: "Debes permitir la ubicación para registrar tu asistencia.",
    origen: "Usuario negó el permiso de geolocalización o hubo timeout",
    accion: 'retry_gps',
  },
  GEO_OUT: {
    titulo: "Fuera de Rango",
    msg: "Tu ubicación no coincide con el área permitida. Vuelve a escanear el código QR para intentarlo de nuevo.",
    origen: "Edge Function register-attendance: geofencing rechazó las coordenadas",
    accion: 'rescan',
  },
  STUDENT_NOT_FOUND: {
    titulo: "No Inscrito",
    msg: "Tu matrícula no pertenece a este grupo. Revisa que esté bien escrita.",
    origen: "Edge Function register-attendance: matrícula sin registro en el curso",
    accion: 'stay_form',
  },
  HASH_EXPIRED: {
    titulo: "Sesión Cerrada",
    msg: "El docente cerró la sesión QR. Pide que genere un código nuevo y vuelve a escanearlo.",
    origen: "Edge Function register-attendance: la sesión ya no está activa",
    accion: 'rescan',
  },
  SERVER_ERROR: {
    titulo: "Error Servidor",
    msg: "No se pudo registrar tu asistencia. Vuelve a escanear el código QR para intentarlo de nuevo.",
    origen: "Edge Function register-attendance: fallback genérico / error no mapeado",
    accion: 'rescan',
  },
  INVALID_SIGNATURE: {
    titulo: "Código Inválido",
    msg: "Este código QR no es válido. Vuelve a escanear el código que muestra tu docente.",
    origen: "Edge Function register-attendance: firma HMAC del hash no coincide (falta ?sig o fue alterado)",
    accion: 'rescan',
  },
  RATE_LIMITED: {
    titulo: "Demasiados Intentos",
    msg: "Se detectaron demasiados intentos con esta matrícula. Espera unos minutos y vuelve a intentarlo.",
    origen: "Edge Function register-attendance: rate limit por matrícula excedido",
    accion: 'stay_form',
  },
} as const;

type ErrorCode = keyof typeof ERROR_CATALOG;

function logError(codigo: ErrorCode) {
  const { titulo, origen } = ERROR_CATALOG[codigo];
  console.error(`[ValidarAsistencia] ${codigo} (${titulo}) — ${origen}`);
}

type EstadoFlujo = 'verificando_qr' | 'solicitando_gps' | 'formulario' | 'exito' | 'error';

export default function ValidarAsistenciaAlumno() {
  const { hash } = useParams() as { hash: string };
  const searchParams = useSearchParams();
  const sig = searchParams.get('sig') ?? '';

  // Flujo: verificando_qr -> solicitando_gps -> formulario -> exito | error
  const [paso, setPaso] = useState<EstadoFlujo>('verificando_qr');
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const [formError, setFormError] = useState<ErrorCode | null>(null);
  const [matricula, setMatricula] = useState("");
  const [studentName, setStudentName] = useState("");
  type SessionData = {
    id: string; session_number: number; is_active: boolean; expires_at: string;
    course_id: string; courses: { title: string } | null;
  };
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Único punto de fallo: decide, según el catálogo, si el error va a la
  // pantalla bloqueante (con o sin botón de reintento) o si se queda como
  // aviso inline sin abandonar el formulario. Nunca recarga la página.
  const fallar = (codigo: ErrorCode) => {
    logError(codigo);
    if (ERROR_CATALOG[codigo].accion === 'stay_form') {
      setFormError(codigo);
      return;
    }
    setErrorCode(codigo);
    setPaso('error');
  };

  // 1. Validar integridad del QR — función independiente (no anidada en el
  // efecto) para poder reintentarla desde el botón sin releer la página.
  const verificarQR = async () => {
    setPaso('verificando_qr');
    try {
      const { data, error } = await supabase
        .from("insitu_sessions")
        .select(`id, session_number, is_active, expires_at, course_id, courses(title)`)
        .eq("qr_hash", hash)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error || !data) {
        fallar('QR_INVALID_OR_EXPIRED');
        return;
      }
      setSessionData(data);
      setPaso('solicitando_gps');
    } catch {
      fallar('QR_CHECK_CONNECTION_ERROR');
    }
  };

  useEffect(() => {
    if (!hash) return;
    // El linter no puede ver que verificarQR() solo actualiza estado tras un
    // await (nunca de forma síncrona en el cuerpo del efecto); el
    // setTimeout(0) lo saca del cuerpo síncrono sin cambiar el comportamiento
    // real — sigue disparándose de inmediato al montar o al cambiar `hash`.
    const t = setTimeout(() => { verificarQR(); }, 0);
    return () => clearTimeout(t);
    // verificarQR se recrea en cada render (no está memoizada) y solo debe
    // correr cuando cambia `hash`; incluirla en deps re-dispararía el efecto
    // en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  // 2. Bloqueo de Seguridad: Solicitar GPS antes de permitir ingreso de
  // matrícula. Se re-ejecuta cada vez que `paso` vuelve a 'solicitando_gps'
  // — tanto en el flujo normal como desde el botón de reintento de GPS.
  useEffect(() => {
    if (paso === 'solicitando_gps') {
      if (!navigator.geolocation) {
        // Mismo motivo que en el efecto de verificarQR: defiere la llamada
        // fuera del cuerpo síncrono del efecto sin cambiar el comportamiento.
        const t = setTimeout(() => fallar('GPS_UNSUPPORTED'), 0);
        return () => clearTimeout(t);
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setPaso('formulario'); // Desbloquea la interfaz
        },
        () => {
          fallar('GPS_DENIED_OR_TIMEOUT');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [paso]);

  const procesarRegistro = async () => {
    if (!matricula || matricula.length < 5 || !coords || !sessionData) return;
    setFormError(null);
    setLoading(true);

    try {
      // Registro en Edge Function (Geofencing)
      const { data, error: invokeError } = await supabase.functions.invoke('register-attendance', {
        body: {
          hash,
          sig,
          matricula: matricula.trim().toUpperCase(),
          lat: coords.lat,
          lng: coords.lng,
        },
      });

      if (invokeError || !data?.success) throw new Error(data?.error_code || 'SERVER_ERROR');

      // Buscar nombre del alumno para la pantalla de éxito limpia
      const { data: st } = await supabase
        .from('students')
        .select('nombres, apellido_paterno')
        .eq('matricula', matricula.trim().toUpperCase())
        .eq('course_id', sessionData.course_id)
        .maybeSingle();

      if (st) setStudentName(`${st.nombres} ${st.apellido_paterno}`);

      setPaso('exito');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const codigo: ErrorCode = msg in ERROR_CATALOG ? (msg as ErrorCode) : 'SERVER_ERROR';
      fallar(codigo);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <ShieldCheck size={48} className={styles.iconHeader} />
            <h1 className={styles.title}>Asistencia</h1>
            <p className={styles.subtitle}>Validación de Presencia</p>
          </div>

          {/* ESTADO CARGA / GPS */}
          {(paso === 'verificando_qr' || paso === 'solicitando_gps') && (
            <div className={styles.statusSection}>
              <Loader2 className={styles.spinner} />
              <p className={styles.badgeText}>
                {paso === 'verificando_qr' ? "Sincronizando..." : "Validando Ubicación..."}
              </p>
            </div>
          )}

          {/* FORMULARIO: Sólo visible tras éxito de GPS */}
          {paso === 'formulario' && (
            <div className={styles.form}>
              <div className={styles.materiaBadge}>
                <span className={styles.badgeText}>{sessionData?.courses?.title}</span>
              </div>

              {/* Error del submit que NO requiere QR nuevo — matrícula
                  corregible: el formulario y lo ya escrito se conservan. */}
              {formError && (
                <div className={styles.inlineError}>
                  <AlertCircle size={14} />
                  <span>{ERROR_CATALOG[formError].msg}</span>
                </div>
              )}

              <input
                type="text"
                placeholder="MATRÍCULA"
                className={styles.input}
                value={matricula}
                autoFocus
                onChange={(e) => setMatricula(e.target.value.toUpperCase())}
              />

              <button
                onClick={procesarRegistro}
                disabled={loading || matricula.length < 5}
                className={styles.loginButton}
              >
                {loading ? "PROCESANDO..." : "CONFIRMAR"}
              </button>

              <div className={styles.gpsHint}>
                <MapPin size={12} /> Ubicación vinculada correctamente
              </div>
            </div>
          )}

          {/* ÉXITO LIMPIO: Nombre + Apellido */}
          {paso === 'exito' && (
            <div className={styles.resultBox}>
              <CheckCircle2 size={64} color="#10b981" />
              <h2 className={styles.resultTitle}>¡Registrado!</h2>
              <p className={styles.studentName}>{studentName}</p>
              <p className={styles.resultText}>Registro validado con éxito.</p>
              <div className={styles.closeHint}>
                <p className={styles.closeHintText}>YA PUEDES CERRAR ESTA VENTANA</p>
              </div>
            </div>
          )}

          {/* ERROR — bloqueante: la asistencia no quedó registrada. El botón
              de reintento solo aparece cuando hay algo reintentable sin QR
              nuevo (falla de red al leer QR, o volver a pedir GPS). Para
              'rescan' y 'none' no hay botón: nunca se recarga la página, el
              siguiente paso real del alumno es escanear un QR nuevo. */}
          {paso === 'error' && errorCode && (
            <div className={styles.resultBox}>
              <AlertCircle size={64} color="#ef4444" />
              <h2 className={styles.resultTitle}>{ERROR_CATALOG[errorCode].titulo}</h2>
              <p className={styles.resultText}>{ERROR_CATALOG[errorCode].msg}</p>

              {ERROR_CATALOG[errorCode].accion === 'retry_qr' && (
                <button onClick={() => verificarQR()} className={styles.retryButton}>
                  Reintentar
                </button>
              )}
              {ERROR_CATALOG[errorCode].accion === 'retry_gps' && (
                <button onClick={() => setPaso('solicitando_gps')} className={styles.retryButton}>
                  Reintentar
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

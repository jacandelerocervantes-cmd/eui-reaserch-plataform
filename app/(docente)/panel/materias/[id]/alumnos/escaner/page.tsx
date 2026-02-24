"use client";

import React, { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { supabase } from "@/lib/supabase";
import { MapPin, CheckCircle2, ShieldAlert, Camera, Lock, ArrowRight } from "lucide-react";

export default function LectorInSituAlumno() {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1); // 1: QR, 2: GPS, 3: Matrícula, 4: Éxito
  const [error, setError] = useState<string | null>(null);
  
  // Datos recolectados en el proceso
  const [hashEscaneado, setHashEscaneado] = useState<string>("");
  const [sesionActiva, setSesionActiva] = useState<any>(null);
  const [coordenadas, setCoordenadas] = useState<{ lat: number, lng: number } | null>(null);
  const [matricula, setMatricula] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =====================================================================
  // FACTOR 1: ESCANEAR EL QR
  // =====================================================================
  const handleScan = async (textoQr: string) => {
    try {
      setHashEscaneado(textoQr);
      // Buscamos si ese QR existe en la base de datos y sigue activo
      const { data: sesion, error: dbError } = await supabase
        .from("sesiones_insitu")
        .select("*, materias(nombre, geocercas_materia(latitud_centro, longitud_centro, radio_metros))")
        .eq("codigo_qr_hash", textoQr)
        .eq("is_activa", true)
        .single();

      if (dbError || !sesion) {
        setError("QR inválido o la sesión ya expiró.");
        return;
      }

      setSesionActiva(sesion);
      setPaso(2); // Pasamos al GPS
    } catch (err) {
      setError("Error al leer el código QR.");
    }
  };

  // =====================================================================
  // FACTOR 2: OBTENER Y VALIDAR GPS (Fórmula de Haversine)
  // =====================================================================
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Radio de la tierra en metros
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distancia en metros
  };

  const solicitarUbicacion = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latAlumno = pos.coords.latitude;
        const lngAlumno = pos.coords.longitude;
        
        // Validar contra la geocerca del maestro
        const geocerca = sesionActiva.materias.geocercas_materia[0]; // Asumiendo que hay 1
        if(geocerca) {
            const distanciaMetros = calcularDistancia(latAlumno, lngAlumno, geocerca.latitud_centro, geocerca.longitud_centro);
            
            if (distanciaMetros > geocerca.radio_metros) {
                setError(`Estás fuera del salón. Distancia: ${Math.round(distanciaMetros)}m (Límite: ${geocerca.radio_metros}m)`);
                return;
            }
        }

        setCoordenadas({ lat: latAlumno, lng: lngAlumno });
        setPaso(3); // Pasamos a la Matrícula
      },
      (err) => {
        setError("Debes permitir el acceso a tu ubicación para registrar asistencia.");
      },
      { enableHighAccuracy: true }
    );
  };

  // =====================================================================
  // FACTOR 3: MATRÍCULA Y REGISTRO FINAL
  // =====================================================================
  const sellarAsistencia = async () => {
    if (matricula.trim() === "") {
        setError("Debes ingresar tu matrícula.");
        return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Buscamos el ID del alumno usando su matrícula
      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles")
        .select("id")
        .eq("matricula_rfc", matricula.trim())
        .single();

      if (perfilError || !perfil) {
        throw new Error("Matrícula no encontrada en el sistema.");
      }

      // 2. Insertamos la asistencia irrefutable
      const { error: insertError } = await supabase
        .from("asistencias_validadas")
        .insert({
          sesion_id: sesionActiva.id,
          alumno_id: perfil.id,
          latitud_registrada: coordenadas?.lat,
          longitud_registrada: coordenadas?.lng
        });

      if (insertError) {
        if(insertError.code === '23505') throw new Error("Ya registraste tu asistencia para esta sesión.");
        throw new Error("Error al guardar en la base de datos.");
      }

      setPaso(4); // ¡ÉXITO!
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================================================
  // RENDERIZADO DE LA INTERFAZ (UI)
  // =====================================================================
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-[24px] shadow-xl overflow-hidden border border-slate-200">
        
        {/* HEADER DE ESTADO */}
        <div className="bg-[#1B396A] p-6 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-30 -mr-10 -mt-10"></div>
            <h1 className="text-2xl font-black relative z-10">Validación In-Situ</h1>
            <p className="text-blue-200 font-medium text-sm mt-1 relative z-10">Protocolo de 3 Factores</p>
            
            {/* Barra de progreso visual */}
            <div className="flex justify-center gap-2 mt-6 relative z-10">
                <div className={`h-2 flex-1 rounded-full ${paso >= 1 ? 'bg-emerald-400' : 'bg-white/20'}`}></div>
                <div className={`h-2 flex-1 rounded-full ${paso >= 2 ? 'bg-emerald-400' : 'bg-white/20'}`}></div>
                <div className={`h-2 flex-1 rounded-full ${paso >= 3 ? 'bg-emerald-400' : 'bg-white/20'}`}></div>
            </div>
        </div>

        <div className="p-8">
            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-[16px] flex items-start gap-3 text-sm font-bold">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* PANTALLA 1: CÁMARA */}
            {paso === 1 && (
                <div className="space-y-6 text-center animate-in fade-in duration-300">
                    <div className="bg-slate-100 p-4 rounded-[20px] overflow-hidden border-2 border-dashed border-slate-300">
                        <Scanner 
                           onScan={(result) => handleScan(result[0].rawValue)} 
                           options={{ delayBetweenScanAttempts: 1000 }}
                           components={{ audio: false }}
                        />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-[#1B396A] font-bold">
                        <Camera className="w-5 h-5" /> Apunta al QR del pizarrón
                    </div>
                </div>
            )}

            {/* PANTALLA 2: GPS */}
            {paso === 2 && sesionActiva && (
                <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-[16px] font-bold border border-emerald-200">
                        Clase Detectada: {sesionActiva.materias.nombre}
                    </div>
                    <div className="bg-slate-50 p-8 rounded-[20px] border border-slate-200">
                        <MapPin className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-bounce" />
                        <h3 className="text-lg font-black text-slate-800">Verificación de Perímetro</h3>
                        <p className="text-slate-500 text-sm mt-2 font-medium">Debemos validar que te encuentras físicamente dentro del salón.</p>
                    </div>
                    <button onClick={solicitarUbicacion} className="w-full bg-[#1B396A] text-white py-4 rounded-[16px] font-black text-lg hover:bg-blue-900 transition-colors shadow-lg">
                        Permitir Ubicación
                    </button>
                </div>
            )}

            {/* PANTALLA 3: MATRÍCULA */}
            {paso === 3 && (
                <div className="space-y-6 text-center animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-center gap-4 mb-2">
                        <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> QR OK</div>
                        <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> GPS OK</div>
                    </div>
                    
                    <div className="text-left space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-slate-400" /> Firma de Identidad (Matrícula)
                        </label>
                        <input 
                            type="text" 
                            value={matricula}
                            onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                            placeholder="Ej. E19080012"
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-[16px] px-6 py-4 font-mono font-black text-xl text-center focus:outline-none focus:border-[#1B396A] transition-colors uppercase"
                        />
                    </div>

                    <button 
                        onClick={sellarAsistencia} 
                        disabled={isSubmitting}
                        className="w-full bg-emerald-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-4 rounded-[16px] font-black text-lg hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30 flex justify-center items-center gap-2"
                    >
                        {isSubmitting ? "Sellando..." : "Sellar Asistencia"} <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* PANTALLA 4: ÉXITO */}
            {paso === 4 && (
                <div className="text-center space-y-6 animate-in zoom-in duration-500 py-8">
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800">¡Asistencia Sellada!</h2>
                    <p className="text-slate-500 font-medium">Tu registro In-Situ es válido e inmutable.</p>
                    <p className="text-xs text-slate-400 font-mono mt-4">Coordenadas: {coordenadas?.lat.toFixed(4)}, {coordenadas?.lng.toFixed(4)}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
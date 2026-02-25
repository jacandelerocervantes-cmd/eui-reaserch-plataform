"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Scanner } from "@yudiel/react-qr-scanner";
import { supabase } from "@/lib/supabase";
import { 
  ShieldCheck, UserCheck, ShieldAlert, Camera, 
  ArrowRight, Loader2, Search, CheckCircle2 
} from "lucide-react";

export default function EscanerIdentidadDocente() {
  const { id: courseId } = useParams() as { id: string };
  const [paso, setPaso] = useState<1 | 2 | 3>(1); // 1: Scanner, 2: Validación, 3: Éxito
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Datos de la sesión y el alumno
  const [sesionActiva, setSesionActiva] = useState<any>(null);
  const [alumnoEncontrado, setAlumnoEncontrado] = useState<any>(null);
  const [matriculaManual, setMatriculaManual] = useState("");

  // 1. Cargar sesión in-situ activa al iniciar
  useEffect(() => {
    const buscarSesion = async () => {
      const { data } = await supabase
        .from("sesiones_insitu")
        .select("id, tipo")
        .eq("materia_id", courseId)
        .eq("is_activa", true)
        .order('fecha_creacion', { ascending: false })
        .limit(1)
        .single();
      
      if (data) setSesionActiva(data);
    };
    if (courseId) buscarSesion();
  }, [courseId]);

  // 2. Procesar el escaneo o búsqueda manual
  const validarAlumno = async (matricula: string) => {
    if (!sesionActiva) {
      setError("No hay una sesión de pase de lista activa en este momento.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Buscar perfil por matrícula
      const { data: perfil, error: pError } = await supabase
        .from("perfiles")
        .select("id, nombre_completo, matricula_rfc")
        .eq("matricula_rfc", matricula.trim().toUpperCase())
        .single();

      if (pError || !perfil) throw new Error("Alumno no registrado en el sistema.");

      setAlumnoEncontrado(perfil);
      setPaso(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Registrar asistencia y sincronizar con Drive
  const registrarConfirmado = async () => {
    setLoading(true);
    try {
      // A. Guardar en Base de Datos
      const { error: insError } = await supabase
        .from("asistencias_validadas")
        .insert({
          sesion_id: sesionActiva.id,
          alumno_id: alumnoEncontrado.id
        });

      if (insError) {
        if (insError.code === '23505') throw new Error("Este alumno ya fue registrado.");
        throw insError;
      }

      // B. Sincronización Híbrida Instantánea con Drive
      await supabase.functions.invoke('sync-attendance', {
        body: { 
          courseId, 
          asistenciaMap: { [alumnoEncontrado.id]: 1 } 
        }
      });

      setPaso(3);
      // Auto-reset después de 2 segundos para seguir escaneando
      setTimeout(() => {
        setPaso(1);
        setAlumnoEncontrado(null);
        setMatriculaManual("");
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-10 px-4">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header Institucional */}
        <div className="bg-[#1B396A] p-8 text-white text-center">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-blue-300" />
          <h1 className="text-2xl font-black">Escáner de Identidad</h1>
          <p className="text-blue-200 text-sm font-medium mt-1">Validación Docente en Sitio</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-xl flex items-center gap-3 text-sm font-bold animate-pulse">
              <ShieldAlert className="w-5 h-5" /> {error}
            </div>
          )}

          {/* PASO 1: CAPTURA (SCANNER O MANUAL) */}
          {paso === 1 && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {!sesionActiva ? (
                <div className="text-center py-10">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 font-bold">Esperando activación de radar...</p>
                </div>
              ) : (
                <>
                  <div className="rounded-[24px] overflow-hidden border-4 border-[#1B396A]/10 shadow-inner">
                    <Scanner onScan={(res) => validarAlumno(res[0].rawValue)} />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-black">O ingreso manual</span></div>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 font-mono font-bold focus:border-[#1B396A] outline-none"
                      placeholder="MATRÍCULA"
                      value={matriculaManual}
                      onChange={(e) => setMatriculaManual(e.target.value)}
                    />
                    <button 
                      onClick={() => validarAlumno(matriculaManual)}
                      className="bg-[#1B396A] text-white p-4 rounded-xl hover:bg-blue-900 transition-all"
                    >
                      <Search size={20} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* PASO 2: CONFIRMACIÓN DE PERFIL */}
          {paso === 2 && alumnoEncontrado && (
            <div className="text-center space-y-6 animate-in slide-in-from-bottom-4 duration-400">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto border-2 border-blue-100">
                <UserCheck className="w-12 h-12 text-[#1B396A]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">{alumnoEncontrado.nombre_completo}</h3>
                <p className="text-[#1B396A] font-mono font-bold mt-1">{alumnoEncontrado.matricula_rfc}</p>
              </div>
              
              <button 
                onClick={registrarConfirmado}
                disabled={loading}
                className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-600 flex justify-center items-center gap-3 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : <><CheckCircle2 /> REGISTRAR ASISTENCIA</>}
              </button>
              
              <button onClick={() => setPaso(1)} className="text-slate-400 font-bold text-sm underline">Cancelar escaneo</button>
            </div>
          )}

          {/* PASO 3: ÉXITO */}
          {paso === 3 && (
            <div className="text-center py-10 animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800">¡Sincronizado!</h2>
              <p className="text-slate-500 font-medium mt-2">La sábana en Drive ha sido actualizada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
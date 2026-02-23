'use client';

import React, { useState } from 'react';
import { 
  ShieldAlert, MapPin, QrCode, Lock, CheckCircle2, 
  FileText, ArrowRight, BrainCircuit, ExternalLink 
} from 'lucide-react';

export default function BunkerMateria() {
  // Estados para manejar el Modal In-Situ y la validación
  const [showInSituModal, setShowInSituModal] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle, loading, success, error
  const [matricula, setMatricula] = useState('');

  // Simulación de datos de la materia para Juan Antonio
  const materia = {
    nombre: "Desarrollo Web (Supabase & Edge)",
    profesor: "Mtro. Candelero",
    promedio: 95,
    estadoInSitu: "activo", // El maestro acaba de lanzar un Taller
  };

  const handleGPSValidation = () => {
    setGpsStatus('loading');
    // Simulamos la Edge Function validando coordenadas
    setTimeout(() => setGpsStatus('success'), 1500);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* HEADER DE LA MATERIA */}
      <header className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-4xl font-black text-[#1B396A] tracking-tight">{materia.nombre}</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Profesor: {materia.profesor}</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Promedio Actual</div>
          <div className="text-4xl font-black text-emerald-500">{materia.promedio}</div>
        </div>
      </header>

      {/* 🔴 ZONA IN-SITU (EDGE UI) */}
      {materia.estadoInSitu === 'activo' && (
        <section className="bg-[#1B396A] rounded-[24px] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-20 -mt-20"></div>
          
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 text-blue-200 font-bold text-sm uppercase tracking-wider mb-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                Dinámica In-Situ Activa
              </div>
              <h2 className="text-2xl font-black mb-2">Taller Colaborativo Workspace</h2>
              <p className="text-blue-100 font-medium max-w-md">
                El profesor ha iniciado una actividad en el salón. Valida tu asistencia para desbloquear el Google Doc de tu equipo.
              </p>
            </div>
            
            {/* Regla de Botón: 14px */}
            <button 
              onClick={() => setShowInSituModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-[14px] font-black text-lg transition-all hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-3"
            >
              <QrCode className="w-6 h-6" /> Escanear QR
            </button>
          </div>
        </section>
      )}

      {/* 📚 BÓVEDA DE TAREAS Y CANDADOS */}
      <section>
        <h3 className="text-2xl font-black text-slate-800 mb-6">Misiones y Entregables</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* TAREA 1: Desbloqueada (Normal) */}
          <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-[10px] text-xs font-bold uppercase">Activa</div>
              <div className="text-sm font-bold text-slate-500">Cierra: Mañana</div>
            </div>
            <h4 className="text-xl font-black text-[#1B396A] mb-2">Reporte de Funciones Edge</h4>
            <p className="text-slate-500 text-sm font-medium mb-6">Sube tu PDF o pega el enlace de tu repositorio de GitHub.</p>
            <button className="w-full bg-[#f8fafc] hover:bg-blue-50 text-[#1B396A] border-2 border-slate-200 hover:border-blue-200 py-3 rounded-[14px] font-bold transition-colors flex justify-center items-center gap-2">
              <FileText className="w-4 h-4" /> Subir Archivo
            </button>
          </div>

          {/* TAREA 2: Bloqueada (Candado de Asistencia) */}
          <div className="bg-slate-50 rounded-[24px] border border-slate-200 p-6 relative overflow-hidden grayscale opacity-70">
            {/* Overlay del Candado */}
            <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-6 text-center">
              <Lock className="w-8 h-8 text-slate-500 mb-2" />
              <div className="font-bold text-slate-700">Acceso Denegado</div>
              <div className="text-xs font-medium text-slate-500 mt-1 max-w-[200px]">
                Requiere registro de asistencia en la clase presencial del 20 de Febrero.
              </div>
            </div>

            <div className="flex justify-between items-start mb-4">
              <div className="bg-slate-200 text-slate-500 px-3 py-1 rounded-[10px] text-xs font-bold uppercase">Bloqueada</div>
            </div>
            <h4 className="text-xl font-black text-slate-400 mb-2">Examen Práctico SQL</h4>
            <p className="text-slate-400 text-sm font-medium mb-6">Resolución de consultas complejas en Supabase.</p>
            <button disabled className="w-full bg-slate-200 text-slate-400 py-3 rounded-[14px] font-bold cursor-not-allowed">
              Subir Archivo
            </button>
          </div>

        </div>
      </section>

      {/* 🧠 BÓVEDA SEGURA (MATERIAL DIDÁCTICO) */}
      <section>
        <h3 className="text-2xl font-black text-slate-800 mb-6">Bóveda Segura de Material</h3>
        <div className="bg-white rounded-[24px] border border-slate-200 p-2 flex items-center justify-between shadow-sm pr-6">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 p-4 rounded-[20px]">
              <FileText className="text-orange-600 w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-[#1B396A]">Presentación: Arquitectura de Datos</h4>
              <p className="text-xs text-slate-500 font-medium">1.2 MB • Solo lectura</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-[14px] font-bold text-sm transition-colors flex items-center gap-2">
              <BrainCircuit className="w-4 h-4" /> Gimnasio Mental (IA)
            </button>
            <button className="bg-[#1B396A] text-white hover:bg-blue-800 px-4 py-2 rounded-[14px] font-bold text-sm transition-colors flex items-center gap-2">
              Leer PDF <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* MODAL IN-SITU (3 FACTORES) */}
      {showInSituModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] max-w-md w-full p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            
            <h3 className="text-2xl font-black text-[#1B396A] text-center mb-6">Validación In-Situ</h3>
            
            <div className="space-y-6">
              {/* Factor 1: QR */}
              <div className="bg-slate-50 p-4 rounded-[16px] flex items-center gap-4 border border-slate-200">
                <div className="bg-emerald-100 p-2 rounded-full"><CheckCircle2 className="text-emerald-600 w-5 h-5" /></div>
                <div>
                  <div className="font-bold text-slate-800">1. Código QR</div>
                  <div className="text-xs text-slate-500 font-medium">Escaneado correctamente a las 11:45 AM</div>
                </div>
              </div>

              {/* Factor 2: GPS Edge Function */}
              <div className={`p-4 rounded-[16px] flex items-center gap-4 border ${gpsStatus === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className={`${gpsStatus === 'success' ? 'bg-emerald-100' : 'bg-blue-100'} p-2 rounded-full`}>
                  {gpsStatus === 'success' ? <CheckCircle2 className="text-emerald-600 w-5 h-5" /> : <MapPin className="text-blue-600 w-5 h-5 animate-pulse" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800">2. Ubicación GPS</div>
                  <div className="text-xs text-slate-500 font-medium">
                    {gpsStatus === 'idle' && 'Presiona para validar perímetro...'}
                    {gpsStatus === 'loading' && 'Consultando Edge Function...'}
                    {gpsStatus === 'success' && 'Ubicación confirmada: TecNM Salón 4'}
                  </div>
                </div>
                {gpsStatus === 'idle' && (
                  <button onClick={handleGPSValidation} className="bg-blue-600 text-white px-3 py-1.5 rounded-[10px] text-xs font-bold">Verificar</button>
                )}
              </div>

              {/* Factor 3: Matrícula */}
              <div className={`p-4 rounded-[16px] border ${gpsStatus === 'success' ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
                <div className="font-bold text-slate-800 mb-2">3. Firma de Identidad</div>
                <input 
                  type="text" 
                  disabled={gpsStatus !== 'success'}
                  placeholder="Ingresa tu Matrícula" 
                  className="w-full bg-slate-100 border border-slate-200 rounded-[12px] px-4 py-3 font-mono text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setShowInSituModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-[14px] font-bold transition-colors">
                Cancelar
              </button>
              <button 
                disabled={gpsStatus !== 'success' || matricula.length < 8}
                className="flex-1 bg-[#1B396A] disabled:bg-slate-300 text-white py-3 rounded-[14px] font-bold transition-colors flex justify-center items-center gap-2"
              >
                Desbloquear Docs <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
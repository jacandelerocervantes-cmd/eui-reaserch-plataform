'use client';

import React from 'react';
import { Map, TestTube, FileText, Lock, QrCode, ArrowRight } from 'lucide-react';

export default function MisionesAlumno() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      <header>
        <h1 className="text-4xl font-black text-[#1B396A] tracking-tight">Misiones Asignadas</h1>
        <p className="text-slate-500 font-medium text-lg mt-1">Proyectos de Investigación, Laboratorio y Campo a los que has sido invitado.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        
        {/* 🟨 MUNDO DORADO: INVESTIGACIÓN (Permiso Limitado) */}
        <div className="bg-white rounded-[24px] border border-yellow-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 rounded-full blur-3xl opacity-10 -mr-10 -mt-10"></div>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="bg-yellow-100 p-3 rounded-[16px]"><FileText className="text-yellow-600 w-6 h-6" /></div>
              <div className="bg-slate-100 text-slate-500 px-3 py-1 rounded-[10px] text-xs font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Solo Escritura Asignada
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Estrés Hídrico en Habanero</h3>
            <p className="text-slate-500 font-medium text-sm mb-4">Invita: Dr. Martínez • Rol: Tesista</p>
            <p className="text-sm font-bold text-yellow-700 bg-yellow-50 p-3 rounded-[12px]">
              Misión: Redactar Capítulo 2 (Marco Teórico) en el Canvas AI.
            </p>
          </div>
          <button className="w-full mt-6 bg-yellow-500 text-white hover:bg-yellow-600 py-3 rounded-[14px] font-bold transition-colors flex justify-center items-center gap-2">
            Abrir Canvas AI <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 🟩 MUNDO ESMERALDA: LABORATORIO (Validación 0) */}
        <div className="bg-white rounded-[24px] border border-emerald-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400 rounded-full blur-3xl opacity-10 -mr-10 -mt-10"></div>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="bg-emerald-100 p-3 rounded-[16px]"><TestTube className="text-emerald-600 w-6 h-6" /></div>
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-[10px] text-xs font-bold flex items-center gap-1">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Telemetría en Vivo
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Incubadora de Fito-patógenos</h3>
            <p className="text-slate-500 font-medium text-sm mb-4">Invita: Ing. Salazar • Rol: Auxiliar</p>
            <div className="bg-slate-50 p-3 rounded-[12px] border border-slate-100">
              <div className="text-xs text-slate-400 font-bold uppercase mb-1">Última lectura IoT</div>
              <div className="text-xl font-black text-emerald-600">37.5 °C <span className="text-sm font-medium text-slate-500">Normal</span></div>
            </div>
          </div>
          <button className="w-full mt-6 bg-emerald-500 text-white hover:bg-emerald-600 py-3 rounded-[14px] font-bold transition-colors flex justify-center items-center gap-2">
            <QrCode className="w-4 h-4" /> Escanear Muestra
          </button>
        </div>

        {/* 🟫 MUNDO TERRACOTA: CAMPO (Modo Recolector) */}
        <div className="bg-white rounded-[24px] border border-orange-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400 rounded-full blur-3xl opacity-10 -mr-10 -mt-10"></div>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="bg-orange-100 p-3 rounded-[16px]"><Map className="text-orange-600 w-6 h-6" /></div>
              <div className="bg-slate-100 text-slate-500 px-3 py-1 rounded-[10px] text-xs font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Solo Captura (Offline)
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Encuesta Agrícola Tizimín</h3>
            <p className="text-slate-500 font-medium text-sm mb-4">Invita: Dr. Martínez • Rol: Recolector</p>
            <p className="text-sm font-bold text-orange-700 bg-orange-50 p-3 rounded-[12px]">
              Misión: Recopilar 15 encuestas a productores.
            </p>
          </div>
          <button className="w-full mt-6 bg-orange-500 text-white hover:bg-orange-600 py-3 rounded-[14px] font-bold transition-colors flex justify-center items-center gap-2">
            Abrir Modo Recolector <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
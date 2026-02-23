'use client';

import React from 'react';
import { Search, MessageSquare, Sparkles, UserPlus, Send } from 'lucide-react';

export default function ComunicacionMatchmaker() {
  return (
    <div className="max-w-6xl mx-auto flex gap-6 h-[85vh] animate-in slide-in-from-right-8 duration-500">
      
      {/* PANEL IZQUIERDO: Chats e Hilos Oficiales */}
      <div className="w-1/3 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-2xl font-black text-[#1B396A]">Comunidad</h2>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar compañero o materia..." 
              className="w-full bg-slate-50 border border-slate-200 rounded-[12px] pl-10 pr-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* Hilo Oficial del Maestro */}
          <div className="bg-blue-50 p-4 rounded-[16px] cursor-pointer border border-blue-100">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-[#1B396A]">Anuncios: Cálculo Vectorial</span>
              <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">Profe</span>
            </div>
            <p className="text-sm text-slate-600 truncate">No olviden el reporte para mañana...</p>
          </div>

          {/* Chat de Equipo Workspace */}
          <div className="bg-white hover:bg-slate-50 p-4 rounded-[16px] cursor-pointer border border-slate-100">
            <div className="font-bold text-slate-800 mb-1">Equipo 3 (Proyecto Final)</div>
            <p className="text-sm text-slate-500 truncate">Ana: Ya subí la parte de la introducción.</p>
          </div>
        </div>
      </div>

      {/* PANEL DERECHO: El Matchmaker IA (La joya de la corona) */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* WIDGET IA: Matchmaker Académico */}
        <div className="bg-indigo-600 rounded-[24px] p-8 shadow-lg text-white relative overflow-hidden flex items-center justify-between">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-500 rounded-full blur-3xl opacity-50"></div>
          <div className="relative z-10 max-w-md">
            <div className="flex items-center gap-2 text-indigo-200 font-bold text-sm uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4 text-yellow-300" /> Sugerencia de la IA
            </div>
            <h3 className="text-2xl font-black mb-2">¡Forma una alianza estratégica!</h3>
            <p className="text-indigo-100 font-medium text-sm">
              Notamos que tienes un 95 en Programación pero un 70 en Matemáticas Discretas. <strong>Roberto Sánchez</strong> de tu grupo tiene exactamente el perfil opuesto.
            </p>
          </div>
          <button className="relative z-10 bg-white text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-[14px] font-black shadow-xl hover:scale-105 transition-transform flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Invitar a Estudiar
          </button>
        </div>

        {/* VENTANA DE CHAT ACTIVO */}
        <div className="flex-1 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-[12px] flex items-center justify-center text-indigo-600 font-black">E3</div>
            <div>
              <h3 className="font-black text-slate-800">Equipo 3 (Proyecto Final)</h3>
              <p className="text-xs font-bold text-emerald-500">4 miembros conectados</p>
            </div>
          </div>
          
          <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
            {/* Mensajes simulados */}
            <div className="flex flex-col gap-4">
              <div className="bg-white p-4 rounded-[16px] rounded-tl-none border border-slate-200 self-start max-w-[80%]">
                <p className="text-sm font-bold text-[#1B396A] mb-1">Ana</p>
                <p className="text-slate-700">Ya subí la parte de la introducción al Workspace. ¿Pueden revisar?</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-4">
            <input 
              type="text" 
              placeholder="Escribe un mensaje al equipo..." 
              className="flex-1 bg-slate-100 border-none rounded-[14px] px-4 py-3 font-medium focus:ring-2 focus:ring-indigo-500"
            />
            <button className="bg-[#1B396A] text-white p-3 rounded-[14px] hover:bg-blue-800 transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
// app/alumno/page.tsx
import React from 'react';
import { AlertTriangle, TrendingUp, Clock, ArrowRight } from 'lucide-react';

export default function HubGlobalAlumno() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      
      {/* HEADER & TRIAGE BANNER (Predicción IA) */}
      <header className="space-y-4">
        <h1 className="text-4xl font-black text-[#1B396A] tracking-tight">Tu Radar Académico</h1>
        
        <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-[24px] flex items-start gap-4 shadow-sm">
          <AlertTriangle className="text-orange-500 w-8 h-8 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-orange-900 text-lg">Atención Requerida (IA Predicción)</h3>
            <p className="text-orange-800 font-medium">
              Tu asistencia en <strong>Fitopatología</strong> está al límite (80%). Además, la tarea con Candado de Asistencia cierra hoy a las 23:59. Concéntrate en esta entrega para no perder puntos vitales.
            </p>
          </div>
        </div>
      </header>

      {/* MINI-WIDGETS: Empleabilidad y Matchmaker */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[24px] border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <h4 className="text-slate-500 font-bold text-sm uppercase tracking-wider">Radar de Empleabilidad</h4>
            <div className="text-2xl font-black text-[#1B396A] mt-1">88% Match</div>
            <p className="text-sm text-slate-500 font-medium mt-1">Perfil actual: Agrónomo de Precisión</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl"><TrendingUp className="text-blue-600 w-6 h-6" /></div>
        </div>
        <div className="bg-[#1B396A] p-6 rounded-[24px] text-white flex items-center justify-between shadow-lg shadow-blue-900/20">
          <div>
            <h4 className="text-blue-200 font-bold text-sm uppercase tracking-wider">Gimnasio Mental</h4>
            <div className="text-xl font-bold mt-1">Nuevas Flashcards Listas</div>
            <p className="text-sm text-blue-100 font-medium mt-1">Generadas del último PDF de Cálculo.</p>
          </div>
          <button className="bg-white text-[#1B396A] px-4 py-2 rounded-[14px] font-bold text-sm hover:scale-95 transition-transform">
            Entrenar
          </button>
        </div>
      </div>

      {/* MURO DE MATERIAS (Ordenado por Riesgo) */}
      <section>
        <h2 className="text-2xl font-black text-slate-800 mb-6">Tus Materias (Priorizadas)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Tarjeta 1: Riesgo Alto / Urgencia */}
          <MateriaCard 
            nombre="Fitopatología Avanzada"
            profesor="Dr. Martínez"
            promedio={70}
            estado="urgente"
            siguienteEvento="Entrega de Reporte (Candado Activo)"
            tiempoRestante="Hoy, 23:59"
          />

          {/* Tarjeta 2: Riesgo Medio */}
          <MateriaCard 
            nombre="Cálculo Vectorial"
            profesor="Ing. Salazar"
            promedio={82}
            estado="atencion"
            siguienteEvento="Taller Workspace In-Situ"
            tiempoRestante="Mañana, 09:00 AM"
          />

          {/* Tarjeta 3: Seguro */}
          <MateriaCard 
            nombre="Desarrollo Web (Supabase)"
            profesor="Mtro. Candelero"
            promedio={95}
            estado="seguro"
            siguienteEvento="Revisión de Funciones Edge"
            tiempoRestante="Viernes, 11:00 AM"
          />
        </div>
      </section>
    </div>
  );
}

// Componente Master Card para Materias
type EstadoMateria = 'urgente' | 'atencion' | 'seguro';

interface MateriaCardProps {
  nombre: string;
  profesor: string;
  promedio: number;
  estado: EstadoMateria;
  siguienteEvento: string;
  tiempoRestante: string;
}

const MateriaCard = ({ nombre, profesor, promedio, estado, siguienteEvento, tiempoRestante }: MateriaCardProps) => {
  // Le decimos a TypeScript que 'colores' usa 'EstadoMateria' como llaves
  const colores: Record<EstadoMateria, { bg: string; border: string; text: string; ring: string }> = {
    urgente: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', ring: 'ring-red-500' },
    atencion: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', ring: 'ring-amber-500' },
    seguro: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', ring: 'ring-emerald-500' }
  };
  const theme = colores[estado];

  return (
    <div className={`group bg-white rounded-[24px] border border-slate-200 p-6 hover:-translate-y-2 transition-all duration-300 hover:shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px] cursor-pointer`}>
      {/* Círculo de color indicativo arriba */}
      <div className={`absolute top-0 left-0 w-full h-1.5 ${theme.bg} ${theme.ring} ring-2 ring-inset opacity-50`}></div>
      
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center font-black text-xl ${theme.bg} ${theme.text}`}>
            {promedio}
          </div>
        </div>
        <h3 className="text-xl font-black text-[#1B396A] leading-tight mb-1">{nombre}</h3>
        <p className="text-slate-500 font-medium text-sm">{profesor}</p>
      </div>

      {/* Sección Expansiva Hover (Eventos) */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center text-sm font-bold text-slate-700 mb-1">
          <Clock className="w-4 h-4 mr-2 text-slate-400" />
          Próximo Evento:
        </div>
        <p className="text-sm text-slate-600 leading-snug mb-3">{siguienteEvento} ({tiempoRestante})</p>
        
        {/* Regla de Botón: 14px */}
        <button className="w-full bg-[#1B396A] text-white py-2.5 rounded-[14px] font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center">
          Entrar al Búnker <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};
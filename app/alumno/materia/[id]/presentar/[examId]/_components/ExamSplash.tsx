import { BookOpen, ShieldAlert, Eye, Copy, Maximize2, MonitorOff } from 'lucide-react';

// ── Pantalla de bienvenida/aviso antes de iniciar ──────────────────────────
export function ExamSplash({ examTitle, questionCount, durationMinutes, onStart }: {
  examTitle: string;
  questionCount: number;
  durationMinutes: number;
  onStart: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center gap-8">
      <div className="w-20 h-20 bg-[#1B396A] rounded-[24px] flex items-center justify-center shadow-xl">
        <BookOpen className="text-white" size={40} />
      </div>

      <div>
        <h1 className="text-3xl font-black text-[#1B396A] mb-2">{examTitle}</h1>
        <p className="text-slate-500 font-medium">{questionCount} reactivos · {durationMinutes} min</p>
      </div>

      {/* Aviso de monitoreo */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-[24px] p-6 text-left w-full space-y-3">
        <div className="flex items-center gap-2 text-amber-800 font-black text-lg">
          <ShieldAlert className="text-amber-600" size={24} />
          Aviso de Monitoreo Académico
        </div>
        <ul className="space-y-2 text-amber-800 font-medium text-sm">
          <li className="flex items-start gap-2">
            <Eye size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
            El sistema registrará si cambias de pestaña o ventana durante el examen.
          </li>
          <li className="flex items-start gap-2">
            <Copy size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
            Los intentos de copiar el contenido quedarán registrados.
          </li>
          <li className="flex items-start gap-2">
            <Maximize2 size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
            El examen se ejecuta en pantalla completa. Salir de ella se registra como incidencia.
          </li>
          <li className="flex items-start gap-2">
            <MonitorOff size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
            Las incidencias son visibles para tu docente y pueden afectar tu calificación.
          </li>
        </ul>
        <p className="text-amber-700 text-sm font-bold pt-2 border-t border-amber-200">
          Al iniciar el examen aceptas estas condiciones y otorgas permiso de pantalla completa.
        </p>
      </div>

      <button
        onClick={onStart}
        className="flex items-center gap-3 bg-[#1B396A] text-white px-10 py-4 rounded-[16px] font-black text-lg hover:bg-blue-800 transition-all hover:shadow-xl hover:-translate-y-0.5"
      >
        <Maximize2 size={22} /> Iniciar Examen en Pantalla Completa
      </button>
    </div>
  );
}

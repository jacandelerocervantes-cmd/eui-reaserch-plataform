'use client';

/**
 * Tutor de IA socrático — piloto acotado para alumnos (ver
 * supabase/functions/ai-tutor-sandbox). Compartido entre los 3 puntos de
 * entrada del piloto: entregar/[assignmentId] (contextType="assignment"),
 * presentar/[examId] antes de iniciar (contextType="exam_prep"), y el tablón
 * de la materia (contextType="general").
 *
 * No reenvía historial al servidor — el backend lo reconstruye desde
 * ai_sandbox_logs (ver nota de seguridad en ai-tutor-sandbox/index.ts). Este
 * componente solo mantiene los mensajes en memoria para pintarlos; si el
 * alumno recarga la página, la conversación visual se reinicia aunque el
 * modelo siga teniendo memoria real de turnos previos del servidor.
 */
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, X, GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type SandboxContextType = 'assignment' | 'exam_prep' | 'general';

interface ChatMessage { role: 'user' | 'model'; text: string }

export default function AiTutorChat({
  courseId, contextType, assignmentId, examId, title,
}: {
  courseId: string;
  contextType: SandboxContextType;
  assignmentId?: string;
  examId?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // Distingue "no habilitado para esta materia/modo" (403) de otros errores
  // — así no confundimos al alumno con un mensaje genérico cuando en
  // realidad su docente simplemente no activó el piloto todavía.
  const [disabledMessage, setDisabledMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-tutor-sandbox', {
        body: { courseId, contextType, assignmentId, examId, message: trimmed },
      });

      if (error) {
        // supabase-js entrega errores HTTP no-2xx aquí, no en `data` —
        // hay que leer el body real de la función para el mensaje específico.
        const context = (error as { context?: Response }).context;
        const body = await context?.json().catch(() => null);
        const status = context?.status;
        const message = body?.error ?? 'No se pudo contactar al tutor. Intenta de nuevo.';

        if (status === 403) {
          setDisabledMessage(message);
        } else {
          setMessages((prev) => [...prev, { role: 'model', text: `⚠️ ${message}` }]);
        }
        return;
      }

      setMessages((prev) => [...prev, { role: 'model', text: data.response }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'model', text: '⚠️ No se pudo contactar al tutor. Intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-[#8b5cf6] text-white px-5 py-3 rounded-[14px] font-bold hover:bg-[#7c3aed] transition-colors shadow-md"
      >
        <Sparkles size={18} /> {title ?? 'Tutor de IA'}
      </button>
    );
  }

  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-[20px] shadow-lg flex flex-col overflow-hidden" style={{ height: '480px' }}>
      {/* Header */}
      <div className="bg-[#8b5cf6] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 font-black">
          <GraduationCap size={20} /> {title ?? 'Tutor de IA'}
        </div>
        <button onClick={() => setOpen(false)} className="opacity-80 hover:opacity-100">
          <X size={20} />
        </button>
      </div>

      {/* Aviso de no habilitado — reemplaza el chat, no lo bloquea silenciosamente */}
      {disabledMessage ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-500 font-medium text-sm">
          {disabledMessage}
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-slate-400 text-sm text-center pt-8">
                Pregúntame lo que necesites — te voy a guiar con preguntas, no te voy a dar la respuesta directa.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-2 rounded-[14px] text-sm font-medium ${
                    m.role === 'user' ? 'bg-[#1B396A] text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-500 px-4 py-2 rounded-[14px] flex items-center gap-2 text-sm">
                  <Loader2 className="animate-spin" size={14} /> Pensando...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 p-3 flex items-center gap-2 flex-shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Escribe tu duda..."
              disabled={loading}
              className="flex-1 border border-slate-200 rounded-[10px] px-3 py-2 text-sm outline-none focus:border-[#8b5cf6]"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-[#8b5cf6] disabled:bg-slate-200 disabled:text-slate-400 text-white p-2 rounded-[10px] hover:bg-[#7c3aed] transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

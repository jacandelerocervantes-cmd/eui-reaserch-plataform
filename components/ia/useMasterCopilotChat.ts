"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Proposal {
  tool_name: string;
  params: Record<string, unknown>;
  summary: string;
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; proposal?: Proposal; resolved?: boolean };

interface Options {
  scope: string;
  courseId?: string;
  /** Acota qué herramientas puede proponer el orquestador (ej. ['material'] en la Bóveda). */
  categories?: string[];
  /** Unidad seleccionada en pantalla — el orquestador la usa por defecto si el docente no menciona otra. */
  defaultUnitId?: string;
}

export function useMasterCopilotChat({ scope, courseId, categories, defaultUnitId }: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const activeProposal = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant' && m.proposal && !m.resolved) return { index: i, proposal: m.proposal };
    }
    return null;
  })();

  // Devuelve la propuesta nueva (o null) para que quien llama pueda actuar
  // directo sobre el resultado de esta acción, en vez de vigilar
  // activeProposal con un efecto — evita el patrón de "sincronizar estado
  // ajeno" que dispara react-hooks/set-state-in-effect.
  const send = async (text: string, preferredTool?: string): Promise<Proposal | null> => {
    if (!text.trim() || loading) return null;
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('master-copilot-orchestrator', {
        body: {
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          scope, course_id: courseId, categories, default_unit_id: defaultUnitId,
          pending_proposal: activeProposal?.proposal ?? null,
          preferred_tool: preferredTool,
        },
      });
      if (error) throw error;

      // Si había una propuesta activa, esta respuesta la reemplaza/resuelve.
      const base = activeProposal
        ? nextMessages.map((m, i) => i === activeProposal!.index ? { ...m, resolved: true } : m)
        : nextMessages;

      if (data.type === 'proposal') {
        setMessages([...base, { role: 'assistant', content: data.summary, proposal: data }]);
        return data as Proposal;
      } else {
        setMessages([...base, { role: 'assistant', content: data.message ?? 'No entendí, ¿puedes reformular?' }]);
        return null;
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'El Master Copilot no pudo procesar la solicitud.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (msgIndex: number, proposal: Proposal, editedParams?: Record<string, unknown>) => {
    setExecuting(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('copilot-execute-tool', {
        body: { tool_name: proposal.tool_name, params: editedParams ?? proposal.params, course_id: courseId },
      });
      if (error || data?.success === false) throw new Error(data?.error || error?.message || 'No se pudo ejecutar la acción.');
      setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, resolved: true } : m));
      setMessages((prev) => [...prev, { role: 'assistant', content: '✅ Listo, se ejecutó correctamente.' }]);
      return true;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al ejecutar la acción.');
      return false;
    } finally {
      setExecuting(false);
    }
  };

  const discard = (msgIndex: number) => {
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, resolved: true } : m));
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Entendido, lo cancelé.' }]);
  };

  const reset = () => { setMessages([]); setErrorMsg(''); };

  return { messages, loading, executing, errorMsg, send, confirm, discard, reset, activeProposal };
}

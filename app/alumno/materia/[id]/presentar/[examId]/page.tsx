'use client';

import { use, useState, useMemo, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BookOpen, CheckCircle2, Loader2, AlertCircle, AlertTriangle,
  ChevronLeft, ChevronRight, Send, Save, ShieldAlert,
  Clock, RotateCcw,
} from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";
import { isAnswered, TYPE_LABELS, formatTime, type FetchResult } from './_lib/examHelpers';
import { fetchExamen } from './_services/fetchExamen';
import { ExamSplash } from './_components/ExamSplash';
import { AnswerArea } from './_components/AnswerArea';
import { useExamSession } from './_hooks/useExamSession';

function PresentarExamenContent({
  resource, courseId, examId, onRetry,
}: { resource: Promise<FetchResult>; courseId: string; examId: string; onRetry: () => void }) {
  const result = use(resource);
  const router = useRouter();
  const s = useExamSession({ result, examId });

  // ── Error de carga ──
  if (result.kind === 'redirect') return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={48} color="#1B396A" />
    </div>
  );

  if (result.kind === 'error') return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <p style={{ color: '#ef4444', fontWeight: 700 }}>{result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  // ── Bloqueado automáticamente por incidencias repetidas ──
  if (s.autoBlocked) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
        <div className="w-24 h-24 rounded-full flex items-center justify-center bg-red-100">
          <ShieldAlert className="text-red-500" size={48} />
        </div>
        <h2 className="text-3xl font-black text-[#1B396A]">Examen Bloqueado Automáticamente</h2>
        <p className="text-slate-500 font-medium max-w-sm">
          Se registraron 3 incidencias de integridad (cambios de pestaña, copiar, o salir de pantalla completa) — el examen se entregó con las respuestas que tenías hasta ese momento. Tu docente fue notificado.
        </p>
        <button
          onClick={() => router.push(`/alumno/materia/${courseId}`)}
          className="bg-[#1B396A] text-white px-8 py-3 rounded-[14px] font-bold hover:bg-blue-800 transition-colors"
        >
          Volver a la Materia
        </button>
      </div>
    );
  }

  // ── Ya entregado y calificado ──
  if (s.submitted) {
    const score = s.existingResponse?.final_score ?? s.existingResponse?.score_ia;
    const isGraded = s.existingResponse?.status === 'completed' || s.existingResponse?.status === 'ai_draft';
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isGraded ? 'bg-emerald-100' : 'bg-blue-100'}`}>
          {isGraded ? <CheckCircle2 className="text-emerald-500" size={48} /> : <Send className="text-blue-500" size={48} />}
        </div>
        <h2 className="text-3xl font-black text-[#1B396A]">
          {isGraded ? 'Examen Calificado' : 'Examen Entregado'}
        </h2>
        {isGraded && score != null && (
          <div className={`text-6xl font-black ${score >= 70 ? 'text-emerald-500' : 'text-red-500'}`}>
            {Math.round(score)}
          </div>
        )}
        <p className="text-slate-500 font-medium max-w-sm">
          {s.timeExpired ? 'Se agotó el tiempo — tu examen se entregó automáticamente con las respuestas que tenías.' :
            isGraded ? 'Tu examen ha sido revisado. Consulta tus calificaciones.' : 'Tu examen fue recibido correctamente.'}
        </p>
        <button
          onClick={() => router.push(`/alumno/materia/${courseId}`)}
          className="bg-[#1B396A] text-white px-8 py-3 rounded-[14px] font-bold hover:bg-blue-800 transition-colors"
        >
          Volver a la Materia
        </button>
      </div>
    );
  }

  // ── Sin preguntas ──
  if (s.questions.length === 0) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <BookOpen size={48} className="text-slate-300 mx-auto mb-4" />
      <p className="text-slate-400 font-medium">Este examen no tiene preguntas.</p>
    </div>
  );

  // ── Splash antes de iniciar ──
  if (!s.examStarted) return (
    <ExamSplash
      examTitle={s.exam?.title ?? 'Examen'}
      questionCount={s.questions.length}
      durationMinutes={s.exam?.duration_minutes ?? 60}
      onStart={s.handleStart}
    />
  );

  // ── Examen en curso — mismo diseño que "Simular" del docente ──
  const q = s.questions[s.current];
  const answeredCount = s.questions.filter(qq => isAnswered(qq, s.answers[qq.id])).length;
  const totalViolations = s.violations.tabSwitches + s.violations.copyAttempts + s.violations.fullscreenExits;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", backgroundColor: "#F8FAFC", userSelect: "none" }}>
      {/* Banner de violación */}
      {s.violationMsg && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#ef4444", color: "white", padding: "12px 24px", borderRadius: "100px", fontWeight: "800", boxShadow: "0 10px 20px rgba(239,68,68,0.3)", zIndex: 2000, display: "flex", alignItems: "center", gap: "10px" }}>
          <ShieldAlert size={18} /> {s.violationMsg}
        </div>
      )}

      {/* Header */}
      <header style={{ backgroundColor: "white", padding: "18px 40px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <div style={{ backgroundColor: "#1B396A", color: "white", padding: "10px 14px", borderRadius: "10px", fontWeight: "900", fontSize: "0.9rem" }}>EUI</div>
          <h2 style={{ color: "#1B396A", margin: 0, fontSize: "1.2rem", fontWeight: "800" }}>{s.exam?.title}</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
          {totalViolations > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: totalViolations >= 2 ? "#dc2626" : "#d97706", fontSize: "0.8rem", fontWeight: 800 }}>
              <ShieldAlert size={16} /> {totalViolations} incidencia(s)
            </div>
          )}
          <div style={{ backgroundColor: "#f1f5f9", padding: "10px 20px", borderRadius: "12px", color: (s.timeLeft ?? 0) < 300 ? "#ef4444" : "#1B396A", fontWeight: "900", display: "flex", alignItems: "center", gap: "10px", transition: "0.3s" }}>
            <Clock size={20} /> {formatTime(s.timeLeft ?? 0)}
          </div>
          <ExpandingButton
            icon={s.savingDraft ? Loader2 : Save}
            label="Borrador"
            loading={s.savingDraft}
            loadingLabel="Guardando..."
            onClick={s.handleSaveDraft}
            title="Guardar borrador"
            expanded
            size={40}
            radius={12}
            gap={8}
            padding="0 14px"
            fontWeight={700}
            fontSize="0.85rem"
            durationMs={300}
            colors={{ bg: "transparent", hoverBg: "#f1f5f9", text: "#64748b", hoverText: "#64748b", border: "#e2e8f0" }}
          />
          <button
            onClick={() => s.handleSubmit(false)}
            disabled={s.submitting}
            style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: "800", cursor: s.submitting ? "default" : "pointer", display: "flex", alignItems: "center", gap: "10px", opacity: s.submitting ? 0.6 : 1 }}
          >
            {s.submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Enviar Examen
          </button>
        </div>
      </header>

      {s.saveDraftError && (
        <div style={{ backgroundColor: "#fee2e2", borderBottom: "1px solid #fecaca", color: "#991b1b", padding: "10px 40px", fontWeight: "600", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={14} /> {s.saveDraftError}
        </div>
      )}

      <main style={{ flex: 1, padding: "60px 20px", display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: "850px" }}>

          {/* Barra de progreso segmentada */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            {s.questions.map((_, i) => (
              <div key={i} style={{ flex: 1, height: "8px", borderRadius: "10px", backgroundColor: i === s.current ? "#1B396A" : isAnswered(s.questions[i], s.answers[s.questions[i].id]) ? "#94a3b8" : "#e2e8f0", transition: "0.4s" }} />
            ))}
          </div>

          {/* Mapa de preguntas */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "40px" }}>
            {s.questions.map((qq, i) => (
              <button
                key={qq.id}
                onClick={() => s.setCurrent(i)}
                style={{
                  width: "36px", height: "36px", borderRadius: "10px", fontWeight: 800, fontSize: "0.85rem", border: "none", cursor: "pointer", transition: "background-color 0.2s",
                  backgroundColor: i === s.current ? "#1B396A" : isAnswered(qq, s.answers[qq.id]) ? "#dcfce7" : "#f1f5f9",
                  color: i === s.current ? "white" : isAnswered(qq, s.answers[qq.id]) ? "#166534" : "#64748b",
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <div style={{ backgroundColor: "white", padding: "50px", borderRadius: "32px", border: "1px solid #e2e8f0", boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontWeight: "900", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reactivo {s.current + 1} de {s.questions.length} · {TYPE_LABELS[q.q_type] ?? q.q_type}</span>
              <div style={{ backgroundColor: "#f8fafc", padding: "6px 14px", borderRadius: "10px", color: "#1B396A", fontWeight: "900", fontSize: "0.85rem" }}>VALOR: {q.points} PTS</div>
            </div>

            <h2 style={{ color: "#1B396A", marginBottom: "50px", lineHeight: "1.5", fontSize: "1.8rem", fontWeight: "800" }}>{q.content}</h2>

            <AnswerArea q={q} answers={s.answers} onAnswer={s.handleAnswer} />
          </div>

          {s.error && (
            <div style={{ marginTop: "24px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px", color: "#b91c1c", fontWeight: 600 }}>
              <AlertCircle size={20} /> {s.error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
            <button disabled={s.current === 0} onClick={() => s.setCurrent(prev => prev - 1)} style={{ background: "none", border: "none", color: s.current === 0 ? "#cbd5e1" : "#1B396A", fontWeight: "800", cursor: s.current === 0 ? "default" : "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "1rem" }}>
              <ChevronLeft size={24} /> Anterior
            </button>
            <button disabled={s.current === s.questions.length - 1} onClick={() => s.setCurrent(prev => prev + 1)} style={{ background: "none", border: "none", color: s.current === s.questions.length - 1 ? "#cbd5e1" : "#1B396A", fontWeight: "800", cursor: s.current === s.questions.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "1rem" }}>
              Siguiente <ChevronRight size={24} />
            </button>
          </div>

          {answeredCount < s.questions.length && (
            <p style={{ textAlign: "center", marginTop: "16px", color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>
              {answeredCount}/{s.questions.length} respondidas
            </p>
          )}
        </div>
      </main>

      <footer style={{ padding: "18px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", borderTop: "1px solid #e2e8f0", backgroundColor: "white", fontWeight: "700" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
          <AlertTriangle size={18} color="#f59e0b" /> MODO EXAMEN: tus respuestas se guardan al avanzar. Las incidencias de integridad son visibles para tu docente.
        </div>
      </footer>
    </div>
  );
}

export default function PresentarExamen() {
  const { id: courseId, examId } = useParams<{ id: string; examId: string }>();
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchExamen(courseId, examId, router, reloadKey), [courseId, examId, router, reloadKey]);

  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={48} color="#1B396A" />
      </div>
    }>
      <PresentarExamenContent key={reloadKey} resource={resource} courseId={courseId} examId={examId} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}

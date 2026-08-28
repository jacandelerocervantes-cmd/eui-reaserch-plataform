"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import {
  Wand2, CheckCircle2, MessageSquare, Save,
  ChevronLeft, ChevronRight, Loader2, ArrowLeft,
  AlertTriangle, ShieldAlert, ShieldCheck,
  Eye, Copy, Maximize2, Clock, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import {
  useRevisionExamen, useAuditoriaConsola,
  describeAnswer, type FetchResult,
} from "./_hooks/useRevisionExamen";

function AuditoriaContent({
  resource, courseId, examId, studentId, onRetry,
}: { resource: Promise<FetchResult>; courseId: string; examId: string; studentId: string; onRetry: () => void }) {
  const v = useAuditoriaConsola(resource, courseId, examId, studentId);

  if (!v.result.ok) return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: "700" }}>{v.result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { exam, response } = v;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "white" }}>

      {/* HEADER DE NAVEGACIÓN (Switcher de Alumnos) */}
      <div style={{ height: "85px", padding: "0 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button onClick={v.goBack} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}><ArrowLeft /></button>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "950", color: "#1B396A" }}>{response?.students?.apellido_paterno}, {response?.students?.nombres}</h2>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "900", textTransform: "uppercase" }}>{response?.students?.matricula} • Auditoría Certeza AIA</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px", marginRight: "10px" }}>
             <button onClick={() => v.prevStudentId && v.goToStudent(v.prevStudentId)} disabled={!v.prevStudentId} style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid #cbd5e1", background: "white", color: v.prevStudentId ? "#1B396A" : "#cbd5e1", cursor: v.prevStudentId ? "pointer" : "not-allowed" }}><ChevronLeft /></button>
             <button onClick={() => v.nextStudentId && v.goToStudent(v.nextStudentId)} disabled={!v.nextStudentId} style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid #cbd5e1", background: "white", color: v.nextStudentId ? "#1B396A" : "#cbd5e1", cursor: v.nextStudentId ? "pointer" : "not-allowed" }}><ChevronRight /></button>
          </div>
          <ExpandingButton icon={Save} label="Guardar y Siguiente" onClick={v.handleSave} loading={v.isSaving} variant="primary" size={52} radius={14} gap={10} padding="0 20px" collapsePadding fontWeight={900} bounce durationMs={400} iconSize={22} minWidth="52px" colors={{ bg: "#1B396A", hoverBg: "#1B396A", text: "white", hoverText: "white", border: "transparent" }} />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* PANEL CENTRAL: VISOR DE REACTIVOS (Evidencia) */}
        <div style={{ flex: 1, backgroundColor: "#f1f5f9", overflowY: "auto", padding: "40px" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "25px" }}>
            {exam?.questions?.map((q, idx: number) => {
              const isMatching = q.q_type === 'matching';
              const resAlumno = response?.answers?.[q.id];
              const scoreActual = v.questionScores[q.id] || 0;
              const comparacion = isMatching ? null : describeAnswer(q, resAlumno);
              const esCorrecto = !!comparacion?.correcto;

              return (
                <div key={q.id} style={{ backgroundColor: "white", borderRadius: "24px", padding: "35px", border: "1px solid #e2e8f0", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "25px" }}>
                    <span style={{ color: "#94a3b8", fontWeight: "900", fontSize: "0.8rem", textTransform: "uppercase" }}>Reactivo {idx + 1} • {q.q_type}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {isMatching ? null : esCorrecto ? <CheckCircle2 color="#10b981" size={18}/> : <AlertTriangle color="#f59e0b" size={18}/>}
                      <span style={{ fontWeight: "900", color: "#1B396A" }}>{scoreActual} / {q.points} PTS</span>
                    </div>
                  </div>

                  <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", lineHeight: 1.4 }}>{q.content}</h3>

                  {isMatching ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {((!Array.isArray(q.options) && q.options?.left) || []).map((l: string, li: number) => {
                        const correctRightIdx = (() => { try { return JSON.parse(q.correct_answer ?? "[]")[li]; } catch { return null; } })();
                        const alumnoRightIdx = (resAlumno as Record<number, number> | undefined)?.[li] ?? -1;
                        const right = (!Array.isArray(q.options) && q.options?.right) || [];
                        return (
                          <div key={li} style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "12px" }}>
                            <span style={{ fontWeight: "700", color: "#1B396A" }}>{l}</span>
                            <span style={{ color: alumnoRightIdx === correctRightIdx ? "#166534" : "#991b1b", fontWeight: "700" }}>
                              {right[alumnoRightIdx] ?? "(en blanco)"} {correctRightIdx != null && right[correctRightIdx] && alumnoRightIdx !== correctRightIdx && `(correcta: ${right[correctRightIdx]})`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
                      <div style={{ padding: "20px", backgroundColor: "#f8fafc", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase" }}>Respuesta Alumno</span>
                        <p style={{ margin: "8px 0 0", fontWeight: "700", color: "#1B396A" }}>{comparacion?.alumno}</p>
                      </div>
                      <div style={{ padding: "20px", backgroundColor: "#f0fdf4", borderRadius: "16px", border: "1px solid #dcfce7" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: "900", color: "#10b981", textTransform: "uppercase" }}>{q.q_type === 'open' ? 'Guía de Evaluación' : 'Clave Correcta'}</span>
                        <p style={{ margin: "8px 0 0", fontWeight: "700", color: "#166534" }}>{comparacion?.clave}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL DERECHO: CONSOLA DE AJUSTE (ADN Actividades) */}
        <div style={{ width: "450px", borderLeft: "1px solid #e2e8f0", backgroundColor: "#fdfdfd", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "40px" }}>

            {/* Score IA */}
            <div style={{ backgroundColor: "#f5f3ff", padding: "20px", borderRadius: "20px", marginBottom: "20px", border: "1px solid #ddd6fe", display: "flex", gap: "15px", alignItems: "center" }}>
              <div style={{ backgroundColor: "#8b5cf6", padding: "10px", borderRadius: "12px", color: "white" }}><Wand2 size={24}/></div>
              <div>
                <div style={{ fontWeight: "900", color: "#6b21a8", fontSize: "0.95rem" }}>Sugerencia IA: {response?.score_ia}</div>
                <div style={{ fontSize: "0.75rem", color: "#7c3aed" }}>Análisis semántico completado</div>
              </div>
            </div>

            {/* Panel Anti-Trampa */}
            {(() => {
              const ac = response?.metadata?.anti_cheat;
              if (!ac) return null;
              const total = ac.total_violations ?? 0;
              const isClean = total === 0;
              const isSuspect = total >= 3;
              return (
                <div style={{
                  backgroundColor: isClean ? "#f0fdf4" : isSuspect ? "#fef2f2" : "#fffbeb",
                  border: `1px solid ${isClean ? "#bbf7d0" : isSuspect ? "#fecaca" : "#fde68a"}`,
                  borderRadius: "20px", padding: "20px", marginBottom: "30px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                    {isClean
                      ? <ShieldCheck size={22} color="#10b981" />
                      : isSuspect
                        ? <ShieldAlert size={22} color="#ef4444" />
                        : <AlertTriangle size={22} color="#f59e0b" />}
                    <div>
                      <div style={{ fontWeight: "900", fontSize: "0.9rem", color: isClean ? "#166534" : isSuspect ? "#991b1b" : "#92400e" }}>
                        Integridad del Examen
                      </div>
                      <div style={{ fontSize: "0.7rem", fontWeight: "700", color: isClean ? "#15803d" : isSuspect ? "#dc2626" : "#b45309" }}>
                        {isClean ? "Sin incidencias registradas" : `${total} incidencia(s) detectada(s)`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.78rem", fontWeight: "700" }}>
                    {[
                      { icon: <Eye size={13}/>, label: "Cambios de pestaña", val: ac.tab_switches ?? 0 },
                      { icon: <Copy size={13}/>, label: "Intentos de copia", val: ac.copy_attempts ?? 0 },
                      { icon: <Maximize2 size={13}/>, label: "Salidas de fullscreen", val: ac.fullscreen_exits ?? 0 },
                      { icon: <Clock size={13}/>, label: "Duración (min)", val: ac.duration_minutes ?? "--" },
                    ].map(({ icon, label, val }) => (
                      <div key={label} style={{ backgroundColor: "white", padding: "10px 12px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px", color: "#475569" }}>
                        <span style={{ color: "#94a3b8" }}>{icon}</span>
                        <div>
                          <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                          <div style={{ fontSize: "1rem", fontWeight: "900", color: Number(val) > 0 && label !== "Duración (min)" ? "#dc2626" : "#1B396A" }}>{val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* SLIDERS DINÁMICOS POR REACTIVO */}
            <h4 style={{ color: "#1B396A", fontWeight: "900", marginBottom: "20px", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Ajuste por Reactivo</h4>
            {exam?.questions?.map((q, idx: number) => (
              <div key={q.id} style={{ marginBottom: "25px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontWeight: "700", color: "#64748b", fontSize: "0.85rem" }}>R{idx + 1}</span>
                  <input
                    type="number" value={v.questionScores[q.id] || 0}
                    onChange={(e) => v.setQuestionScores({...v.questionScores, [q.id]: parseInt(e.target.value) || 0})}
                    style={{ width: "50px", textAlign: "center", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: "800", color: "#1B396A" }}
                  />
                </div>
                <input
                  type="range" min="0" max={q.points} value={v.questionScores[q.id] || 0}
                  onChange={(e) => v.setQuestionScores({...v.questionScores, [q.id]: parseInt(e.target.value)})}
                  style={{ width: "100%", accentColor: "#1B396A", cursor: "pointer" }}
                />
              </div>
            ))}

            <div style={{ marginTop: "40px" }}>
              <div style={{ fontWeight: "900", color: "#1B396A", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}><MessageSquare size={18}/> Correcciones Técnicas</div>
              <textarea
                value={v.feedback} onChange={(e) => v.setFeedback(e.target.value)}
                placeholder="Escribe la retroalimentación técnica..."
                style={{ width: "100%", height: "150px", padding: "20px", borderRadius: "20px", border: "2px solid #f1f5f9", outline: "none", resize: "none" }}
              />
            </div>

            {/* BOTÓN ROJO DE ALERTA (TU REQUERIMIENTO) */}
            <button
              onClick={() => v.setManualAlert(!v.manualAlert)}
              style={{ width: "100%", marginTop: "20px", padding: "15px", borderRadius: "15px", border: "none", backgroundColor: v.manualAlert ? "#ef4444" : "#fef2f2", color: v.manualAlert ? "white" : "#ef4444", fontWeight: "800", cursor: "pointer", transition: "0.3s", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
            >
              <AlertTriangle size={18} /> {v.manualAlert ? "Entrega Marcada con Error" : "Marcar Error en Entrega"}
            </button>
          </div>

          {/* FOOTER DE NOTA FINAL */}
          <div style={{ padding: "35px", borderTop: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "900", textTransform: "uppercase" }}>Calificación Auditada</div>
                <div style={{ fontSize: "3rem", fontWeight: "1000", color: v.manualAlert ? "#ef4444" : "#1B396A" }}>{v.totalGrade.toFixed(1)}</div>
              </div>
              <ExpandingButton icon={CheckCircle2} label="Finalizar Auditoría" onClick={v.handleSave} variant="success" size={52} radius={14} gap={10} padding="0 20px" collapsePadding fontWeight={900} bounce durationMs={400} iconSize={22} minWidth="52px" colors={{ bg: "#10b981", hoverBg: "#10b981", text: "white", hoverText: "white", border: "transparent" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuditoriaExamenIndividual() {
  const { id: courseId, examId, studentId } = useParams() as { id: string; examId: string; studentId: string };
  const { resource, reloadKey, retry } = useRevisionExamen(courseId, examId, studentId);

  return (
    <Suspense fallback={<div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" size={48} color="#1B396A" /></div>}>
      <AuditoriaContent key={`${studentId}-${reloadKey}`} resource={resource} courseId={courseId} examId={examId} studentId={studentId} onRetry={retry} />
    </Suspense>
  );
}

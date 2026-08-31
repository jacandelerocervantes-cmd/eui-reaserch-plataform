'use client';

import { use, useState, useMemo, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  GraduationCap, Loader2, BookOpen, RotateCcw,
  CalendarCheck, FileText, Award
} from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";

export type GradeItem = {
  id: string;
  code: string; // "Asist.", "A1", "A2", "E1", etc.
  name: string;
  weight: number; // porcentaje o puntos máx
  score: number | null; // 0 - 100
  earnedPoints: number | null; // (score * weight / 100)
};

export type UnitPillar = {
  title: string;
  weight: number;
  earnedPoints: number | null;
  items: GradeItem[];
};

export type UnitGradeDetail = {
  unitId: string;
  unitTitle: string;
  unitNumber: number;
  isClosed: boolean;
  pillars: {
    asistencia: UnitPillar;
    actividades: UnitPillar;
    evaluaciones: UnitPillar;
  };
  totalEarnedPoints: number | null;
};

export type FetchResult =
  | {
      kind: "ok";
      courseName: string;
      unitDetails: UnitGradeDetail[];
      finalAvg: number | null;
    }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

async function fetchCalificaciones(
  courseId: string,
  router: ReturnType<typeof useRouter>,
  _reloadKey: number
): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/alumno/login'); return { kind: "redirect" }; }

    const { data: studentRec } = await supabase
      .from('students')
      .select('id, courses(title)')
      .ilike('correo', user.email ?? '')
      .eq('course_id', courseId)
      .single();

    if (!studentRec) { router.push('/alumno'); return { kind: "redirect" }; }

    const courseName = (studentRec as { courses: { title: string } | null }).courses?.title ?? 'Materia';
    const studentId = studentRec.id;

    const { data: units } = await supabase
      .from('course_units')
      .select('id, title, unit_number, is_closed')
      .eq('course_id', courseId)
      .order('unit_number', { ascending: true });

    if (!units?.length) {
      return { kind: "ok", courseName, unitDetails: [], finalAvg: null };
    }

    type UnitRow = { id: string; title: string; unit_number: number; is_closed: boolean };
    const unitList = units as UnitRow[];
    const unitIds = unitList.map((u) => u.id);

    const [
      { data: activitiesData },
      { data: assignmentsData },
      { data: examsData },
      { data: gradesData },
      { data: attendancesData },
      { data: evalData },
    ] = await Promise.all([
      supabase.from('activities').select('id, name, weight_percentage, unit_id').in('unit_id', unitIds),
      supabase.from('assignments').select('id, title, unit_id').eq('course_id', courseId),
      supabase.from('exams').select('id, title, unit_id').in('unit_id', unitIds),
      supabase.from('grades').select('activity_id, score').eq('student_id', studentId),
      supabase.from('validated_attendances').select('unit_number, status').eq('course_id', courseId).eq('student_id', studentId),
      supabase.from('evaluation_responses').select('exam_id, final_score, score_ia, status, exams(title)').eq('student_id', studentId),
    ]);

    type ActivityRow = { id: string; name: string; weight_percentage: number; unit_id: string };
    type AssignmentRow = { id: string; title: string; unit_id: string };
    type ExamRow = { id: string; title: string; unit_id: string };
    type GradeRow = { activity_id: string; score: number | null };
    type AttRow = { unit_number: number; status: number };
    type EvalRow = { exam_id: string; final_score: number | null; score_ia: number | null; status: string; exams: { title: string } | null };

    const activities = (activitiesData ?? []) as ActivityRow[];
    const assignments = (assignmentsData ?? []) as AssignmentRow[];
    const exams = (examsData ?? []) as ExamRow[];
    const attendances = (attendancesData ?? []) as AttRow[];
    const evaluations = (evalData ?? []) as EvalRow[];

    const gradeMap = new Map<string, number>(
      ((gradesData ?? []) as GradeRow[]).map((g) => [g.activity_id, Number(g.score ?? 0)])
    );

    const evalMap = new Map<string, number>(
      evaluations.map((e) => [e.exam_id, Number(e.final_score ?? e.score_ia ?? 0)])
    );

    let sumUnitAverages = 0;
    let countedUnits = 0;

    const unitDetails: UnitGradeDetail[] = unitList.map((u) => {
      const unitActs = activities.filter((a) => a.unit_id === u.id);
      const unitAsgns = assignments.filter((a) => a.unit_id === u.id);
      const unitExams = exams.filter((e) => e.unit_id === u.id);
      const unitAtts = attendances.filter((a) => a.unit_number === u.unit_number);

      // Pilares de la unidad
      const assistAct = unitActs.find((a) => a.name.toLowerCase().includes('asist'));
      const activAct = unitActs.find((a) =>
        a.name.toLowerCase().includes('activ') ||
        a.name.toLowerCase().includes('tarea') ||
        a.name.toLowerCase().includes('práct') ||
        a.name.toLowerCase().includes('pract') ||
        a.name.toLowerCase().includes('trabaj')
      );
      const evalAct = unitActs.find((a) =>
        a.name.toLowerCase().includes('eval') ||
        a.name.toLowerCase().includes('examen') ||
        a.name.toLowerCase().includes('cuest')
      );

      const assistWeight = assistAct?.weight_percentage ?? 10;
      const activWeight = activAct?.weight_percentage ?? 40;
      const evalWeight = evalAct?.weight_percentage ?? 50;

      // ── 1. PILAR ASISTENCIA ──
      const assistKey1 = assistAct ? assistAct.id : null;
      const assistKey2 = `${studentId}_asist_${u.id}`;
      const assistKey3 = assistAct ? `${studentId}_${assistAct.id}` : null;
      
      let assistScore: number | null = null;
      if (assistKey1 && gradeMap.has(assistKey1)) {
        assistScore = gradeMap.get(assistKey1)!;
      } else if (gradeMap.has(assistKey2)) {
        assistScore = gradeMap.get(assistKey2)!;
      } else if (assistKey3 && gradeMap.has(assistKey3)) {
        assistScore = gradeMap.get(assistKey3)!;
      } else if (unitAtts.length > 0) {
        const totalPoints = unitAtts.reduce((sum, r) => sum + r.status, 0);
        assistScore = Number(((totalPoints / unitAtts.length) * 100).toFixed(2));
      }

      const assistEarned = assistScore !== null
        ? Number((assistScore * (assistWeight / 100)).toFixed(2))
        : null;

      const asistenciaPillar: UnitPillar = {
        title: 'Asistencia',
        weight: assistWeight,
        earnedPoints: assistEarned,
        items: [
          {
            id: assistAct?.id || `asist-${u.id}`,
            code: 'Asist.',
            name: assistAct?.name || 'Asistencia a Clases',
            weight: assistWeight,
            score: assistScore,
            earnedPoints: assistEarned,
          }
        ]
      };

      // ── 2. PILAR ACTIVIDADES ──
      const defaultAsgnW = unitAsgns.length > 0 ? (activWeight / unitAsgns.length) : activWeight;
      const activItems: GradeItem[] = unitAsgns.length > 0
        ? unitAsgns.map((asg, idx) => {
            const k1 = asg.id;
            const k2 = `${studentId}_asgn_${asg.id}`;
            let score: number | null = null;
            if (gradeMap.has(k1)) score = gradeMap.get(k1)!;
            else if (gradeMap.has(k2)) score = gradeMap.get(k2)!;

            const w = Number(defaultAsgnW.toFixed(2));
            const earned = score !== null ? Number((score * (w / 100)).toFixed(2)) : null;

            return {
              id: asg.id,
              code: `A${idx + 1}`,
              name: asg.title,
              weight: w,
              score,
              earnedPoints: earned,
            };
          })
        : [
            (() => {
              const k1 = activAct?.id || null;
              const k2 = activAct ? `${studentId}_${activAct.id}` : null;
              let score: number | null = null;
              if (k1 && gradeMap.has(k1)) score = gradeMap.get(k1)!;
              else if (k2 && gradeMap.has(k2)) score = gradeMap.get(k2)!;

              const earned = score !== null ? Number((score * (activWeight / 100)).toFixed(2)) : null;
              return {
                id: activAct?.id || `act-${u.id}`,
                code: 'Actividades',
                name: activAct?.name || 'Actividades de Aprendizaje',
                weight: activWeight,
                score,
                earnedPoints: earned,
              };
            })()
          ];

      const scoredActiv = activItems.filter((it) => it.earnedPoints !== null);
      const activEarned = scoredActiv.length > 0
        ? Number(scoredActiv.reduce((sum, it) => sum + (it.earnedPoints ?? 0), 0).toFixed(2))
        : null;

      const actividadesPillar: UnitPillar = {
        title: 'Actividades',
        weight: activWeight,
        earnedPoints: activEarned,
        items: activItems,
      };

      // ── 3. PILAR EVALUACIONES ──
      const defaultExamW = unitExams.length > 0 ? (evalWeight / unitExams.length) : evalWeight;
      const evalItems: GradeItem[] = unitExams.length > 0
        ? unitExams.map((ex, idx) => {
            const k1 = ex.id;
            const k2 = `${studentId}_exam_${ex.id}`;
            let score: number | null = null;
            if (evalMap.has(k1)) score = evalMap.get(k1)!;
            else if (gradeMap.has(k1)) score = gradeMap.get(k1)!;
            else if (gradeMap.has(k2)) score = gradeMap.get(k2)!;

            const w = Number(defaultExamW.toFixed(2));
            const earned = score !== null ? Number((score * (w / 100)).toFixed(2)) : null;

            return {
              id: ex.id,
              code: `E${idx + 1}`,
              name: ex.title,
              weight: w,
              score,
              earnedPoints: earned,
            };
          })
        : [
            (() => {
              const k1 = evalAct?.id || null;
              const k2 = evalAct ? `${studentId}_${evalAct.id}` : null;
              let score: number | null = null;
              if (k1 && gradeMap.has(k1)) score = gradeMap.get(k1)!;
              else if (k2 && gradeMap.has(k2)) score = gradeMap.get(k2)!;

              const earned = score !== null ? Number((score * (evalWeight / 100)).toFixed(2)) : null;
              return {
                id: evalAct?.id || `eval-${u.id}`,
                code: 'Examen',
                name: evalAct?.name || 'Evaluación de Unidad',
                weight: evalWeight,
                score,
                earnedPoints: earned,
              };
            })()
          ];

      const scoredEval = evalItems.filter((it) => it.earnedPoints !== null);
      const evalEarned = scoredEval.length > 0
        ? Number(scoredEval.reduce((sum, it) => sum + (it.earnedPoints ?? 0), 0).toFixed(2))
        : null;

      const evaluacionesPillar: UnitPillar = {
        title: 'Evaluaciones',
        weight: evalWeight,
        earnedPoints: evalEarned,
        items: evalItems,
      };

      // ── TOTAL DE LA UNIDAD ──
      const hasAnyPoints = assistEarned !== null || activEarned !== null || evalEarned !== null;
      const totalEarnedPoints = hasAnyPoints
        ? Number(((assistEarned ?? 0) + (activEarned ?? 0) + (evalEarned ?? 0)).toFixed(2))
        : null;

      if (totalEarnedPoints !== null) {
        sumUnitAverages += totalEarnedPoints;
        countedUnits++;
      }

      return {
        unitId: u.id,
        unitTitle: u.title,
        unitNumber: u.unit_number,
        isClosed: u.is_closed,
        pillars: {
          asistencia: asistenciaPillar,
          actividades: actividadesPillar,
          evaluaciones: evaluacionesPillar,
        },
        totalEarnedPoints,
      };
    });

    const finalAvg = countedUnits > 0
      ? Number((sumUnitAverages / countedUnits).toFixed(2))
      : null;

    return { kind: "ok", courseName, unitDetails, finalAvg };
  } catch (err) {
    console.error('Error cargando calificaciones del alumno:', err);
    return { kind: "error", message: 'No se pudieron cargar tus calificaciones.' };
  }
}

function CalificacionesContent({ resource, onRetry }: { resource: Promise<FetchResult>; onRetry: () => void }) {
  const result = use(resource);

  if (result.kind === "redirect") return (
    <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={40} color="#1B396A" />
    </div>
  );

  if (result.kind === "error") return (
    <div style={{ height: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
      <p style={{ color: "#ef4444", fontWeight: "700" }}>{result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { courseName, unitDetails, finalAvg } = result;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* HEADER DE CALIFICACIONES */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "20px" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "900", margin: 0, letterSpacing: "-0.02em" }}>
            Mis Calificaciones
          </h1>
          <p style={{ color: "#64748b", fontSize: "1rem", fontWeight: "600", marginTop: "4px", margin: 0 }}>
            {courseName} · Boleta por Criterios de Evaluación
          </p>
        </div>

        {finalAvg !== null ? (
          <div style={{ textAlign: "right", backgroundColor: "white", padding: "14px 24px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
              Promedio General
            </div>
            <div style={{ fontSize: "2.6rem", fontWeight: 950, color: finalAvg >= 70 ? "#10b981" : "#ef4444", lineHeight: 1 }}>
              {finalAvg.toFixed(2)}
            </div>
            <div style={{ marginTop: "6px" }}>
              <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 800, backgroundColor: finalAvg >= 70 ? "#dcfce7" : "#fee2e2", color: finalAvg >= 70 ? "#166534" : "#991b1b" }}>
                {finalAvg >= 70 ? "APROBADO" : "REPROBADO"}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "right", backgroundColor: "#f8fafc", padding: "12px 20px", borderRadius: "14px", border: "1px dashed #cbd5e1" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Promedio General</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#94a3b8" }}>--</div>
            <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>En curso</span>
          </div>
        )}
      </div>

      {/* DETALLE POR UNIDADES */}
      {unitDetails.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "white", borderRadius: "20px", border: "2px dashed #e2e8f0" }}>
          <BookOpen size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: "0 0 4px 0" }}>No hay unidades de aprendizaje</h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0 }}>Tu docente aún no ha creado las unidades de esta materia.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {unitDetails.map((u) => {
            const hasScore = u.totalEarnedPoints !== null;
            return (
              <div
                key={u.unitId}
                style={{
                  backgroundColor: "white",
                  borderRadius: "20px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                }}
              >
                {/* Cabecera de la Unidad */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 24px",
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ backgroundColor: "#1B396A", color: "white", padding: "6px 12px", borderRadius: "10px", fontWeight: "900", fontSize: "0.9rem" }}>
                      U{u.unitNumber}
                    </span>
                    <div>
                      <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.15rem", fontWeight: "800" }}>
                        {u.unitTitle}
                      </h3>
                      <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: "600" }}>
                        {u.isClosed ? "🔒 Unidad cerrada" : "▶ Unidad activa"} · Valor: 100.00 pts
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>
                        Total Unidad
                      </div>
                      <div style={{ fontSize: "1.8rem", fontWeight: "950", color: hasScore ? (u.totalEarnedPoints! >= 70 ? "#10b981" : "#ef4444") : "#94a3b8", lineHeight: 1 }}>
                        {hasScore ? `${u.totalEarnedPoints!.toFixed(2)}` : "--"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid de los 3 Pilares: Asistencia, Actividades, Evaluaciones */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: "16px",
                    padding: "20px 24px",
                    backgroundColor: "#ffffff",
                  }}
                >
                  {/* PILAR 1: ASISTENCIA */}
                  <div style={{ backgroundColor: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <CalendarCheck size={18} color="#1B396A" />
                        <span style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.95rem" }}>Asistencia</span>
                      </div>
                      <span style={{ fontSize: "0.78rem", fontWeight: "800", color: "#64748b", backgroundColor: "#e2e8f0", padding: "2px 8px", borderRadius: "6px" }}>
                        {u.pillars.asistencia.weight.toFixed(2)} pts
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {u.pillars.asistencia.items.map((it) => (
                        <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.88rem" }}>
                          <div>
                            <div style={{ fontWeight: "700", color: "#334155" }}>{it.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                              {it.score !== null ? `Nota: ${it.score.toFixed(2)} / 100` : 'Sin registro todavía'}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: "900", color: it.earnedPoints !== null ? "#1B396A" : "#94a3b8", fontSize: "1rem" }}>
                              {it.earnedPoints !== null ? `+${it.earnedPoints.toFixed(2)}` : "--"}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700" }}>pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PILAR 2: ACTIVIDADES */}
                  <div style={{ backgroundColor: "#eff6ff", borderRadius: "14px", border: "1px solid #bfdbfe", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #bfdbfe", paddingBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <FileText size={18} color="#2563eb" />
                        <span style={{ fontWeight: "800", color: "#1e40af", fontSize: "0.95rem" }}>Actividades</span>
                      </div>
                      <span style={{ fontSize: "0.78rem", fontWeight: "800", color: "#2563eb", backgroundColor: "#dbeafe", padding: "2px 8px", borderRadius: "6px" }}>
                        {u.pillars.actividades.weight.toFixed(2)} pts
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "220px", overflowY: "auto" }}>
                      {u.pillars.actividades.items.map((it) => (
                        <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.88rem", padding: "4px 0", borderBottom: "1px dashed #dbeafe" }}>
                          <div style={{ paddingRight: "8px" }}>
                            <div style={{ fontWeight: "700", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "0.75rem", backgroundColor: "#2563eb", color: "white", padding: "1px 6px", borderRadius: "4px", fontWeight: "800" }}>{it.code}</span>
                              <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "160px" }} title={it.name}>{it.name}</span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              Vale {it.weight.toFixed(2)} pts {it.score !== null ? `· Nota: ${it.score.toFixed(2)}` : '· Pendiente'}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontWeight: "900", color: it.earnedPoints !== null ? "#2563eb" : "#94a3b8", fontSize: "0.95rem" }}>
                              {it.earnedPoints !== null ? `+${it.earnedPoints.toFixed(2)}` : "--"}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "700" }}>pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PILAR 3: EVALUACIONES */}
                  <div style={{ backgroundColor: "#fffbeb", borderRadius: "14px", border: "1px solid #fde68a", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #fde68a", paddingBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Award size={18} color="#d97706" />
                        <span style={{ fontWeight: "800", color: "#92400e", fontSize: "0.95rem" }}>Evaluaciones</span>
                      </div>
                      <span style={{ fontSize: "0.78rem", fontWeight: "800", color: "#d97706", backgroundColor: "#fef3c7", padding: "2px 8px", borderRadius: "6px" }}>
                        {u.pillars.evaluaciones.weight.toFixed(2)} pts
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "220px", overflowY: "auto" }}>
                      {u.pillars.evaluaciones.items.map((it) => (
                        <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.88rem", padding: "4px 0", borderBottom: "1px dashed #fef3c7" }}>
                          <div style={{ paddingRight: "8px" }}>
                            <div style={{ fontWeight: "700", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "0.75rem", backgroundColor: "#d97706", color: "white", padding: "1px 6px", borderRadius: "4px", fontWeight: "800" }}>{it.code}</span>
                              <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "160px" }} title={it.name}>{it.name}</span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              Vale {it.weight.toFixed(2)} pts {it.score !== null ? `· Nota: ${it.score.toFixed(2)}` : '· Pendiente'}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontWeight: "900", color: it.earnedPoints !== null ? "#d97706" : "#94a3b8", fontSize: "0.95rem" }}>
                              {it.earnedPoints !== null ? `+${it.earnedPoints.toFixed(2)}` : "--"}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "700" }}>pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CalificacionesAlumno() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchCalificaciones(courseId, router, reloadKey), [courseId, router, reloadKey]);

  return (
    <Suspense fallback={
      <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
      </div>
    }>
      <CalificacionesContent resource={resource} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}


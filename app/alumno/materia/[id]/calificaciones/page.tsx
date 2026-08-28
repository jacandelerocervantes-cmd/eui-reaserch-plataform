'use client';

import { use, useState, useMemo, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GraduationCap, Loader2, BookOpen, RotateCcw } from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";

type UnitGrade = {
  unitId: string;
  unitTitle: string;
  unitNumber: number;
  criteria: { name: string; weight: number; score: number | null }[];
  unitAvg: number | null;
};

type ExamGrade = {
  examId: string;
  examTitle: string;
  score: number | null;
  status: string;
};

type FetchResult =
  | { kind: "ok"; courseName: string; unitGrades: UnitGrade[]; examGrades: ExamGrade[]; finalAvg: number | null }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
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
      .select('id, title, unit_number')
      .eq('course_id', courseId)
      .order('unit_number', { ascending: true });

    if (!units?.length) {
      return { kind: "ok", courseName, unitGrades: [], examGrades: [], finalAvg: null };
    }

    type ActivityRow = { id: string; name: string; weight_percentage: number; unit_id: string };
    type UnitRow = { id: string; title: string; unit_number: number };
    type GradeRow = { activity_id: string; score: number | null };
    type EvalResponseRow = { exam_id: string; final_score: number | null; score_ia: number | null; status: string; exams: { title: string } | null };

    const { data: activities } = await supabase
      .from('activities')
      .select('id, name, weight_percentage, unit_id')
      .in('unit_id', (units as UnitRow[]).map((u) => u.id));

    const { data: grades } = await supabase
      .from('grades')
      .select('activity_id, score')
      .eq('student_id', studentId);

    const gradeMap = new Map<string, number>(((grades ?? []) as GradeRow[]).map((g) => [g.activity_id, Number(g.score ?? 0)]));

    let sumAvg = 0;
    let countAvg = 0;

    const built: UnitGrade[] = (units as UnitRow[]).map((u) => {
      const unitActs = ((activities ?? []) as ActivityRow[]).filter((a) => a.unit_id === u.id);
      const criteria: { name: string; weight: number; score: number | null }[] = unitActs.map((a) => ({
        name: a.name,
        weight: a.weight_percentage,
        score: gradeMap.has(a.id) ? (gradeMap.get(a.id) ?? null) : null,
      }));

      const scored = criteria.filter((c) => c.score !== null);
      let unitAvg: number | null = null;
      if (scored.length > 0) {
        const totalWeight = unitActs.reduce((s, a) => s + a.weight_percentage, 0);
        unitAvg = Math.round(
          unitActs.reduce((sum, a) => {
            const score = gradeMap.get(a.id) ?? 0;
            return sum + score * (a.weight_percentage / (totalWeight || 100));
          }, 0)
        );
        sumAvg += unitAvg;
        countAvg++;
      }

      return { unitId: u.id, unitTitle: u.title, unitNumber: u.unit_number, criteria, unitAvg };
    });

    const finalAvg = countAvg > 0 ? Math.round(sumAvg / countAvg) : null;

    const { data: evalData } = await supabase
      .from('evaluation_responses')
      .select('exam_id, final_score, score_ia, status, exams(title)')
      .eq('student_id', studentId);

    const examGrades: ExamGrade[] = ((evalData ?? []) as EvalResponseRow[]).map((e) => ({
      examId: e.exam_id,
      examTitle: e.exams?.title ?? 'Examen',
      score: e.final_score ?? e.score_ia,
      status: e.status,
    }));

    return { kind: "ok", courseName, unitGrades: built, examGrades, finalAvg };
  } catch (err) {
    console.error('Error cargando calificaciones:', err);
    return { kind: "error", message: 'No se pudieron cargar tus calificaciones de esta materia.' };
  }
}

function CalificacionesContent({ resource, onRetry }: { resource: Promise<FetchResult>; onRetry: () => void }) {
  const result = use(resource);

  if (result.kind === "redirect") return (
    <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={40} color="#1B396A" />
    </div>
  );

  if (result.kind === "error") return (
    <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
      <p style={{ color: "#ef4444", fontWeight: "700" }}>{result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { courseName, unitGrades, examGrades, finalAvg } = result;

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Mis Calificaciones</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>{courseName}</p>
        </div>
        {finalAvg !== null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Promedio General</div>
            <div style={{ fontSize: "3rem", fontWeight: 900, color: finalAvg >= 70 ? "#10b981" : "#ef4444", lineHeight: 1 }}>{finalAvg}</div>
            <span style={{ padding: "3px 10px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 800, backgroundColor: finalAvg >= 70 ? "#dcfce7" : "#fee2e2", color: finalAvg >= 70 ? "#166534" : "#991b1b" }}>
              {finalAvg >= 70 ? "APROBADO" : "REPROBADO"}
            </span>
          </div>
        )}
      </div>

      {/* Calificaciones por unidad */}
      <div>
        <h2 style={{ display: "flex", alignItems: "center", gap: "10px", color: "#1e293b", fontSize: "1.3rem", fontWeight: 800, marginBottom: "16px" }}>
          <GraduationCap size={22} color="#1B396A" /> Calificaciones por Unidad
        </h2>

        {unitGrades.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
            <BookOpen size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
            <p style={{ color: "#64748b", fontWeight: 600 }}>Aún no hay calificaciones registradas.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {unitGrades.map((u) => (
              <div key={u.unitId} style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{u.unitNumber}</span>
                    <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.1rem", fontWeight: 800 }}>{u.unitTitle}</h3>
                  </div>
                  {u.unitAvg !== null && (
                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: u.unitAvg >= 70 ? "#10b981" : "#ef4444" }}>{u.unitAvg}</div>
                  )}
                </div>
                <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {u.criteria.length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", fontStyle: "italic", margin: "8px 0" }}>Esta unidad no tiene criterios de evaluación configurados.</p>
                  ) : u.criteria.map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", borderBottom: i < u.criteria.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#334155", fontSize: "0.9rem" }}>{c.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700 }}>Vale {c.weight}%</div>
                      </div>
                      {c.score !== null ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "96px", height: "8px", borderRadius: "10px", backgroundColor: "#f1f5f9", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: "10px", backgroundColor: c.score >= 70 ? "#10b981" : "#f87171", width: `${Math.min(c.score, 100)}%` }} />
                          </div>
                          <span style={{ fontSize: "1.2rem", fontWeight: 900, minWidth: "44px", textAlign: "right", color: c.score >= 70 ? "#059669" : "#ef4444" }}>{c.score}</span>
                        </div>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontWeight: 700 }}>--</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exámenes */}
      {examGrades.length > 0 && (
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "10px", color: "#1e293b", fontSize: "1.3rem", fontWeight: 800, marginBottom: "16px" }}>
            <BookOpen size={22} color="#1B396A" /> Exámenes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {examGrades.map((e) => (
              <div key={e.examId} style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                <div>
                  <h4 style={{ margin: 0, color: "#1B396A", fontWeight: 800, fontSize: "1rem" }}>{e.examTitle}</h4>
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, color: e.status === 'completed' ? "#10b981" : e.status === 'ai_draft' ? "#7c3aed" : "#d97706" }}>
                    {e.status === 'completed' ? '● Calificado' : e.status === 'ai_draft' ? '✨ Revisión IA' : '○ Pendiente'}
                  </span>
                </div>
                {e.score !== null ? (
                  <div style={{ fontSize: "1.8rem", fontWeight: 900, color: e.score >= 70 ? "#10b981" : "#ef4444" }}>{Math.round(e.score)}</div>
                ) : (
                  <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#cbd5e1" }}>--</div>
                )}
              </div>
            ))}
          </div>
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
      <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
      </div>
    }>
      <CalificacionesContent resource={resource} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}

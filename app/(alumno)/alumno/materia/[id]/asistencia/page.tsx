"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Check, X, AlertTriangle, Loader2, ShieldAlert, BookOpen, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

type AttendanceRecord = { session_date: string; session_number: number; unit_number: number; status: number };
type CourseUnit = { id: string; unit_number: number; title: string; is_closed: boolean };
type FetchResult =
  | { kind: "ok"; units: CourseUnit[]; attendance: AttendanceRecord[] }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchAsistencia(
  courseId: string,
  router: ReturnType<typeof useRouter>,
  _reloadKey: number
): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/alumno/login'); return { kind: "redirect" }; }

    const { data: studentRec } = await supabase
      .from("students")
      .select("id")
      .ilike("correo", user.email?.trim() ?? "")
      .eq("course_id", courseId)
      .maybeSingle();

    const { data: unitsData } = await supabase
      .from("course_units").select("id, unit_number, title, is_closed").eq("course_id", courseId).order("unit_number");

    let attData: AttendanceRecord[] = [];
    if (studentRec?.id) {
      const { data } = await supabase
        .from("validated_attendances")
        .select("session_date, session_number, unit_number, status")
        .eq("course_id", courseId)
        .eq("student_id", studentRec.id)
        .order("session_date")
        .order("session_number");
      attData = (data ?? []) as AttendanceRecord[];
    }

    return { kind: "ok", units: unitsData ?? [], attendance: attData };
  } catch (err) {
    console.error('Error cargando asistencia:', err);
    return { kind: "error", message: 'No se pudo cargar tu asistencia de esta materia.' };
  }
}

function AsistenciaContent({ resource, onRetry }: { resource: Promise<FetchResult>; onRetry: () => void }) {
  const result = use(resource);
  const [selectedUnitNumber, setSelectedUnitNumber] = useState<number | null>(null);

  if (result.kind === "redirect") return (
    <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={40} color="#1B396A" />
    </div>
  );

  if (result.kind === "error") return (
    <div style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <p style={{ color: "#ef4444", fontWeight: "700" }}>{result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { units, attendance } = result;
  const unitAttendance = attendance.filter(a => a.unit_number === selectedUnitNumber);
  const total = unitAttendance.reduce((sum, r) => sum + r.status, 0);
  const pct = unitAttendance.length > 0 ? (total / unitAttendance.length) * 100 : 0;
  const derechoExamen = pct >= 80;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "800", margin: 0 }}>Mi Asistencia</h1>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "4px 0 0" }}>Solo lectura — reporte por unidad</p>
      </div>

      {units.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <select
            value={selectedUnitNumber ?? ""}
            onChange={(e) => setSelectedUnitNumber(Number(e.target.value))}
            style={{ padding: "9px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.9rem", fontWeight: "600", color: "#1B396A", backgroundColor: "white", cursor: "pointer", minWidth: "260px" }}
          >
            {units.map(u => (
              <option key={u.id} value={u.unit_number}>
                {u.is_closed ? "🔒" : "▶"} Unidad {u.unit_number} — {u.title}{u.is_closed ? "" : " (activa)"}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedUnitNumber === null ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
          <BookOpen size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: 0 }}>Selecciona una unidad arriba</h3>
          <p style={{ color: "#64748b" }}>Para ver tu asistencia.</p>
        </div>
      ) : (
        <>
          {!derechoExamen && unitAttendance.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "14px", padding: "16px 20px", marginBottom: "20px" }}>
              <ShieldAlert size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <p style={{ margin: 0, fontWeight: 800, color: "#991b1b" }}>Sin derecho a examen en esta unidad</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>
                  Tu asistencia es del {Math.round(pct)}% — se requiere mínimo 80%. Habla con tu docente si crees que es un error.
                </p>
              </div>
            </div>
          )}

          {unitAttendance.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "#94a3b8" }}>
              <p style={{ fontSize: "1rem", fontWeight: "600", margin: "0 0 4px" }}>Sin registros para esta unidad</p>
              <p style={{ fontSize: "0.85rem", margin: 0 }}>Cuando tu docente pase lista, aparecerá aquí.</p>
            </div>
          ) : (
            <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    {unitAttendance.map((r, i) => (
                      <th key={i} style={{ padding: "12px 10px", textAlign: "center", borderBottom: "2px solid #e2e8f0", fontSize: "0.7rem" }}>
                        {r.session_date.split('-').reverse().slice(0, 2).join('/')}<br />S{r.session_number}
                      </th>
                    ))}
                    <th style={{ padding: "12px 20px", borderBottom: "2px solid #e2e8f0" }}>%</th>
                    <th style={{ padding: "12px 20px", borderBottom: "2px solid #e2e8f0" }}>Examen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {unitAttendance.map((r, i) => (
                      <td key={i} style={{ textAlign: "center", padding: "10px 5px" }}>
                        {r.status === 1 ? <Check size={18} color="#10b981" /> : r.status === 0.5 ? <AlertTriangle size={18} color="#f59e0b" /> : <X size={18} color="#ef4444" />}
                      </td>
                    ))}
                    <td style={{ textAlign: "center", fontWeight: "bold", color: pct < 80 ? "#ef4444" : "#10b981" }}>{Math.round(pct)}%</td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ padding: "3px 8px", borderRadius: "10px", fontSize: "0.7rem", backgroundColor: derechoExamen ? "#dcfce7" : "#fee2e2", color: derechoExamen ? "#166534" : "#991b1b" }}>
                        {derechoExamen ? "SÍ" : "NO"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <p style={{ marginTop: "16px", fontSize: "0.78rem", color: "#94a3b8" }}>
            <Check size={11} style={{ display: "inline", verticalAlign: "middle", color: "#10b981" }} /> Asistió ·{" "}
            <AlertTriangle size={11} style={{ display: "inline", verticalAlign: "middle", color: "#f59e0b" }} /> Retardo ·{" "}
            <X size={11} style={{ display: "inline", verticalAlign: "middle", color: "#ef4444" }} /> Falta
          </p>
        </>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

export default function AsistenciaAlumno() {
  const { id: courseId } = useParams() as { id: string };
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchAsistencia(courseId, router, reloadKey), [courseId, router, reloadKey]);

  return (
    <Suspense fallback={
      <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
      </div>
    }>
      <AsistenciaContent resource={resource} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}

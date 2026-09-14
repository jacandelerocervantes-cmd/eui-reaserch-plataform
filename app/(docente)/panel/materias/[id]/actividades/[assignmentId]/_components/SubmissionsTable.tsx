"use client";

import { Loader2, FolderOpen, ShieldAlert, Lock, ChevronRight } from "lucide-react";

export type SubmissionRow = {
  id: string;
  subId: string | null;
  name: string;
  status: string;
  score: number | null;
  aiScore: number | null;
  aiFeedback: string | null;
  metadata: unknown;
  isLate: boolean;
  contentUrl: string | null;
  folderId: string | null;
};

export default function SubmissionsTable({
  loading, submissions, selectedIds, eligibleSubmissions, lockMap,
  handleSelectAll, handleToggleSelect, courseId, assignmentId, router,
}: {
  loading: boolean;
  submissions: SubmissionRow[];
  selectedIds: string[];
  eligibleSubmissions: SubmissionRow[];
  lockMap: Map<string, boolean>;
  handleSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleToggleSelect: (id: string) => void;
  courseId: string;
  assignmentId: string;
  router: ReturnType<typeof import("next/navigation").useRouter>;
}) {
  return (
    <div style={{ backgroundColor: "white", borderRadius: "28px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "20px 24px", width: "50px" }}>
              <input
                type="checkbox"
                checked={selectedIds.length === eligibleSubmissions.length && eligibleSubmissions.length > 0}
                onChange={handleSelectAll}
                style={{ width: "20px", height: "20px", cursor: "pointer" }}
              />
            </th>
            <th style={{ padding: "20px 24px", textAlign: "left", color: "#1B396A", fontSize: "0.8rem", fontWeight: "800", textTransform: "uppercase" }}>Estudiante</th>
            <th style={{ padding: "20px 24px", textAlign: "left", color: "#1B396A", fontSize: "0.8rem", fontWeight: "800", textTransform: "uppercase" }}>Estado Revisión</th>
            <th style={{ padding: "20px 24px", textAlign: "center", color: "#1B396A", fontSize: "0.8rem", fontWeight: "800", textTransform: "uppercase" }}>Nota</th>
            <th style={{ padding: "20px 24px", width: "40px" }}></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} style={{ padding: "60px", textAlign: "center" }}>
                <Loader2 className="animate-spin" size={28} color="#94a3b8" style={{ margin: "0 auto" }} />
              </td>
            </tr>
          ) : submissions.map((s) => {
            const isSelected = selectedIds.includes(s.id);
            const isNoSubmission = s.status === 'no_submission';
            const isLocked = lockMap.get(s.id) ?? false;
            const isClickable = !isNoSubmission && !isLocked;

            return (
              <tr
                key={s.id}
                onClick={() => isClickable && s.subId && router.push(`/panel/materias/${courseId}/actividades/${assignmentId}/auditoria/${s.subId}`)}
                title={isLocked ? "Publica la calificación del alumno anterior antes de continuar" : undefined}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  cursor: isClickable ? "pointer" : "default",
                  backgroundColor: isSelected ? "#f0f7ff" : "transparent",
                  opacity: isNoSubmission || isLocked ? 0.6 : 1,
                  transition: "all 0.2s"
                }}
              >
                <td style={{ padding: "20px 24px" }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    disabled={isNoSubmission}
                    checked={isSelected}
                    onChange={() => handleToggleSelect(s.id)}
                    style={{ width: "20px", height: "20px", cursor: isNoSubmission ? "default" : "pointer" }}
                  />
                </td>
                <td style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "1.1rem" }}>{s.name}</div>
                    {s.folderId && (
                      <a
                        href={`https://drive.google.com/drive/folders/${s.folderId}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Abrir carpeta personal en Drive"
                        style={{ color: "#94a3b8", display: "flex" }}
                      >
                        <FolderOpen size={16} />
                      </a>
                    )}
                  </div>
                  {s.isLate && <div style={{ color: "#ef4444", fontSize: "0.7rem", fontWeight: "950", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}><ShieldAlert size={12}/> ENTREGA TARDÍA</div>}
                </td>
                <td style={{ padding: "20px 24px" }}>
                  <span style={{
                    backgroundColor: s.status === 'completed' ? "#dcfce7" : s.status === 'ai_draft' ? "#f3e8ff" : s.status === 'ai_queued' ? "#fef9c3" : s.status === 'no_submission' ? "#f1f5f9" : "#e0f2fe",
                    color: s.status === 'completed' ? "#166534" : s.status === 'ai_draft' ? "#6b21a8" : s.status === 'ai_queued' ? "#92400e" : s.status === 'no_submission' ? "#64748b" : "#075985",
                    padding: "6px 14px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "800"
                  }}>
                    {s.status === 'completed' ? "● Calificado" : s.status === 'ai_draft' ? "✨ Borrador IA (temporal)" : s.status === 'ai_queued' ? "En cola IA" : s.status === 'no_submission' ? "Sin entrega" : "Entregado"}
                  </span>
                </td>
                <td style={{ padding: "20px 24px", textAlign: "center" }}>
                  <div style={{ fontWeight: "1000", color: "#1B396A", fontSize: "1.4rem" }}>{s.score || "--"}</div>
                </td>
                <td style={{ padding: "20px 24px" }}>
                  {isLocked ? <Lock size={18} color="#cbd5e1" /> : !isNoSubmission && <ChevronRight size={20} color="#cbd5e1" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

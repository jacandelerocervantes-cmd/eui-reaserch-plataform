"use client";

import {
  User, Users, UsersRound, FileUp, Cloud, FileText, Table,
  Presentation, Gamepad2, Grid3X3, Search, Play, Sparkles, Loader2, CheckCircle2
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import OptionCard from "./OptionCard";
import type { PuzzleData } from "./PuzzlePreviewModal";

type ActivityFormData = {
  title: string; description: string; unit_id: string; criteria_id: string;
  format: string; submission_type: string; soft_deadline: string; hard_deadline: string;
  late_penalty_percent: number;
};
type UnitOption = { id: string; unit_number: number; title: string };
type TeamOption = { id: string; name: string; memberCount: number };

export default function ActivityFormLeftColumn({
  formData, setFormData, selectedTeamIds, teams, units, setShowTeamPicker,
  puzzleData, isGeneratingPuzzle, handleGeneratePuzzle, setShowPuzzlePreview,
}: {
  formData: ActivityFormData;
  setFormData: (v: ActivityFormData) => void;
  selectedTeamIds: string[];
  teams: TeamOption[];
  units: UnitOption[];
  setShowTeamPicker: (v: boolean) => void;
  puzzleData?: PuzzleData | null;
  isGeneratingPuzzle?: boolean;
  handleGeneratePuzzle?: (type?: string) => void;
  setShowPuzzlePreview?: (v: boolean) => void;
}) {
  const isWorkspace = ['doc', 'sheet', 'slide'].includes(formData.submission_type);
  const isPuzzle = formData.submission_type.startsWith('puzzle_');

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Información General</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>
              Unidad Temática
            </label>
            <select
              required
              value={formData.unit_id}
              onChange={e => setFormData({ ...formData, unit_id: e.target.value, criteria_id: "" })}
              style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "1rem", fontWeight: "700", color: "#1B396A", backgroundColor: "#f8fafc", cursor: "pointer", outline: "none" }}
            >
              <option value="">Selecciona una unidad...</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>Unidad {u.unit_number}: {u.title}</option>
              ))}
            </select>
          </div>
          <input required type="text" placeholder="Título de la actividad" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "1.05rem", fontWeight: "600", color: "#334155", outline: "none", transition: "border 0.2s" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
          <textarea rows={5} placeholder="Instrucciones detalladas" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "1rem", color: "#334155", outline: "none", resize: "none", transition: "border 0.2s" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
        </div>
      </div>

      <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Modalidad y Entorno de Entrega</h3>

        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "0.85rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "10px" }}>Modalidad de Trabajo</p>
          <div style={{ display: "flex", gap: "12px" }}>
            <OptionCard icon={User} label="Individual" selected={formData.format === 'individual'} onClick={() => setFormData({...formData, format: 'individual'})} />
            <OptionCard icon={Users} label="Por Equipos" selected={formData.format === 'equipo'} onClick={() => setFormData({...formData, format: 'equipo'})} />
          </div>

          {formData.format === 'equipo' && (
            <div style={{ marginTop: "14px", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "0.85rem", color: "#334155", fontWeight: "600" }}>
                  {selectedTeamIds.length === 0
                    ? "Ningún equipo seleccionado"
                    : `${selectedTeamIds.length} equipo(s) seleccionado(s)`}
                </span>
                <ExpandingButton expanded type="button" icon={UsersRound} label="Seleccionar Equipos" onClick={() => setShowTeamPicker(true)} variant="default" size={42} radius={10} gap={10} padding="0 16px" fontWeight={600} fontSize="0.9rem" durationMs={300} />
              </div>
              {selectedTeamIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                  {teams.filter(t => selectedTeamIds.includes(t.id)).map(t => (
                    <span key={t.id} style={{ fontSize: "0.75rem", fontWeight: "700", color: "#1B396A", backgroundColor: "#eff6ff", padding: "4px 10px", borderRadius: "20px" }}>
                      {t.name} ({t.memberCount})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "10px" }}>Tipo de Entrega</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: isWorkspace || isPuzzle ? "16px" : "0" }}>
            <OptionCard
              icon={FileUp}
              label="Archivo"
              selected={formData.submission_type === 'file'}
              onClick={() => setFormData({...formData, submission_type: 'file'})}
            />
            <OptionCard
              icon={Cloud}
              label="Workspace"
              selected={isWorkspace}
              onClick={() => setFormData({...formData, submission_type: 'doc'})}
            />
            <OptionCard
              icon={Gamepad2}
              label="Puzzle IA"
              selected={isPuzzle}
              onClick={() => setFormData({...formData, submission_type: 'puzzle_crossword'})}
            />
          </div>

          {/* SUB-OPCIONES WORKSPACE */}
          {isWorkspace && (
            <div style={{ display: "flex", gap: "12px", animation: "fadeIn 0.3s ease-out", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
              <OptionCard icon={FileText} label="Doc" selected={formData.submission_type === 'doc'} onClick={() => setFormData({...formData, submission_type: 'doc'})} />
              <OptionCard icon={Table} label="Sheet" selected={formData.submission_type === 'sheet'} onClick={() => setFormData({...formData, submission_type: 'sheet'})} />
              <OptionCard icon={Presentation} label="Slide" selected={formData.submission_type === 'slide'} onClick={() => setFormData({...formData, submission_type: 'slide'})} />
            </div>
          )}

          {/* SUB-OPCIONES PUZZLE / GAMIFICACIÓN */}
          {isPuzzle && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", animation: "fadeIn 0.3s ease-out", padding: "18px", backgroundColor: "#f8fafc", borderRadius: "14px", border: "1px dashed #cbd5e1" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                <OptionCard
                  icon={Grid3X3}
                  label="Crucigrama"
                  selected={formData.submission_type === 'puzzle_crossword'}
                  onClick={() => setFormData({...formData, submission_type: 'puzzle_crossword'})}
                />
                <OptionCard
                  icon={Search}
                  label="Sopa de Letras"
                  selected={formData.submission_type === 'puzzle_wordsearch'}
                  onClick={() => setFormData({...formData, submission_type: 'puzzle_wordsearch'})}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", paddingTop: "8px", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {puzzleData ? (
                    <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#16a34a", display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={16} /> Puzzle listo ({formData.submission_type === 'puzzle_crossword' ? `${puzzleData.words?.length || 0} conceptos` : '12x12'})
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600" }}>
                      * Haz clic en generar para crear el tablero con IA
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  {puzzleData && setShowPuzzlePreview && (
                    <button
                      type="button"
                      onClick={() => setShowPuzzlePreview(true)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: "white",
                        color: "#1B396A",
                        fontWeight: "700",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Play size={15} /> Probar Puzzle
                    </button>
                  )}

                  {handleGeneratePuzzle && (
                    <button
                      type="button"
                      disabled={isGeneratingPuzzle}
                      onClick={() => handleGeneratePuzzle(formData.submission_type)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "10px",
                        border: "none",
                        backgroundColor: "#1B396A",
                        color: "white",
                        fontWeight: "800",
                        fontSize: "0.85rem",
                        cursor: isGeneratingPuzzle ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {isGeneratingPuzzle ? (
                        <>
                          <Loader2 size={15} className="animate-spin" /> Generando...
                        </>
                      ) : (
                        <>
                          <Sparkles size={15} /> Generar con IA
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

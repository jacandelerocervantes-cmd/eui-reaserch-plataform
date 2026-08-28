"use client";

import {
  Sparkles, Save, Layers, Play, Ban, AlertCircle,
  Plus, Loader2
} from "lucide-react";
import SlideCard from "./_components/SlideCard";
import CriterioCard from "./_components/CriterioCard";
import SimulacionModal from "./_components/SimulacionModal";
import { TYPES, useCrearMaterial } from "./_hooks/useCrearMaterial";

export default function CrearMaterialPage() {
  const m = useCrearMaterial();

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#F8FAFC", overflow: "hidden" }}>

      {/* PANEL CENTRAL: CONTENIDO */}
      <div style={{ flex: 1, padding: "30px 40px", overflowY: "auto" }}>

        {/* BARRA DE IA INTERACTIVA — igual espíritu que Evaluaciones: un solo
            cuadro, se puede llamar varias veces para generar/agregar/ajustar. */}
        <div style={{ backgroundColor: "white", padding: "16px 20px", borderRadius: "18px", border: "1px solid #e2e8f0", marginBottom: "30px", boxShadow: "0 4px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <Sparkles color="#2563eb" size={20} style={{ marginTop: "9px", flexShrink: 0 }} />
            <textarea
              value={m.prompt}
              onChange={(e) => m.setPrompt(e.target.value)}
              onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }}
              placeholder={!m.unitId ? "Selecciona una unidad en Propiedades primero..." : m.tipo.placeholder}
              rows={1}
              disabled={!m.unitId}
              style={{ flex: 1, border: "none", outline: "none", fontWeight: "600", fontSize: "1rem", color: "#1B396A", resize: "none", fontFamily: "inherit", padding: "8px 0", minHeight: "24px", maxHeight: "240px", overflowY: "auto", backgroundColor: "transparent" }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); m.handleGenerate(); } }}
            />
            <button
              onClick={m.handleGenerate}
              disabled={!m.prompt.trim() || !m.unitId || m.loading}
              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "8px", backgroundColor: m.prompt.trim() && m.unitId ? "#1B396A" : "#cbd5e1", color: "white", border: "none", borderRadius: "12px", padding: "10px 16px", fontWeight: 700, cursor: m.prompt.trim() && m.unitId ? "pointer" : "not-allowed" }}
            >
              {m.loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {m.loading ? "Pensando..." : "Generar"}
            </button>
          </div>
        </div>

        {m.errorMsg && (
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "12px 16px", backgroundColor: "#fef2f2", borderRadius: "12px", marginBottom: "20px" }}>
            <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: "1px" }} />
            <p style={{ color: "#dc2626", fontSize: "0.85rem", margin: 0 }}>{m.errorMsg}</p>
          </div>
        )}

        {/* CONTENIDO ESPECÍFICO POR TIPO */}
        {m.tipo.tool === "crear_material_boveda" && (
          <textarea
            value={m.contenido}
            onChange={(e) => m.setContenido(e.target.value)}
            placeholder="El contenido generado aparecerá aquí — también puedes escribirlo o editarlo directo."
            style={{ width: "100%", minHeight: "400px", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", backgroundColor: "white", fontFamily: "Georgia, serif", fontSize: "0.95rem", color: "#1e293b", lineHeight: "1.7", resize: "vertical", outline: "none", boxSizing: "border-box" }}
          />
        )}

        {m.tipo.tool === "crear_presentacion_slides" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px", paddingBottom: "40px" }}>
            {m.slides.map((s, idx) => (
              <SlideCard key={idx} slide={s} index={idx} onUpdate={(updated) => m.setSlides(m.slides.map((x, i) => i === idx ? updated : x))} onDelete={() => m.setSlides(m.slides.filter((_, i) => i !== idx))} />
            ))}
            <button onClick={() => m.setSlides([...m.slides, { titulo: "", bullets: [""] }])} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "16px", borderRadius: "16px", border: "2px dashed #cbd5e1", background: "none", cursor: "pointer", color: "#64748b", fontWeight: 700 }}>
              <Plus size={18} /> Agregar diapositiva manual
            </button>
            {m.slides.length === 0 && (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>Sin diapositivas todavía. Pídele a la IA que genere la presentación arriba.</p>
            )}
          </div>
        )}

        {m.tipo.tool === "crear_rubrica_sheet" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px", paddingBottom: "40px" }}>
            <div style={{ backgroundColor: m.totalWeight === 100 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${m.totalWeight === 100 ? "#bbf7d0" : "#fecaca"}`, borderRadius: "12px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, color: m.totalWeight === 100 ? "#16a34a" : "#dc2626", fontSize: "0.85rem" }}>Total: {m.totalWeight}% {m.totalWeight !== 100 && "(debe ser 100%)"}</span>
            </div>
            {m.criterios.map((c, idx) => (
              <CriterioCard key={idx} criterio={c} index={idx} onUpdate={(updated) => m.setCriterios(m.criterios.map((x, i) => i === idx ? updated : x))} onDelete={() => m.setCriterios(m.criterios.filter((_, i) => i !== idx))} />
            ))}
            <button onClick={() => m.setCriterios([...m.criterios, { name: "", description: "", weight: 0 }])} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "16px", borderRadius: "16px", border: "2px dashed #cbd5e1", background: "none", cursor: "pointer", color: "#64748b", fontWeight: 700 }}>
              <Plus size={18} /> Agregar criterio manual
            </button>
            {m.criterios.length === 0 && (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>Sin criterios todavía. Pídele a la IA que genere la rúbrica arriba.</p>
            )}
          </div>
        )}
      </div>

      {/* PANEL DERECHO: PROPIEDADES — Guardar/Cancelar fijos abajo */}
      <div style={{ width: "380px", backgroundColor: "white", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", height: "100vh" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "35px 35px 0 35px" }}>
          <h3 style={{ color: "#1B396A", marginBottom: "30px", display: "flex", alignItems: "center", gap: "12px", fontWeight: "950", fontSize: "1.3rem" }}>
            <Layers size={22} /> Propiedades
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Tipo de Material</label>
              <div style={{ display: "flex", gap: "6px", backgroundColor: "#f1f5f9", padding: "5px", borderRadius: "14px" }}>
                {TYPES.map((t) => (
                  <button
                    key={t.tool}
                    onClick={() => m.setTipo(t)}
                    title={t.label}
                    style={{ flex: 1, padding: "12px 4px", borderRadius: "10px", border: "none", cursor: "pointer", backgroundColor: m.tipo.tool === t.tool ? "white" : "transparent", transition: "0.3s", boxShadow: m.tipo.tool === t.tool ? "0 4px 6px rgba(0,0,0,0.05)" : "none", color: m.tipo.tool === t.tool ? "#1B396A" : "#64748b", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}
                  >
                    <t.icon size={16} />
                    <span style={{ fontSize: "0.65rem", fontWeight: 900 }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Título</label>
              <input
                value={m.titulo} onChange={(e) => m.setTitulo(e.target.value)}
                placeholder="Ej: Normalización de Bases de Datos"
                style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem", color: "#1B396A", fontWeight: "600", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Unidad</label>
              <select value={m.unitId} onChange={(e) => m.setUnitId(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.95rem", color: "#1B396A", fontWeight: "600", backgroundColor: "white", cursor: "pointer" }}>
                <option value="">Selecciona una unidad...</option>
                {m.units.map((u) => <option key={u.id} value={u.id}>U{u.unit_number}: {u.title}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: "20px 35px 35px 35px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            onClick={() => m.setIsSimulating(true)}
            disabled={m.tipo.tool === "crear_rubrica_sheet" ? m.criterios.length === 0 : m.tipo.tool === "crear_presentacion_slides" ? m.slides.length === 0 : !m.contenido.trim()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", borderRadius: "12px", border: "1px solid #cbd5e1", backgroundColor: "white", color: "#1B396A", fontWeight: 800, cursor: "pointer" }}
          >
            <Play size={16} /> Simular
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => m.router.back()} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", borderRadius: "12px", border: "1px solid #fee2e2", backgroundColor: "white", color: "#ef4444", fontWeight: 800, cursor: "pointer" }}>
              <Ban size={16} /> Cancelar
            </button>
            <button
              onClick={m.handleSave}
              disabled={!m.canSave}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", borderRadius: "12px", border: "none", backgroundColor: m.canSave ? "#1B396A" : "#cbd5e1", color: "white", fontWeight: 800, cursor: m.canSave ? "pointer" : "not-allowed" }}
            >
              {m.isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {m.isSaving ? "Creando..." : "Guardar"}
            </button>
          </div>
          {m.tipo.tool === "crear_rubrica_sheet" && m.totalWeight !== 100 && m.criterios.length > 0 && (
            <div style={{ color: "#dc2626", fontSize: "0.75rem", textAlign: "center", fontWeight: "900", marginTop: "4px", backgroundColor: "#fef2f2", padding: "10px", borderRadius: "10px", border: "1px solid #fee2e2" }}>
              <AlertCircle size={14} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
              Los pesos deben sumar 100% (van {m.totalWeight}%).
            </div>
          )}
        </div>
      </div>

      {m.isSimulating && <SimulacionModal tipo={m.tipo} titulo={m.titulo} contenido={m.contenido} slides={m.slides} onClose={() => m.setIsSimulating(false)} />}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

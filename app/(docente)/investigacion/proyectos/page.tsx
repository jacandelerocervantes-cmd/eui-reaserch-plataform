"use client";

import React, { useState } from "react";
import { Plus, Search, Briefcase, Clock, Globe, ShieldCheck, ChevronDown, Sparkles, Loader2, ArrowRight, X, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useProyectosInvestigacion, type Proyecto, type NewProjectForm, type NewProjectPayload } from "./_hooks/useProyectosInvestigacion";

const STATUS_COLOR: Record<string, string> = { 'En Ejecución': '#f59e0b', 'Finalizado': '#10b981', 'Propuesta': '#3b82f6' };

const ProjectCard = ({ project, onUpdateStatus, onNavigate }: { project: Proyecto; onUpdateStatus: (id: string, s: string) => void; onNavigate: (id: string) => void }) => {
  const [hovered, setIsHovered] = useState(false);
  const color = STATUS_COLOR[project.status] ?? '#94a3b8';
  const cycleStatus: Record<string, string> = { 'Propuesta': 'En Ejecución', 'En Ejecución': 'Finalizado', 'Finalizado': 'Propuesta' };

  return (
    <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: hovered ? `0 20px 25px -5px ${color}20` : "0 4px 6px -1px rgba(0,0,0,0.05)", transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden", display: "flex", flexDirection: "column", transform: hovered ? "translateY(-6px)" : "none" }}>
      <div style={{ height: "6px", backgroundColor: color }} />
      <div style={{ padding: "24px", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
          <button onClick={e => { e.stopPropagation(); onUpdateStatus(project.id, cycleStatus[project.status]); }}
            style={{ fontSize: "0.7rem", fontWeight: "900", color, backgroundColor: `${color}15`, padding: "4px 10px", borderRadius: "8px", textTransform: "uppercase", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            {project.status} <ChevronDown size={12} />
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            {project.es_publico && <span style={{ backgroundColor: "#f1f5f9", padding: "4px", borderRadius: "6px", display: "flex" }}><Globe size={16} color="#64748b" /></span>}
            {project.con_financiamiento && <span style={{ backgroundColor: "#ecfdf5", padding: "4px", borderRadius: "6px", display: "flex" }}><ShieldCheck size={16} color="#10b981" /></span>}
          </div>
        </div>
        <h3 style={{ margin: "0 0 12px 0", color: "#1B396A", fontSize: "1.1rem", fontWeight: "900", lineHeight: 1.3 }}>{project.titulo}</h3>
        {project.descripcion && <p style={{ margin: "0 0 12px 0", color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>{project.descripcion.slice(0, 100)}{project.descripcion.length > 100 ? '...' : ''}</p>}
        <div style={{ display: "flex", gap: "8px", color: "#64748b", fontSize: "0.8rem", fontWeight: "700" }}>
          {project.presupuesto && <div style={{ backgroundColor: "#f8fafc", padding: "3px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}><ShieldCheck size={12} /> ${Number(project.presupuesto).toLocaleString()}</div>}
          {project.fecha_inicio && <div style={{ backgroundColor: "#f8fafc", padding: "3px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> {new Date(project.fecha_inicio).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}</div>}
        </div>
      </div>
      <div style={{ maxHeight: hovered ? "160px" : "0px", opacity: hovered ? 1 : 0, padding: hovered ? "0 24px 24px" : "0 24px", transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden" }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", marginBottom: "16px" }} />
        {project.proximo_hito && (
          <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "12px", marginBottom: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>Próximo Hito</div>
            <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1e293b", display: "flex", justifyContent: "space-between" }}>
              {project.proximo_hito}
              {project.fecha_hito && <span style={{ color: "#d97706", fontSize: "0.8rem" }}>{new Date(project.fecha_hito).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
            </div>
          </div>
        )}
        <ExpandingButton icon={ArrowRight} label="Ver detalle" onClick={() => onNavigate(project.id)} expanded fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={800} fontSize="0.9rem" durationMs={300} />
      </div>
    </div>
  );
};

const Modal = ({ onClose, onSave, error }: { onClose: () => void; onSave: (data: NewProjectPayload) => void; error: string | null }) => {
  const [form, setForm] = useState<NewProjectForm>({ titulo: '', descripcion: '', presupuesto: '', fecha_inicio: '', es_publico: false, con_financiamiento: false });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof NewProjectForm, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);
    await onSave({ ...form, presupuesto: form.presupuesto ? Number(form.presupuesto) : null, status: 'Propuesta', avance: 0 });
    setSaving(false);
  };
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "540px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ color: "#1B396A", fontSize: "1.5rem", fontWeight: "900", margin: 0 }}>Nuevo Proyecto</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}
          {([['titulo', 'Título del proyecto *', 'text', true], ['descripcion', 'Descripción', 'text', false], ['presupuesto', 'Presupuesto (MXN)', 'number', false], ['fecha_inicio', 'Fecha de inicio', 'date', false]] as [keyof NewProjectForm, string, string, boolean][]).map(([k, label, type, req]) => (
            <div key={k}>
              <label style={{ fontSize: "0.8rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>{label}</label>
              <input type={type} required={req} value={form[k] as string} onChange={e => set(k, e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#f59e0b"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "16px" }}>
            {([['es_publico', 'Publicado'], ['con_financiamiento', 'Con Financiamiento']] as [keyof NewProjectForm, string][]).map(([k, label]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", color: "#1e293b" }}>
                <input type="checkbox" checked={form[k] as boolean} onChange={e => set(k, e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#1B396A" }} />
                {label}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <div style={{ flex: 1 }}>
              <ExpandingButton label="Cancelar" onClick={onClose} type="button" variant="cancel" fullWidth size={48} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
            </div>
            <div style={{ flex: 2 }}>
              <ExpandingButton icon={Sparkles} label="Crear Proyecto" loading={saving} loadingLabel="Guardando..." type="submit" disabled={saving} expanded fullWidth size={48} radius={12} gap={8} padding="0 16px" fontWeight={900} durationMs={300} />
            </div>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default function MisProyectosInvestigacion() {
  const router = useRouter();
  const {
    proyectos,
    loading,
    loadError,
    searchTerm, setSearchTerm,
    activeFilter, setActiveFilter,
    showModal, setShowModal,
    createError,
    filtered,
    fetchAll,
    handleUpdateStatus,
    handleCreate,
  } = useProyectosInvestigacion();

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Mundo Dorado</span>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Portafolio de Investigación</h1>
          <p style={{ color: "#64748b", fontSize: "1rem", fontWeight: "500", marginTop: "4px" }}>{proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} registrado{proyectos.length !== 1 ? 's' : ''}</p>
        </div>
        <ExpandingButton icon={Plus} label="Nuevo Proyecto" onClick={() => setShowModal(true)} variant="primary" size={48} radius={14} gap={10} padding="0 24px" fontWeight={900} durationMs={300} shadow="always" />
      </header>

      {loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={fetchAll} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "280px", maxWidth: "480px" }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
          <input type="text" placeholder="Buscar proyecto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "14px 16px 14px 48px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none", backgroundColor: "white", boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = "#f59e0b"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {['Todos', 'En curso', 'Publicados', 'Con Fondos'].map(tag => {
            const active = activeFilter === tag || (tag === 'Todos' && !activeFilter);
            return (
              <button key={tag} onClick={() => setActiveFilter(tag === 'Todos' ? null : tag)}
                style={{ padding: "10px 16px", borderRadius: "12px", border: "none", fontSize: "0.85rem", fontWeight: "800", cursor: "pointer", backgroundColor: active ? "#1B396A" : "white", color: active ? "white" : "#64748b", boxShadow: active ? "0 4px 10px rgba(27,57,106,0.2)" : "0 2px 4px rgba(0,0,0,0.04)" }}>
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} /> Cargando proyectos...
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
          <Briefcase size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>{proyectos.length === 0 ? 'No tienes proyectos aún' : 'Sin resultados'}</h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem" }}>{proyectos.length === 0 ? 'Crea tu primer proyecto de investigación' : 'Prueba con otros filtros'}</p>
          {proyectos.length === 0 && <div style={{ display: "flex", justifyContent: "center" }}><ExpandingButton label="Crear primer proyecto" onClick={() => setShowModal(true)} variant="primary" expanded size={44} radius={12} gap={8} padding="0 20px" fontWeight={800} durationMs={300} /></div>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "24px", alignItems: "start" }}>
          {filtered.map(p => <ProjectCard key={p.id} project={p} onUpdateStatus={handleUpdateStatus} onNavigate={id => router.push(`/investigacion/proyectos/${id}`)} />)}
        </div>
      )}

      {showModal && <Modal onClose={() => setShowModal(false)} onSave={handleCreate} error={createError} />}
    </div>
  );
}

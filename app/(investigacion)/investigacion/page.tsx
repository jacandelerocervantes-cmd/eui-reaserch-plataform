"use client";

import { Suspense } from "react";
import {
  Sparkles, TrendingUp, BookOpen, Users, ArrowRight,
  CheckCircle2, Plus, Loader2, Share2, ArrowUpRight, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { MetricCard } from "./_components/MetricCard";
import { useEscritorioInvestigacion } from "./_hooks/useEscritorioInvestigacion";

function EscritorioContent() {
  const { router, result, alertas, handleAlertAction, onRetry } = useEscritorioInvestigacion();

  if (result.kind === "redirect") return (
    <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={48} color="#1B396A" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (result.kind === "error") return (
    <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
      <p style={{ color: "#ef4444", fontWeight: "700" }}>{result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { userName, metrics, proyectosActivos } = result;

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>Mundo Dorado</span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#10b981", fontSize: "0.75rem", fontWeight: "800", backgroundColor: "#ecfdf5", padding: "4px 8px", borderRadius: "6px" }}>
              <CheckCircle2 size={12} /> Datos en tiempo real
            </span>
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Mi Escritorio</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Bienvenido, {userName}</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton label="Mi Perfil" onClick={() => router.push('/investigacion/config')} variant="secondary" expanded size={48} radius={14} gap={10} padding="0 24px" fontWeight={800} durationMs={300} />
          <ExpandingButton icon={Plus} label="Nuevo Manuscrito" onClick={() => router.push('/investigacion/canvas')} variant="primary" size={48} radius={14} gap={8} padding="0 24px" fontWeight={900} durationMs={300} shadow="always" />
        </div>
      </header>

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        <MetricCard label="Proyectos" value={metrics.proyectos} icon={TrendingUp} color="#f59e0b" onClick={() => router.push('/investigacion/proyectos')} />
        <MetricCard label="Publicaciones" value={metrics.literatura} icon={BookOpen} color="#10b981" onClick={() => router.push('/investigacion/literatura')} />
        <MetricCard label="Tesistas" value={metrics.tesistas} icon={Users} color="#8b5cf6" onClick={() => router.push('/investigacion/tesis')} />
        <MetricCard label="Saldo MXN" value={metrics.saldo} icon={Share2} color="#3b82f6" onClick={() => router.push('/investigacion/financiamiento')} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "32px", alignItems: "start" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "1.4rem", color: "#1B396A", fontWeight: "900", margin: 0 }}>Proyectos en Ejecución</h2>
            <button onClick={() => router.push('/investigacion/proyectos')} style={{ background: "none", border: "none", color: "#3b82f6", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.9rem" }}>
              Ver todos <ArrowRight size={16} />
            </button>
          </div>

          {proyectosActivos.length === 0 ? (
            <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px dashed #e2e8f0", padding: "40px", textAlign: "center", color: "#94a3b8" }}>
              <TrendingUp size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
              <p style={{ margin: 0, fontWeight: "600" }}>Sin proyectos activos</p>
              <div style={{ marginTop: "12px", display: "flex", justifyContent: "center" }}>
                <ExpandingButton label="Crear proyecto" onClick={() => router.push('/investigacion/proyectos')} variant="primary" expanded size={40} radius={10} gap={8} padding="0 20px" fontWeight={800} fontSize="0.85rem" durationMs={300} />
              </div>
            </div>
          ) : (
            proyectosActivos.map(proj => (
              <div key={proj.id} onClick={() => router.push(`/investigacion/proyectos/${proj.id}`)}
                style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px", cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#f59e0b"; e.currentTarget.style.transform = "translateX(4px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.transform = "translateX(0)"; }}
              >
                <h4 style={{ margin: "0 0 12px 0", color: "#1B396A", fontSize: "1rem", fontWeight: "800" }}>{proj.titulo}</h4>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ flex: 1, height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${proj.avance ?? 0}%`, height: "100%", backgroundColor: "#f59e0b" }} />
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "700", flexShrink: 0 }}>{proj.avance ?? 0}%</span>
                </div>
                {proj.proximo_hito && (
                  <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "#64748b" }}>{proj.proximo_hito}</span>
                    {proj.fecha_hito && <span style={{ color: "#d97706", fontWeight: "700" }}>{new Date(proj.fecha_hito).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
          <h2 style={{ fontSize: "1.2rem", color: "#1B396A", fontWeight: "900", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={20} color="#f59e0b" /> Bandeja de Acción
          </h2>
          {alertas.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "32px 0" }}>
              <CheckCircle2 size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
              <p style={{ fontWeight: "600", margin: 0 }}>Estás al día.</p>
            </div>
          ) : alertas.map(a => {
            const IconComp = a.icon;
            return (
              <div key={a.id} style={{ paddingBottom: "16px", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: `${a.color}15`, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <IconComp size={20} />
                  </div>
                  <div>
                    <p style={{ margin: "0 0 4px 0", fontSize: "0.9rem", fontWeight: "800", color: "#1e293b" }}>{a.title}</p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", lineHeight: 1.4 }}>{a.desc}</p>
                  </div>
                </div>
                <div style={{ paddingLeft: "54px" }}>
                  <ExpandingButton
                    icon={ArrowUpRight}
                    label={a.action}
                    onClick={() => handleAlertAction(a.type, a.id)}
                    expanded
                    small smallSize={28}
                    radius={8}
                    gap={4}
                    padding="0 12px"
                    fontWeight={800}
                    fontSize="0.8rem"
                    durationMs={300}
                    colors={{ bg: "white", hoverBg: `${a.color}15`, text: a.color, hoverText: a.color, border: `${a.color}40` }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

export default function EscritorioInvestigacion() {
  return (
    <Suspense fallback={
      <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={48} color="#1B396A" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <EscritorioContent />
    </Suspense>
  );
}

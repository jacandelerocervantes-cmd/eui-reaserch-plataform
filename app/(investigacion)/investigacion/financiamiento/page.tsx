"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  DollarSign, PieChart, ShieldCheck, Clock, 
  ArrowUpRight, Plus, Receipt, Sparkles, FileText, Loader2, AlertCircle
} from "lucide-react";

// Tipo de dato para la Base de Datos
type Fondo = {
  id: string;
  nombre: string;
  monto_total: number;
  monto_ejercido: number;
  status: "Activo" | "Por Cerrar" | "Cerrado";
  color: string;
};

export default function FinanciamientoInvestigacion() {
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  // Estados para acciones UI
  const [isGeneratingReport, setIsGeneratingReport] = useState<string | null>(null);
  const [gastoRapido, setGastoRapido] = useState<{ id: string, amount: string } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchFondos();
  }, []);

  const fetchFondos = async () => {
    setLoading(true);
    try {
      // Intento de lectura real desde Supabase (Tabla fondos_investigacion)
      const { data, error } = await supabase.from('fondos_investigacion').select('*');
      
      if (data && data.length > 0) {
        setFondos(data);
      } else {
        // Fallback: Datos simulados si la tabla aún no existe
        setFondos([
          { id: "F-001", nombre: "Apoyo a la Investigación TecNM 2026", monto_total: 120000, monto_ejercido: 24000, status: "Activo", color: "#10b981" },
          { id: "F-002", nombre: "Fondo Sectorial CONAHCYT", monto_total: 450000, monto_ejercido: 382500, status: "Por Cerrar", color: "#f59e0b" }
        ]);
      }
    } catch (error) {
      console.error("Error al cargar fondos:", error);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================================
  // ACCIÓN: REGISTRO DE GASTO RÁPIDO (Fricción Cero / Optimistic UI)
  // =====================================================================
  const registrarGasto = async (id: string) => {
    if (!gastoRapido || gastoRapido.id !== id || !gastoRapido.amount) return;
    
    const montoGasto = parseFloat(gastoRapido.amount);
    if (isNaN(montoGasto) || montoGasto <= 0) return;

    // 1. Actualización Optimista en la Interfaz (Instantáneo)
    setFondos(prev => prev.map(f => {
      if (f.id === id) {
        const nuevoEjercido = Math.min(f.monto_ejercido + montoGasto, f.monto_total);
        return { ...f, monto_ejercido: nuevoEjercido };
      }
      return f;
    }));
    
    setGastoRapido(null); // Limpiar input

    // 2. Guardado en Supabase (Silencioso)
    try {
      // await supabase.rpc('registrar_gasto_fondo', { fondo_id: id, monto: montoGasto });
    } catch (error) {
      alert("Error al registrar el gasto en el servidor.");
      fetchFondos(); // Revertir en caso de error
    }
  };

  // =====================================================================
  // ACCIÓN: GENERAR INFORME IA (El sueño de todo investigador)
  // =====================================================================
  const generarInformeIA = (id: string) => {
    setIsGeneratingReport(id);
    
    // Simulamos el procesamiento del LLM analizando facturas
    setTimeout(() => {
      setIsGeneratingReport(null);
      alert("¡Informe Financiero y Técnico generado exitosamente y guardado en tu Drive!");
    }, 2500);
  };

  // Helpers de formato
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
      
      {/* HEADER */}
      <header style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              Mundo Dorado
            </span>
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.4rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Gestión de Fondos</h1>
          <p style={{ color: "#64748b", fontSize: "1.05rem", fontWeight: "500", marginTop: "4px" }}>Control presupuestal y comprobación inteligente de gastos.</p>
        </div>
        
        <div style={{ display: "flex", gap: "12px" }}>
          <button style={{ backgroundColor: "white", color: "#1B396A", border: "1px solid #e2e8f0", padding: "12px 20px", borderRadius: "14px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
            <Receipt size={18} /> Subir XML / Factura
          </button>
          <button style={{ backgroundColor: "#1B396A", color: "white", padding: "12px 24px", borderRadius: "14px", fontWeight: "800", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 15px rgba(27, 57, 106, 0.2)" }}>
            <Plus size={20} /> Solicitar Recurso
          </button>
        </div>
      </header>

      {/* GRID DE FONDOS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "24px" }}>
        {loading ? (
           <div style={{ padding: "40px", color: "#94a3b8", fontWeight: "600", width: "100%", textAlign: "center", gridColumn: "1 / -1" }}>Consultando tesorería...</div>
        ) : (
          fondos.map((f) => {
            const porcentaje = Math.round((f.monto_ejercido / f.monto_total) * 100);
            const isClosing = f.status === "Por Cerrar";
            
            return (
              <div key={f.id} style={{ backgroundColor: "white", borderRadius: "28px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 10px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "flex-start" }}>
                    <div style={{ backgroundColor: `${f.color}15`, color: f.color, padding: "12px", borderRadius: "16px" }}>
                      <ShieldCheck size={28} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: "800", color: f.color, backgroundColor: `${f.color}15`, padding: "6px 12px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "4px" }}>
                      {isClosing && <AlertCircle size={12} />} {f.status}
                    </span>
                  </div>
                  
                  <h3 style={{ margin: "0 0 8px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800", lineHeight: "1.3" }}>{f.nombre}</h3>
                  <div style={{ fontSize: "2.2rem", fontWeight: "900", color: "#1B396A", marginBottom: "4px", letterSpacing: "-0.03em" }}>{formatCurrency(f.monto_total)}</div>
                  <p style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: "600", margin: "0 0 24px 0" }}>Asignación Total Autorizada</p>
                  
                  {/* BARRA DE PROGRESO INTELIGENTE */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "32px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "800", color: "#64748b" }}>
                      <span>Presupuesto Ejercido</span>
                      <span style={{ color: porcentaje > 80 ? "#ef4444" : "#1B396A" }}>{porcentaje}% ({formatCurrency(f.monto_ejercido)})</span>
                    </div>
                    <div style={{ width: "100%", height: "10px", backgroundColor: "#f1f5f9", borderRadius: "5px", overflow: "hidden" }}>
                      <div style={{ width: `${porcentaje}%`, height: "100%", backgroundColor: f.color, transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                    </div>
                  </div>
                </div>

                {/* ACCIONES DEL FONDO */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  
                  {/* Fila de Comprobación Rápida */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <DollarSign size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                      <input 
                        type="number" 
                        placeholder="Monto a comprobar..." 
                        value={gastoRapido?.id === f.id ? gastoRapido.amount : ""}
                        onChange={(e) => setGastoRapido({ id: f.id, amount: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", fontWeight: "600", color: "#1B396A" }}
                      />
                    </div>
                    <button 
                      onClick={() => registrarGasto(f.id)}
                      disabled={!gastoRapido || gastoRapido.id !== f.id || !gastoRapido.amount}
                      style={{ backgroundColor: "#f8fafc", color: "#1B396A", padding: "0 16px", borderRadius: "10px", fontWeight: "800", border: "1px solid #e2e8f0", cursor: (!gastoRapido || gastoRapido.id !== f.id || !gastoRapido.amount) ? "not-allowed" : "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => { if(gastoRapido?.id === f.id && gastoRapido.amount) { e.currentTarget.style.backgroundColor = "#1B396A"; e.currentTarget.style.color = "white"; }}}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.color = "#1B396A"; }}
                    >
                      Añadir Gasto
                    </button>
                  </div>

                  {/* El Botón Mágico: Informe IA */}
                  {isClosing && (
                    <button 
                      onClick={() => generarInformeIA(f.id)}
                      disabled={isGeneratingReport === f.id}
                      style={{ width: "100%", backgroundColor: "#fffbeb", color: "#d97706", padding: "12px", borderRadius: "10px", border: "1px solid #fde68a", fontWeight: "800", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: isGeneratingReport === f.id ? "wait" : "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => { if (isGeneratingReport !== f.id) e.currentTarget.style.backgroundColor = "#fef3c7" }}
                      onMouseLeave={e => { if (isGeneratingReport !== f.id) e.currentTarget.style.backgroundColor = "#fffbeb" }}
                    >
                      {isGeneratingReport === f.id ? (
                        <><Loader2 size={16} className="animate-spin" /> Consolidando XMLs y Reportes...</>
                      ) : (
                        <><Sparkles size={16} /> Auto-Generar Informe Financiero de Cierre</>
                      )}
                    </button>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Mail, Star, Archive, Trash2, Search, 
  Sparkles, Send, Loader2, AlertCircle, ChevronRight, Zap, ShieldCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// Definimos la interfaz para aprovechar los datos enriquecidos por la IEO
interface EmailData {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  aiCategory: string;
  priority?: number;
  brief?: string;
}

export default function BandejaCorreoFinal() {
  const [isMounted, setIsMounted] = useState(false);
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMail, setSelectedMail] = useState<EmailData | null>(null);
  const [activeCategory, setActiveCategory] = useState("Todos");

  useEffect(() => {
    setIsMounted(true);
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('sync-correo', {
        body: { action: 'obtenerCorreos' }
      });
      if (error) throw error;
      if (data?.success) setEmails(data.data);
    } catch (err) {
      console.error("Error al sincronizar correos:", err);
    } finally {
      setLoading(false);
    }
  };

  // El filtrado ahora coincide con las categorías exactas que devuelve la Edge Function
  const filteredEmails = useMemo(() => {
    if (activeCategory === "Todos") return emails;
    return emails.filter(m => m.aiCategory === activeCategory);
  }, [emails, activeCategory]);

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "grid", gridTemplateColumns: "350px 1fr", gap: "24px", height: "85vh" }}>
      
      {/* COLUMNA 1: LISTADO (TRIAGE IEO) */}
      <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #f1f5f9" }}>
          <h3 style={{ marginBottom: "15px", fontWeight: "900", color: "#1B396A", display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldCheck size={18} color="#10b981" /> Triage IEO
          </h3>
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "5px" }}>
            {/* Categorías actualizadas al estándar del Orquestador */}
            {["Todos", "DOCENCIA", "INVESTIGACION", "INSTITUCIONAL", "PERSONAL"].map(cat => (
              <span key={cat} onClick={() => setActiveCategory(cat)} style={{ 
                padding: "6px 12px", backgroundColor: activeCategory === cat ? "#1B396A" : "#f1f5f9", 
                color: activeCategory === cat ? "white" : "#64748b", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"
              }}>{cat}</span>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" color="#1B396A" size={32} style={{ margin: "0 auto" }}/></div>
          ) : filteredEmails.length === 0 ? (
             <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "0.85rem" }}>No hay correos en esta categoría.</div>
          ) : (
            filteredEmails.map(mail => (
              <div key={mail.id} onClick={() => setSelectedMail(mail)} style={{ 
                padding: "20px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", 
                backgroundColor: selectedMail?.id === mail.id ? "#f8fafc" : "white",
                borderLeft: selectedMail?.id === mail.id ? "4px solid #1B396A" : "4px solid transparent"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1B396A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>
                    {mail.from.split('<')[0].trim()}
                  </span>
                  <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: "bold", backgroundColor: "#e2e8f0", padding: "2px 6px", borderRadius: "6px" }}>
                    {mail.aiCategory}
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: "700", marginBottom: "6px", color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {mail.subject}
                </div>
                {/* Indicador de Prioridad de la IEO */}
                {mail.priority && mail.priority <= 2 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", color: "#ef4444", fontWeight: "bold" }}>
                    <AlertCircle size={12} /> Alta Prioridad
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* COLUMNA 2: DETALLE Y ACCIÓN MAESTRA */}
      <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {selectedMail ? (
          <>
            <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", backgroundColor: "#fcfcfd" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#1B396A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "1.2rem" }}>
                  {selectedMail.from[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: "800", color: "#1B396A", display: "flex", alignItems: "center", gap: "6px" }}>
                    {selectedMail.from}
                    {selectedMail.priority && selectedMail.priority <= 2 && <AlertCircle size={14} color="#ef4444" title="Alta Prioridad" />}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                    Clasificado por IA como <strong style={{ color: "#1B396A" }}>{selectedMail.aiCategory}</strong>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ padding: "32px", flex: 1, overflowY: "auto" }}>
              <h2 style={{ fontSize: "1.5rem", color: "#1B396A", fontWeight: "900", marginBottom: "24px" }}>{selectedMail.subject}</h2>
              
              {/* Resumen Ejecutivo IEO */}
              {selectedMail.brief && (
                <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: "16px", borderRadius: "12px", marginBottom: "24px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <Zap size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: "800", color: "#475569", marginBottom: "4px" }}>Resumen IEO</h4>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155" }}>{selectedMail.brief}</p>
                  </div>
                </div>
              )}

              <p style={{ color: "#475569", lineHeight: "1.6", whiteSpace: "pre-wrap", fontSize: "0.95rem" }}>
                {selectedMail.snippet}
              </p>
            </div>
            
            <div style={{ padding: "24px", backgroundColor: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "flex", gap: "12px" }}>
              <input type="text" placeholder="Escribe una respuesta o solicita al Copilot..." style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none" }} />
              <button style={{ backgroundColor: "#1B396A", color: "white", padding: "0 24px", borderRadius: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", border: "none" }}>
                <Send size={16} /> Enviar
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
            <Sparkles size={48} style={{ marginBottom: "16px", opacity: 0.2 }} />
            <h3 style={{ margin: 0, color: "#475569" }}>Selecciona un correo</h3>
            <p style={{ fontSize: "0.9rem" }}>La IEO ha clasificado tu bandeja de entrada.</p>
          </div>
        )}
      </section>
    </div>
  );
}
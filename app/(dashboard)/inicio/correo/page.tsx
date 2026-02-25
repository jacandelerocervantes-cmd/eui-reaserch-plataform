"use client";

import React, { useState, useEffect } from "react";
import { 
  Mail, Star, Archive, Trash2, Search, 
  Filter, ChevronRight, User, Sparkles, Send, Loader2
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Instanciamos el cliente de Supabase usando tus variables de entorno públicas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function BandejaCorreo() {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedMail, setSelectedMail] = useState<any>(null);
  
  // Estados para manejar los datos reales
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    fetchEmails();
  }, []);

  // Función que llama a tu Edge Function para obtener correos
  const fetchEmails = async () => {
    try {
      setLoading(true);
      // Invocamos la Edge Function sync-correo que ya tienes configurada
      // Le pasamos la acción 'obtenerCorreos' en el cuerpo para tu Router.gs
      const { data, error } = await supabase.functions.invoke('sync-correo', {
        body: { action: 'obtenerCorreos' }
      });
      
      if (error) throw error;
      
      if (data && data.success) {
        // Asignamos la lista de correos. Si tu Router devuelve {success, data}, usamos data.data
        const listaCorreos = Array.isArray(data.emails) ? data.emails : (data.data || []);
        setEmails(listaCorreos);
      }
    } catch (error) {
      console.error("Error al obtener la bandeja de entrada:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "grid", gridTemplateColumns: "350px 1fr", gap: "24px", height: "calc(100vh - 120px)" }}>
      
      {/* COLUMNA 1: LISTADO DE CORREOS */}
      <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input type="text" placeholder="Buscar en correo..." style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "5px" }}>
            {["Todos", "Alumnos", "Institucional", "Investigación"].map(cat => (
              <span key={cat} style={{ padding: "6px 12px", backgroundColor: "#f1f5f9", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700", color: "#64748b", cursor: "pointer", whiteSpace: "nowrap" }}>{cat}</span>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }} className="custom-scrollbar">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8", gap: "12px" }}>
              <Loader2 size={32} className="animate-spin" color="#1B396A" />
              <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>Sincronizando con Gmail...</span>
            </div>
          ) : emails.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
              No hay correos recientes en tu bandeja.
            </div>
          ) : (
            emails.map(mail => (
              <div 
                key={mail.id} 
                onClick={() => setSelectedMail(mail)}
                style={{ 
                  padding: "20px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", 
                  backgroundColor: selectedMail?.id === mail.id ? "#f8fafc" : "white",
                  position: "relative"
                }}
              >
                {mail.unread && <div style={{ position: "absolute", left: "8px", top: "25px", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#3b82f6" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1B396A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }}>{mail.from}</span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{mail.time}</span>
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1e293b", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mail.subject}</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{mail.snippet || mail.preview}</div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* COLUMNA 2: VISTA DEL CORREO SELECCIONADO */}
      <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {selectedMail ? (
          <>
            <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#1B396A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "1.2rem", textTransform: "uppercase" }}>
                  {selectedMail.from[0]}
                </div>
                <div>
                  <div style={{ fontWeight: "800", color: "#1B396A" }}>{selectedMail.from}</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Para: mi@tecnm.mx</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "none", cursor: "pointer" }}><Star size={18} color="#94a3b8" /></button>
                <button style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "none", cursor: "pointer" }}><Archive size={18} color="#94a3b8" /></button>
                <button style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "none", cursor: "pointer" }}><Trash2 size={18} color="#ef4444" /></button>
              </div>
            </div>
            
            <div style={{ padding: "32px", flex: 1, overflowY: "auto" }}>
              <h2 style={{ fontSize: "1.5rem", color: "#1B396A", fontWeight: "900", marginBottom: "24px" }}>{selectedMail.subject}</h2>
              <p style={{ color: "#475569", lineHeight: "1.6", fontSize: "1rem", whiteSpace: "pre-wrap" }}>
                {selectedMail.cuerpoCompleto || selectedMail.snippet || selectedMail.preview}
              </p>
            </div>

            {/* BARRA DE RESPUESTA CON IA */}
            <div style={{ padding: "24px", backgroundColor: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                <input type="text" placeholder="Escribe una respuesta..." style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none" }} />
                <button style={{ backgroundColor: "#8b5cf6", color: "white", border: "none", padding: "0 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <Sparkles size={18} /> Redactar con IA
                </button>
                <button style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "0 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <Send size={18} /> Enviar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#94a3b8" }}>
            {loading ? (
              <Loader2 size={64} className="animate-spin" style={{ marginBottom: "16px", opacity: 0.5 }} color="#1B396A" />
            ) : (
              <Mail size={64} style={{ marginBottom: "16px", opacity: 0.2 }} />
            )}
            <p style={{ fontWeight: "600" }}>{loading ? "Obteniendo correos..." : "Selecciona un correo para leerlo"}</p>
          </div>
        )}
      </section>

    </div>
  );
}
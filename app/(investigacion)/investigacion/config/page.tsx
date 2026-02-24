"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User, Globe, Bell, Lock, Share2, Save, CheckCircle2, Loader2, Database, Key } from "lucide-react";

export default function ConfigInvestigacion() {
  const [isMounted, setIsMounted] = useState(false);
  
  // Estado del Perfil
  const [perfil, setPerfil] = useState({
    orcid: "",
    lineas_investigacion: "",
    zotero_api_key: "",
    alertas_citas: true,
    alertas_informes: true,
    alertas_grants: false,
  });

  // Estados de Fricción Cero (Auto-guardado)
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>("Sincronizado");

  useEffect(() => {
    setIsMounted(true);
    fetchPerfil();
  }, []);

  const fetchPerfil = async () => {
    try {
      // Simulación de fetch a la tabla perfiles (o metadata_investigador)
      // const { data: { user } } = await supabase.auth.getUser();
      // const { data } = await supabase.from('perfiles').select('*').eq('id', user?.id).single();
      
      // Datos mockeados iniciales
      setPerfil({
        orcid: "0000-0002-1234-5678",
        lineas_investigacion: "Inteligencia Artificial, IoT Agrícola",
        zotero_api_key: "",
        alertas_citas: true,
        alertas_informes: true,
        alertas_grants: false,
      });
    } catch (error) {
      console.error("Error al cargar perfil:", error);
    }
  };

  // =====================================================================
  // AUTO-GUARDADO (Debounce de 1 segundo para inputs de texto)
  // =====================================================================
  useEffect(() => {
    if (!isMounted) return;
    
    setLastSaved("Sincronizando cambios...");
    const delayDebounceFn = setTimeout(async () => {
      setIsSaving(true);
      try {
        // Aquí iría el update a Supabase
        // await supabase.from('perfiles').update(perfil).eq('id', user.id);
        await new Promise(r => setTimeout(r, 600)); // Simular red
        setLastSaved(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (error) {
        console.error("Error al guardar:", error);
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [perfil.orcid, perfil.lineas_investigacion, perfil.zotero_api_key]);

  // =====================================================================
  // TOGGLE INSTANTÁNEO (Para switches de booleanos)
  // =====================================================================
  const handleToggle = async (campo: keyof typeof perfil) => {
    const nuevoValor = !perfil[campo];
    setPerfil(prev => ({ ...prev, [campo]: nuevoValor }));
    
    setIsSaving(true);
    setLastSaved("Sincronizando cambios...");
    // Update directo a BD sin esperar debounce
    // await supabase.from('perfiles').update({ [campo]: nuevoValor }).eq('id', user.id);
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 400);
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
      
      {/* HEADER */}
      <header style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              Mundo Dorado
            </span>
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.4rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Ajustes de Investigador</h1>
          <p style={{ color: "#64748b", fontSize: "1.05rem", fontWeight: "500", marginTop: "4px" }}>Gestiona tu identidad académica y preferencias del sistema.</p>
        </div>

        {/* ESTADO DE SINCRONIZACIÓN (Reemplaza al botón Guardar) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: isSaving ? "#fffbeb" : "#ecfdf5", padding: "10px 16px", borderRadius: "12px", border: `1px solid ${isSaving ? '#fde68a' : '#a7f3d0'}`, transition: "all 0.3s" }}>
          {isSaving ? <Loader2 size={16} className="animate-spin text-amber-500" /> : <CheckCircle2 size={16} color="#10b981" />}
          <span style={{ fontSize: "0.85rem", fontWeight: "700", color: isSaving ? "#d97706" : "#059669" }}>
            {isSaving ? "Guardando..." : "Guardado"}
          </span>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* ================= SECCIÓN 1: IDENTIDAD DIGITAL ================= */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <h3 style={{ color: "#1B396A", fontSize: "1.1rem", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Globe size={20} color="#f59e0b" /> Identidad Digital
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>ORCID ID</label>
              <input 
                type="text" 
                value={perfil.orcid}
                onChange={e => setPerfil({...perfil, orcid: e.target.value})}
                placeholder="0000-0002-XXXX-XXXX" 
                style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "2px solid #e2e8f0", marginTop: "6px", fontSize: "1rem", outline: "none", color: "#1B396A", fontWeight: "600", transition: "border 0.2s" }} 
                onFocus={(e) => e.target.style.borderColor = "#f59e0b"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
              />
              <p style={{ margin: "6px 0 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Este ID se usará automáticamente al exportar tus papers desde el Canvas AI.</p>
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>LÍNEAS DE INVESTIGACIÓN</label>
              <input 
                type="text" 
                value={perfil.lineas_investigacion}
                onChange={e => setPerfil({...perfil, lineas_investigacion: e.target.value})}
                placeholder="IA, IoT, Ciberseguridad" 
                style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "2px solid #e2e8f0", marginTop: "6px", fontSize: "1rem", outline: "none", color: "#1B396A", fontWeight: "600", transition: "border 0.2s" }} 
                onFocus={(e) => e.target.style.borderColor = "#f59e0b"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>
          </div>
        </section>

        {/* ================= SECCIÓN 2: INTEGRACIONES (NUEVO) ================= */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
             <div>
                <h3 style={{ color: "#1B396A", fontSize: "1.1rem", fontWeight: "800", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Database size={20} color="#8b5cf6" /> Gestores de Referencias
                </h3>
                <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>Conecta tu biblioteca para insertar citas directamente en el editor.</p>
             </div>
          </div>
          
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
               <Key size={14}/> Zotero API Key
            </label>
            <input 
              type="password" 
              value={perfil.zotero_api_key}
              onChange={e => setPerfil({...perfil, zotero_api_key: e.target.value})}
              placeholder="••••••••••••••••••••••••" 
              style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "2px solid #e2e8f0", marginTop: "6px", fontSize: "1rem", outline: "none", color: "#1B396A", fontFamily: "monospace", transition: "border 0.2s" }} 
              onFocus={(e) => e.target.style.borderColor = "#8b5cf6"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>
        </section>

        {/* ================= SECCIÓN 3: NOTIFICACIONES (TOGGLES) ================= */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <h3 style={{ color: "#1B396A", fontSize: "1.1rem", fontWeight: "800", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={20} color="#ef4444" /> Notificaciones Académicas
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Componente Switch Reutilizable */}
            {[
              { id: 'alertas_citas', label: "Alertas de nuevas citas a mis papers", desc: "Te notificaremos si Google Scholar detecta una nueva cita." },
              { id: 'alertas_informes', label: "Recordatorios de informes de financiamiento", desc: "Avisos 15 días antes del cierre de presupuesto." },
              { id: 'alertas_grants', label: "Convocatorias de Grants (CONAHCYT / SNI)", desc: "Recomendaciones de fondos basados en tus líneas de investigación." }
            ].map((item) => {
              const isActive = perfil[item.id as keyof typeof perfil] as boolean;
              return (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", backgroundColor: isActive ? "#f8fafc" : "transparent", borderRadius: "16px", border: `1px solid ${isActive ? '#e2e8f0' : 'transparent'}`, transition: "all 0.2s" }}>
                  <div>
                    <div style={{ fontSize: "0.95rem", color: "#1e293b", fontWeight: "700" }}>{item.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "2px" }}>{item.desc}</div>
                  </div>
                  
                  {/* Toggle Switch Personalizado */}
                  <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                    <div style={{ position: "relative" }} onClick={() => handleToggle(item.id as any)}>
                      <div style={{ width: "50px", height: "26px", backgroundColor: isActive ? "#10b981" : "#cbd5e1", borderRadius: "50px", transition: "background-color 0.3s" }}></div>
                      <div style={{ position: "absolute", top: "2px", left: isActive ? "26px" : "2px", width: "22px", height: "22px", backgroundColor: "white", borderRadius: "50%", transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}></div>
                    </div>
                  </label>

                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
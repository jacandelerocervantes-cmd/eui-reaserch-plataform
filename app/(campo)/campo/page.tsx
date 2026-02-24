"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  MapPin, Camera, Wifi, WifiOff, Users, 
  CheckCircle2, Play, ClipboardList, Database, 
  Loader2, ArrowRight, Zap, Target
} from "lucide-react";

export default function DashboardCampo() {
  const [isMounted, setIsMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div style={{ backgroundColor: "#fdf8f6", minHeight: "calc(100vh - 80px)", padding: "40px" }}>
      
      {/* HEADER TÁCTICO */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px", borderBottom: "1px solid #fed7aa", paddingBottom: "24px" }}>
        <div>
          <span style={{ backgroundColor: "#ffedd5", color: "#9a3412", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
            Mundo Terracota
          </span>
          <h1 style={{ color: "#431407", fontSize: "2.5rem", fontWeight: "950", margin: "8px 0 0 0", letterSpacing: "-0.02em" }}>Operaciones de Campo</h1>
        </div>
        
        <div style={{ backgroundColor: isOnline ? "#ecfdf5" : "#fef2f2", color: isOnline ? "#059669" : "#dc2626", padding: "12px 20px", borderRadius: "16px", display: "flex", alignItems: "center", gap: "10px", border: `1px solid ${isOnline ? '#a7f3d0' : '#fecaca'}` }}>
          {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
          <span style={{ fontSize: "0.9rem", fontWeight: "800" }}>{isOnline ? "Sincronizado" : "Modo Offline Activo"}</span>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "32px" }}>
        
        {/* COLUMNA IZQUIERDA: MISIONES Y ACCIÓN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Misión Principal (Gamificación) */}
          <section style={{ backgroundColor: "white", borderRadius: "32px", padding: "40px", border: "1px solid #fed7aa", boxShadow: "0 10px 15px -3px rgba(154, 52, 18, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" }}>
               <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ backgroundColor: "#fff7ed", color: "#ea580c", padding: "12px", borderRadius: "16px" }}><Target size={32} /></div>
                  <div>
                    <h2 style={{ margin: 0, color: "#431407", fontSize: "1.4rem", fontWeight: "900" }}>Misión Actual: Cuadrante B-12</h2>
                    <p style={{ margin: "4px 0 0 0", color: "#9a3412", fontWeight: "600", fontSize: "0.9rem" }}>Proyecto: Resiliencia Hídrica Yucatán</p>
                  </div>
               </div>
               <span style={{ backgroundColor: "#ea580c", color: "white", padding: "6px 12px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "900" }}>PRIORIDAD ALTA</span>
            </div>

            <div style={{ backgroundColor: "#f8fafc", padding: "24px", borderRadius: "20px", marginBottom: "30px", border: "1px solid #e2e8f0" }}>
               <p style={{ margin: "0 0 12px 0", fontSize: "0.95rem", color: "#475569", fontWeight: "600", lineHeight: "1.5" }}>
                 "Recolectar 5 muestras de suelo a 20cm de profundidad y documentar visualmente el estado de las hojas en el área de goteo."
               </p>
               <div style={{ display: "flex", gap: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#ea580c", fontWeight: "800", fontSize: "0.85rem" }}><CheckCircle2 size={16}/> 2/5 Muestras</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8", fontWeight: "800", fontSize: "0.85rem" }}><Camera size={16}/> 0/10 Fotos</div>
               </div>
            </div>

            <button 
              onClick={() => router.push('/campo/captura')}
              style={{ width: "100%", backgroundColor: "#ea580c", color: "white", border: "none", padding: "20px", borderRadius: "20px", fontSize: "1.1rem", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", boxShadow: "0 10px 20px rgba(234, 88, 12, 0.2)", cursor: "pointer", transition: "transform 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <Play size={24} fill="white" /> CONTINUAR CAPTURA DE DATOS
            </button>
          </section>

          {/* Historial de la Jornada */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "1rem", color: "#9a3412", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", gap: "8px", marginLeft: "12px" }}>
              <ClipboardList size={18} /> Actividad Reciente
            </h3>
            {[
              { task: "Muestreo Sector A1", status: "completado", time: "10:30 AM", user: "Kevin Soto" },
              { task: "Calibración Sensor Suelo", status: "completado", time: "09:15 AM", user: "Andrea Méndez" },
            ].map((m, i) => (
              <div key={i} style={{ backgroundColor: "white", padding: "20px", borderRadius: "24px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <div style={{ backgroundColor: "#ecfdf5", padding: "10px", borderRadius: "12px" }}><CheckCircle2 color="#10b981" size={20} /></div>
                  <div>
                    <div style={{ fontSize: "1rem", fontWeight: "800", color: "#431407" }}>{m.task}</div>
                    <div style={{ fontSize: "0.8rem", color: "#9a3412", fontWeight: "600" }}>Por: {m.user}</div>
                  </div>
                </div>
                <span style={{ fontSize: "0.8rem", fontWeight: "800", color: "#94a3b8" }}>{m.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMNA DERECHA: EQUIPO Y SINCRONIZACIÓN */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Tarjeta de Equipo (Servicio Social) */}
          <div style={{ backgroundColor: "white", borderRadius: "32px", padding: "32px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.1rem", fontWeight: "900", display: "flex", alignItems: "center", gap: "10px" }}>
              <Users size={20} color="#ea580c" /> Miembros en Campo
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { name: "Andrea Méndez", role: "Servicio Social", status: "Capturando" },
                { name: "Kevin Soto", role: "Practicante", status: "En Tránsito" }
              ].map((user, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", color: "#1B396A" }}>{user.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "#1B396A" }}>{user.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>{user.role}</div>
                  </div>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981" }}></div>
                </div>
              ))}
            </div>
          </div>

          {/* Estado de la Base de Datos Local */}
          <div style={{ backgroundColor: "#431407", borderRadius: "32px", padding: "32px", color: "white" }}>
             <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <Database size={20} color="#fbbf24" />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "900" }}>Bóveda Local</h3>
             </div>
             <p style={{ fontSize: "0.85rem", opacity: 0.8, lineHeight: "1.5", marginBottom: "20px" }}>
               Tienes 3 registros pendientes de subida. Se enviarán automáticamente al detectar conexión estable.
             </p>
             <div style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: "16px", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: "800" }}>Paquetes: 03</span>
                <button style={{ backgroundColor: "white", color: "#431407", border: "none", padding: "6px 12px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "900", cursor: "pointer" }}>Forzar Envío</button>
             </div>
          </div>

        </aside>
      </div>
    </div>
  );
}
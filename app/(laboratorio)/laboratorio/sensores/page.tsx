"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, Thermometer, Droplets, Cpu, Wifi, AlertTriangle, Terminal, Zap } from "lucide-react";

export default function MonitoreoSensores() {
  // Estados para la telemetría en vivo
  const [nodos, setNodos] = useState({
    "temp-01": { label: "Incubadora Alpha", val: 37.0, unit: "°C", icon: Thermometer, color: "#ef4444", status: "online" },
    "hum-01": { label: "Cámara Húmeda", val: 80.5, unit: "%", icon: Droplets, color: "#3b82f6", status: "online" },
    "edge-01": { label: "Servidor Edge", val: 12, unit: "% CPU", icon: Cpu, color: "#8b5cf6", status: "online" }
  });

  const [logs, setLogs] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [flashingNode, setFlashingNode] = useState<string | null>(null);

  // =====================================================================
  // MOTOR DE INGESTA EN TIEMPO REAL (Supabase Realtime)
  // =====================================================================
  useEffect(() => {
    // Simulamos la conexión inicial
    setTimeout(() => setIsConnected(true), 1000);

    // Nos suscribimos a la tabla 'telemetria_iot'
    const canalIoT = supabase
      .channel('telemetria-laboratorio')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'telemetria_iot' 
      }, (payload) => {
        const nuevoDato = payload.new;
        const jsonPayload = nuevoDato.payload; // Ej: {"temp": 37.5}
        
        // 1. Efecto visual de flash en la tarjeta
        setFlashingNode(nuevoDato.equipo_id);
        setTimeout(() => setFlashingNode(null), 500);

        // 2. Actualizamos el valor del sensor
        setNodos(prev => {
            const actual = { ...prev };
            if (nuevoDato.equipo_id === 'temp-01' && jsonPayload.temp) actual["temp-01"].val = jsonPayload.temp;
            if (nuevoDato.equipo_id === 'hum-01' && jsonPayload.hum) actual["hum-01"].val = jsonPayload.hum;
            if (nuevoDato.equipo_id === 'edge-01' && jsonPayload.cpu) actual["edge-01"].val = jsonPayload.cpu;
            return actual;
        });

        // 3. Agregamos al registro (Log)
        setLogs(prev => [{ id: nuevoDato.id, equipo: nuevoDato.equipo_id, data: JSON.stringify(jsonPayload), time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
      })
      .subscribe();

    return () => { supabase.removeChannel(canalIoT); };
  }, []);

  // =====================================================================
  // SIMULADOR DE HARDWARE (Para probar la UI sin sensores físicos)
  // =====================================================================
  const dispararDatoSimulado = async () => {
    const equipos = ['temp-01', 'hum-01', 'edge-01'];
    const equipoElegido = equipos[Math.floor(Math.random() * equipos.length)];
    
    let fakePayload = {};
    if(equipoElegido === 'temp-01') fakePayload = { temp: +(36.5 + Math.random() * 2).toFixed(1) };
    if(equipoElegido === 'hum-01') fakePayload = { hum: +(78 + Math.random() * 5).toFixed(1) };
    if(equipoElegido === 'edge-01') fakePayload = { cpu: Math.floor(10 + Math.random() * 40) };

    // Insertamos directamente en Supabase. Esto disparará el evento Realtime arriba.
    await supabase.from('telemetria_iot').insert({
        equipo_id: equipoElegido,
        proyecto_id: 'simulacion-001',
        payload: fakePayload
    });
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px", animation: "fadeIn 0.5s ease-out" }}>
      
      {/* HEADER: EL MUNDO ESMERALDA */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ backgroundColor: "#ecfdf5", color: "#059669", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              Mundo Esmeralda
            </span>
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.4rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Telemetría IoT</h1>
          <p style={{ color: "#64748b", fontSize: "1.05rem", fontWeight: "500", marginTop: "4px" }}>Ingesta de datos de hardware (Validación 0).</p>
        </div>
        
        {/* INDICADOR DE CONEXIÓN */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: isConnected ? "#ecfdf5" : "#f1f5f9", padding: "12px 20px", borderRadius: "16px", border: `1px solid ${isConnected ? '#a7f3d0' : '#e2e8f0'}`, transition: "all 0.3s" }}>
            {isConnected ? (
                <>
                    <span style={{ display: "flex", height: "12px", width: "12px", position: "relative" }}>
                        <span style={{ animate: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite", position: "absolute", display: "inline-flex", height: "100%", width: "100%", borderRadius: "50%", backgroundColor: "#10b981", opacity: 0.7 }}></span>
                        <span style={{ position: "relative", display: "inline-flex", borderRadius: "50%", height: "12px", width: "12px", backgroundColor: "#059669" }}></span>
                    </span>
                    <span style={{ color: "#059669", fontWeight: "800", fontSize: "0.95rem" }}>Satelital Activo</span>
                </>
            ) : (
                <>
                    <Wifi size={18} color="#94a3b8" />
                    <span style={{ color: "#64748b", fontWeight: "800", fontSize: "0.95rem" }}>Conectando...</span>
                </>
            )}
        </div>
      </header>

      {/* GRID DE SENSORES VIVOS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        {Object.entries(nodos).map(([key, s]) => {
          const isFlashing = flashingNode === key;
          const IconComponent = s.icon;
          
          return (
            <div 
                key={key} 
                style={{ 
                    backgroundColor: isFlashing ? `${s.color}15` : "white", 
                    borderRadius: "24px", 
                    border: `2px solid ${isFlashing ? s.color : '#e2e8f0'}`, 
                    padding: "32px",
                    transition: "all 0.3s ease-out",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: isFlashing ? `0 0 20px ${s.color}20` : "0 4px 6px -1px rgba(0,0,0,0.02)"
                }}
            >
              {/* Efecto de pulso en el fondo al recibir datos */}
              {isFlashing && <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: s.color, opacity: 0.05, animation: "pulse 0.5s ease-out" }}></div>}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", position: "relative", zIndex: 1 }}>
                  <div style={{ backgroundColor: `${s.color}15`, padding: "12px", borderRadius: "16px", color: s.color }}>
                      <IconComponent size={28} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#f8fafc", padding: "4px 10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <Activity size={14} color="#10b981" />
                      <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>{s.status}</span>
                  </div>
              </div>
              
              <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                      <div style={{ fontSize: "3.5rem", fontWeight: "900", color: "#1B396A", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
                          {s.val}
                      </div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "800", color: "#94a3b8" }}>{s.unit}</div>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "1rem", fontWeight: "700", color: "#64748b" }}>{s.label}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", fontWeight: "600", color: "#cbd5e1", fontFamily: "monospace" }}>ID: {key}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* CONSOLA DE INGESTA (LOGS EN VIVO) & HERRAMIENTAS DE DESARROLLO */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", marginTop: "10px" }}>
          
          {/* Terminal / Logs */}
          <div style={{ backgroundColor: "#0f172a", borderRadius: "24px", padding: "24px", color: "#38bdf8", fontFamily: "monospace", overflow: "hidden", position: "relative", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", borderBottom: "1px solid #1e293b", paddingBottom: "12px" }}>
                  <Terminal size={18} color="#94a3b8" />
                  <span style={{ color: "#f8fafc", fontWeight: "700", fontSize: "0.9rem", letterSpacing: "1px" }}>RAW_PAYLOAD_STREAM</span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: "150px" }}>
                  {logs.length === 0 ? (
                      <div style={{ color: "#475569", fontSize: "0.85rem" }}>{'>'} Esperando paquetes de datos entrantes...</div>
                  ) : (
                      logs.map((log, i) => (
                          <div key={i} style={{ fontSize: "0.85rem", opacity: 1 - (i * 0.15), display: "flex", gap: "12px" }}>
                              <span style={{ color: "#10b981" }}>[{log.time}]</span>
                              <span style={{ color: "#fcd34d" }}>{log.equipo}</span>
                              <span style={{ color: "#e2e8f0" }}>{log.data}</span>
                          </div>
                      ))
                  )}
              </div>
          </div>

          {/* Panel de Control Auxiliar */}
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                  <h3 style={{ margin: "0 0 8px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Zap size={20} color="#f59e0b" /> Ingesta Manual
                  </h3>
                  <p style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: "500", lineHeight: "1.4" }}>
                      Simula la llegada de un paquete JSON desde un microcontrolador ESP32 para probar la Fricción Cero de la UI.
                  </p>
              </div>
              <button 
                  onClick={dispararDatoSimulado}
                  style={{ width: "100%", backgroundColor: "#f8fafc", color: "#1B396A", border: "2px dashed #cbd5e1", padding: "14px", borderRadius: "14px", fontWeight: "800", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.color = "#10b981"; e.currentTarget.style.backgroundColor = "#ecfdf5"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#1B396A"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
              >
                  Disparar Payload
              </button>
          </div>

      </div>

    </div>
  );
}
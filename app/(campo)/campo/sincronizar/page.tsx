"use client";

import React, { useState, useEffect } from "react";
import { 
  Database, Wifi, WifiOff, RefreshCw, 
  Trash2, CheckCircle2, Loader2, AlertTriangle, 
  Image as ImageIcon, MapPin
} from "lucide-react";

export default function BovedaSincronizacion() {
  const [isMounted, setIsMounted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Datos simulados de IndexedDB (Local Storage)
  const [offlineQueue, setOfflineQueue] = useState([
    { id: 1, tipo: "Foto", meta: "Sector B - Hoja", size: "2.4MB", time: "10:30 AM" },
    { id: 2, tipo: "GPS", meta: "Muestra Suelo ID:45", size: "12KB", time: "11:15 AM" },
    { id: 3, tipo: "Audio", meta: "Nota de voz - Observación", size: "850KB", time: "11:20 AM" }
  ]);

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

  const handleSyncAll = () => {
    if(!isOnline) return alert("Aún no tienes conexión a internet.");
    setSyncing(true);
    // Simular subida a Supabase
    setTimeout(() => {
      setOfflineQueue([]);
      setSyncing(false);
      alert("¡Todos los datos han sido sellados en la nube con éxito!");
    }, 3000);
  };

  if (!isMounted) return null;

  return (
    <div style={{ backgroundColor: "#fdf8f6", minHeight: "calc(100vh - 80px)", padding: "30px" }}>
      
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
          <h1 style={{ color: "#431407", fontSize: "2rem", fontWeight: "900", margin: 0 }}>Bóveda de Datos</h1>
          <p style={{ color: "#9a3412", fontWeight: "600" }}>Cola de registros pendientes de sincronización.</p>
        </div>
        <div style={{ textAlign: "right" }}>
           {isOnline ? (
             <span style={{ color: "#10b981", fontWeight: "900", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}><Wifi size={18}/> SEÑAL DETECTADA</span>
           ) : (
             <span style={{ color: "#ef4444", fontWeight: "900", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}><WifiOff size={18}/> SIN CONEXIÓN</span>
           )}
        </div>
      </header>

      {offlineQueue.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div style={{ backgroundColor: "#fff7ed", border: "1px solid #fed7aa", padding: "20px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
            <AlertTriangle color="#ea580c" size={24} />
            <p style={{ margin: 0, color: "#9a3412", fontSize: "0.9rem", fontWeight: "700" }}>
              Tienes {offlineQueue.length} paquetes esperando ser enviados a la base de datos central.
            </p>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {offlineQueue.map((item, i) => (
              <div key={item.id} style={{ padding: "20px", borderBottom: i === offlineQueue.length - 1 ? "none" : "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <div style={{ color: "#94a3b8" }}>
                    {item.tipo === 'Foto' ? <ImageIcon size={20}/> : <MapPin size={20}/>}
                  </div>
                  <div>
                    <div style={{ fontWeight: "800", color: "#431407", fontSize: "0.95rem" }}>{item.meta}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>{item.tipo} • {item.size} • {item.time}</div>
                  </div>
                </div>
                <button style={{ color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={18}/></button>
              </div>
            ))}
          </div>

          <button 
            onClick={handleSyncAll}
            disabled={syncing || !isOnline}
            style={{ 
              width: "100%", backgroundColor: !isOnline ? "#cbd5e1" : "#431407", 
              color: "white", border: "none", padding: "20px", borderRadius: "20px", 
              fontSize: "1.1rem", fontWeight: "900", display: "flex", 
              alignItems: "center", justifyContent: "center", gap: "12px",
              cursor: (!isOnline || syncing) ? "not-allowed" : "pointer"
            }}
          >
            {syncing ? (
              <><Loader2 className="animate-spin" size={24} /> SINCRONIZANDO...</>
            ) : (
              <><RefreshCw size={24} /> SUBIR TODO A SUPABASE</>
            )}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 40px" }}>
          <div style={{ backgroundColor: "#ecfdf5", color: "#10b981", width: "80px", height: "80px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <CheckCircle2 size={40} />
          </div>
          <h2 style={{ color: "#431407", fontWeight: "900" }}>Bóveda Vacía</h2>
          <p style={{ color: "#94a3b8", fontWeight: "600" }}>Todos tus datos de campo están a salvo en la nube.</p>
        </div>
      )}

    </div>
  );
}
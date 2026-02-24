"use client";

import React, { useState } from "react";
import { Camera, MapPin, Mic, Save, X, Check, Loader2, Sparkles } from "lucide-react";

export default function CapturaDeCampo() {
  const [capturing, setCapturing] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [notes, setNotes] = useState("");

  const handleSimulateCapture = () => {
    setCapturing(true);
    setTimeout(() => {
      setCapturing(false);
      setGpsReady(true);
      alert("Foto capturada con metadatos GPS: 21.12° N, 88.15° W");
    }, 1500);
  };

  return (
    <div style={{ height: "100vh", backgroundColor: "#000", display: "flex", flexDirection: "column" }}>
      {/* Visor de Cámara Simulado */}
      <div style={{ flex: 1, position: "relative", backgroundColor: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {capturing ? <Loader2 size={48} className="animate-spin text-white" /> : <Camera size={64} color="white" opacity={0.3} />}
        
        {/* Overlay Táctico */}
        <div style={{ position: "absolute", top: "20px", left: "20px", color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: "900", letterSpacing: "2px" }}>COORD_SATELLITE_LINK</div>
          <div style={{ fontSize: "1rem", fontWeight: "700", fontFamily: "monospace" }}>{gpsReady ? "21.1234, -88.1567" : "BUSCANDO SEÑAL..."}</div>
        </div>

        {gpsReady && (
          <div style={{ position: "absolute", top: "20px", right: "20px", backgroundColor: "#10b981", color: "white", padding: "4px 12px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: "900" }}>
            GPS LOCK OK
          </div>
        )}
      </div>

      {/* Controles Inferiores */}
      <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "32px 32px 0 0", display: "flex", flexDirection: "column", gap: "20px" }}>
        <textarea 
          placeholder="Añadir nota de voz o texto..." 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", outline: "none", fontSize: "1rem", resize: "none" }}
        />
        
        <div style={{ display: "flex", gap: "16px" }}>
          <button onClick={handleSimulateCapture} style={{ flex: 1, height: "80px", backgroundColor: "#ea580c", color: "white", border: "none", borderRadius: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", fontWeight: "900" }}>
            <Camera size={28} />
            CAPTURAR
          </button>
          <button style={{ width: "80px", height: "80px", backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Mic size={28} />
          </button>
          <button style={{ width: "80px", height: "80px", backgroundColor: "#1B396A", color: "white", border: "none", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Save size={28} />
          </button>
        </div>
      </div>
    </div>
  );
}
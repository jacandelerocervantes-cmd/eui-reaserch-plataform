"use client";

import { useParams } from "next/navigation";
import {
  QrCode, Timer, Save, MapPin, Check, X,
  AlertTriangle, XCircle, Loader2, RotateCcw
} from "lucide-react";
import QRCode from "react-qr-code";
import ExpandingButton from "@/components/ui/ExpandingButton";
import GeofenceModal from "./_components/GeofenceModal";
import { useAsistencia } from "./_hooks/useAsistencia";

export default function PaseDeLista() {
  const { id: courseId } = useParams() as { id: string };
  const a = useAsistencia(courseId);

  return (
    <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "30px", position: "relative" }}>

      {a.loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {a.loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={a.fetchData} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      {/* 🗺️ MODAL DE GEOCERCA SIMPLIFICADO */}
      {a.showMapModal && (
        <GeofenceModal
          geoError={a.geoError}
          isLocating={a.isLocating}
          buscarUbicacion={a.buscarUbicacion}
          isLoaded={a.isLoaded}
          mapCenter={a.mapCenter}
          setMapCenter={a.setMapCenter}
          tempRadius={a.tempRadius}
          setTempRadius={a.setTempRadius}
          isSaving={a.isSaving}
          guardarGeocercaModal={a.guardarGeocercaModal}
          setShowMapModal={a.setShowMapModal}
        />
      )}

      {/* --- HEADER --- */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800" }}>Pase de Lista</h1>
          <div onClick={a.isActive ? undefined : a.abrirConfiguracionGeocerca} style={{ cursor: a.isActive ? "not-allowed" : "pointer", marginLeft: "20px", padding: "6px 14px", borderRadius: "20px", backgroundColor: a.geocerca ? "#ecfdf5" : "#fef2f2", color: a.geocerca ? "#059669" : "#dc2626", fontWeight: "700", border: `1px solid ${a.geocerca ? "#a7f3d0" : "#fecaca"}` }}>
            <MapPin size={16} style={{ display: 'inline', marginRight: '5px' }} /> {a.geocerca ? `${a.geocerca.radius}m` : "Configurar GPS"}
          </div>
        </div>
        <ExpandingButton icon={a.isSaving ? Loader2 : Save} label="Sellar Sábana" onClick={a.guardarFinal} disabled={a.isSaving || a.sessionAlreadySaved} size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} fontSize="1rem" durationMs={300} />
      </header>

      {/* --- RADAR / QR --- */}
      <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "40px", textAlign: "center", maxWidth: "420px", margin: "0 auto", width: "100%", boxShadow: "0 10px 30px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
        {a.isActive && <button onClick={() => { a.setIsActive(false); a.setSesionId(null); }} style={{ float: 'right', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><XCircle size={24} /></button>}
        {a.currentUnit && (
          <div style={{ marginBottom: "8px", fontSize: "0.75rem", fontWeight: "700", color: "#64748b", letterSpacing: "0.05em" }}>
            UNIDAD {a.currentUnit.unit_number} — {a.currentUnit.title}
          </div>
        )}
        <div style={{ marginBottom: "15px", color: "#1B396A", fontWeight: "800" }}>SESIÓN ACTUAL: {a.sessionNumber}</div>
        {a.sessionAlreadySaved && (
          <div style={{ marginBottom: '12px', padding: '10px 16px', borderRadius: '12px', backgroundColor: '#f0fdf4', color: '#166534', fontWeight: '700', fontSize: '0.82rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            ✓ Todas las sesiones del día ya fueron selladas
          </div>
        )}
        <div style={{ height: a.isActive ? "220px" : "60px", display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '20px', border: a.isActive ? '2px dashed #cbd5e1' : '1px solid #e2e8f0' }}>
          {!a.isActive ? <ExpandingButton icon={QrCode} label="Generar QR" onClick={a.startRadar} disabled={a.isSaving || a.loading || a.sessionAlreadySaved} size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} fontSize="1rem" durationMs={300} /> : (
            <div style={{ background: 'white', padding: '10px', borderRadius: '10px' }}>
               <QRCode value={`${typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '')}/asistencia/validar/${a.qrHash}?sig=${a.qrSig ?? ''}`} size={180} fgColor="#1B396A" />
            </div>
          )}
        </div>
        {a.isActive && (
          <div style={{ marginTop: "20px", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: "#ef4444" }}>
            <Timer size={20} /> <span style={{ fontSize: "2rem", fontWeight: "900", fontFamily: "monospace" }}>{Math.floor(a.timeLeft / 60)}:{(a.timeLeft % 60).toString().padStart(2, "0")}</span>
          </div>
        )}
      </div>

      {/* --- TABLA DE ALUMNOS --- */}
      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.8rem' }}><th style={{ padding: "15px", textAlign: "left" }}>Alumno</th><th style={{ padding: "15px", textAlign: "right" }}>Estatus</th></tr></thead>
          <tbody>
            {a.loading ? <tr><td colSpan={2} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin mx-auto" /></td></tr> : a.students.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: a.asistencia[s.id] === 1 ? '#f0fdf4' : (a.asistencia[s.id] === 0.5 ? '#fffbeb' : 'transparent') }}>
                <td style={{ padding: "15px" }}>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{s.matricula}</div>
                  <div style={{ fontWeight: "700", color: "#1B396A" }}>{s.nombre_completo}</div>
                </td>
                <td style={{ padding: "15px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    {[0, 0.5, 1].map((v) => (
                      <button key={v} onClick={() => { a.setAsistencia((prev: Record<string, number>) => ({ ...prev, [s.id]: v })); a.setAutoMarcados((prev) => { if (!prev.has(s.id)) return prev; const next = new Set(prev); next.delete(s.id); return next; }); }} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "none", backgroundColor: a.asistencia[s.id] === v ? (v === 1 ? "#dcfce3" : v === 0.5 ? "#fef3c7" : "#fee2e2") : "#f1f5f9", color: a.asistencia[s.id] === v ? (v === 1 ? "#10b981" : v === 0.5 ? "#f59e0b" : "#ef4444") : "#94a3b8", cursor: 'pointer' }}>
                        {v === 1 ? <Check size={16} /> : v === 0.5 ? <AlertTriangle size={14} /> : <X size={16} />}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

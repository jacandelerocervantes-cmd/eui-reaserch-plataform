"use client";

import { MapPin, Save, X, Loader2, RotateCcw } from "lucide-react";
import { GoogleMap, Circle, Marker } from '@react-google-maps/api';
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { MapCenter } from "../_hooks/useAsistencia";

const mapContainerStyle = { width: '100%', height: '350px', borderRadius: '16px' };

type GeofenceModalProps = {
  geoError: string | null;
  isLocating: boolean;
  buscarUbicacion: () => void;
  isLoaded: boolean;
  mapCenter: MapCenter;
  setMapCenter: (c: MapCenter) => void;
  tempRadius: number;
  setTempRadius: (r: number) => void;
  isSaving: boolean;
  guardarGeocercaModal: () => void;
  setShowMapModal: (v: boolean) => void;
};

export default function GeofenceModal({
  geoError, isLocating, buscarUbicacion, isLoaded, mapCenter, setMapCenter,
  tempRadius, setTempRadius, isSaving, guardarGeocercaModal, setShowMapModal,
}: GeofenceModalProps) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", width: "100%", maxWidth: "550px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.2)" }}>
         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
           <h2 style={{ margin: 0, fontWeight: "800", color: "#1B396A" }}>Área de Asistencia</h2>
           <button onClick={() => setShowMapModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={28} /></button>
         </div>

         {geoError && (
           <div style={{ marginBottom: "12px", padding: "10px 14px", borderRadius: "10px", backgroundColor: "#fef2f2", color: "#dc2626", fontSize: "0.82rem", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
             <span>⚠️ {geoError}</span>
             <ExpandingButton icon={isLocating ? Loader2 : RotateCcw} label="Reintentar" onClick={buscarUbicacion} disabled={isLocating} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.78rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#dc2626", text: "#dc2626", hoverText: "white", border: "#dc2626" }} />
           </div>
         )}

         <p style={{ margin: "0 0 8px 0", fontSize: "0.78rem", color: "#64748b", fontWeight: "600" }}>
           📍 Arrastra el pin o haz clic en el mapa para ajustar la ubicación exacta
         </p>
         <div style={{ borderRadius: "16px", overflow: "hidden", marginBottom: "20px", height: "350px", border: "1px solid #e2e8f0" }}>
           {isLocating ? (
             <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b' }}>
               <Loader2 size={32} className="animate-spin" style={{ color: '#1B396A' }} />
               <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Obteniendo ubicación...</span>
             </div>
           ) : isLoaded ? (
             <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={18}
                options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy' }}
                onClick={(e) => { if(e.latLng) setMapCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() }) }}
             >
               <Marker
                 position={mapCenter}
                 draggable
                 onDragEnd={(e) => { if(e.latLng) setMapCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() }) }}
               />
               <Circle center={mapCenter} radius={tempRadius} options={{ fillColor: "#1B396A", fillOpacity: 0.2, strokeColor: "#1B396A", strokeWeight: 2 }} />
             </GoogleMap>
           ) : <span>Cargando Mapa...</span>}
         </div>

         <div style={{ marginBottom: "10px" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1B396A', backgroundColor: '#e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
                    {tempRadius} metros
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>de radio permitido</span>
            </div>

            <div style={{ padding: '10px 0' }}>
                <input
                    type="range"
                    min="10"
                    max="1000"
                    step="5"
                    value={tempRadius}
                    onChange={(e) => setTempRadius(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#1B396A", cursor: 'pointer' }}
                />
            </div>
         </div>

         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
           <button onClick={buscarUbicacion} disabled={isLocating} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}>
             <MapPin size={14} /> {isLocating ? 'Localizando...' : 'Mi ubicación'}
           </button>
           <ExpandingButton icon={Save} label="Guardar Configuración" onClick={guardarGeocercaModal} disabled={isSaving} size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} fontSize="1rem" durationMs={300} />
         </div>
      </div>
    </div>
  );
}

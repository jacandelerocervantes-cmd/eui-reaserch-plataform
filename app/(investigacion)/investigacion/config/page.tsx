"use client";

import { use, useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import {
  User, Bell, Key, Database, CheckCircle2, Loader2,
  AlertCircle, ExternalLink, Eye, EyeOff, RefreshCw, Zap,
  FlaskConical, MapPin, BookOpen, Shield, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

type Profile = {
  orcid_id: string;
  lineas_investigacion: string;
  zotero_user_id: string;
  zotero_api_key: string;
  notification_prefs: {
    alertas_citas: boolean;
    alertas_informes: boolean;
    alertas_grants: boolean;
    alertas_sensor: boolean;
    alertas_calibracion: boolean;
    alertas_campo: boolean;
  };
};

const DEFAULT_PROFILE: Profile = {
  orcid_id: "",
  lineas_investigacion: "",
  zotero_user_id: "",
  zotero_api_key: "",
  notification_prefs: {
    alertas_citas: true,
    alertas_informes: true,
    alertas_grants: false,
    alertas_sensor: true,
    alertas_calibracion: true,
    alertas_campo: true,
  },
};

const NOTIFICATIONS = [
  { id: "alertas_citas", label: "Nuevas citas a mis papers", desc: "Aviso cuando OpenAlex detecte una cita nueva.", icon: BookOpen, area: "Investigación" },
  { id: "alertas_informes", label: "Recordatorios de informes de financiamiento", desc: "Avisos 15 días antes del cierre de presupuesto.", icon: AlertCircle, area: "Investigación" },
  { id: "alertas_grants", label: "Convocatorias CONAHCYT / SNI", desc: "Recomendaciones basadas en tus líneas de investigación.", icon: Zap, area: "Investigación" },
  { id: "alertas_sensor", label: "Alertas de sensores IoT", desc: "Email cuando un sensor exceda su umbral de alerta.", icon: FlaskConical, area: "Laboratorio" },
  { id: "alertas_calibracion", label: "Recordatorio de calibración de equipo", desc: "Aviso 7 días antes de que venza la calibración.", icon: RefreshCw, area: "Laboratorio" },
  { id: "alertas_campo", label: "Actualizaciones de misiones de campo", desc: "Aviso cuando se complete una sincronización de capturas.", icon: MapPin, area: "Campo" },
];

type FetchResult =
  | { ok: true; userId: string; perfil: Profile; orcidValid: boolean; zoteroValid: boolean }
  | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchPerfil(_reloadKey: number): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No se pudo identificar la sesión." };

    const { data, error } = await supabase
      .from("profiles")
      .select("orcid_id, lineas_investigacion, notification_prefs")
      .eq("id", user.id)
      .single();
    if (error) throw error;

    // zotero_user_id/zotero_api_key se leen vía API route server-side: la
    // key se guarda cifrada (AES-256-GCM) y solo el servidor tiene la clave
    // para descifrarla — ver app/api/profile/zotero-key/route.ts.
    const zoteroRes = await fetch("/api/profile/zotero-key");
    const zotero = zoteroRes.ok ? await zoteroRes.json() : { zotero_user_id: "", zotero_api_key: "" };

    const perfil: Profile = {
      orcid_id: data?.orcid_id ?? "",
      lineas_investigacion: data?.lineas_investigacion ?? "",
      zotero_user_id: zotero.zotero_user_id ?? "",
      zotero_api_key: zotero.zotero_api_key ?? "",
      notification_prefs: {
        ...DEFAULT_PROFILE.notification_prefs,
        ...(data?.notification_prefs ?? {}),
      },
    };

    return { ok: true, userId: user.id, perfil, orcidValid: !!data?.orcid_id, zoteroValid: !!zotero.zotero_api_key };
  } catch (e) {
    console.error("Error cargando perfil de investigación:", e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cargar tu perfil de investigación." };
  }
}

function ConfigInvestigacionContent({ resource, onRetry }: { resource: Promise<FetchResult>; onRetry: () => void }) {
  const result = use(resource);
  const hasMounted = useRef(false);
  const userId = result.ok ? result.userId : null;
  const [perfil, setPerfil] = useState<Profile>(result.ok ? result.perfil : DEFAULT_PROFILE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [showZoteroKey, setShowZoteroKey] = useState(false);
  const [orcidStatus, setOrcidStatus] = useState<"idle" | "checking" | "valid" | "invalid">(result.ok && result.orcidValid ? "valid" : "idle");
  const [zoteroStatus, setZoteroStatus] = useState<"idle" | "checking" | "valid" | "invalid">(result.ok && result.zoteroValid ? "valid" : "idle");

  const save = useCallback(async (updates: Partial<Profile>) => {
    if (!userId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (error) throw error;
      setLastSaved(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  }, [userId]);

  // Debounce auto-save for text fields
  useEffect(() => {
    if (!hasMounted.current) return;
    const t = setTimeout(() => {
      save({ orcid_id: perfil.orcid_id, lineas_investigacion: perfil.lineas_investigacion });
    }, 1000);
    return () => clearTimeout(t);
  }, [perfil.orcid_id, perfil.lineas_investigacion, save]);

  const saveZotero = async (updates: { zotero_user_id: string; zotero_api_key: string }) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/profile/zotero-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setLastSaved(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!hasMounted.current) return;
    const t = setTimeout(() => {
      saveZotero({ zotero_user_id: perfil.zotero_user_id, zotero_api_key: perfil.zotero_api_key });
    }, 1000);
    return () => clearTimeout(t);
  }, [perfil.zotero_user_id, perfil.zotero_api_key]);

  if (!result.ok) return (
    <div style={{ padding: "40px", maxWidth: "820px", margin: "0 auto" }}>
      <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {result.error}
        <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
      </div>
    </div>
  );

  const handleToggle = async (field: keyof Profile["notification_prefs"]) => {
    const updated = { ...perfil.notification_prefs, [field]: !perfil.notification_prefs[field] };
    setPerfil(p => ({ ...p, notification_prefs: updated }));
    await save({ notification_prefs: updated });
  };

  const validateOrcid = async () => {
    if (!perfil.orcid_id || !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(perfil.orcid_id)) {
      setOrcidStatus("invalid");
      return;
    }
    setOrcidStatus("checking");
    try {
      const res = await fetch(`https://pub.orcid.org/v3.0/${perfil.orcid_id}/record`, {
        headers: { Accept: "application/json" },
      });
      setOrcidStatus(res.ok ? "valid" : "invalid");
    } catch {
      setOrcidStatus("invalid");
    }
  };

  const validateZotero = async () => {
    if (!perfil.zotero_api_key || !perfil.zotero_user_id) {
      setZoteroStatus("invalid");
      return;
    }
    setZoteroStatus("checking");
    try {
      const res = await fetch(`https://api.zotero.org/users/${perfil.zotero_user_id}/items?limit=1`, {
        headers: { "Zotero-API-Key": perfil.zotero_api_key },
      });
      setZoteroStatus(res.ok ? "valid" : "invalid");
    } catch {
      setZoteroStatus("invalid");
    }
  };

  const statusBadge = (status: "idle" | "checking" | "valid" | "invalid") => {
    if (status === "valid") return <span style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={14} /> Conectado</span>;
    if (status === "invalid") return <span style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}><AlertCircle size={14} /> No válido</span>;
    if (status === "checking") return <span style={{ color: "#f59e0b", fontSize: "0.8rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}><Loader2 size={14} className="animate-spin" /> Verificando...</span>;
    return null;
  };

  const groupedNotifications = ["Investigación", "Laboratorio", "Campo"].map(area => ({
    area,
    items: NOTIFICATIONS.filter(n => n.area === area),
  }));

  return (
    <div style={{ padding: "40px", maxWidth: "820px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* HEADER */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>
            Mundo Dorado
          </span>
          <h1 style={{ color: "#1B396A", fontSize: "2.4rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Ajustes del Investigador</h1>
          <p style={{ color: "#64748b", fontSize: "1rem", fontWeight: "500", marginTop: "4px" }}>Perfil académico, APIs conectadas y preferencias de notificación.</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: isSaving ? "#fffbeb" : saveError ? "#fef2f2" : "#ecfdf5", padding: "10px 16px", borderRadius: "12px", border: `1px solid ${isSaving ? "#fde68a" : saveError ? "#fecaca" : "#a7f3d0"}`, transition: "all 0.3s", minWidth: "140px" }}>
          {isSaving
            ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /><span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#d97706" }}>Guardando...</span></>
            : saveError
              ? <><AlertCircle size={16} color="#ef4444" /><span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#ef4444" }}>Error</span></>
              : <><CheckCircle2 size={16} color="#10b981" /><span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#059669" }}>{lastSaved ? `Guardado ${lastSaved}` : "Sincronizado"}</span></>
          }
        </div>
      </header>

      {/* ── SECCIÓN 1: IDENTIDAD ACADÉMICA ── */}
      <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px" }}>
        <h3 style={{ color: "#1B396A", fontSize: "1.1rem", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <User size={20} color="#f59e0b" /> Identidad Académica
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* ORCID */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>ORCID ID</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {statusBadge(orcidStatus)}
                {perfil.orcid_id && (
                  <a href={`https://orcid.org/${perfil.orcid_id}`} target="_blank" rel="noreferrer" style={{ color: "#64748b", display: "flex" }}>
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={perfil.orcid_id}
                onChange={e => { setPerfil(p => ({ ...p, orcid_id: e.target.value })); setOrcidStatus("idle"); }}
                placeholder="0000-0002-XXXX-XXXX"
                style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "1rem", outline: "none", color: "#1B396A", fontWeight: "600", fontFamily: "monospace" }}
                onFocus={e => e.target.style.borderColor = "#f59e0b"} onBlur={e => { e.target.style.borderColor = "#e2e8f0"; validateOrcid(); }}
              />
              <ExpandingButton icon={Shield} label="Verificar" onClick={validateOrcid} variant="secondary" expanded size={48} radius={12} gap={6} padding="0 18px" fontWeight={700} fontSize="0.85rem" durationMs={300} />
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Usado para importar tus publicaciones y vincularlas al Radar Académico.</p>
          </div>

          {/* Líneas de investigación */}
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>LÍNEAS DE INVESTIGACIÓN</label>
            <input
              type="text"
              value={perfil.lineas_investigacion}
              onChange={e => setPerfil(p => ({ ...p, lineas_investigacion: e.target.value }))}
              placeholder="p. ej. IA, IoT, Bioinformática"
              style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "1rem", outline: "none", color: "#1B396A", fontWeight: "600", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "#f59e0b"} onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
            <p style={{ margin: "6px 0 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>El Radar y el Gap Scanner AI usan estas palabras clave para filtrar literatura relevante.</p>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2: APIs CONECTADAS ── */}
      <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ color: "#1B396A", fontSize: "1.1rem", fontWeight: "800", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <Key size={20} color="#8b5cf6" /> APIs Conectadas
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>Conecta servicios externos para potenciar las funciones del sistema. Tus claves se guardan cifradas.</p>
        </div>

        {/* Zotero */}
        <div style={{ backgroundColor: "#fafafa", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "36px", height: "36px", backgroundColor: "#cc2936", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Database size={18} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "0.95rem" }}>Zotero</div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Gestor de referencias bibliográficas</div>
              </div>
            </div>
            {statusBadge(zoteroStatus)}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>User ID</label>
              <input
                type="text"
                value={perfil.zotero_user_id}
                onChange={e => { setPerfil(p => ({ ...p, zotero_user_id: e.target.value })); setZoteroStatus("idle"); }}
                placeholder="12345678"
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#8b5cf6"} onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>API Key</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    type={showZoteroKey ? "text" : "password"}
                    value={perfil.zotero_api_key}
                    onChange={e => { setPerfil(p => ({ ...p, zotero_api_key: e.target.value })); setZoteroStatus("idle"); }}
                    placeholder="••••••••••••••••••••••••"
                    style={{ width: "100%", padding: "12px 40px 12px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "#8b5cf6"} onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                  />
                  <button onClick={() => setShowZoteroKey(s => !s)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                    {showZoteroKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <ExpandingButton icon={Shield} label="Probar" onClick={validateZotero} expanded size={44} radius={10} gap={6} padding="0 16px" fontWeight={700} fontSize="0.85rem" durationMs={300} colors={{ bg: "#f5f3ff", hoverBg: "#ede9fe", text: "#7c3aed", hoverText: "#7c3aed", border: "#8b5cf640" }} />
              </div>
            </div>
            <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "#8b5cf6", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}>
              <ExternalLink size={12} /> Obtener tu API Key en zotero.org
            </a>
          </div>
        </div>

        {/* OpenAlex / Semantic Scholar — sin key */}
        <div style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", border: "1px solid #bbf7d0", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <CheckCircle2 size={20} color="#10b981" />
          <div>
            <div style={{ fontWeight: "800", color: "#065f46", fontSize: "0.9rem" }}>OpenAlex · Semantic Scholar · CrossRef</div>
            <div style={{ fontSize: "0.75rem", color: "#059669" }}>Conectados automáticamente — no requieren API key. El Radar Académico los usa directamente.</div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 3: NOTIFICACIONES ── */}
      <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px" }}>
        <h3 style={{ color: "#1B396A", fontSize: "1.1rem", fontWeight: "800", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Bell size={20} color="#ef4444" /> Notificaciones por Módulo
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {groupedNotifications.map(group => (
            <div key={group.area}>
              <div style={{ fontSize: "0.7rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>{group.area}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {group.items.map(item => {
                  const isActive = perfil.notification_prefs[item.id as keyof Profile["notification_prefs"]];
                  const IconComp = item.icon;
                  return (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", backgroundColor: isActive ? "#f8fafc" : "transparent", borderRadius: "14px", border: `1px solid ${isActive ? "#e2e8f0" : "transparent"}`, transition: "all 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <IconComp size={16} color={isActive ? "#1B396A" : "#94a3b8"} />
                        <div>
                          <div style={{ fontSize: "0.9rem", color: "#1e293b", fontWeight: "700" }}>{item.label}</div>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "2px" }}>{item.desc}</div>
                        </div>
                      </div>
                      <div onClick={() => handleToggle(item.id as keyof Profile["notification_prefs"])} style={{ cursor: "pointer", position: "relative", flexShrink: 0 }}>
                        <div style={{ width: "48px", height: "24px", backgroundColor: isActive ? "#10b981" : "#cbd5e1", borderRadius: "50px", transition: "background-color 0.3s" }} />
                        <div style={{ position: "absolute", top: "2px", left: isActive ? "24px" : "2px", width: "20px", height: "20px", backgroundColor: "white", borderRadius: "50%", transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

export default function ConfigInvestigacion() {
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchPerfil(reloadKey), [reloadKey]);

  return (
    <Suspense fallback={<div style={{ padding: "40px", display: "flex", justifyContent: "center" }}><Loader2 className="animate-spin" size={32} color="#1B396A" /></div>}>
      <ConfigInvestigacionContent key={reloadKey} resource={resource} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}

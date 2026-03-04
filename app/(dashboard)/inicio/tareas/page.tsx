"use client";

import React, { useState, useEffect } from "react";
import { 
  CheckSquare, Plus, Star, Calendar, Trash2, 
  ListChecks, Filter, Loader2, Zap, ShieldCheck 
} from "lucide-react";
import { supabase } from "@/lib/supabase"; // Unificado con tu arquitectura

interface EnrichedTask {
  id: string;
  t: string;
  d: string;
  p: string;
  completed: boolean;
  pilar?: string;
  color?: string;
  sugerencia_tactica?: string;
}

export default function ListaPendientesIEO() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  const [lists, setLists] = useState<any[]>([]);
  const [selectedList, setSelectedList] = useState<any>(null);
  const [tasks, setTasks] = useState<EnrichedTask[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('sync-tasks', {
        body: { action: 'obtenerListasTareas' }
      });
      if (error) throw error;
      if (data?.success) {
        setLists(data.data);
        if (data.data.length > 0) {
          handleSelectList(data.data[0]);
        }
      }
    } catch (err) {
      console.error("Error al cargar listas:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectList = async (list: any) => {
    setSelectedList(list);
    setAiSummary(null); // Reset del briefing
    try {
      setLoadingTasks(true);
      const { data, error } = await supabase.functions.invoke('sync-tasks', {
        body: { 
          action: 'obtenerTareasPorLista', 
          payload: { idLista: list.id } 
        }
      });
      if (error) throw error;
      if (data?.success) {
        setTasks(data.data);
        if (data.aiSummary) setAiSummary(data.aiSummary);
      }
    } catch (err) {
      console.error("Error al cargar tareas IEO:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: "32px" }}>
      
      {/* BARRA LATERAL DE LISTAS */}
      <aside style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <button style={{ backgroundColor: "#1B396A", color: "white", padding: "14px", borderRadius: "12px", border: "none", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
          <Plus size={20} /> Nueva Lista
        </button>

        <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "10px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center" }}><Loader2 className="animate-spin" size={24} color="#1B396A" style={{ margin: "0 auto"}}/></div>
          ) : (
            lists.map(list => (
              <div 
                key={list.id} 
                onClick={() => handleSelectList(list)}
                style={{ 
                  display: "flex", justifyContent: "space-between", alignItems: "center", 
                  padding: "12px 16px", borderRadius: "10px", cursor: "pointer", 
                  transition: "all 0.2s",
                  backgroundColor: selectedList?.id === list.id ? "#f1f5f9" : "transparent"
                }} 
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: list.color || "#1B396A" }} />
                  <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "#475569" }}>{list.name}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* CONTENIDO DE TAREAS */}
      <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "900", margin: 0 }}>
            {selectedList ? selectedList.name : "Selecciona una lista"}
          </h1>
          <button style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><Filter size={20} /></button>
        </header>

        {/* BRIEFING IEO */}
        {!loadingTasks && aiSummary && (
          <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
            <ShieldCheck size={24} color="#8b5cf6" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#8b5cf6", textTransform: "uppercase", marginBottom: "2px" }}>Directiva de Operación</div>
              <div style={{ fontSize: "0.95rem", color: "#334155", fontWeight: "600" }}>{aiSummary}</div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {loadingTasks ? (
            <div style={{ padding: "60px", textAlign: "center", display: "flex", justifyContent: "center" }}>
              <Loader2 className="animate-spin" size={32} color="#1B396A" />
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No hay tareas en esta lista.</div>
          ) : (
            tasks.map((task, i) => (
              <div key={i} style={{ 
                display: "flex", alignItems: "center", justifyContent: "space-between", 
                padding: "16px", backgroundColor: "#fcfcfd", borderRadius: "16px", 
                border: "1px solid #f1f5f9",
                borderLeft: task.color ? `4px solid ${task.color}` : "4px solid transparent",
                opacity: task.completed ? 0.6 : 1
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "6px", border: "2px solid #cbd5e1", cursor: "pointer", backgroundColor: task.completed ? "#1B396A" : "transparent", marginTop: "2px" }} />
                  <div>
                    <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "0.95rem", textDecoration: task.completed ? "line-through" : "none", marginBottom: "4px" }}>
                      {task.t}
                    </div>
                    {/* Metadatos IEO */}
                    <div style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <span style={{ color: "#64748b", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                        <Calendar size={12} /> {task.d || "Sin fecha"}
                      </span>
                      {task.pilar && !task.completed && (
                        <span style={{ color: task.color, fontWeight: "800", backgroundColor: `${task.color}15`, padding: "2px 6px", borderRadius: "4px" }}>
                          {task.pilar}
                        </span>
                      )}
                      {task.sugerencia_tactica && !task.completed && (
                        <span style={{ color: "#8b5cf6", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                          <Zap size={12} /> {task.sugerencia_tactica}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{ 
                    fontSize: "0.7rem", fontWeight: "800", 
                    color: task.p === 'Alta' ? '#ef4444' : task.p === 'Media' ? '#f59e0b' : '#64748b', 
                    backgroundColor: task.p === 'Alta' ? '#fee2e2' : task.p === 'Media' ? '#fef3c7' : '#f1f5f9', 
                    padding: "4px 8px", borderRadius: "6px" 
                  }}>
                    {task.p}
                  </span>
                  <Trash2 size={18} color="#94a3b8" style={{ cursor: "pointer" }} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
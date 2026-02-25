"use client";

import React, { useState, useEffect } from "react";
import { CheckSquare, Plus, Star, Calendar, Trash2, ListChecks, Filter, Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ListaPendientes() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  const [lists, setLists] = useState<any[]>([]);
  const [selectedList, setSelectedList] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.functions.invoke('sync-tasks', {
        body: { action: 'obtenerListasTareas' }
      });
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
    try {
      setLoadingTasks(true);
      const { data } = await supabase.functions.invoke('sync-tasks', {
        body: { 
          action: 'obtenerTareasPorLista', 
          payload: { idLista: list.id } 
        }
      });
      if (data?.success) {
        setTasks(data.data);
      }
    } catch (err) {
      console.error("Error al cargar tareas:", err);
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
            <div style={{ padding: "20px", textAlign: "center" }}><Loader2 className="animate-spin" size={20} /></div>
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
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: list.color }} />
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
            {selectedList ? `Pendientes: ${selectedList.name}` : "Selecciona una lista"}
          </h1>
          <button style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><Filter size={20} /></button>
        </header>

        <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {loadingTasks ? (
            <div style={{ padding: "40px", textAlign: "center" }}><Loader2 className="animate-spin" size={32} color="#1B396A" /></div>
          ) : tasks.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No hay tareas en esta lista.</div>
          ) : (
            tasks.map((task, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "6px", border: "2px solid #cbd5e1", cursor: "pointer", backgroundColor: task.completed ? "#1B396A" : "transparent" }} />
                  <div>
                    <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.95rem", textDecoration: task.completed ? "line-through" : "none" }}>{task.t}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={12} /> {task.d}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: "800", color: task.p === 'Alta' ? '#ef4444' : '#64748b', backgroundColor: task.p === 'Alta' ? '#fee2e2' : '#f1f5f9', padding: "4px 8px", borderRadius: "6px" }}>{task.p}</span>
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
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase, signOut } from "@/lib/supabase"; 
import {
  Settings, LogOut, GraduationCap, Beaker, FlaskConical, 
  Sparkles, LayoutGrid, Mail, Calendar, CheckSquare,
  Briefcase, Library, FileSignature, Globe, Book, Microscope,
  ClipboardList, Camera, Database,
  ArrowLeft, Megaphone, Users, TrendingUp, Presentation // <-- Ajuste de iconos aquí
} from "lucide-react";
import styles from "./Sidebar.module.css";
import { FloatingCopilot } from "@/components/ia/FloatingCopilot";

export default function MasterSidebar() {
  const pathname = usePathname();
  const router = useRouter(); 
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const ICON_SIZE = 24;

  // --- ESTADOS PARA RBAC ---
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<number | null>(null);

  const getScopeFromPath = () => {
    if (pathname.startsWith("/panel")) return "DOCENCIA";
    if (pathname.startsWith("/investigacion")) return "INVESTIGACION";
    if (pathname.startsWith("/laboratorio")) return "LABORATORIO";
    if (pathname.startsWith("/campo")) return "CAMPO";
    return "CENTRO_DE_MANDO";
  };

  const currentScope = getScopeFromPath();

  useEffect(() => {
    const fetchAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role, access_level")
          .eq("id", user.id)
          .single();

        if (data) {
          setUserRole(data.role);        
          setUserLevel(data.access_level); 
        }
      }
    };
    fetchAccess();
  }, []);

  const getAuthorizedModules = () => {
    const modules = [
      { name: "Inicio", icon: <LayoutGrid size={ICON_SIZE} />, path: "/inicio", color: "#64748b" }
    ];

    if (userRole === "docente") {
      modules.push({ name: "Docencia", icon: <GraduationCap size={ICON_SIZE} />, path: "/panel", color: "#3b82f6" });
    } else if (userRole === "alumno") {
      modules.push({ name: "Mis Clases", icon: <GraduationCap size={ICON_SIZE} />, path: "/alumno", color: "#3b82f6" });
    }

    if (userRole && userLevel !== null) {
      if (userLevel <= 2) {
        modules.push({ name: "Investigación", icon: <Beaker size={ICON_SIZE} />, path: "/investigacion", color: "#f59e0b" });
      }
      if (userLevel === 1) {
        modules.push({ name: "Laboratorio", icon: <FlaskConical size={ICON_SIZE} />, path: "/laboratorio", color: "#10b981" });
        modules.push({ name: "Campo", icon: <Globe size={ICON_SIZE} />, path: "/campo", color: "#ea580c" });
      }
    }
    return modules;
  };

  const authorizedModules = getAuthorizedModules();

  const visibleModules = authorizedModules.filter(m => {
    if (m.path === "/inicio" && pathname === "/inicio") return false;
    return true;
  });

  const getContextualTools = () => {
    // --- LÓGICA PARA DOCENCIA ---
    if (pathname.startsWith("/panel/materias/")) {
      const parts = pathname.split("/"); 
      const materiaId = parts[3]; 

      if (materiaId) {
        return [
          { name: "Volver", icon: <ArrowLeft size={20} />, path: "/panel" },
          { name: "Tablón", icon: <Megaphone size={20} />, path: `/panel/materias/${materiaId}` },
          { name: "Alumnos", icon: <Users size={20} />, path: `/panel/materias/${materiaId}/alumnos` },
          { name: "Actividades", icon: <ClipboardList size={20} />, path: `/panel/materias/${materiaId}/actividades` },
          { name: "Calificaciones", icon: <TrendingUp size={20} />, path: `/panel/materias/${materiaId}/calificaciones` },
          // AQUI EL CAMBIO: Se renombra a "Material de Clase" y se usa Presentation
          { name: "Material de Clase", icon: <Presentation size={20} />, path: `/panel/materias/${materiaId}/drive` },
        ];
      }
    }

    // --- LÓGICA RESTANTE ---
    if (pathname.startsWith("/inicio")) {
      return [
        { name: "Correo", icon: <Mail size={20} />, path: "/inicio/correo" },
        { name: "Agenda", icon: <Calendar size={20} />, path: "/inicio/agenda" },
        { name: "Tareas", icon: <CheckSquare size={20} />, path: "/inicio/tareas" },
      ];
    }
    if (pathname.startsWith("/alumno")) {
      return [
        { name: "Materias", icon: <Book size={20} />, path: "/alumno" },
        { name: "Misiones", icon: <ClipboardList size={20} />, path: "/alumno/misiones" },
        { name: "Mensajes", icon: <Mail size={20} />, path: "/alumno/comunicacion" },
      ];
    }
    if (pathname.startsWith("/investigacion")) {
      return [
        { name: "Proyectos", icon: <Briefcase size={20} />, path: "/investigacion/proyectos" },
        { name: "Exp. Literario", icon: <Library size={20} />, path: "/investigacion/literatura" },
        { name: "Canvas AI", icon: <FileSignature size={20} />, path: "/investigacion/canvas" },
      ];
    }
    if (pathname.startsWith("/laboratorio")) {
      return [
        { name: "Bitácora", icon: <Book size={20} />, path: "/laboratorio/bitacora" },
        { name: "Estación Control", icon: <Microscope size={20} />, path: "/laboratorio/laboratorio" },
      ];
    }
    if (pathname.startsWith("/campo")) {
      return [
        { name: "Misiones", icon: <ClipboardList size={20} />, path: "/campo" },
        { name: "Captura GPS", icon: <Camera size={20} />, path: "/campo/captura" },
        { name: "Bóveda Local", icon: <Database size={20} />, path: "/campo/sincronizar" },
      ];
    }
    return [];
  };

  const currentTools = getContextualTools();
  
  const activeColor = authorizedModules.find(m => pathname.startsWith(m.path))?.color || "#64748b";

  const handleLogout = async () => {
    try {
      await signOut(); 
      router.push("/login"); 
      router.refresh(); 
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.scrollContainer}>
        <nav className={styles.nav}>
          
          {visibleModules.map((module, index) => {
            const isActive = pathname.startsWith(module.path);
            return (
              <Link 
                key={index} 
                href={module.path} 
                className={`${styles.itemWrapper} ${isActive ? styles.active : ""}`}
                title={module.name}
              >
                <div 
                  className={styles.icon} 
                  style={{ 
                    color: isActive ? "white" : "#1B396A",
                    backgroundColor: isActive ? module.color : "white"
                  }}
                >
                  {module.icon}
                </div>
                <span className={styles.label}>{module.name}</span>
                {isActive && (
                  <div style={{ 
                    position: 'absolute', left: 0, width: '4px', height: '24px', 
                    backgroundColor: module.color, borderRadius: '0 4px 4px 0' 
                  }} />
                )}
              </Link>
            );
          })}

          <div className={styles.separator} />

          {currentTools.map((tool, index) => {
            const isToolActive = pathname === tool.path;
            return (
              <Link key={index} href={tool.path} className={styles.itemWrapper} title={tool.name}>
                <div className={styles.icon} style={{ 
                  opacity: isToolActive ? 1 : 0.6,
                  transform: isToolActive ? 'scale(1.1)' : 'scale(1)',
                  border: isToolActive ? `2px solid ${activeColor}` : 'none'
                }}>
                  {tool.icon}
                </div>
                <span className={styles.label} style={{ fontWeight: tool.name === "Volver" ? "bold" : "normal" }}>
                  {tool.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.footer}>
        <div className={styles.separator} />
        
        <div className={styles.aiSection}>
          <button 
            className={`${styles.itemWrapper} ${styles.aiWrapper} ${isCopilotOpen ? styles.aiActive : ""}`} 
            onClick={() => setIsCopilotOpen(!isCopilotOpen)}
            style={{ borderLeft: isCopilotOpen ? `4px solid ${activeColor}` : 'none' }}
          >
            <div className={`${styles.icon} ${styles.aiIcon}`} style={{ backgroundColor: isCopilotOpen ? activeColor : 'transparent' }}>
              <Sparkles size={ICON_SIZE} color={isCopilotOpen ? "white" : "#7C3AED"} />
            </div>
            <span className={styles.label} style={{ fontWeight: isCopilotOpen ? 'bold' : 'normal' }}>Control Maestro</span>
          </button>
          
          {isCopilotOpen && (
            <div className={styles.floatingContainer}>
               <FloatingCopilot scope={currentScope} forceOpen={true} onClose={() => setIsCopilotOpen(false)} />
            </div>
          )}
        </div>

        <Link href="/configuracion" className={styles.itemWrapper} title="Ajustes">
          <div className={styles.icon}><Settings size={ICON_SIZE} /></div>
          <span className={styles.label}>Ajustes</span>
        </Link>

        <button onClick={handleLogout} className={styles.itemWrapper} style={{ background: "none", border: "none", cursor: "pointer", marginTop: '0.8rem' }}>
          <div className={styles.icon}><LogOut size={ICON_SIZE} /></div>
          <span className={styles.label}>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
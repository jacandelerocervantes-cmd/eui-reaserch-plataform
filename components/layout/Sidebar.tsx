"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings, LogOut, GraduationCap, Beaker, FlaskConical, 
  Sparkles, LayoutGrid, Mail, Calendar, CheckSquare,
  Briefcase, Library, FileSignature, Globe, Book, Microscope
} from "lucide-react";
import styles from "./Sidebar.module.css";
import { FloatingCopilot } from "@/components/ia/FloatingCopilot";

export default function MasterSidebar() {
  const pathname = usePathname();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const ICON_SIZE = 24;

  // 1. LOS 4 PILARES (Siempre visibles arriba)
  const mainModules = [
    { name: "Inicio", icon: <LayoutGrid size={ICON_SIZE} />, path: "/inicio", color: "#64748b" },
    { name: "Docencia", icon: <GraduationCap size={ICON_SIZE} />, path: "/panel", color: "#3b82f6" },
    { name: "Investigación", icon: <Beaker size={ICON_SIZE} />, path: "/investigacion", color: "#f59e0b" },
    { name: "Laboratorio", icon: <FlaskConical size={ICON_SIZE} />, path: "/laboratorio", color: "#10b981" },
  ];

  // 2. HERRAMIENTAS DINÁMICAS (Cambian según el módulo activo)
  const getContextualTools = () => {
    if (pathname.startsWith("/inicio")) {
      return [
        { name: "Correo", icon: <Mail size={20} />, path: "/inicio/correo" },
        { name: "Agenda", icon: <Calendar size={20} />, path: "/inicio/agenda" },
        { name: "Tareas", icon: <CheckSquare size={20} />, path: "/inicio/tareas" },
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
    return [];
  };

  const currentTools = getContextualTools();
  const activeModule = mainModules.find(m => pathname.startsWith(m.path)) || mainModules[0];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.scrollContainer}>
        <nav className={styles.nav}>
          
          {/* SECCIÓN 1: LOS 4 MUNDOS */}
          {mainModules.map((module, index) => {
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

          {/* SECCIÓN 2: HERRAMIENTAS DINÁMICAS */}
          {currentTools.map((tool, index) => {
            const isToolActive = pathname === tool.path;
            return (
              <Link key={index} href={tool.path} className={styles.itemWrapper} title={tool.name}>
                <div className={styles.icon} style={{ 
                  opacity: isToolActive ? 1 : 0.6,
                  transform: isToolActive ? 'scale(1.1)' : 'scale(1)',
                  border: isToolActive ? `2px solid ${activeModule.color}` : 'none'
                }}>
                  {tool.icon}
                </div>
                <span className={styles.label}>{tool.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* SECCIÓN 2: FOOTER (CONFIG Y AI) */}
      <div className={styles.footer}>
        <div className={styles.separator} />
        
        <div className={styles.aiSection}>
          <button 
            className={`${styles.itemWrapper} ${styles.aiWrapper}`} 
            onClick={() => setIsCopilotOpen(!isCopilotOpen)}
          >
            <div className={`${styles.icon} ${styles.aiIcon}`}>
              <Sparkles size={ICON_SIZE} />
            </div>
            <span className={styles.label}>Control Maestro</span>
          </button>
          
          {isCopilotOpen && (
            <div className={styles.floatingContainer}>
               <FloatingCopilot forceOpen={true} onClose={() => setIsCopilotOpen(false)} />
            </div>
          )}
        </div>

        <Link href="/configuracion" className={styles.itemWrapper} title="Ajustes">
          <div className={styles.icon}><Settings size={ICON_SIZE} /></div>
          <span className={styles.label}>Ajustes</span>
        </Link>

        <button className={styles.itemWrapper} style={{ background: "none", border: "none", cursor: "pointer", marginTop: '0.8rem' }}>
          <div className={styles.icon}><LogOut size={ICON_SIZE} /></div>
          <span className={styles.label}>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase, signOut } from "@/lib/supabase"; 
import {
  Settings, LogOut, LayoutDashboard, School, Telescope, TestTubeDiagonal,
  Map, Sparkles, MessageSquareShare, Users, NotebookPen, LineChart,
  Cloud, ArrowLeft, UserCheck, History, Contact,
  ClipboardCheck, MonitorPlay, BookOpen, UsersRound
} from "lucide-react";
import styles from "./Sidebar.module.css";
import { FloatingCopilot } from "@/components/ia/FloatingCopilot";

export default function MasterSidebar() {
  const pathname = usePathname();
  const router = useRouter(); 
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const ICON_SIZE = 24;

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

  // --- 1. MÓDULOS GLOBALES (BLOQUE INFERIOR) ---
  const getGlobalModules = () => {
    const modules = [
      { name: "Inicio", icon: <LayoutDashboard size={ICON_SIZE} />, path: "/inicio", color: "#64748b", rootMatch: "/inicio" }
    ];

    if (userRole === "docente") {
      modules.push({ name: "Docencia", icon: <School size={ICON_SIZE} />, path: "/panel", color: "#3b82f6", rootMatch: "/panel" });
    } else if (userRole === "alumno") {
      modules.push({ name: "Mis Clases", icon: <School size={ICON_SIZE} />, path: "/alumno", color: "#3b82f6", rootMatch: "/alumno" });
    }

    if (userRole && userLevel !== null) {
      if (userLevel <= 2) {
        modules.push({ name: "Investigación", icon: <Telescope size={ICON_SIZE} />, path: "/investigacion", color: "#f59e0b", rootMatch: "/investigacion" });
      }
      if (userLevel === 1) {
        modules.push({ name: "Laboratorio", icon: <TestTubeDiagonal size={ICON_SIZE} />, path: "/laboratorio", color: "#10b981", rootMatch: "/laboratorio" });
        modules.push({ name: "Campo", icon: <Map size={ICON_SIZE} />, path: "/campo", color: "#ea580c", rootMatch: "/campo" });
      }
    }
    return modules;
  };

  // --- 2. MOTOR DE CONTEXTO ESTRICTO (BLOQUE SUPERIOR) ---
  const getContextualNavigation = () => {
    const parts = pathname.split("/").filter(Boolean);
    let backButton = null;
    let localTools: { name: string, icon: React.ReactNode, path: string }[] = [];

    // LÓGICA PARA DOCENCIA
    if (parts[0] === "panel" && parts[1] === "materias" && parts[2]) {
      const materiaId = parts[2];
      const subModule = parts[3]; 

      // NIVEL: Dentro de la Materia (Raíz)
      if (!subModule) {
        backButton = { name: "Volver a Materias", path: "/panel", icon: <ArrowLeft size={20} /> };
        localTools = [
          { name: "Tablón", icon: <MessageSquareShare size={20} />, path: `/panel/materias/${materiaId}` },
          { name: "Alumnos", icon: <Users size={20} />, path: `/panel/materias/${materiaId}/alumnos` },
          { name: "Actividades", icon: <NotebookPen size={20} />, path: `/panel/materias/${materiaId}/actividades` },
          { name: "Evaluaciones", icon: <ClipboardCheck size={20} />, path: `/panel/materias/${materiaId}/evaluaciones` },
          { name: "Calificaciones", icon: <LineChart size={20} />, path: `/panel/materias/${materiaId}/calificaciones` },
          { name: "Unidades", icon: <BookOpen size={20} />, path: `/panel/materias/${materiaId}/unidades` },
          { name: "Material Drive", icon: <Cloud size={20} />, path: `/panel/materias/${materiaId}/drive` },
        ];
      } 
      // NIVEL: Sección Alumnos / Asistencia
      else if (subModule === "alumnos") {
        backButton = { name: "Volver a la Clase", path: `/panel/materias/${materiaId}`, icon: <ArrowLeft size={20} /> };
        localTools = [
          { name: "Lista de Grupo", icon: <Contact size={20} />, path: `/panel/materias/${materiaId}/alumnos` },
          { name: "Equipos", icon: <UsersRound size={20} />, path: `/panel/materias/${materiaId}/alumnos/equipos` },
          { name: "Pase de Lista", icon: <UserCheck size={20} />, path: `/panel/materias/${materiaId}/alumnos/asistencia` },
          { name: "Historial", icon: <History size={20} />, path: `/panel/materias/${materiaId}/alumnos/historial` },
        ];
      }
      // NIVEL: Sección Actividades
      else if (subModule === "actividades") {
        backButton = { name: "Volver a la Clase", path: `/panel/materias/${materiaId}`, icon: <ArrowLeft size={20} /> };
        localTools = [
          { name: "Actividades", icon: <NotebookPen size={20} />, path: `/panel/materias/${materiaId}/actividades` },
        ];
      }
      // NIVEL: Sección Evaluaciones
      // "Crear con IA" ya no tiene entrada directa aquí: para eso está el
      // Master Copilot. La página evaluaciones/nuevo sigue accesible desde
      // el botón "Crear Examen" dentro de la propia lista de Exámenes.
      else if (subModule === "evaluaciones") {
        backButton = { name: "Volver a la Clase", path: `/panel/materias/${materiaId}`, icon: <ArrowLeft size={20} /> };
        localTools = [
          { name: "Exámenes", icon: <ClipboardCheck size={20} />, path: `/panel/materias/${materiaId}/evaluaciones` },
          { name: "Simulador", icon: <MonitorPlay size={20} />, path: `/panel/materias/${materiaId}/evaluaciones/simulacion` }
        ];
      }
      // NIVEL: Sección Material Drive (Bóveda)
      // "crear-ia" ya no tiene entrada directa aquí: es el modo detallado del
      // Master Copilot flotante (botón de expandir dentro del chat).
      else if (subModule === "drive" || subModule === "crear-ia") {
        backButton = { name: "Volver a la Clase", path: `/panel/materias/${materiaId}`, icon: <ArrowLeft size={20} /> };
        localTools = [
          { name: "Material", icon: <Cloud size={20} />, path: `/panel/materias/${materiaId}/drive` },
        ];
      }
      // NIVEL: Secciones sin sub-navegación propia (unidades, calificaciones…)
      else {
        backButton = { name: "Volver a la Clase", path: `/panel/materias/${materiaId}`, icon: <ArrowLeft size={20} /> };
      }
    }

    // Regla "Anti-Espejo": Si ya estás en la ruta exacta, ocultamos ese botón específico
    const filteredTools = localTools.filter(tool => tool.path !== pathname);

    return { backButton, localTools: filteredTools };
  };

  const globalModules = getGlobalModules();
  // Regla "Anti-Espejo Global": Ocultar el módulo raíz si ya estamos dentro de su rama
  const visibleGlobalModules = globalModules.filter(m => !pathname.startsWith(m.rootMatch));
  const { backButton, localTools } = getContextualNavigation();
  const activeColor = globalModules.find(m => pathname.startsWith(m.rootMatch))?.color || "#64748b";

  const handleLogout = async () => {
    try { await signOut(); router.push("/login"); router.refresh(); } 
    catch (error) { console.error("Error logout:", error); }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.scrollContainer}>
        <nav className={styles.nav}>
          
          {/* BLOQUE CONTEXTUAL (CONTEXTO ACTUAL) */}
          {backButton && (
            <Link href={backButton.path} className={styles.itemWrapper} title={backButton.name}>
              <div className={styles.icon} style={{ backgroundColor: "#f1f5f9", border: `1.5px solid ${activeColor}` }}>
                {backButton.icon}
              </div>
              <span className={styles.label} style={{ fontWeight: "bold" }}>{backButton.name}</span>
            </Link>
          )}

          {localTools.map((tool, index) => (
            <Link key={`local-${index}`} href={tool.path} className={styles.itemWrapper} title={tool.name}>
              <div className={styles.icon} style={{ color: activeColor }}>
                {tool.icon}
              </div>
              <span className={styles.label}>{tool.name}</span>
            </Link>
          ))}

          {(backButton || localTools.length > 0) && <div className={styles.separator} />}

          {/* BLOQUE GLOBAL (ACCESO A OTROS MÓDULOS) */}
          {visibleGlobalModules.map((module, index) => (
            <Link key={`global-${index}`} href={module.path} className={styles.itemWrapper} title={module.name}>
              <div className={styles.icon} style={{ color: "#64748b", opacity: 0.8 }}>
                {module.icon}
              </div>
              <span className={styles.label}>{module.name}</span>
            </Link>
          ))}

        </nav>
      </div>

      {/* FOOTER (SISTEMA E IA) */}
      <div className={styles.footer}>
        <div className={styles.separator} />
        
        <div className={styles.aiSection}>
          <button className={`${styles.itemWrapper} ${styles.aiWrapper}`} onClick={() => setIsCopilotOpen(!isCopilotOpen)}>
            <div className={`${styles.icon} ${styles.aiIcon}`}><Sparkles size={ICON_SIZE} /></div>
            <span className={styles.label} style={{ fontWeight: 'bold' }}>Control Maestro AI</span>
          </button>
          
          {isCopilotOpen && (
            <div className={styles.floatingContainer}>
               <FloatingCopilot scope={currentScope} forceOpen={true} onClose={() => setIsCopilotOpen(false)} />
            </div>
          )}
        </div>

        <Link href="/configuracion" className={styles.itemWrapper} title="Ajustes">
          <div className={styles.icon} style={{ color: "#64748b" }}><Settings size={ICON_SIZE} /></div>
          <span className={styles.label}>Ajustes</span>
        </Link>

        <button onClick={handleLogout} className={styles.itemWrapper} style={{ background: "none", border: "none", cursor: "pointer", marginTop: '0.8rem' }}>
          <div className={styles.icon} style={{ color: "#ef4444" }}><LogOut size={ICON_SIZE} /></div>
          <span className={styles.label}>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
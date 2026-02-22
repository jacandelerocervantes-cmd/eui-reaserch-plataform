"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Settings, LogOut, ArrowLeft, LayoutDashboard,
  Folder, Users, FileText, ClipboardList,
  QrCode, UsersRound, Target, Home
} from "lucide-react";
import styles from "./Sidebar.module.css";

interface MenuItem {
  name: string;
  icon: React.ReactNode;
  path: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const pathParts = pathname.split('/').filter(Boolean);

  const isRoot = pathname === "/panel";
  const courseId = pathParts[2]; // panel/materias/[id]
  const section = pathParts[3];  // panel/materias/[id]/evaluaciones

  const ICON_SIZE = 24;

  const tools = {
    home: { name: "Mis Materias", icon: <Home size={ICON_SIZE} />, path: "/panel" },
    config: { name: "Configuración", icon: <Settings size={ICON_SIZE} />, path: "/panel/config" },
    tablon: { name: "Tablón", icon: <LayoutDashboard size={ICON_SIZE} />, path: `/panel/materias/${courseId}` },
    alumnos: { name: "Alumnos", icon: <Users size={ICON_SIZE} />, path: `/panel/materias/${courseId}/alumnos` },
    calificaciones: { name: "Calificaciones", icon: <Target size={ICON_SIZE} />, path: `/panel/materias/${courseId}/calificaciones` },
    actividades: { name: "Actividades", icon: <ClipboardList size={ICON_SIZE} />, path: `/panel/materias/${courseId}/actividades` },
    evaluaciones: { name: "Evaluaciones", icon: <FileText size={ICON_SIZE} />, path: `/panel/materias/${courseId}/evaluaciones` },
    drive: { name: "Drive", icon: <Folder size={ICON_SIZE} />, path: `/panel/materias/${courseId}/drive` },
    qr: { name: "Pase de Lista QR", icon: <QrCode size={ICON_SIZE} />, path: `/panel/materias/${courseId}/alumnos/asistencia` },
    listaAlumnos: { name: "Lista de Alumnos", icon: <UsersRound size={ICON_SIZE} />, path: `/panel/materias/${courseId}/alumnos` }
  };

  const handleBack = () => {
    if (pathParts.length > 1) {
      const backPath = "/" + pathParts.slice(0, -1).join("/");
      router.push(backPath);
    }
  };

  const getDynamicMenu = (): MenuItem[] => {
    if (isRoot) return [tools.config];
    let menu: MenuItem[] = [];

    // --- LÓGICA DINÁMICA POR SECCIÓN ---
    if (section === "alumnos") {
      menu = [tools.qr, tools.listaAlumnos, tools.tablon, tools.calificaciones, tools.evaluaciones];
    } else if (section === "calificaciones") {
      menu = [tools.tablon, tools.alumnos, tools.actividades, tools.evaluaciones];
    } else if (section === "evaluaciones") {
      // Cuando estamos en Evaluaciones, mostramos el resto de herramientas
      menu = [tools.tablon, tools.alumnos, tools.calificaciones, tools.actividades, tools.drive];
    } else if (section === "actividades") {
       menu = [tools.tablon, tools.alumnos, tools.calificaciones, tools.evaluaciones, tools.drive];
    } else if (courseId) {
      // Vista general de la materia (Tablón)
      menu = [tools.alumnos, tools.calificaciones, tools.actividades, tools.evaluaciones, tools.drive];
    }

    // Filtramos para no mostrar el link de la página donde ya estamos
    return menu.filter(item => item.path !== pathname);
  };

  return (
    <aside className={styles.sidebar}>
      {!isRoot && (
        <div className={styles.fixedTop}>
          <Link href="/panel" className={styles.itemWrapper}>
            <div className={styles.icon}>{tools.home.icon}</div>
            <span className={styles.label}>{tools.home.name}</span>
          </Link>
          <button onClick={handleBack} className={styles.itemWrapper} style={{background: 'none', border: 'none', cursor: 'pointer'}}>
            <div className={styles.icon}><ArrowLeft size={ICON_SIZE} /></div>
            <span className={styles.label}>Atrás</span>
          </button>
          <div className={styles.separator} />
        </div>
      )}

      <div className={styles.scrollContainer}>
        <nav className={styles.nav}>
          {getDynamicMenu().map((item, index) => (
            <Link key={index} href={item.path} className={styles.itemWrapper}>
              <div className={styles.icon}>{item.icon}</div>
              <span className={styles.label}>{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.footer}>
        <div className={styles.separator} />
        <button className={styles.itemWrapper} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <div className={styles.icon}><LogOut size={ICON_SIZE} /></div>
          <span className={styles.label}>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
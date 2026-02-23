// app/alumno/layout.tsx
import React from 'react';
import { BookOpen, Map, TestTube, FileText, MessageSquare, LayoutDashboard } from 'lucide-react';

export default function AlumnoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#f8fafc]">
      {/* MASTER SIDEBAR */}
      <aside className="w-24 bg-[#1B396A] flex flex-col items-center py-8 shadow-2xl transition-all duration-300 hover:w-64 group z-50 overflow-hidden">
        <div className="text-white font-black text-2xl mb-12 tracking-tighter">
          <span className="group-hover:hidden">T</span>
          <span className="hidden group-hover:block whitespace-nowrap">TecNM Panel</span>
        </div>

        <nav className="flex flex-col gap-6 w-full px-4">
          {/* Módulo Base: Docencia (Azul) */}
          <SidebarItem icon={<LayoutDashboard />} label="Hub Global" color="bg-blue-500" active />
          
          {/* El Nuevo Módulo: Comunicación Interna */}
          <SidebarItem icon={<MessageSquare />} label="Comunidad" color="bg-indigo-500" badge="2" />

          <div className="w-full h-px bg-white/20 my-4"></div>

          {/* Accesos a la Trinidad (Solo visibles si hay invitación) */}
          <div className="hidden group-hover:block text-xs font-bold text-white/50 uppercase px-4 mb-2 tracking-wider">
            Misiones Activas
          </div>
          <SidebarItem icon={<FileText />} label="Investigación" color="bg-[#eab308]" /> {/* Dorado */}
          <SidebarItem icon={<TestTube />} label="Laboratorio" color="bg-[#10b981]" /> {/* Esmeralda */}
          <SidebarItem icon={<Map />} label="Campo" color="bg-[#ea580c]" /> {/* Terracota */}
        </nav>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto p-10">
        {children}
      </main>
    </div>
  );
}

// Subcomponente para los ítems del menú
interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  active?: boolean;
  badge?: string | number | null;
}

const SidebarItem = ({ icon, label, color, active = false, badge = null }: SidebarItemProps) => (
  <button className={`relative flex items-center p-3 rounded-[14px] transition-all w-full
    ${active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
    <div className={`p-2 rounded-xl ${active ? color : 'bg-transparent'} transition-colors`}>
      {icon}
    </div>
    <span className="ml-4 font-bold whitespace-nowrap hidden group-hover:block">{label}</span>
    {badge && (
      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full hidden group-hover:block">
        {badge}
      </span>
    )}
  </button>
);
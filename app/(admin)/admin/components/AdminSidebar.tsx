'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, GraduationCap, RotateCcw, LogOut } from 'lucide-react';
import { signOut } from '@/lib/supabase';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Estado General', href: '/admin' },
  { icon: Users,           label: 'Docentes',       href: '/admin/docentes' },
  { icon: GraduationCap,   label: 'Alumnos',        href: '/admin/alumnos' },
  { icon: RotateCcw,       label: 'Reversiones',    href: '/admin/reversiones' },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-24 bg-[#0f172a] flex flex-col items-center py-8 shadow-2xl transition-all duration-300 hover:w-64 group z-50 overflow-hidden flex-shrink-0">
      <div className="text-white font-black text-2xl mb-12 tracking-tighter">
        <span className="group-hover:hidden">A</span>
        <span className="hidden group-hover:block whitespace-nowrap">Control Maestro</span>
      </div>

      <nav className="flex flex-col gap-6 w-full px-4 flex-1">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center p-3 rounded-[14px] transition-all w-full no-underline
                ${isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`p-2 rounded-xl ${isActive ? 'bg-amber-500' : 'bg-transparent'} transition-colors`}>
                <Icon size={22} />
              </div>
              <span className="ml-4 font-bold whitespace-nowrap hidden group-hover:block">{label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={signOut}
        className="flex items-center p-3 rounded-[14px] transition-all w-[calc(100%-32px)] text-white/50 hover:bg-white/5 hover:text-white mx-4 mt-4"
      >
        <div className="p-2 rounded-xl bg-transparent">
          <LogOut size={22} />
        </div>
        <span className="ml-4 font-bold whitespace-nowrap hidden group-hover:block">Cerrar Sesión</span>
      </button>
    </aside>
  );
}

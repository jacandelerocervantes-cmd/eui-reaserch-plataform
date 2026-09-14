export type Mision = { id: string; titulo: string; descripcion: string | null; objetivo: string | null; latitud: number | null; longitud: number | null; radio_metros: number; fecha_inicio: string | null; fecha_fin: string | null; status: 'planificada' | 'activa' | 'completada' | 'cancelada' };

export type MisionForm = { titulo: string; descripcion: string; objetivo: string; latitud: string; longitud: string; radio_metros: string; fecha_inicio: string; fecha_fin: string };
export type MisionPayload = Omit<MisionForm, 'latitud' | 'longitud' | 'radio_metros' | 'fecha_inicio' | 'fecha_fin' | 'descripcion' | 'objetivo'> & {
  latitud: number | null; longitud: number | null; radio_metros: number; fecha_inicio: string | null; fecha_fin: string | null;
  descripcion: string | null; objetivo: string | null; status: string; campos_requeridos: unknown[];
};

export const STATUS_COLOR: Record<string, string> = { planificada: '#3b82f6', activa: '#10b981', completada: '#94a3b8', cancelada: '#ef4444' };
export const STATUS_BG: Record<string, string> = { planificada: '#eff6ff', activa: '#ecfdf5', completada: '#f8fafc', cancelada: '#fef2f2' };

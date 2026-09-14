export type Fondo = { id: string; nombre: string; tipo: 'entrada' | 'gasto'; monto_total: number; fecha_inicio: string | null; fecha_fin: string | null; fuente: string | null; descripcion: string | null };
export type Report = { resumen_ejecutivo: string; alertas: string[]; recomendaciones: string[]; proyeccion: string; burn_rate_mensual: number };

export type FondoForm = { nombre: string; tipo: string; monto_total: string; fuente: string; fecha_inicio: string; fecha_fin: string; descripcion: string };
export type FondoPayload = Omit<FondoForm, 'monto_total' | 'fuente' | 'fecha_inicio' | 'fecha_fin' | 'descripcion'> & {
  monto_total: number; fuente: string | null; fecha_inicio: string | null; fecha_fin: string | null; descripcion: string | null;
};
